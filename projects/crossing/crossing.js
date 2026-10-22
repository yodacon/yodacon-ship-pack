// Crossing: Frogger with the pack's ships. Hop a small fighter across five
// lanes of traffic, then across the ion stream by riding the freighters that
// cross it, and into one of five bays at the top. Fill all five to clear the
// level. Traffic and freighters fly on frame 9 (heading east) or frame 27
// (west); your ship faces the way it hops: frames 0, 9, 18 or 27.
// From level 3 one group of Yodacons and one of Tomaquads in the stream jump
// to hyperspace now and then: they flicker, then vanish for two seconds,
// and whoever is riding them is lost. Once a crossing you can hyperjump
// (Space or J): two rows forward at once, over whatever is in between.
import { loadShip, drawShip, frameRect } from "../../lib/yodacon-ship-pack.js";
import { play, isMuted, setMuted } from "../../lib/yodacon-sound.js";

const $ = (id) => document.getElementById(id);
const canvas = $("screen"), ctx = canvas.getContext("2d");
const CELL = 48, COLS = 13, ROWS = 13, W = canvas.width, H = canvas.height;   // 624 × 624
const SAVE = "crossing-v1", LIVES = 4, CLOCK = 40, MARGIN = 120;
const rowY = (r) => r * CELL + CELL / 2;
const BAYS = [72, 192, 312, 432, 552], BAY_HALF = 20;

// Rows: 0 the bays, 1–5 the ion stream (ride or be lost), 6 the median,
// 7–11 traffic, 12 the start. Every design but the two smaller Pins flies
// here; the Large Pin is the slowest raft.
const LANES = [
  { row: 1, ship: ["override", "callisto"], dir: -1, speed: 40, groups: 3, size: 2, ride: true },
  { row: 2, ship: ["conex", "yodacon"], dir: 1, speed: 52, groups: 3, size: 2, ride: true, warp: true },
  { row: 3, ship: ["conex", "large-pin"], dir: -1, speed: 30, groups: 3, size: 2, scale: 1.4, ride: true },
  { row: 4, ship: ["conex", "dart"], dir: 1, speed: 48, groups: 3, size: 2, ride: true },
  { row: 5, ship: ["conex", "tomaquad"], dir: -1, speed: 36, groups: 3, size: 3, ride: true, warp: true },
  { row: 7, ship: ["konex", "advisor"], dir: 1, speed: 72, groups: 3, size: 1 },
  { row: 8, ship: ["conex", "necromancer"], dir: -1, speed: 50, groups: 3, size: 2 },
  { row: 9, ship: ["conex", "defender"], dir: 1, speed: 125, groups: 2, size: 1 },
  { row: 10, ship: ["konex", "citrus"], dir: -1, speed: 44, groups: 3, size: 1 },
  { row: 11, ship: ["override", "yodacon"], dir: 1, speed: 32, groups: 3, size: 1, scale: 0.75 },
];
const PILOTS = [["conex", "gryphon"], ["conex", "defender"], ["conex", "trident"]];

const state = { phase: "loading", time: 0, level: 1, lives: LIVES, score: 0, clock: CLOCK, best: 12, bays: [], lanes: [], me: null,
  pilot: 0, sparks: [], deaths: {}, flash: "", result: "" };
let ships = {}, pilots = [], last = performance.now(), acc = 0;

function load() { try { return JSON.parse(localStorage.getItem(SAVE)) ?? {}; } catch { return {}; } }
function save(d) { try { localStorage.setItem(SAVE, JSON.stringify(d)); } catch { /* not kept */ } }

// How long a hull is when it flies sideways: scan frame 9's alpha once.
function sideLength(ship, scale = 1) {
  const r = frameRect(ship, 9), c = new OffscreenCanvas(r.w, r.h), g = c.getContext("2d");
  g.drawImage(ship.sheet, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
  const a = g.getImageData(0, 0, r.w, r.h).data;
  let lo = r.w, hi = 0;
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) if (a[(y * r.w + x) * 4 + 3] > 40) { lo = Math.min(lo, x); hi = Math.max(hi, x); }
  return (hi - lo + 1) * scale;
}

// --- Setup ---------------------------------------------------------------------------------------

function laneSet() {
  const pace = Math.min(2, 1 + (state.level - 1) * 0.12);
  return LANES.map((d) => {
    const k = ships[d.ship.join("/")], scale = d.scale ?? 1, len = k.len * scale;
    const span = W + MARGIN * 2, gap = span / d.groups, items = [];
    for (let g = 0; g < d.groups; g++) for (let i = 0; i < d.size; i++) items.push({ x: g * gap + i * (len + 4) - MARGIN, g });
    return { ...d, k, scale, len, speed: d.speed * pace, span, items };
  });
}

function newGame(pilot = state.pilot) {
  Object.assign(state, { phase: "play", time: 0, level: 1, lives: LIVES, score: 0, pilot, bays: BAYS.map(() => false), deaths: {} });
  state.lanes = laneSet();
  spawn();
  $("pick").hidden = true; $("banner").hidden = true;
}

function spawn() {
  const k = pilots[state.pilot];
  state.me = { k, x: rowY(6), row: 12, from: null, hop: 0, heading: 0, alive: true, jump: true, jumping: false };
  state.clock = CLOCK; state.best = 12; state.flash = "";
}

// --- Input ---------------------------------------------------------------------------------------

const DIRS = { ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0] };
let queued = null;
addEventListener("keydown", (e) => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (state.phase === "play" && (k.startsWith("Arrow") || k === " ")) e.preventDefault();
  if (DIRS[k] && !e.repeat) queued = DIRS[k];
  if ((k === " " || k === "j") && !e.repeat) hyperjump();
  if (k === "Enter" && state.phase === "over") showPick();
});
// Touch: tap above, below or beside your ship to hop that way.
canvas.addEventListener("pointerdown", (e) => {
  if (state.phase !== "play" || !state.me) return;
  const b = canvas.getBoundingClientRect(), x = ((e.clientX - b.left) / b.width) * W, y = ((e.clientY - b.top) / b.height) * H;
  const dx = x - state.me.x, dy = y - rowY(state.me.row);
  queued = Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy) || -1];
});
let padWas = 0, padJump = false;

// Once a crossing: two rows forward at once, over whatever is between.
function hyperjump() {
  const me = state.me;
  if (state.phase !== "play" || !me?.alive || me.hop > 0 || !me.jump || me.row === 0) return false;
  me.jump = false; me.jumping = true;
  queued = [0, -2];
  burst(me.x, rowY(me.row), 16, "#b49bff", 90);
  play("send");
  return true;
}
function pollPad() {
  const pad = [...(navigator.getGamepads?.() ?? [])].find(Boolean);
  if (!pad) return;
  const b = (n) => pad.buttons[n]?.pressed, ax = pad.axes[0] ?? 0, ay = pad.axes[1] ?? 0;
  const dir = b(12) || ay < -0.5 ? 1 : b(13) || ay > 0.5 ? 2 : b(14) || ax < -0.5 ? 3 : b(15) || ax > 0.5 ? 4 : 0;
  if (dir && dir !== padWas) queued = [[0, -1], [0, 1], [-1, 0], [1, 0]][dir - 1];
  padWas = dir;
  const jb = b(1) || b(3);
  if (jb && !padJump) hyperjump();
  padJump = jb;
}

// --- Update --------------------------------------------------------------------------------------

const hopTime = (k) => 0.26 - 0.015 * k.record.Maneuver;
const laneAt = (row) => state.lanes.find((l) => l.row === row);
// A warping group's cycle: 6 s there, 1.2 s flickering, 2 s gone.
const WARP = 9.2;
const warpPhase = (l, it, dt = 0) => (l.warp && state.level >= 3 && it.g === 0 ? (state.time + dt + l.row * 1.7) % WARP : -1);
const gone = (l, it, dt = 0) => warpPhase(l, it, dt) > 7.2;
// The ship of a lane under x, dt seconds from now (for the play-test pilot too).
function under(row, x, dt = 0, pad = 0) {
  const l = laneAt(row);
  if (!l) return null;
  for (const it of l.items) {
    if (gone(l, it, dt)) continue;
    let cx = it.x + l.dir * l.speed * dt;
    cx = ((((cx + MARGIN) % l.span) + l.span) % l.span) - MARGIN;
    if (Math.abs(cx - x) < l.len / 2 + pad) return { lane: l, x: cx };
  }
  return null;
}

function update(dt) {
  for (const s of state.sparks) { s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt; }
  state.sparks = state.sparks.filter((s) => s.life > 0);
  if (state.phase !== "play" && state.phase !== "dying") return;
  pollPad();
  state.time += dt;
  for (const l of state.lanes) for (const it of l.items) {
    it.x += l.dir * l.speed * dt;
    if (it.x > W + MARGIN) it.x -= l.span; else if (it.x < -MARGIN) it.x += l.span;
  }
  const me = state.me;
  if (state.phase === "dying") { if ((me.wait -= dt) <= 0) afterDeath(); return; }
  state.clock -= dt;
  if (state.clock <= 0) return die("Out of time");

  if (me.hop > 0) {                                              // mid-hop
    me.hop -= dt;
    const f = 1 - Math.max(0, me.hop) / hopTime(me.k);
    me.x = me.from.x + (me.to.x - me.from.x) * f;
    if (me.hop <= 0) { me.row = me.to.row; me.x = me.to.x; me.from = null; me.jumping = false; landed(); }
  } else if (queued) {
    const [dx, dy] = queued, row = me.row + dy, x = me.x + dx * CELL;
    if (row <= 12 && x >= CELL / 2 - 1 && x <= W - CELL / 2 + 1) {
      me.heading = dy < 0 ? 0 : dy > 0 ? 180 : dx > 0 ? 90 : 270;
      me.from = { x: me.x, row: me.row }; me.to = { x, row: row < 0 ? 0 : row };
      me.hop = hopTime(me.k);
      play("select");
    }
  }
  queued = null;
  if (me.hop > 0 || !state.me.alive) return;

  // Riding: the freighter carries you; off the edge is lost.
  const l = laneAt(me.row);
  if (l?.ride) {
    me.x += l.dir * l.speed * dt;
    if (me.x < 6 || me.x > W - 6) return die("Carried out of the zone");
    if (!under(me.row, me.x, 0, 2)) return die("Your freighter jumped to hyperspace");
  } else if (l) {
    const hit = under(me.row, me.x, 0, 8);
    if (hit) return die(`Hit by the ${hit.lane.k.name}`);
  }
}

function landed() {
  const me = state.me;
  if (me.row < state.best) { state.score += 10 * (state.best - me.row); state.best = me.row; }
  if (me.row === 0) {
    const i = BAYS.findIndex((b) => Math.abs(b - me.x) < BAY_HALF);
    if (i < 0) return die("Missed the bay");
    if (state.bays[i]) return die("That bay is taken");
    state.bays[i] = true;
    state.score += 50 + Math.ceil(state.clock) * 5;
    burst(BAYS[i], rowY(0), 18, "#5cff5c", 70);
    if (state.bays.every(Boolean)) return levelUp();
    play("held"); state.flash = `Bay ${i + 1} docked`;
    return spawn();
  }
  const l = laneAt(me.row);
  if (l?.ride) {
    if (!under(me.row, me.x, 0, -6)) return die("Lost in the ion stream");
    play("pickup");
  }
}

function levelUp() {
  play("won");
  state.score += 250 * state.level;
  state.level++;
  state.bays = BAYS.map(() => false);
  state.lanes = laneSet();
  banner(`Level ${state.level}`, state.level === 3 ? "All five bays full. Watch the Yodacons and Tomaquads: some now jump to hyperspace." : "All five bays full. The traffic is faster now.");
  setTimeout(() => { if (state.phase === "play") $("banner").hidden = true; }, 1600);
  spawn();
}

function die(why) {
  const me = state.me;
  me.alive = false;
  state.deaths[why] = (state.deaths[why] ?? 0) + 1;
  burst(me.x, rowY(me.row), 30, "#ff7a59", 110);
  play("boom");
  state.lives--;
  state.flash = why;
  state.phase = "dying"; me.wait = 1;
}

function afterDeath() {
  if (state.lives > 0) { state.phase = "play"; spawn(); return; }
  state.phase = "over";
  const best = load(), record = state.score > (best.score ?? 0);
  if (record) save({ score: state.score, level: state.level });
  play("lost");
  state.result = `Last run: ${state.score.toLocaleString()} points, level ${state.level}${record ? " — your best" : ""}.`;
  banner("Game over", `${state.result.slice(10)} Enter to choose a ship.`);
}

function burst(x, y, n, color, speed) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = speed * (0.3 + Math.random());
    state.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.2 + Math.random() * 0.5, max: 0.7, color });
  }
}

function banner(title, text) { $("banner-title").textContent = title; $("banner-text").textContent = text; $("banner").hidden = false; }

// --- Drawing -------------------------------------------------------------------------------------

function draw(now) {
  ctx.fillStyle = "#03050a"; ctx.fillRect(0, 0, W, H);
  // The ion stream: violet bands that shimmer.
  for (let r = 1; r <= 5; r++) {
    const g = ctx.createLinearGradient(0, r * CELL, 0, (r + 1) * CELL);
    const s = 0.16 + 0.05 * Math.sin(now / 600 + r);
    g.addColorStop(0, `rgb(194 107 216 / ${s})`); g.addColorStop(0.5, `rgb(120 60 200 / ${s + 0.08})`); g.addColorStop(1, `rgb(194 107 216 / ${s})`);
    ctx.fillStyle = g; ctx.fillRect(0, r * CELL, W, CELL);
  }
  for (let i = 0; i < 40; i++) {                                 // drifting motes in the stream
    const x = (i * 97 + now * 0.03 * (i % 2 ? 1 : -1)) % W, y = CELL + ((i * 53) % (5 * CELL));
    ctx.fillStyle = "rgb(230 180 255 / 0.35)"; ctx.fillRect((x + W) % W, y, 2, 1);
  }
  // Traffic lanes: dark with dashed dividers.
  ctx.fillStyle = "#0a0d12"; ctx.fillRect(0, 7 * CELL, W, 5 * CELL);
  ctx.strokeStyle = "rgb(255 179 64 / 0.25)"; ctx.setLineDash([14, 12]);
  for (let r = 8; r <= 11; r++) { ctx.beginPath(); ctx.moveTo(0, r * CELL); ctx.lineTo(W, r * CELL); ctx.stroke(); }
  ctx.setLineDash([]);
  // Platforms: the median, the start pad, the bay wall.
  for (const r of [6, 12]) {
    const g = ctx.createLinearGradient(0, r * CELL, 0, (r + 1) * CELL);
    g.addColorStop(0, "#4c5457"); g.addColorStop(0.15, "#2b3134"); g.addColorStop(1, "#1e2326");
    ctx.fillStyle = g; ctx.fillRect(0, r * CELL, W, CELL);
    ctx.fillStyle = "rgb(255 255 255 / 0.05)"; for (let x = 0; x < W; x += 24) ctx.fillRect(x, r * CELL + 4, 1, CELL - 8);
  }
  ctx.fillStyle = "#2b3134"; ctx.fillRect(0, 0, W, CELL);
  BAYS.forEach((x, i) => {
    ctx.fillStyle = "#05070a"; ctx.fillRect(x - BAY_HALF - 4, 6, (BAY_HALF + 4) * 2, CELL - 6);
    ctx.strokeStyle = state.bays[i] ? "#5cff5c" : "#7fe9ff"; ctx.strokeRect(x - BAY_HALF - 4 + 0.5, 6.5, (BAY_HALF + 4) * 2 - 1, CELL - 7);
    if (state.bays[i]) drawShip(ctx, pilots[state.pilot].ship, 0, x, rowY(0) + 3, 1);
  });
  for (const l of state.lanes) for (const it of l.items) {
    const ph = warpPhase(l, it);
    if (ph > 7.2) {                                              // gone: a faint ripple where it was
      ctx.strokeStyle = "rgb(180 160 255 / 0.25)"; ctx.beginPath(); ctx.ellipse(it.x, rowY(l.row), l.len / 2, 8, 0, 0, Math.PI * 2); ctx.stroke();
      continue;
    }
    if (ph > 6 && Math.floor(now / 80) % 2) ctx.globalAlpha = 0.3;  // flickering before the jump
    drawShip(ctx, l.k.ship, l.dir > 0 ? 90 : 270, it.x, rowY(l.row), l.scale);
    ctx.globalAlpha = 1;
  }
  const me = state.me;
  if (me?.alive && state.phase !== "over") {
    const lift = me.hop > 0 ? Math.sin((1 - me.hop / hopTime(me.k)) * Math.PI) * 6 : 0;
    const y = me.from ? rowY(me.from.row) + (rowY(me.to.row) - rowY(me.from.row)) * (1 - Math.max(0, me.hop) / hopTime(me.k)) : rowY(me.row);
    if (me.jumping) {                                            // the hyperjump's streak
      ctx.strokeStyle = "rgb(180 155 255 / 0.6)"; ctx.lineWidth = me.k.len * 0.4;
      ctx.beginPath(); ctx.moveTo(me.x, rowY(me.from.row)); ctx.lineTo(me.x, y); ctx.stroke(); ctx.lineWidth = 1;
    }
    drawShip(ctx, me.k.ship, me.heading, me.x, y - lift, 1 + lift / 40);
  }
  for (const p of state.sparks) { ctx.globalAlpha = Math.min(1, (p.life / p.max) * 1.5); ctx.fillStyle = p.color; ctx.fillRect(p.x - 1, p.y - 1, 2, 2); }
  ctx.globalAlpha = 1;
  // The clock: a bar along the bottom.
  const f = Math.max(0, state.clock / CLOCK);
  ctx.fillStyle = f < 0.25 ? "#ff2a1a" : "#5cff5c"; ctx.fillRect(4, H - 5, (W - 8) * f, 3);
}

function hud() {
  $("score").textContent = state.score.toLocaleString();
  $("lives").textContent = Math.max(0, state.lives);
  $("level").textContent = state.level;
  $("note").textContent = state.flash;
  $("jump").textContent = state.me?.jump ? "ready" : "used";
  $("jump-btn").disabled = !state.me?.jump || state.phase !== "play";
}

// --- Pick ----------------------------------------------------------------------------------------

function renderPick() {
  $("pilots").replaceChildren(...pilots.map((k, i) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "hull";
    b.innerHTML = `<img src="${k.ship.urls.yard}" alt=""><span class="name">${k.name}</span>` +
      `<span class="specs">Hop ${Math.round(hopTime(k) * 1000)} ms · Maneuver ${k.record.Maneuver}</span>`;
    b.addEventListener("click", () => newGame(i));
    return b;
  }));
  const best = load();
  $("best").textContent = [state.result, best.score ? `Best ${best.score.toLocaleString()} points, level ${best.level}.` : ""].filter(Boolean).join(" ");
}
function showPick() { $("banner").hidden = true; $("pick").hidden = false; renderPick(); }

// --- Start ---------------------------------------------------------------------------------------

const STEP = 1 / 60;
requestAnimationFrame(function frame(now) {
  acc += Math.min(0.25, (now - last) / 1000);
  last = now;
  while (acc >= STEP) { update(STEP); acc -= STEP; }
  if (state.phase !== "loading") { draw(now); hud(); }
  requestAnimationFrame(frame);
});

const wanted = [...new Map([...LANES.map((l) => l.ship), ...PILOTS].map((s) => [s.join("/"), s])).values()];
const loaded = await Promise.all(wanted.map(([ed, slug]) => loadShip(ed, slug)));
wanted.forEach((s, i) => { const k = loaded[i]; ships[s.join("/")] = { ship: k, name: k.name, len: sideLength(k) }; });
pilots = PILOTS.map((s) => { const k = ships[s.join("/")]; return { ...k, record: k.ship.meta.stats }; });
state.lanes = laneSet();
state.bays = BAYS.map(() => false);
state.phase = "pick";
$("mute").onclick = () => { setMuted(!isMuted()); $("mute").textContent = `Sound: ${isMuted() ? "off" : "on"}`; $("mute").setAttribute("aria-pressed", String(isMuted())); };
$("mute").textContent = `Sound: ${isMuted() ? "off" : "on"}`;
$("jump-btn").onclick = () => hyperjump();
$("new").onclick = () => { state.phase = "pick"; showPick(); };
showPick();
// tick(n) runs n simulation steps at once, for play-tests on slow machines.
globalThis.crossing = { state, newGame, under, hyperjump, hopTime, BAYS, BAY_HALF, CELL, rowY, hop: (dx, dy) => { queued = [dx, dy]; },
  tick: (n = 1) => { for (let i = 0; i < n; i++) update(STEP); } };
