// Wake: light cycles with the pack's ships. Four ships cross a grid, each
// leaving an ion wake behind it; touch any wake, a rock or the edge and you are
// out. Be the last one flying to clear the arena. Ships turn only at right
// angles, so each flies on frame 0, 9, 18 or 27. Once a round you can jump
// (Space): three cells straight ahead, over whatever is in between, leaving a
// gap in your wake that anyone may use.
import { loadShip, drawShip, frameRect, loadImage, PACK_BASE } from "../../lib/yodacon-ship-pack.js";
import { play as sound, isMuted, setMuted } from "../../lib/yodacon-sound.js";

let touched = false;
for (const ev of ["pointerdown", "keydown"]) addEventListener(ev, () => { touched = true; }, { once: true, capture: true });
const play = (name) => { if (touched && state.phase !== "pick") sound(name); };   // the demo behind the pick screen is silent

const $ = (id) => document.getElementById(id);
const canvas = $("screen"), ctx = canvas.getContext("2d");
const COLS = 64, ROWS = 44, CELL = 12, W = COLS * CELL, H = ROWS * CELL, SAVE = "wake-v1", LENGTH = 24, JUMP = 3;
const ROCK = 250, WALL = 251;
const DIRS = { up: [0, -1, 0], right: [1, 0, 90], down: [0, 1, 180], left: [-1, 0, 270] };
const LEFT_OF = { up: "left", left: "down", down: "right", right: "up" }, RIGHT_OF = { up: "right", right: "down", down: "left", left: "up" };
const COLORS = ["#7ef0a8", "#ff7a59", "#6bc6ff", "#ffcf6b"];

// Your ship, and the five arenas: each with three rivals, so every hull in
// the pack flies somewhere (the Large Pin the only Pin). Speeds in cells a
// second; `look` is how much open space the rivals count ahead, `wander` how
// often they turn on a whim, `bold` how often they cut across you, `jumps`
// whether they have a jump too.
const HULLS = [["conex", "yodacon"], ["conex", "gryphon"], ["konex", "citrus"], ["conex", "defender"], ["konex", "advisor"], ["override", "callisto"]];
const ARENAS = [
  { name: "Open Grid", speed: 10, look: 8, wander: 0.08, bold: 0, jumps: false, rivals: [["conex", "dart"], ["conex", "trident"], ["konex", "citrus"]] },
  { name: "Asteroid Field", speed: 11, look: 20, wander: 0.05, bold: 0.1, jumps: false, rocks: 70, rivals: [["conex", "necromancer"], ["conex", "defender"], ["konex", "advisor"]] },
  { name: "Four Planets", speed: 12, look: 80, wander: 0.02, bold: 0.2, jumps: false, planets: [["gas", 16, 11], ["ice", 48, 11], ["lava", 16, 33], ["garden", 48, 33]],
    rivals: [["conex", "tomaquad"], ["conex", "gryphon"], ["conex", "large-pin"]] },
  { name: "Closing Ring", speed: 12, look: 200, bold: 0.35, jumps: true, shrink: 3.5, rivals: [["override", "callisto"], ["conex", "dart"], ["conex", "necromancer"]] },
  { name: "Override Run", speed: 14, look: 400, bold: 0.5, jumps: true, rocks: 40, rivals: [["override", "yodacon"], ["override", "callisto"], ["conex", "tomaquad"]] },
];
const STARTS = [[8, 22, "right"], [55, 22, "left"], [32, 6, "down"], [32, 37, "up"]];

const state = { phase: "loading", pick: 0, arena: 0, lives: 3, score: 0, riders: [], grid: new Uint8Array(COLS * ROWS), clock: 0,
  t: 0, ring: 0, ringIn: 0, sparks: [], wins: {} };
let hulls = [], art = {}, planetArt = {};
const at = (x, y) => (x < 0 || y < 0 || x >= COLS || y >= ROWS ? WALL : state.grid[y * COLS + x]);
const put = (x, y, v) => { if (x >= 0 && y >= 0 && x < COLS && y < ROWS) state.grid[y * COLS + x] = v; };

function load() { try { return JSON.parse(localStorage.getItem(SAVE)) ?? {}; } catch { return {}; } }
function save(d) { try { localStorage.setItem(SAVE, JSON.stringify(d)); } catch { /* not kept */ } }

// A hull's length on frame 0, read from the sprite's alpha, so every ship
// is drawn about the same length on the grid.
function hullLength(ship) {
  const r = frameRect(ship, 0), c = new OffscreenCanvas(r.w, r.h), g = c.getContext("2d");
  g.drawImage(ship.sheet, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
  const a = g.getImageData(0, 0, r.w, r.h).data;
  let lo = r.h, hi = 0;
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) if (a[(y * r.w + x) * 4 + 3] > 40) { lo = Math.min(lo, y); hi = Math.max(hi, y); }
  return hi - lo + 1;
}
const nameOf = (ed, slug) => (ed === "override" && slug === "yodacon" ? "1998 Yodacon" : art[`${ed}/${slug}`].name);

// --- Rounds --------------------------------------------------------------------------------------

function newGame(pick = state.pick) {
  Object.assign(state, { pick, arena: 0, lives: 3, score: 0, auto: null });
  $("pick").hidden = true;
  startRound();
}

function startRound(demo = false) {
  const a = ARENAS[state.arena];
  state.grid.fill(0);
  if (a.rocks) scatterRocks(a.rocks);
  for (const [type, cx, cy] of a.planets ?? []) for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) if (x * x + y * y <= 18) put(cx + x, cy + y, ROCK);
  const crew = [HULLS[state.pick], ...a.rivals];
  state.riders = crew.map(([ed, slug], i) => {
    const [x, y, dir] = STARTS[i], ship = art[`${ed}/${slug}`];
    put(x, y, i + 1);
    return { i, ship, name: i ? nameOf(ed, slug) : hulls[state.pick].name, scale: LENGTH / ship.len, x, y, px: x, py: y, dir, next: dir,
      alive: true, queue: [], jump: i === 0 || a.jumps, trail: [[[x, y]]], color: COLORS[i], cells: 0 };
  });
  Object.assign(state, { phase: demo ? "pick" : "ready", clock: 0, ring: 0, ringIn: a.shrink ?? 0, sparks: [], readyIn: 1.6 });
  if (demo) return;
  banner(`${state.arena + 1}. ${a.name}`, `Against the ${state.riders.slice(1).map((r) => r.name).join(", ")}.` +
    (a.jumps ? " They can jump too." : "") + (a.shrink ? " The ring closes in." : ""), 0);
}

// Rocks come in small clumps, kept clear of the four starting lanes.
function scatterRocks(n) {
  let placed = 0;
  while (placed < n) {
    const x = 2 + Math.floor(Math.random() * (COLS - 4)), y = 2 + Math.floor(Math.random() * (ROWS - 4));
    if (Math.abs(y - 22) < 2 || Math.abs(x - 32) < 2) continue;
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]].slice(0, 1 + Math.floor(Math.random() * 4))) put(x + dx, y + dy, ROCK);
    placed++;
  }
}

// Turns queue up (two at most), so a quick double tap makes a U-turn over
// two steps; a turn straight back on yourself is ignored.
function turn(dir) {
  const me = state.riders[0];
  if (!me?.alive || !DIRS[dir] || state.phase === "pick") return;
  const after = me.queue.at(-1) ?? me.dir;
  if (dir === after || (DIRS[dir][0] === -DIRS[after][0] && DIRS[dir][1] === -DIRS[after][1])) return;
  if (me.queue.length < 2) me.queue.push(dir);
  if (state.phase === "ready") state.readyIn = Math.min(state.readyIn, 0.3);
}

function jump(r = state.riders[0]) {
  if (!r?.alive || !r.jump || (state.phase !== "play" && state.phase !== "pick")) return false;
  r.jumping = true;
  return true;
}

// --- Rivals --------------------------------------------------------------------------------------

// Open cells reachable from (x, y), counted up to `cap`: the space a ship
// would have to live in after a move.
function room(x, y, cap) {
  if (at(x, y)) return 0;
  const seen = new Set([y * COLS + x]), queue = [[x, y]];
  for (let q = 0; q < queue.length && seen.size < cap; q++) {
    const [cx, cy] = queue[q];
    for (const [dx, dy] of Object.values(DIRS)) {
      const nx = cx + dx, ny = cy + dy, k = ny * COLS + nx;
      if (!at(nx, ny) && !seen.has(k)) { seen.add(k); queue.push([nx, ny]); }
    }
  }
  return seen.size;
}

// A rival keeps straight unless a turn gives it more room; a bold one heads
// for the cell in front of you; with nowhere left it jumps if it can.
function think(r, a) {
  const me = state.riders[0];
  const options = [r.dir, LEFT_OF[r.dir], RIGHT_OF[r.dir]].map((d) => {
    const [dx, dy] = DIRS[d], nx = r.x + dx, ny = r.y + dy;
    let score = room(nx, ny, a.look) + (d === r.dir ? 3 : 0) + Math.random() * 2;
    if (a.wander && d !== r.dir && Math.random() < a.wander) score += 6;
    // Another ship could reach the same cell: count it as worse.
    for (const o of state.riders) if (o !== r && o.alive && Math.abs(o.x + DIRS[o.dir][0] - nx) + Math.abs(o.y + DIRS[o.dir][1] - ny) === 0) score -= 40;
    if (me.alive && a.bold && Math.random() < a.bold) {
      const tx = me.x + DIRS[me.dir][0] * 4, ty = me.y + DIRS[me.dir][1] * 4;
      score += 25 - Math.min(25, Math.abs(tx - nx) + Math.abs(ty - ny));
    }
    return { d, score, nx, ny };
  }).sort((p, q) => q.score - p.score);
  const best = options[0];
  if (best.score < 4 && r.jump) {
    const [dx, dy] = DIRS[r.dir];
    if (room(r.x + dx * JUMP, r.y + dy * JUMP, 30) >= 20) { r.jumping = true; return; }
  }
  r.next = best.d;
}

// --- Update --------------------------------------------------------------------------------------

function update(dt) {
  state.t += dt;
  for (const s of state.sparks) { s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt; }
  state.sparks = state.sparks.filter((s) => s.life > 0);
  if (state.phase === "ready") {
    if ((state.readyIn -= dt) <= 0) { state.phase = "play"; $("banner").hidden = true; }
    return;
  }
  if (state.phase === "ending") { if ((state.endIn -= dt) <= 0) endRound(); return; }
  if (state.phase === "between") { if ((state.betweenIn -= dt) <= 0) startRound(); return; }
  if (state.phase !== "play" && state.phase !== "pick") return;
  const a = ARENAS[state.arena];
  if (a.shrink && (state.ringIn -= dt) <= 0) { closeRing(); state.ringIn = a.shrink; }
  state.clock += dt * a.speed;
  const phase = state.phase;
  while (state.clock >= 1 && state.phase === phase) { state.clock -= 1; step(a); }
}

function step(a) {
  const riders = state.riders.filter((r) => r.alive);
  const me = state.riders[0];
  if (state.phase === "pick") think(me, a);              // the demo flies all four
  else if (state.auto) state.auto(me);
  else if (me.alive && me.queue.length) me.next = me.queue.shift();
  for (const r of riders) if (r.i) think(r, a);
  // Everyone moves at once: work out each new cell, then who hit what.
  for (const r of riders) {
    r.dir = r.next;
    const [dx, dy] = DIRS[r.dir], n = r.jumping ? JUMP : 1;
    r.px = r.x; r.py = r.y;
    r.nx = r.x + dx * n; r.ny = r.y + dy * n;
    r.leapt = r.jumping;
    if (r.jumping) { r.jump = false; r.jumping = false; }
  }
  for (const r of riders) {
    if (at(r.nx, r.ny)) r.crash = at(r.nx, r.ny) === WALL ? "the edge" : at(r.nx, r.ny) === ROCK ? (a.planets ? "a planet" : a.shrink ? "the closing ring" : "a rock") : `the ${state.riders[at(r.nx, r.ny) - 1].name}'s wake`;
    for (const o of riders) if (o !== r && o.nx === r.nx && o.ny === r.ny) r.crash = `the ${o.name}, head on`;
  }
  for (const r of riders) {
    r.x = r.nx; r.y = r.ny;
    if (r.crash) {
      r.alive = false; r.out = r.crash; delete r.crash;
      burst(r.x * CELL + CELL / 2, r.y * CELL + CELL / 2, 36, r.color, 120);
      play(r.i ? "boom" : "lost");
      continue;
    }
    put(r.x, r.y, r.i + 1);
    r.cells++;
    if (r.leapt) { r.trail.push([[r.x, r.y]]); burst(r.x * CELL + CELL / 2, r.y * CELL + CELL / 2, 10, "#b49bff", 60); if (!r.i) play("send"); }
    else r.trail.at(-1).push([r.x, r.y]);
  }
  const left = state.riders.filter((r) => r.alive);
  if (state.phase === "pick") { if (left.length <= 1) startRound(true); return; }
  if (state.riders[0].alive) state.score++;
  if (!state.riders[0].alive || left.length <= 1) { state.phase = "ending"; state.endIn = 0.9; }
}

// The Closing Ring: every few seconds the outermost open ring becomes wall.
function closeRing() {
  if (state.ring >= 12) return;
  const k = state.ring;
  for (let x = k; x < COLS - k; x++) { if (!at(x, k)) put(x, k, ROCK); if (!at(x, ROWS - 1 - k)) put(x, ROWS - 1 - k, ROCK); }
  for (let y = k; y < ROWS - k; y++) { if (!at(k, y)) put(k, y, ROCK); if (!at(COLS - 1 - k, y)) put(COLS - 1 - k, y, ROCK); }
  state.ring++;
  play("error");
}

function endRound() {
  const me = state.riders[0], won = me.alive;
  if (won) {
    state.score += 1000 * (state.arena + 1);
    play("won");
    if (state.arena === ARENAS.length - 1) return gameOver(true);
    state.arena++;
    banner("Arena cleared", `${me.name} last one flying. On to ${ARENAS[state.arena].name}.`, 0);
    state.phase = "between"; state.betweenIn = 1.8;
    return;
  }
  state.lives--;
  if (state.lives <= 0) return gameOver(false);
  banner("Out", `Into ${me.out}. ${state.lives} ${state.lives === 1 ? "life" : "lives"} left.`, 0);
  state.phase = "between"; state.betweenIn = 1.8;
}

function gameOver(champion) {
  state.phase = "over";
  const best = load(), record = !best.score || state.score > best.score;
  if (record) save({ ...best, score: state.score });
  banner(champion ? "Champion" : "Game over", `${state.score.toLocaleString()} points, ${champion ? "every arena cleared" : `out in ${ARENAS[state.arena].name}`}` +
    `${record ? " — your best" : ""}. Enter to fly again.`, 0);
  play(champion ? "won" : "lost");
}

function burst(x, y, n, color, speed) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = speed * (0.3 + Math.random());
    state.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.2 + Math.random() * 0.6, max: 0.8, color });
  }
}

function banner(title, text) {
  $("banner-title").textContent = title; $("banner-text").textContent = text; $("banner").hidden = false;
}

// --- Drawing -------------------------------------------------------------------------------------

function draw() {
  ctx.fillStyle = "#03060c"; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgb(80 140 200 / 0.08)"; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= COLS; x += 4) { ctx.moveTo(x * CELL + 0.5, 0); ctx.lineTo(x * CELL + 0.5, H); }
  for (let y = 0; y <= ROWS; y += 4) { ctx.moveTo(0, y * CELL + 0.5); ctx.lineTo(W, y * CELL + 0.5); }
  ctx.stroke();
  const a = ARENAS[state.arena];
  // Rocks and the closed ring, cell by cell; planets drawn over their cells.
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (state.grid[y * COLS + x] === ROCK) {
    const shade = 60 + ((x * 7 + y * 13) % 5) * 9;
    ctx.fillStyle = `rgb(${shade} ${shade - 6} ${shade - 12})`;
    ctx.beginPath(); ctx.roundRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2, 4); ctx.fill();
  }
  for (const [type, cx, cy] of a.planets ?? []) ctx.drawImage(planetArt[type], (cx - 4.6) * CELL, (cy - 4.6) * CELL, 10.2 * CELL, 10.2 * CELL);
  const f = state.phase === "play" || state.phase === "pick" ? state.clock : 1;
  for (const r of state.riders) {
    const hx = (r.alive ? r.px + (r.x - r.px) * f : r.x) * CELL + CELL / 2, hy = (r.alive ? r.py + (r.y - r.py) * f : r.y) * CELL + CELL / 2;
    ctx.strokeStyle = r.color; ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.shadowColor = r.color; ctx.shadowBlur = 8;
    // The head is drawn one step behind the grid, sliding into its cell, so
    // the newest piece of wake runs to the ship rather than to its cell.
    r.trail.forEach((seg, s) => {
      const live = s === r.trail.length - 1 && r.alive, pts = live ? seg.slice(0, -1) : seg;
      if (!pts.length) return;
      ctx.lineWidth = 4; ctx.globalAlpha = r.alive ? 0.9 : 0.4;
      ctx.beginPath();
      pts.forEach(([x, y], k) => (k ? ctx.lineTo(x * CELL + CELL / 2, y * CELL + CELL / 2) : ctx.moveTo(x * CELL + CELL / 2, y * CELL + CELL / 2)));
      if (live) ctx.lineTo(hx, hy);
      ctx.stroke();
    });
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    if (r.alive) {
      const [dx, dy, heading] = DIRS[r.dir];
      drawShip(ctx, r.ship, heading, hx + dx * 4, hy + dy * 4, r.scale);
    }
  }
  for (const p of state.sparks) { ctx.globalAlpha = Math.min(1, (p.life / p.max) * 1.5); ctx.fillStyle = p.color; ctx.fillRect(p.x - 1, p.y - 1, 2, 2); }
  ctx.globalAlpha = 1;
}

function hud() {
  $("score").textContent = state.score.toLocaleString();
  $("lives").textContent = Math.max(0, state.lives);
  $("arena").textContent = `${state.arena + 1}/${ARENAS.length}`;
  $("jump").textContent = state.riders[0]?.jump ? "ready" : "used";
  const list = state.riders.map((r) => `<li style="--c:${r.color}" class="${r.alive ? "" : "out"}">${r.i ? r.name : `${r.name} (you)`}` +
    `${r.alive ? "" : ` — into ${r.out}`}</li>`).join("");
  if ($("riders").dataset.html !== list) { $("riders").innerHTML = list; $("riders").dataset.html = list; }
}

// --- Input ---------------------------------------------------------------------------------------

const KEYS = { ArrowUp: "up", w: "up", ArrowDown: "down", s: "down", ArrowLeft: "left", a: "left", ArrowRight: "right", d: "right" };
addEventListener("keydown", (e) => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (e.target.closest?.("button") && (k === " " || k === "Enter")) return;
  if (KEYS[k]) { e.preventDefault(); turn(KEYS[k]); }
  if (k === " " && state.phase === "play") { e.preventDefault(); jump(); }
  if (k === "Enter" && state.phase === "over") showPickDemo();
});
for (const b of document.querySelectorAll("[data-pad]")) {
  b.addEventListener("pointerdown", (e) => { e.preventDefault(); b.dataset.pad === "jump" ? jump() : turn(b.dataset.pad); });
}
// A swipe on the grid turns the ship that way.
let swipe = null;
canvas.addEventListener("pointerdown", (e) => { swipe = [e.clientX, e.clientY]; });
canvas.addEventListener("pointerup", (e) => {
  if (!swipe) return;
  const dx = e.clientX - swipe[0], dy = e.clientY - swipe[1];
  if (Math.hypot(dx, dy) < 12) jump(); else turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
  swipe = null;
});

// --- Pick ----------------------------------------------------------------------------------------

function showPick() {
  state.phase = "pick";
  $("banner").hidden = true;
  const best = load();
  $("best").textContent = best.score ? `Best: ${best.score.toLocaleString()} points` : "";
  $("hulls").replaceChildren(...hulls.map((h, i) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "hull";
    b.innerHTML = `<img src="${h.ship.urls.yard}" alt=""><span class="name">${h.name}</span>`;
    b.addEventListener("click", () => newGame(i));
    return b;
  }));
  $("pick").hidden = false;
}

// --- Start ---------------------------------------------------------------------------------------

const STEP = 1 / 60;
let last = performance.now(), acc = 0;
requestAnimationFrame(function frame(now) {
  acc += Math.min(0.25, (now - last) / 1000);
  last = now;
  while (acc >= STEP) { update(STEP); acc -= STEP; }
  if (state.phase !== "loading") { draw(); hud(); }
  requestAnimationFrame(frame);
});

const wanted = new Map([...HULLS, ...ARENAS.flatMap((a) => a.rivals)].map(([ed, slug]) => [`${ed}/${slug}`, [ed, slug]]));
const ptypes = [...new Set(ARENAS.flatMap((a) => (a.planets ?? []).map((p) => p[0])))];
const [ships, planets] = await Promise.all([Promise.all([...wanted.values()].map(([ed, slug]) => loadShip(ed, slug))),
  Promise.all(ptypes.map((t) => loadImage(new URL(`planets/${t}/large/planet.png`, PACK_BASE).href)))]);
[...wanted.keys()].forEach((k, i) => { art[k] = ships[i]; art[k].len = hullLength(ships[i]); });
ptypes.forEach((t, i) => { planetArt[t] = planets[i]; });
hulls = HULLS.map(([ed, slug]) => ({ ship: art[`${ed}/${slug}`], name: nameOf(ed, slug) }));
$("mute").onclick = () => { setMuted(!isMuted()); $("mute").textContent = `Sound: ${isMuted() ? "off" : "on"}`; $("mute").setAttribute("aria-pressed", String(isMuted())); };
$("mute").textContent = `Sound: ${isMuted() ? "off" : "on"}`;
// Behind the pick screen, four computer pilots fly the first arena.
function showPickDemo() { state.arena = 0; startRound(true); showPick(); }
$("new").onclick = showPickDemo;
showPickDemo();
// tick(n) runs n steps of 1/60 s; state.auto, a function of your rider, lets a
// play-test steer without key events (newGame() clears it).
globalThis.wake = { state, newGame, turn, jump, think, room, ARENAS, DIRS, LEFT_OF, RIGHT_OF, tick: (n = 1) => { for (let i = 0; i < n; i++) update(STEP); } };
