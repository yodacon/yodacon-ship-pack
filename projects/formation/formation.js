// Formation: Snake with the pack's ships. Fly the Yodacon round a minefield
// and pick up stranded ships; each falls in behind you and follows your exact
// path, drawn on the frame for its own heading. Every rescue lays another
// mine. Hit a mine, the edge of the field or your own formation and it's
// over. Every hull is drawn at one length (the pack's run from 24 to 87
// pixels), so the formation reads as a line, not a pile.
import { loadShip, drawShip, frameRect } from "../../lib/yodacon-ship-pack.js";
import { play, isMuted, setMuted } from "../../lib/yodacon-sound.js";

const $ = (id) => document.getElementById(id);
const canvas = $("screen"), ctx = canvas.getContext("2d");
const W = canvas.width, H = canvas.height, EDGE = 14, SAVE = "formation-v1";
const rad = (d) => (d * Math.PI) / 180;
const SIZE = 34;                                                  // every hull drawn about this big
const LEADER = ["conex", "yodacon"];
// Stranded ships come in this order, then at random; the Large Pin (the only
// Pin) and the 1998 Yodacon are worth more.
const STRANDED = [["conex", "gryphon"], ["conex", "trident"], ["konex", "citrus"], ["conex", "defender"], ["conex", "dart"],
  ["konex", "advisor"], ["conex", "necromancer"], ["override", "callisto"], ["conex", "tomaquad"], ["conex", "large-pin"], ["override", "yodacon"]];
const WORTH = { "large-pin": 3, yodacon: 3 };

const state = { phase: "loading", t: 0, score: 0, me: null, path: [], tail: [], pickup: null, mines: [], sparks: [], rescued: 0, cause: "" };
let kinds = {}, order = 0;
const stars = Array.from({ length: 120 }, () => ({ x: Math.random() * W, y: Math.random() * H, z: 0.2 + Math.random() * 0.8 }));

function load() { try { return JSON.parse(localStorage.getItem(SAVE)) ?? {}; } catch { return {}; } }
function save(d) { try { localStorage.setItem(SAVE, JSON.stringify(d)); } catch { /* not kept */ } }
const scaleOf = (k) => SIZE / k.len;

// A hull's length on frame 0, from its alpha: the sprites' frames run from 32
// to 96 px but the hulls inside them are 24 to 87 px long, and thin or wide.
function hullLength(ship) {
  const r = frameRect(ship, 0), c = new OffscreenCanvas(r.w, r.h), g = c.getContext("2d");
  g.drawImage(ship.sheet, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
  const a = g.getImageData(0, 0, r.w, r.h).data;
  let lo = r.h, hi = 0;
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) if (a[(y * r.w + x) * 4 + 3] > 40) { lo = Math.min(lo, y); hi = Math.max(hi, y); }
  return hi - lo + 1;
}

// --- Game ----------------------------------------------------------------------------------------

function newGame() {
  Object.assign(state, { phase: "play", t: 0, score: 0, tail: [], mines: [], sparks: [], rescued: 0, cause: "" });
  state.me = { k: kinds[LEADER.join("/")], x: W / 2, y: H * 0.7, heading: 0, speed: 105, turn: 0 };
  state.path = [{ x: state.me.x, y: state.me.y, h: 0, d: 0 }];
  order = 0;
  placePickup();
  $("banner").hidden = true;
}

function freeSpot(clear) {
  for (let tries = 0; tries < 200; tries++) {
    const x = 50 + Math.random() * (W - 100), y = 50 + Math.random() * (H - 100);
    if (Math.hypot(x - state.me.x, y - state.me.y) < clear) continue;
    if (state.mines.some((m) => Math.hypot(m.x - x, m.y - y) < 46)) continue;
    if (state.tail.some((f) => Math.hypot(f.x - x, f.y - y) < 40)) continue;
    if (state.pickup && Math.hypot(state.pickup.x - x, state.pickup.y - y) < 60) continue;
    return { x, y };
  }
  return { x: 60 + Math.random() * (W - 120), y: 60 + Math.random() * (H - 120) };
}

function placePickup() {
  const id = order < STRANDED.length ? STRANDED[order] : STRANDED[Math.floor(Math.random() * STRANDED.length)];
  order++;
  state.pickup = { k: kinds[id.join("/")], ...freeSpot(120), spin: Math.random() * 360 };
}

// The distance along the path from the leader back to each follower: half of
// each neighbour's length, plus a little air.
function spacings() {
  let d = 0, prev = SIZE * 0.55;
  return state.tail.map(() => { d += prev + SIZE * 0.45; prev = SIZE * 0.55; return d; });
}

// --- Input ---------------------------------------------------------------------------------------

const held = new Set(), touch = { side: 0 };
addEventListener("keydown", (e) => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (state.phase === "play" && (k.startsWith("Arrow") || k === " ")) e.preventDefault();
  if ((k === "Enter" || k === " ") && state.phase !== "play") newGame();
  held.add(k);
});
addEventListener("keyup", (e) => held.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key));
addEventListener("blur", () => held.clear());
canvas.addEventListener("pointerdown", (e) => {
  if (state.phase !== "play") { newGame(); return; }
  const b = canvas.getBoundingClientRect();
  touch.side = e.clientX - b.left < b.width / 2 ? -1 : 1;
});
for (const ev of ["pointerup", "pointercancel", "pointerleave"]) canvas.addEventListener(ev, () => { touch.side = 0; });

function steering() {
  let s = 0;
  if (held.has("ArrowLeft") || held.has("a")) s -= 1;
  if (held.has("ArrowRight") || held.has("d")) s += 1;
  if (touch.side) s = touch.side;
  const pad = [...(navigator.getGamepads?.() ?? [])].find(Boolean);
  if (pad) {
    const ax = pad.axes[0] ?? 0;
    if (Math.abs(ax) > 0.25) s = ax;
    if (pad.buttons[14]?.pressed) s = -1; if (pad.buttons[15]?.pressed) s = 1;
    if (state.phase !== "play" && (pad.buttons[0]?.pressed || pad.buttons[9]?.pressed)) newGame();
  }
  return s;
}

// --- Update --------------------------------------------------------------------------------------

function update(dt) {
  state.t += dt;
  for (const s of state.sparks) { s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt; }
  state.sparks = state.sparks.filter((s) => s.life > 0);
  if (state.pickup) state.pickup.spin = (state.pickup.spin + 40 * dt) % 360;
  if (state.phase !== "play") { steering(); return; }
  const me = state.me;
  me.heading = (me.heading + (state.steer ?? steering()) * 190 * dt + 360) % 360;
  me.x += Math.sin(rad(me.heading)) * me.speed * dt;
  me.y -= Math.cos(rad(me.heading)) * me.speed * dt;
  const lastP = state.path[state.path.length - 1];
  state.path.push({ x: me.x, y: me.y, h: me.heading, d: lastP.d + Math.hypot(me.x - lastP.x, me.y - lastP.y) });

  // Followers sit on the path, each at its spacing behind the leader.
  const gaps = spacings(), head = state.path[state.path.length - 1].d;
  let j = state.path.length - 1;
  state.tail.forEach((f, i) => {
    const want = head - gaps[i];
    while (j > 0 && state.path[j - 1].d >= want) j--;
    const p = state.path[Math.max(0, j - 1)], q = state.path[j];
    const f2 = q.d > p.d ? (want - p.d) / (q.d - p.d) : 0;
    f.x = p.x + (q.x - p.x) * f2; f.y = p.y + (q.y - p.y) * f2; f.heading = q.h;
  });
  const keep = head - (gaps[gaps.length - 1] ?? 0) - 40;          // drop the path nobody needs any more
  let cut = 0;
  while (cut < state.path.length - 2 && state.path[cut + 1].d < keep) cut++;
  if (cut > 200) state.path.splice(0, cut);

  if (me.x < EDGE || me.x > W - EDGE || me.y < EDGE || me.y > H - EDGE) return crash("Flew off the edge of the field");
  for (const m of state.mines) if (Math.hypot(m.x - me.x, m.y - me.y) < 15) return crash("Hit a mine");
  for (let i = 2; i < state.tail.length; i++) {
    const f = state.tail[i];
    if (Math.hypot(f.x - me.x, f.y - me.y) < SIZE * 0.55) return crash(`Rammed your own ${f.k.name}`);
  }
  const p = state.pickup;
  if (p && Math.hypot(p.x - me.x, p.y - me.y) < SIZE * 0.8) {
    const worth = WORTH[p.k.ship.slug] ?? 1;
    state.rescued++;
    state.score += 10 * (state.tail.length + 1) * worth;
    state.tail.push({ k: p.k, x: me.x, y: me.y, heading: me.heading });
    burst(p.x, p.y, 14, "#5cff5c", 60);
    play("pickup");
    me.speed = Math.min(190, 105 + state.rescued * 4);
    state.mines.push(freeSpot(140));                             // every rescue lays another mine
    placePickup();
  }
}

function crash(why) {
  state.phase = "over"; state.cause = why;
  burst(state.me.x, state.me.y, 40, "#ff7a59", 140);
  play("boom");
  const best = load(), record = state.score > (best.score ?? 0);
  if (record) save({ score: state.score, length: state.tail.length });
  banner(why, `${state.tail.length} ship${state.tail.length === 1 ? "" : "s"} in formation, ${state.score.toLocaleString()} points` +
    `${record ? " — your best" : best.score ? `; best ${best.score.toLocaleString()}` : ""}. Enter, Space or tap to fly again.`);
}

function burst(x, y, n, color, speed) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = speed * (0.3 + Math.random());
    state.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.2 + Math.random() * 0.6, max: 0.8, color });
  }
}
function banner(title, text) { $("banner-title").textContent = title; $("banner-text").textContent = text; $("banner").hidden = false; }

// --- Drawing -------------------------------------------------------------------------------------

function draw() {
  ctx.fillStyle = "#03050a"; ctx.fillRect(0, 0, W, H);
  for (const s of stars) { ctx.fillStyle = `rgb(170 180 220 / ${s.z})`; ctx.fillRect(s.x, s.y, 1, 1); }
  ctx.strokeStyle = "rgb(255 179 64 / 0.4)"; ctx.setLineDash([10, 8]);
  ctx.strokeRect(EDGE - 6.5, EDGE - 6.5, W - 2 * EDGE + 13, H - 2 * EDGE + 13); ctx.setLineDash([]);
  const blink = Math.floor(state.t * 2.5) % 2;
  for (const m of state.mines) {
    ctx.fillStyle = blink ? "#ff2a1a" : "#7a1a12"; ctx.beginPath(); ctx.arc(m.x, m.y, 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgb(255 42 26 / 0.3)"; ctx.beginPath(); ctx.arc(m.x, m.y, 12, 0, Math.PI * 2); ctx.stroke();
  }
  const p = state.pickup;
  if (p) {                                                       // a stranded ship, tumbling through all 36 frames
    ctx.strokeStyle = `rgb(92 255 92 / ${0.25 + 0.2 * Math.sin(state.t * 5)})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, SIZE * 0.8, 0, Math.PI * 2); ctx.stroke();
    drawShip(ctx, p.k.ship, p.spin, p.x, p.y, scaleOf(p.k));
  }
  for (let i = state.tail.length - 1; i >= 0; i--) { const f = state.tail[i]; drawShip(ctx, f.k.ship, f.heading, f.x, f.y, scaleOf(f.k)); }
  const me = state.me;
  if (me && state.phase !== "over") drawShip(ctx, me.k.ship, me.heading, me.x, me.y, scaleOf(me.k) * 1.15);
  for (const s of state.sparks) { ctx.globalAlpha = Math.min(1, (s.life / s.max) * 1.5); ctx.fillStyle = s.color; ctx.fillRect(s.x - 1, s.y - 1, 2, 2); }
  ctx.globalAlpha = 1;
}

function hud() {
  $("score").textContent = state.score.toLocaleString();
  $("length").textContent = state.tail.length;
  $("speed").textContent = Math.round(state.me?.speed ?? 0);
  $("best").textContent = (load().score ?? 0).toLocaleString();
  $("next").textContent = state.pickup ? `${state.pickup.k.name}${WORTH[state.pickup.k.ship.slug] ? " (worth triple)" : ""}` : "–";
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

const wanted = [LEADER, ...STRANDED];
const ships = await Promise.all(wanted.map(([ed, slug]) => loadShip(ed, slug)));
wanted.forEach(([ed, slug], i) => { kinds[`${ed}/${slug}`] = { ship: ships[i], len: hullLength(ships[i]), name: ed === "override" && slug === "yodacon" ? "1998 Yodacon" : ships[i].name }; });
state.me = { k: kinds[LEADER.join("/")], x: W / 2, y: H * 0.7, heading: 0, speed: 105 };
state.path = [{ x: state.me.x, y: state.me.y, h: 0, d: 0 }];
placePickup();
state.phase = "title";
banner("Formation", "Steer with ← → (or tap the left or right half). Pick up stranded ships; don't hit mines, the edge or your own line. Enter, Space or tap to start.");
$("mute").onclick = () => { setMuted(!isMuted()); $("mute").textContent = `Sound: ${isMuted() ? "off" : "on"}`; $("mute").setAttribute("aria-pressed", String(isMuted())); };
$("mute").textContent = `Sound: ${isMuted() ? "off" : "on"}`;
// tick(n) runs n simulation steps at once; steer (-1..1, or null for the
// keys) lets a play-test fly without key events.
globalThis.formation = { state, newGame, SIZE, EDGE, W, H, spacings,
  tick: (n = 1) => { for (let i = 0; i < n; i++) update(STEP); } };
