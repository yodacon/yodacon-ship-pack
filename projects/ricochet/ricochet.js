// Ricochet: Breakout with the pack's ships. The bricks are pirate formations,
// every ship nose down on frame 18; the tougher the hull, the more hits it
// takes. Your paddle is a ship too, and its width is its hull's. From the
// third formation the front rank drops bombs that stun the paddle. Ships you
// break sometimes drop pickups: W escort wings (two Gryphons fly alongside,
// a wider paddle), M two more balls, L lasers, S a slower ball. The tractor
// (Shift or C) catches the ball on the paddle, three times a formation; let
// it go with Space or a click.
import { loadShip, drawShip, frameRect } from "../../lib/yodacon-ship-pack.js";
import { play, isMuted, setMuted } from "../../lib/yodacon-sound.js";

const $ = (id) => document.getElementById(id);
const canvas = $("screen"), ctx = canvas.getContext("2d");
const W = canvas.width, H = canvas.height, SAVE = "ricochet-v1";
const COLS = 10, CW = 60, CH = 38, TOP = 56, LEFT = (W - COLS * CW) / 2, PADDLE_Y = H - 46, BALL_R = 6;
const TRACTORS = 3, LIVES = 3;

// The pirates, by toughness. The Large Pin (the only Pin) is a 2 × 2 boss.
const KINDS = {
  t: { ship: ["conex", "trident"], hp: 1, points: 10 }, g: { ship: ["conex", "gryphon"], hp: 1, points: 10 },
  c: { ship: ["konex", "citrus"], hp: 1, points: 15 }, a: { ship: ["konex", "advisor"], hp: 2, points: 25 },
  d: { ship: ["conex", "defender"], hp: 2, points: 25 }, n: { ship: ["conex", "necromancer"], hp: 2, points: 30 },
  r: { ship: ["conex", "dart"], hp: 3, points: 40 }, m: { ship: ["conex", "tomaquad"], hp: 3, points: 40 },
  y: { ship: ["conex", "yodacon"], hp: 4, points: 60 }, P: { ship: ["conex", "large-pin"], hp: 14, points: 500, big: true },
};
// Formations, ten columns a row. "P" marks the Large Pin's top-left cell.
const FORMATIONS = [
  { name: "The picket line", rows: ["tttttttttt", "gggggggggg", "tttttttttt", "cccccccccc"] },
  { name: "Chevron", rows: ["a........a", "da......ad", ".da....ad.", "..dattad..", "...gttg...", "....gg...."] },
  { name: "The fortress", rows: ["nnnnnnnnnn", "n.dddddd.n", "n.d....d.n", "n.d.yy.d.n", "n.dddddd.n", "nnnnnnnnnn"] },
  { name: "Escort duty", rows: ["rr..yy..rr", "mm..yy..mm", "..aaaaaa..", "gcgcgcgcgc", "cgcgcgcgcg"] },
  { name: "The Pin", rows: ["yyyy..yyyy", "nnnnP.nnnn", "nnnn..nnnn", "rrrrrrrrrr", "dddddddddd", "aaaaaaaaaa"] },
];
// Your paddle: three hulls, wide and slow to narrow and quick. Width in px.
const PADDLES = [["override", "callisto", 96], ["conex", "yodacon", 76], ["conex", "defender", 56]];
const PICKUPS = { W: "#7ef0a8", M: "#8fd8ff", L: "#ff7a59", S: "#ffcf6b" };

const state = { phase: "loading", level: 0, score: 0, lives: LIVES, paddle: null, balls: [], ships: [], drops: [], bombs: [], lasers: [],
  sparks: [], tractors: TRACTORS, holding: false, t: 0, pick: 0, effects: {} };
let kinds = {}, paddles = [], wing = null;
const stars = Array.from({ length: 120 }, () => ({ x: Math.random() * W, y: Math.random() * H, z: 0.2 + Math.random() * 0.8 }));

function load() { try { return JSON.parse(localStorage.getItem(SAVE)) ?? {}; } catch { return {}; } }
function save(d) { try { localStorage.setItem(SAVE, JSON.stringify(d)); } catch { /* not kept */ } }

// A hull's length and beam on frame 0, from its alpha.
function extent(ship) {
  const r = frameRect(ship, 0), c = new OffscreenCanvas(r.w, r.h), g = c.getContext("2d");
  g.drawImage(ship.sheet, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
  const a = g.getImageData(0, 0, r.w, r.h).data;
  let x0 = r.w, x1 = 0, y0 = r.h, y1 = 0;
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) if (a[(y * r.w + x) * 4 + 3] > 40) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return { len: y1 - y0 + 1, wid: x1 - x0 + 1 };
}

// --- Levels --------------------------------------------------------------------------------------

function newGame(pick = state.pick) {
  Object.assign(state, { phase: "serve", pick, level: 0, score: 0, lives: LIVES });
  $("pick").hidden = true;
  startLevel();
}

function startLevel() {
  const f = FORMATIONS[state.level % FORMATIONS.length], round = Math.floor(state.level / FORMATIONS.length);
  state.ships = [];
  f.rows.forEach((row, r) => [...row].forEach((ch, c) => {
    const k = kinds[ch];
    if (!k) return;
    const w = k.big ? 2 : 1, hp = k.hp + round;           // round two: everything a hit tougher
    state.ships.push({ k, x: LEFT + c * CW, y: TOP + r * CH, w: CW * w, h: CH * w, hp, max: hp, flash: 0 });
  }));
  Object.assign(state, { drops: [], bombs: [], lasers: [], effects: {}, tractors: TRACTORS, holding: false });
  serve();
  banner(f.name, `Formation ${state.level + 1}${round ? ` (round ${round + 1}: every ship a hit tougher)` : ""}. Space or click to launch.`, 2);
}

function serve() {
  const p = paddles[state.pick];
  state.paddle = { k: p, x: state.paddle?.x ?? W / 2, w: p.w, stun: 0, cool: 0 };
  state.balls = [{ x: state.paddle.x, y: PADDLE_Y - 12, vx: 0, vy: 0, held: true }];
  state.phase = "serve";
}

const speed = () => (310 + state.level * 14) * (state.effects.S > state.t ? 0.65 : 1);
function launch() {
  for (const b of state.balls) if (b.held) {
    const off = (b.x - state.paddle.x) / (paddleWidth() / 2), a = Math.max(-1, Math.min(1, off)) * 55 - 0.0001;
    const v = speed();
    b.vx = Math.sin(rad(a)) * v; b.vy = -Math.cos(rad(a)) * v; b.held = false;
  }
  state.holding = false;
  if (state.phase === "serve") state.phase = "play";
  play("send");
}
const rad = (d) => (d * Math.PI) / 180;
const paddleWidth = () => state.paddle.w + (state.effects.W > state.t ? 44 : 0);

// The tractor: the next touch on the paddle catches the ball.
function tractor() {
  if (state.phase !== "play" || state.tractors <= 0 || state.holding) return false;
  state.tractors--; state.holding = true;
  play("select");
  return true;
}

// --- Input ---------------------------------------------------------------------------------------

const held = new Set();
let pointerX = null;
addEventListener("keydown", (e) => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if ((k === " " || k.startsWith("Arrow")) && state.phase !== "pick") e.preventDefault();
  if (k === " " && !e.repeat) { if (state.balls.some((b) => b.held)) launch(); }
  if ((k === "Shift" || k === "c") && !e.repeat) tractor();
  if (k === "Enter" && state.phase === "over") showPick();
  held.add(k);
});
addEventListener("keyup", (e) => held.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key));
addEventListener("blur", () => held.clear());
const toGame = (e) => { const b = canvas.getBoundingClientRect(); return ((e.clientX - b.left) / b.width) * W; };
canvas.addEventListener("pointermove", (e) => { pointerX = toGame(e); });
canvas.addEventListener("pointerdown", (e) => {
  pointerX = toGame(e);
  if (state.phase === "over") { showPick(); return; }
  if (state.balls.some((b) => b.held)) launch();
});
canvas.addEventListener("pointerleave", () => { if (matchMedia("(pointer: fine)").matches) pointerX = null; });

// --- Update --------------------------------------------------------------------------------------

function update(dt) {
  state.t += dt;
  for (const s of state.sparks) { s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt; }
  state.sparks = state.sparks.filter((s) => s.life > 0);
  if (bannerUntil && state.t > bannerUntil) { $("banner").hidden = true; bannerUntil = 0; }
  if (state.phase !== "play" && state.phase !== "serve") return;
  const p = state.paddle, pw = paddleWidth();

  // The paddle: pointer, keys or gamepad; stunned by a bomb, it can't move.
  let move = 0;
  if (held.has("ArrowLeft") || held.has("a")) move -= 1;
  if (held.has("ArrowRight") || held.has("d")) move += 1;
  const pad = [...(navigator.getGamepads?.() ?? [])].find(Boolean);
  if (pad) {
    const ax = pad.axes[0] ?? 0, b = (n) => pad.buttons[n]?.pressed;
    if (Math.abs(ax) > 0.2) move = ax; if (b(14)) move = -1; if (b(15)) move = 1;
    if ((b(0) || b(7)) && state.balls.some((x) => x.held)) launch();
    if (b(1) && !padTractor) tractor();
    padTractor = b(1);
  }
  if (p.stun > 0) p.stun -= dt;
  else if (state.autoX != null) p.x += Math.max(-p.k.speed * dt, Math.min(p.k.speed * dt, state.autoX - p.x));
  else if (move) p.x += move * p.k.speed * dt;
  else if (pointerX != null) p.x += Math.max(-p.k.speed * 1.6 * dt, Math.min(p.k.speed * 1.6 * dt, pointerX - p.x));
  p.x = Math.max(pw / 2 + 4, Math.min(W - pw / 2 - 4, p.x));

  // Lasers, while they last: two bolts every 0.3 s.
  if (state.effects.L > state.t && (p.cool -= dt) <= 0 && state.phase === "play") {
    p.cool = 0.3;
    for (const o of [-pw / 2 + 6, pw / 2 - 6]) state.lasers.push({ x: p.x + o, y: PADDLE_Y - 10 });
    play("shot");
  }
  for (const l of state.lasers) {
    l.y -= 520 * dt;
    const s = state.ships.find((o) => o.hp > 0 && l.x > o.x && l.x < o.x + o.w && l.y > o.y && l.y < o.y + o.h);
    if (s) { l.dead = true; hitShip(s); }
    if (l.y < 0) l.dead = true;
  }
  state.lasers = state.lasers.filter((l) => !l.dead);

  for (const b of state.balls) {
    if (b.held) { b.x = p.x + (b.off ?? 0); b.y = PADDLE_Y - 12; continue; }
    // Keep the speed where the level (and the slow pickup) say.
    const v = Math.hypot(b.vx, b.vy) || 1, want = speed() * Math.min(1.45, 1 + (b.hits ?? 0) * 0.02);
    b.vx *= want / v; b.vy *= want / v;
    // Sub-steps, so a fast ball can't jump a ship.
    const n = Math.ceil((want * dt) / 5);
    for (let i = 0; i < n && !b.lost; i++) stepBall(b, dt / n, p, pw);
  }
  state.balls = state.balls.filter((b) => !b.lost);
  if (!state.balls.length) return loseBall();

  // Bombs from the front rank, from the third formation.
  if (state.level >= 2 && state.phase === "play") {
    const front = new Map();
    for (const s of state.ships) if (s.hp > 0) { const col = Math.round((s.x - LEFT) / CW); if (!front.has(col) || front.get(col).y < s.y) front.set(col, s); }
    for (const s of front.values()) if (Math.random() < dt * 0.06 * (1 + state.level * 0.15)) state.bombs.push({ x: s.x + s.w / 2, y: s.y + s.h });
  }
  for (const bm of state.bombs) {
    bm.y += 170 * dt;
    if (bm.y > PADDLE_Y - 8 && bm.y < PADDLE_Y + 8 && Math.abs(bm.x - p.x) < pw / 2) { bm.dead = true; p.stun = 1; burst(bm.x, bm.y, 10, "#ff7a59", 80); play("hit"); }
    if (bm.y > H) bm.dead = true;
  }
  state.bombs = state.bombs.filter((bm) => !bm.dead);
  for (const d of state.drops) {
    d.y += 120 * dt;
    if (d.y > PADDLE_Y - 10 && d.y < PADDLE_Y + 10 && Math.abs(d.x - p.x) < pw / 2 + 8) { d.dead = true; pickup(d.kind); }
    if (d.y > H) d.dead = true;
  }
  state.drops = state.drops.filter((d) => !d.dead);
  for (const s of state.ships) if (s.flash > 0) s.flash -= dt;
  if (!state.ships.some((s) => s.hp > 0)) levelDone();
}
let padTractor = false;

function stepBall(b, dt, p, pw) {
  b.x += b.vx * dt; b.y += b.vy * dt;
  if (b.x < BALL_R) { b.x = BALL_R; b.vx = Math.abs(b.vx); }
  if (b.x > W - BALL_R) { b.x = W - BALL_R; b.vx = -Math.abs(b.vx); }
  if (b.y < BALL_R) { b.y = BALL_R; b.vy = Math.abs(b.vy); }
  if (b.y > H + 20) { b.lost = true; return; }
  // The paddle: where it lands sets the angle out, up to 60° either side.
  if (b.vy > 0 && b.y > PADDLE_Y - 10 && b.y < PADDLE_Y + 6 && Math.abs(b.x - p.x) < pw / 2 + BALL_R) {
    if (state.holding) { b.held = true; b.off = b.x - p.x; b.vx = b.vy = 0; state.holding = false; play("pickup"); return; }
    const off = Math.max(-1, Math.min(1, (b.x - p.x) / (pw / 2))), a = rad(off * 60), v = Math.hypot(b.vx, b.vy);
    b.vx = Math.sin(a) * v; b.vy = -Math.cos(a) * v; b.y = PADDLE_Y - 10;
    b.hits = (b.hits ?? 0) + 1;
    play("select");
  }
  // Ships: bounce off the side with the shallower overlap.
  for (const s of state.ships) {
    if (s.hp <= 0) continue;
    const x0 = s.x + 4, x1 = s.x + s.w - 4, y0 = s.y + 4, y1 = s.y + s.h - 4;
    if (b.x + BALL_R < x0 || b.x - BALL_R > x1 || b.y + BALL_R < y0 || b.y - BALL_R > y1) continue;
    const ox = Math.min(b.x + BALL_R - x0, x1 - (b.x - BALL_R)), oy = Math.min(b.y + BALL_R - y0, y1 - (b.y - BALL_R));
    if (ox < oy) { b.vx = b.x < (x0 + x1) / 2 ? -Math.abs(b.vx) : Math.abs(b.vx); }
    else { b.vy = b.y < (y0 + y1) / 2 ? -Math.abs(b.vy) : Math.abs(b.vy); }
    hitShip(s);
    break;
  }
}

function hitShip(s) {
  s.hp--; s.flash = 0.12;
  if (s.hp > 0) { play("hit"); return; }
  state.score += s.k.points * (1 + Math.floor(state.level / FORMATIONS.length));
  burst(s.x + s.w / 2, s.y + s.h / 2, s.k.big ? 60 : 16, "#ffcf6b", s.k.big ? 180 : 110);
  play("boom");
  if (Math.random() < (s.k.big ? 1 : 0.12)) {
    const kind = "WMLS"[Math.floor(Math.random() * 4)];
    state.drops.push({ x: s.x + s.w / 2, y: s.y + s.h / 2, kind });
  }
}

function pickup(kind) {
  play("pickup");
  if (kind === "M") {
    const src = state.balls.find((b) => !b.held) ?? state.balls[0];
    for (const d of [-25, 25]) {
      const v = speed(), a = Math.atan2(src.vx || 0.01, -(src.vy || -1)) + rad(d);
      state.balls.push({ x: src.x, y: src.y, vx: Math.sin(a) * v, vy: -Math.cos(a) * v, hits: src.hits ?? 0 });
    }
  } else state.effects[kind] = state.t + (kind === "W" ? 15 : 10);
  banner({ W: "Escort wings", M: "Multiball", L: "Lasers", S: "Slow ball" }[kind], "", 1);
}

function loseBall() {
  state.lives--;
  burst(state.paddle.x, PADDLE_Y, 30, "#ff7a59", 120);
  play("lost");
  if (state.lives <= 0) return gameOver();
  state.effects = {}; state.bombs = []; state.drops = []; state.lasers = [];
  serve();
  banner("Ball lost", `${state.lives} left. Space or click to launch.`, 1.5);
}

function levelDone() {
  state.level++;
  state.score += state.lives * 100;
  play("won");
  startLevel();
}

function gameOver() {
  state.phase = "over";
  const best = load(), key = paddles[state.pick].ship.slug, record = !best[key] || state.score > best[key];
  if (record) save({ ...best, [key]: state.score });
  banner("Game over", `${state.score.toLocaleString()} points, formation ${state.level + 1}${record ? " — your best with this hull" : ""}. Enter or click to choose again.`, 0);
}

function burst(x, y, n, color, sp) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = sp * (0.3 + Math.random());
    state.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.2 + Math.random() * 0.5, max: 0.7, color });
  }
}

let bannerUntil = 0;
function banner(title, text, secs) {
  $("banner-title").textContent = title; $("banner-text").textContent = text; $("banner").hidden = false;
  bannerUntil = secs ? state.t + secs : 0;
}

// --- Drawing -------------------------------------------------------------------------------------

function draw() {
  ctx.fillStyle = "#03050a"; ctx.fillRect(0, 0, W, H);
  for (const s of stars) { ctx.fillStyle = `rgb(170 180 220 / ${s.z})`; ctx.fillRect(s.x, s.y, 1, 1); }
  for (const s of state.ships) {
    if (s.hp <= 0) continue;
    if (s.k.big) { ctx.strokeStyle = "rgb(194 107 216 / 0.4)"; ctx.strokeRect(s.x + 3.5, s.y + 3.5, s.w - 7, s.h - 7); }
    if (s.flash > 0) ctx.globalAlpha = 0.5;
    drawShip(ctx, s.k.ship, 180, s.x + s.w / 2, s.y + s.h / 2, s.k.scale * (s.k.big ? 2 : 1));
    ctx.globalAlpha = 1;
    if (s.max > 1) for (let i = 0; i < s.max; i++) {          // hit pips under each tough ship
      ctx.fillStyle = i < s.hp ? "#ffb340" : "rgb(255 255 255 / 0.15)";
      ctx.fillRect(s.x + s.w / 2 - s.max * 2.5 + i * 5, s.y + s.h - 5, 4, 2);
    }
  }
  for (const d of state.drops) {
    ctx.fillStyle = PICKUPS[d.kind]; ctx.beginPath(); ctx.arc(d.x, d.y, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#04140b"; ctx.font = "700 11px ui-monospace, monospace"; ctx.fillText(d.kind, d.x - 4, d.y + 4);
  }
  for (const bm of state.bombs) { ctx.fillStyle = "#ff7a59"; ctx.beginPath(); ctx.arc(bm.x, bm.y, 3, 0, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = "#ff7a59"; ctx.lineWidth = 2;
  for (const l of state.lasers) { ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(l.x, l.y + 10); ctx.stroke(); }
  ctx.lineWidth = 1;
  const p = state.paddle;
  if (p && state.phase !== "pick") {
    const pw = paddleWidth();
    if (state.holding) {                                          // the tractor, waiting
      ctx.fillStyle = `rgb(127 233 255 / ${0.15 + 0.1 * Math.sin(state.t * 10)})`;
      ctx.fillRect(p.x - pw / 2, PADDLE_Y - 40, pw, 34);
    }
    if (state.effects.W > state.t) for (const side of [-1, 1]) drawShip(ctx, wing, 0, p.x + side * (pw / 2 - 10), PADDLE_Y + 4, 0.8);
    if (p.stun > 0 && Math.floor(state.t * 12) % 2) ctx.globalAlpha = 0.4;
    drawShip(ctx, p.k.ship, 0, p.x, PADDLE_Y + 4, p.k.scale);
    ctx.globalAlpha = 1;
  }
  for (const b of state.balls) {
    const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, BALL_R * 2);
    g.addColorStop(0, "#ffffff"); g.addColorStop(0.4, "#8fd8ff"); g.addColorStop(1, "rgb(143 216 255 / 0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, BALL_R * 2, 0, Math.PI * 2); ctx.fill();
  }
  for (const s of state.sparks) { ctx.globalAlpha = Math.min(1, (s.life / s.max) * 1.5); ctx.fillStyle = s.color; ctx.fillRect(s.x - 1, s.y - 1, 2, 2); }
  ctx.globalAlpha = 1;
}

function hud() {
  $("score").textContent = state.score.toLocaleString();
  $("lives").textContent = Math.max(0, state.lives);
  $("level").textContent = state.level + 1;
  $("tractor").textContent = state.holding ? "on" : state.tractors;
}

// --- Pick ----------------------------------------------------------------------------------------

function renderPick() {
  const best = load();
  $("hulls").replaceChildren(...paddles.map((h, i) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "hull";
    b.innerHTML = `<img src="${h.ship.urls.yard}" alt=""><span class="name">${h.name}</span>` +
      `<span class="specs">${h.w} px wide · ${h.speed} px/s</span>` + (best[h.ship.slug] ? `<span class="best">Best ${best[h.ship.slug].toLocaleString()}</span>` : "");
    b.addEventListener("click", () => newGame(i));
    return b;
  }));
}
function showPick() { state.phase = "pick"; $("banner").hidden = true; $("pick").hidden = false; renderPick(); }

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

const kindKeys = Object.keys(KINDS);
const loaded = await Promise.all([...kindKeys.map((k) => KINDS[k].ship), ...PADDLES].map(([ed, slug]) => loadShip(ed, slug)));
kindKeys.forEach((key, i) => {
  const ship = loaded[i], e = extent(ship);
  kinds[key] = { ...KINDS[key], ship, scale: Math.min(1.6, 34 / Math.max(e.len, e.wid)) };   // fits a 60 × 38 cell
});
paddles = loaded.slice(kindKeys.length).map((ship, i) => {
  const e = extent(ship), w = PADDLES[i][2];
  return { ship, name: ship.name, w, scale: Math.min(2, (w * 0.9) / e.wid), speed: Math.round(260 + ship.meta.stats.Speed * 0.5) };
});
wing = kinds.g.ship;
state.paddle = { k: paddles[0], x: W / 2, w: paddles[0].w, stun: 0, cool: 0 };
startLevel(); state.phase = "pick"; $("banner").hidden = true;
$("mute").onclick = () => { setMuted(!isMuted()); $("mute").textContent = `Sound: ${isMuted() ? "off" : "on"}`; $("mute").setAttribute("aria-pressed", String(isMuted())); };
$("mute").textContent = `Sound: ${isMuted() ? "off" : "on"}`;
$("new").onclick = showPick;
$("tractor-btn").onclick = () => tractor();
showPick();
// tick(n) runs n simulation steps at once; autoX moves the paddle for a play-test.
globalThis.ricochet = { state, newGame, launch, tractor, PADDLE_Y, W, H, BALL_R, paddleWidth, FORMATIONS,
  tick: (n = 1) => { for (let i = 0; i < n; i++) update(STEP); } };
