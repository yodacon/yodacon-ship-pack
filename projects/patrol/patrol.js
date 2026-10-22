// Patrol: Pac-Man with the pack's ships. Sweep a maze of asteroid belts clear
// of cargo pods while four pirates hunt you, each its own way: the Dart chases
// you, the Necromancer cuts you off, the Trident works off the Dart, and the
// Tomaquad loses its nerve up close. A fuel cell overcharges your guns and the
// pirates run. Once a level you can drop a decoy beacon (Space) that draws them
// off for a few seconds. A Large Pin freighter calls twice a level for a bonus.
import { loadShip, drawShip, frameRect } from "../../lib/yodacon-ship-pack.js";
import { play as sound, isMuted, setMuted } from "../../lib/yodacon-sound.js";

let touched = false;
for (const ev of ["pointerdown", "keydown"]) addEventListener(ev, () => { touched = true; }, { once: true, capture: true });
const play = (name) => { if (touched) sound(name); };

const $ = (id) => document.getElementById(id);
const canvas = $("screen"), ctx = canvas.getContext("2d");
const T = 24, COLS = 27, ROWS = 22, W = COLS * T, H = ROWS * T, SAVE = "patrol-v1", LENGTH = 21;
const DIRS = { up: [0, -1, 0], left: [-1, 0, 270], down: [0, 1, 180], right: [1, 0, 90] };   // the classic tie order
const BACK = { up: "down", down: "up", left: "right", right: "left" };
const EXIT = [13, 8], PIN_AT = [13, 12], DECOY_TIME = 6, EXTRA_LIFE = 10000;
const MODES = [7, 20, 7, 20, 5, 20, 5, Infinity];         // scatter, chase, scatter, chase …

// Three mazes, written as their left half and the centre column; the right
// half is the mirror. # belt, . pod, o fuel cell, H the pirates' hold, - its door, P you.
const MAZES = [
  { name: "Belt Station", rows: ["##############", "#............#", "#.####.#####.#", "#o####.#####.#", "#.............", "#.####.##.####", "#......##....#",
    "######.#####.#", "######.##     ", "######.## ###-", "      .   #HHH", "######.## ####", "######.##     ", "######.##.####", "#............#",
    "#.####.#####.#", "#o..##.......P", "###.##.##.####", "#......##....#", "#.##########.#", "#.............", "##############"] },
  { name: "Twin Belts", rows: ["##############", "#o...........#", "#.##.#######.#", "#.##.#.......#", "#....#.###.#.#", "####.#...#.#..", "#....###.#.###",
    "#.##.....#....", "#.##.#.#.     ", "#....#.## ###-", "####.#.   #HHH", "#....#.## ####", "#.##....      ", "#.##.###.###.#", "#............#",
    "###.###.####.#", "#o.......#...P", "#.#.####.#.###", "#.#......#...#", "#.####.#####.#", "#.............", "##############"] },
  { name: "The Spiral", rows: ["##############", "#.....#......#", "#.###.#.####.#", "#o#.....#....#", "#.#.###.#.##.#", "#.......#.##..", "###.###.#....#",
    "###.#...####.#", "###.#.###     ", "#...#.### ###-", "  #...    #HHH", "#.#.#.### ####", "#...#.##      ", "###.#.##.##.##", "#.....#......#",
    "#.###.#.####.#", "#o#..........P", "#.#.#####.#.#.", "#...#.....#...", "#.###.###.###.", "#.............", "##############"] },
].map((m) => ({ ...m, grid: m.rows.map((r) => r + [...r.slice(0, 13)].reverse().join("")) }));

// Your ship, the four pirates (from level 4 the 1998 Yodacon leads in the
// Dart's place) and the freighter: every design in the pack, one Pin.
const HULLS = [["konex", "citrus"], ["konex", "advisor"], ["conex", "gryphon"], ["conex", "defender"], ["override", "callisto"], ["conex", "yodacon"]];
const PIRATES = [
  { key: "chaser", ship: ["conex", "dart"], ace: ["override", "yodacon"], corner: [25, -2], color: "#ff5f5f", wait: 0 },
  { key: "ambusher", ship: ["conex", "necromancer"], corner: [1, -2], color: "#ff9ad5", wait: 2 },
  { key: "flanker", ship: ["conex", "trident"], corner: [26, 23], color: "#6bd6ff", wait: 5 },
  { key: "shy", ship: ["conex", "tomaquad"], corner: [0, 23], color: "#ffb347", wait: 8 },
];
const FREIGHTER = ["conex", "large-pin"];

const state = { phase: "loading", pick: 0, level: 1, score: 0, lives: 3, nextLife: EXTRA_LIFE, maze: null, pods: null, left: 0, me: null,
  pirates: [], mode: 0, modeT: 0, fright: 0, chain: 0, decoys: 1, decoy: null, pin: null, pinsCalled: 0, t: 0, sparks: [], popups: [] };
let art = {}, hulls = [], walls = null;

function load() { try { return JSON.parse(localStorage.getItem(SAVE)) ?? {}; } catch { return {}; } }
function save(d) { try { localStorage.setItem(SAVE, JSON.stringify(d)); } catch { /* not kept */ } }
const nameOf = ([ed, slug]) => (ed === "override" && slug === "yodacon" ? "1998 Yodacon" : art[`${ed}/${slug}`].name);

// A hull's length on frame 0, from its alpha, so every ship fills a lane alike.
function hullLength(ship) {
  const r = frameRect(ship, 0), c = new OffscreenCanvas(r.w, r.h), g = c.getContext("2d");
  g.drawImage(ship.sheet, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
  const a = g.getImageData(0, 0, r.w, r.h).data;
  let lo = r.h, hi = 0;
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) if (a[(y * r.w + x) * 4 + 3] > 40) { lo = Math.min(lo, y); hi = Math.max(hi, y); }
  return hi - lo + 1;
}

// --- The maze ------------------------------------------------------------------------------------

const cell = (x, y) => (y < 0 || y >= ROWS ? "#" : state.maze.grid[y][(x + COLS) % COLS]);
const open = (x, y) => !"#H-".includes(cell(x, y));
const wrapX = (e) => { if (e.x < 0) e.x += COLS; else if (e.x >= COLS) e.x -= COLS; };

// The belts drawn once per maze: a dark fill, and a bright edge wherever a
// belt meets open space, as in the arcade.
function paintWalls() {
  const c = new OffscreenCanvas(W, H), g = c.getContext("2d");
  const wall = (x, y) => y < 0 || y >= ROWS || x < 0 || x >= COLS || "#".includes(state.maze.grid[y][x]);
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const ch = state.maze.grid[y][x];
    if (ch === "-") { g.fillStyle = "#ff9ad5"; g.fillRect(x * T, y * T + T / 2 - 2, T, 4); continue; }
    if (ch !== "#") continue;
    const shade = 18 + ((x * 7 + y * 11) % 4) * 4;
    g.fillStyle = `rgb(${shade} ${shade + 6} ${shade + 18})`; g.fillRect(x * T, y * T, T, T);
    g.strokeStyle = "#3f7fe0"; g.lineWidth = 2; g.beginPath();
    if (!wall(x, y - 1)) { g.moveTo(x * T, y * T + 1); g.lineTo(x * T + T, y * T + 1); }
    if (!wall(x, y + 1)) { g.moveTo(x * T, y * T + T - 1); g.lineTo(x * T + T, y * T + T - 1); }
    if (!wall(x - 1, y)) { g.moveTo(x * T + 1, y * T); g.lineTo(x * T + 1, y * T + T); }
    if (!wall(x + 1, y)) { g.moveTo(x * T + T - 1, y * T); g.lineTo(x * T + T - 1, y * T + T); }
    g.stroke();
    // a few rocks in the belt
    g.fillStyle = "rgb(120 130 150 / 0.25)";
    g.beginPath(); g.arc(x * T + 6 + ((x * 13 + y * 5) % 12), y * T + 6 + ((x * 3 + y * 17) % 12), 2 + ((x + y) % 3), 0, Math.PI * 2); g.fill();
  }
  walls = c;
}

// --- Levels --------------------------------------------------------------------------------------

const speeds = () => ({ me: Math.min(8.4, 7.4 + state.level * 0.1), pirate: Math.min(8.2, 6.5 + state.level * 0.35),
  fright: 4.3, eyes: 15, tunnel: 3.6, fear: Math.max(1.5, 7.5 - state.level) });

function newGame(pick = state.pick) {
  Object.assign(state, { pick, level: 1, score: 0, lives: 3, nextLife: EXTRA_LIFE, auto: null });
  $("pick").hidden = true;
  startLevel();
}

function startLevel() {
  state.maze = MAZES[(state.level - 1) % MAZES.length];
  state.pods = state.maze.grid.map((r) => [...r].map((c) => (c === "." ? 1 : c === "o" ? 2 : 0)));
  state.left = state.pods.flat().filter(Boolean).length;
  state.total = state.left;
  Object.assign(state, { decoys: 1, pinsCalled: 0, pin: null });
  paintWalls();
  resetPositions();
  banner(`Level ${state.level}: ${state.maze.name}`, state.level === 4 ? "The 1998 Yodacon leads the pirates now." : "Ready", 0);
}

function resetPositions() {
  const [px, py] = (() => { for (let y = 0; y < ROWS; y++) { const x = state.maze.grid[y].indexOf("P"); if (x >= 0) return [x, y]; } })();
  state.me = { x: px, y: py, dir: "left", want: "left", prog: 0, moving: true, ship: hulls[state.pick] };
  state.pirates = PIRATES.map((p, i) => {
    const which = p.ace && state.level >= 4 ? p.ace : p.ship;
    return { ...p, i, ship: art[`${which[0]}/${which[1]}`], name: nameOf(which), x: EXIT[0], y: EXIT[1], dir: "left", prog: 0,
      mode: i === 0 ? "out" : "home", wait: Math.max(0.5, p.wait - state.level * 0.6), slot: i, reverse: false, ace: which === p.ace };
  });
  Object.assign(state, { mode: 0, modeT: 0, fright: 0, chain: 0, decoy: null, phase: "ready", readyIn: 1.8 });
}

// --- Input ---------------------------------------------------------------------------------------

function steer(dir) { if (DIRS[dir] && state.me) { state.me.want = dir; if (state.phase === "ready") state.readyIn = Math.min(state.readyIn, 0.4); } }

function dropDecoy() {
  if (state.phase !== "play" || state.decoys <= 0) return false;
  state.decoys--;
  state.decoy = { x: state.me.x, y: state.me.y, life: DECOY_TIME };
  play("send");
  return true;
}

const KEYS = { ArrowUp: "up", w: "up", ArrowDown: "down", s: "down", ArrowLeft: "left", a: "left", ArrowRight: "right", d: "right" };
addEventListener("keydown", (e) => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (e.target.closest?.("button") && (k === " " || k === "Enter")) return;
  if (KEYS[k]) { e.preventDefault(); steer(KEYS[k]); }
  if ((k === " " || k === "e") && state.phase === "play") { e.preventDefault(); dropDecoy(); }
  if (k === "Enter" && state.phase === "over") showPick();
});
for (const b of document.querySelectorAll("[data-pad]")) {
  b.addEventListener("pointerdown", (e) => { e.preventDefault(); b.dataset.pad === "decoy" ? dropDecoy() : steer(b.dataset.pad); });
}
let swipe = null;
canvas.addEventListener("pointerdown", (e) => { swipe = [e.clientX, e.clientY]; });
canvas.addEventListener("pointerup", (e) => {
  if (!swipe) return;
  const dx = e.clientX - swipe[0], dy = e.clientY - swipe[1];
  if (Math.hypot(dx, dy) < 12) dropDecoy(); else steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
  swipe = null;
});

// --- Update --------------------------------------------------------------------------------------

function update(dt) {
  state.t += dt;
  for (const s of state.sparks) { s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt; }
  state.sparks = state.sparks.filter((s) => s.life > 0);
  for (const p of state.popups) { p.y -= 18 * dt; p.life -= dt; }
  state.popups = state.popups.filter((p) => p.life > 0);
  if (state.phase === "ready") { if ((state.readyIn -= dt) <= 0) { state.phase = "play"; $("banner").hidden = true; } return; }
  if (state.phase === "dying") {
    if ((state.wait -= dt) <= 0) {
      if (state.lives <= 0) return gameOver();
      resetPositions(); banner(`Level ${state.level}`, `${state.lives} ${state.lives === 1 ? "ship" : "ships"} left`, 0);
    }
    return;
  }
  if (state.phase === "cleared") { if ((state.wait -= dt) <= 0) { state.level++; startLevel(); } return; }
  if (state.phase !== "play") return;
  const sp = speeds();
  if (state.fright > 0) state.fright = Math.max(0, state.fright - dt);
  else if ((state.modeT += dt) >= MODES[state.mode]) {          // scatter and chase take turns
    state.modeT = 0; state.mode++;
    for (const p of state.pirates) if (p.mode === "out") p.reverse = true;
  }
  if (state.decoy && (state.decoy.life -= dt) <= 0) state.decoy = null;
  if (state.pin && (state.pin.life -= dt) <= 0) state.pin = null;
  const me = state.me;
  if (state.auto) { const d = state.auto(me); if (d) me.want = d; }
  move(me, sp.me * dt, true);
  for (const p of state.pirates) {
    if (p.mode === "home") { if ((p.wait -= dt) <= 0) { Object.assign(p, { mode: "out", x: EXIT[0], y: EXIT[1], dir: "left", prog: 0 }); } continue; }
    const tunnel = p.y === 10 && (p.x < 5 || p.x > COLS - 6);
    const v = p.mode === "eyes" ? sp.eyes : tunnel ? sp.tunnel : p.scared ? sp.fright : sp.pirate + (p.ace ? 0.3 : 0);
    move(p, v * dt, false);
  }
  collide();
}

// Move along the lanes; turns are decided at each tile's centre.
function move(e, dist, isMe) {
  if (isMe && e.prog > 0 && e.want === BACK[e.dir]) reverse(e);
  if (!isMe && e.reverse && e.prog > 0) { reverse(e); e.reverse = false; }
  let guard = 0;
  while (dist > 1e-9 && guard++ < 8) {
    if (e.prog === 0) {
      if (isMe) {
        eat(e.x, e.y);
        if (open(e.x + DIRS[e.want][0], e.y + DIRS[e.want][1])) e.dir = e.want;
        if (!open(e.x + DIRS[e.dir][0], e.y + DIRS[e.dir][1])) { e.moving = false; return; }
        e.moving = true;
      } else {
        if (e.reverse) { e.dir = BACK[e.dir]; e.reverse = false; }
        choose(e);
        if (e.mode === "eyes" && e.x === EXIT[0] && e.y === EXIT[1]) { Object.assign(e, { mode: "home", wait: 2, scared: false }); return; }
      }
    }
    const step = Math.min(dist, 1 - e.prog);
    e.prog += step; dist -= step;
    if (e.prog >= 1 - 1e-9) { e.x += DIRS[e.dir][0]; e.y += DIRS[e.dir][1]; wrapX(e); e.prog = 0; }
  }
}
function reverse(e) { e.x += DIRS[e.dir][0]; e.y += DIRS[e.dir][1]; wrapX(e); e.prog = 1 - e.prog; e.dir = BACK[e.dir]; }

// The pirates' rule from the arcade: at each tile, of the ways open (never
// straight back), take the one whose next tile is nearest the target.
function target(p) {
  const me = state.me, [dx, dy] = DIRS[me.dir];
  if (p.mode === "eyes") return EXIT;
  if (state.decoy) return [state.decoy.x, state.decoy.y];
  if (state.mode % 2 === 0) return p.corner;
  if (p.key === "chaser") return [me.x, me.y];
  if (p.key === "ambusher") return [me.x + dx * 4, me.y + dy * 4];
  if (p.key === "flanker") { const c = state.pirates[0]; return [2 * (me.x + dx * 2) - c.x, 2 * (me.y + dy * 2) - c.y]; }
  return Math.hypot(p.x - me.x, p.y - me.y) > 8 ? [me.x, me.y] : p.corner;
}
function choose(p) {
  const ways = Object.keys(DIRS).filter((d) => d !== BACK[p.dir] && open(p.x + DIRS[d][0], p.y + DIRS[d][1]));
  if (!ways.length) { p.dir = BACK[p.dir]; return; }
  if (p.scared && p.mode === "out") { p.dir = ways[Math.floor(Math.random() * ways.length)]; return; }
  const [tx, ty] = target(p);
  p.dir = ways.reduce((best, d) => {
    const dist = (w) => (p.x + DIRS[w][0] - tx) ** 2 + (p.y + DIRS[w][1] - ty) ** 2;
    return dist(d) < dist(best) ? d : best;
  });
}

function eat(x, y) {
  const v = state.pods[y]?.[x];
  if (!v) return;
  state.pods[y][x] = 0;
  state.left--;
  if (v === 1) { score(10); if (state.left % 2) play("coin"); }
  else {
    score(50);
    state.fright = speeds().fear; state.chain = 0;
    for (const p of state.pirates) if (p.mode === "out") { p.scared = true; p.reverse = true; }
    play("target");
  }
  const eaten = state.total - state.left;
  if (state.pinsCalled < 2 && eaten >= (state.pinsCalled ? 0.7 : 0.33) * state.total) {
    state.pinsCalled++;
    state.pin = { x: PIN_AT[0], y: PIN_AT[1], life: 9, spin: 0 };
  }
  if (!state.left) { state.phase = "cleared"; state.wait = 2.2; play("won"); banner("Sector clear", `Level ${state.level} done.`, 0); }
}

const pos = (e) => [e.x + DIRS[e.dir][0] * e.prog, e.y + DIRS[e.dir][1] * e.prog];
function collide() {
  const [mx, my] = pos(state.me);
  if (!state.fright) for (const p of state.pirates) p.scared = false;
  for (const p of state.pirates) {
    if (p.mode !== "out") continue;
    const [px, py] = pos(p);
    if (Math.abs(px - mx) + Math.abs(py - my) > 0.7 && !(Math.abs(Math.abs(px - mx) - COLS) < 0.7 && py === my)) continue;
    if (p.scared) {
      const pts = 200 * 2 ** state.chain++;
      score(pts);
      p.mode = "eyes"; p.scared = false;
      burst((px + 0.5) * T, (py + 0.5) * T, 26, p.color, 110);
      state.popups.push({ x: (px + 0.5) * T, y: py * T, text: String(pts), life: 1 });
      play("boom");
    } else return die(p);
  }
  if (state.pin && Math.abs(state.pin.x - mx) + Math.abs(state.pin.y - my) < 0.8) {
    const pts = 500 + 250 * state.level;
    score(pts);
    state.popups.push({ x: (state.pin.x + 0.5) * T, y: state.pin.y * T, text: String(pts), life: 1.2 });
    state.pin = null;
    play("pickup");
  }
}

function die(p) {
  state.phase = "dying"; state.wait = 1.6; state.lives--;
  state.lastDeath = p.name;
  const [mx, my] = pos(state.me);
  burst((mx + 0.5) * T, (my + 0.5) * T, 40, "#ffcf6b", 140);
  play("lost");
}

function score(n) {
  state.score += n;
  if (state.score >= state.nextLife) { state.lives++; state.nextLife += EXTRA_LIFE; play("held"); }
}

function gameOver() {
  state.phase = "over";
  const best = load(), record = !best.score || state.score > best.score;
  if (record) save({ ...best, score: state.score, level: state.level });
  banner("Game over", `${state.score.toLocaleString()} points, level ${state.level}${record ? " — your best" : ""}. Enter to fly again.`, 0);
}

function burst(x, y, n, color, speed) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = speed * (0.3 + Math.random());
    state.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.2 + Math.random() * 0.6, max: 0.8, color });
  }
}
function banner(title, text) { $("banner-title").textContent = title; $("banner-text").textContent = text; $("banner").hidden = false; }

// --- Drawing -------------------------------------------------------------------------------------

function drawAt(ship, heading, x, y, len = LENGTH) { drawShip(ctx, ship, heading, (x + 0.5) * T, (y + 0.5) * T, len / ship.len); }

function draw() {
  ctx.fillStyle = "#02040a"; ctx.fillRect(0, 0, W, H);
  if (!state.maze) return;
  ctx.drawImage(walls, 0, 0);
  const pulse = 0.5 + 0.5 * Math.sin(state.t * 6);
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const v = state.pods[y][x];
    if (v === 1) { ctx.fillStyle = "#9fe8ff"; ctx.fillRect(x * T + T / 2 - 2, y * T + T / 2 - 2, 4, 4); }
    else if (v === 2) {
      ctx.fillStyle = `rgb(255 ${180 + pulse * 60} 80)`; ctx.shadowColor = "#ffb340"; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(x * T + T / 2, y * T + T / 2, 5 + pulse * 2, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    }
  }
  if (state.decoy) {
    const { x, y, life } = state.decoy, r = 6 + ((state.t * 30) % 18);
    ctx.strokeStyle = `rgb(180 155 255 / ${Math.min(1, life)})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc((x + 0.5) * T, (y + 0.5) * T, r, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#b49bff"; ctx.fillRect((x + 0.5) * T - 3, (y + 0.5) * T - 3, 6, 6);
  }
  if (state.pin) {                                      // the freighter turns slowly through its frames
    state.pin.spin = (state.t * 40) % 360;
    if (state.pin.life > 2 || Math.floor(state.t * 8) % 2) drawAt(art["conex/large-pin"], state.pin.spin, state.pin.x, state.pin.y, 30);
  }
  // Pirates waiting in the hold sit in a row inside it.
  for (const p of state.pirates) {
    if (p.mode === "home") { drawAt(p.ship, 0, 11 + p.slot * 1.33, 10, LENGTH * 0.8); continue; }
    const [x, y] = pos(p), heading = DIRS[p.dir][2];
    if (p.mode === "eyes") { ctx.globalAlpha = 0.25; drawAt(p.ship, heading, x, y); ctx.globalAlpha = 1; continue; }
    if (p.scared) {
      const ending = state.fright < 2 && Math.floor(state.t * 6) % 2;
      ctx.strokeStyle = ending ? "#ffffff" : "#4f7dff"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc((x + 0.5) * T, (y + 0.5) * T, 12, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 0.6; drawAt(p.ship, heading, x, y); ctx.globalAlpha = 1;
    } else drawAt(p.ship, heading, x, y);
  }
  const me = state.me;
  if (me && state.phase !== "dying" && state.phase !== "over") { const [x, y] = pos(me); drawAt(me.ship, DIRS[me.dir][2], x, y); }
  for (const p of state.sparks) { ctx.globalAlpha = Math.min(1, (p.life / p.max) * 1.5); ctx.fillStyle = p.color; ctx.fillRect(p.x - 1, p.y - 1, 2, 2); }
  ctx.globalAlpha = 1;
  ctx.font = "700 12px ui-monospace, monospace"; ctx.textAlign = "center";
  for (const p of state.popups) { ctx.fillStyle = "#9fe8ff"; ctx.fillText(p.text, p.x, p.y); }
}

function hud() {
  $("score").textContent = state.score.toLocaleString();
  $("lives").textContent = Math.max(0, state.lives);
  $("level").textContent = state.level;
  $("decoy").textContent = state.decoy ? `${Math.ceil(state.decoy.life)} s` : state.decoys ? "ready" : "used";
  const mode = state.fright ? "running from you" : state.decoy ? "after the decoy" : state.mode % 2 ? "hunting" : "scattering";
  $("mode").textContent = state.phase === "play" ? `Pirates ${mode}` : "";
}

// --- Pick ----------------------------------------------------------------------------------------

function showPick() {
  state.phase = "pick";
  $("banner").hidden = true;
  const best = load();
  $("best").textContent = best.score ? `Best: ${best.score.toLocaleString()} points, level ${best.level}` : "";
  $("hulls").replaceChildren(...HULLS.map((h, i) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "hull";
    b.innerHTML = `<img src="${hulls[i].urls.yard}" alt=""><span class="name">${nameOf(h)}</span>`;
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

const wanted = new Map([...HULLS, ...PIRATES.flatMap((p) => (p.ace ? [p.ship, p.ace] : [p.ship])), FREIGHTER].map(([ed, slug]) => [`${ed}/${slug}`, [ed, slug]]));
const ships = await Promise.all([...wanted.values()].map(([ed, slug]) => loadShip(ed, slug)));
[...wanted.keys()].forEach((k, i) => { art[k] = ships[i]; art[k].len = hullLength(ships[i]); });
hulls = HULLS.map(([ed, slug]) => art[`${ed}/${slug}`]);
$("mute").onclick = () => { setMuted(!isMuted()); $("mute").textContent = `Sound: ${isMuted() ? "off" : "on"}`; $("mute").setAttribute("aria-pressed", String(isMuted())); };
$("mute").textContent = `Sound: ${isMuted() ? "off" : "on"}`;
$("new").onclick = showPick;
state.maze = MAZES[0]; state.pods = state.maze.grid.map((r) => [...r].map((c) => (c === "." ? 1 : c === "o" ? 2 : 0)));
paintWalls(); resetPositions();
showPick();
// tick(n) runs n steps of 1/60 s; state.auto, a function of your ship that
// returns a direction, lets a play-test steer without key events.
globalThis.patrol = { state, newGame, steer, dropDecoy, open, pos, DIRS, BACK, COLS, ROWS, tick: (n = 1) => { for (let i = 0; i < n; i++) update(STEP); } };
