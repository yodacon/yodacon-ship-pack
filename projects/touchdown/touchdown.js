// Touchdown: Lunar Lander with the pack's ships. Bring your hull down on a
// pad, upright and slow, on five worlds: a rocky moon, an ice world with slick
// pads, a garden world with wind and air, a lava world that throws rocks, and
// last the deck of a Large Pin carrier moving over a gas giant. Every hull
// thrusts, turns and carries fuel by its 1997 record. Retro rockets (Shift):
// twice a world, kill three quarters of your speed in a breath.
import { loadShip, drawShip, frameRect, frameIndex, loadImage, PACK_BASE } from "../../lib/yodacon-ship-pack.js";
import { play as sound, isMuted, setMuted } from "../../lib/yodacon-sound.js";

let touched = false;
for (const ev of ["pointerdown", "keydown"]) addEventListener(ev, () => { touched = true; }, { once: true, capture: true });
const play = (name) => { if (touched) sound(name); };

const $ = (id) => document.getElementById(id);
const canvas = $("screen"), ctx = canvas.getContext("2d");
const W = canvas.width, H = canvas.height, SAVE = "touchdown-v1", LENGTH = 30, RETROS = 2;
const rad = (d) => (d * Math.PI) / 180;
const SAFE = { vy: 42, vx: 22, tilt: 12 };

// The hulls you can fly: every design but the Large Pin, which is the carrier.
const HULLS = [["conex", "gryphon"], ["conex", "defender"], ["conex", "trident"], ["konex", "citrus"], ["konex", "advisor"],
  ["conex", "necromancer"], ["conex", "yodacon"], ["override", "callisto"], ["conex", "tomaquad"], ["conex", "dart"], ["override", "yodacon"]];
const KONEX_STATS = { advisor: { Accel: 600, Maneuver: 4, Fuel: 500 }, citrus: { Accel: 650, Maneuver: 5, Fuel: 400 } };
const CARRIER = ["conex", "large-pin"];

// Five worlds; gravity in px/s². `slick` narrows the sideways limit; `wind`
// is the gust strength; `vents` throw rocks; `carrier` replaces the ground.
const WORLDS = [
  { name: "Rocky moon", planet: "rocky", g: 18, sky: ["#05060a", "#0c0e14"], ground: ["#7d7468", "#3a342e"], pads: [[90, 1], [56, 2], [40, 4]] },
  { name: "Ice world", planet: "ice", g: 23, sky: ["#060a12", "#14223a"], ground: ["#d8ecf5", "#6f8fa6"], slick: true, jag: 1.5, pads: [[70, 1], [48, 3], [38, 5]] },
  { name: "Garden world", planet: "garden", g: 27, sky: ["#0b1830", "#2c5a7d"], ground: ["#4d7a3a", "#23361c"], wind: 16, air: 0.12, pads: [[80, 1], [52, 2], [40, 4]] },
  { name: "Lava world", planet: "lava", g: 31, sky: ["#120604", "#3a1208"], ground: ["#3a2a24", "#120a08"], vents: 2, pads: [[70, 1], [48, 3], [40, 5]] },
  { name: "Carrier deck", planet: "gas", g: 22, sky: ["#05060c", "#141a2c"], carrier: true },
];

const state = { phase: "loading", pick: 0, world: 0, tour: 1, score: 0, ships: 3, me: null, ground: [], pads: [], rocks: [], sparks: [],
  retros: RETROS, retro: 0, wind: 0, t: 0, carrier: null, landings: 0 };
let hulls = [], art = {}, planetArt = {}, deck = null;

function load() { try { return JSON.parse(localStorage.getItem(SAVE)) ?? {}; } catch { return {}; } }
function save(d) { try { localStorage.setItem(SAVE, JSON.stringify(d)); } catch { /* not kept */ } }
const nameOf = ([ed, slug]) => (ed === "override" && slug === "yodacon" ? "1998 Yodacon" : art[`${ed}/${slug}`].name);

// A hull's opaque length on frame 0, so every ship is drawn about as long.
function hullLength(ship) {
  const r = frameRect(ship, 0), c = new OffscreenCanvas(r.w, r.h), g = c.getContext("2d");
  g.drawImage(ship.sheet, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
  const a = g.getImageData(0, 0, r.w, r.h).data;
  let lo = r.h, hi = 0;
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) if (a[(y * r.w + x) * 4 + 3] > 40) { lo = Math.min(lo, y); hi = Math.max(hi, y); }
  return hi - lo + 1;
}
function handling(ship, which) {
  const st = { ...(ship.meta.stats ?? {}), ...(KONEX_STATS[ship.slug] ?? {}) };
  return { ship, name: nameOf(which), scale: LENGTH / ship.len, thrust: 46 + st.Accel * 0.085, turn: 60 + st.Maneuver * 25,
    fuel: Math.round(8 + st.Fuel / 110), record: st };
}

// The carrier's deck: the Large Pin side on (frame 9, nose right), its top
// edge read column by column from the sprite's alpha.
function deckProfile(ship, scale) {
  const r = frameRect(ship, 9), c = new OffscreenCanvas(r.w, r.h), g = c.getContext("2d");
  g.drawImage(ship.sheet, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
  const a = g.getImageData(0, 0, r.w, r.h).data, top = [];
  for (let x = 0; x < r.w; x++) {
    let y = 0;
    while (y < r.h && a[(y * r.w + x) * 4 + 3] <= 40) y++;
    top.push(y < r.h ? y : null);
  }
  const cols = top.map((y, x) => (y == null ? null : x)).filter((x) => x != null), x0 = cols[0], x1 = cols.at(-1);
  // The pad: the flattest stretch in the middle 40% of the hull.
  const mid = top.slice(Math.round(x0 + (x1 - x0) * 0.3), Math.round(x0 + (x1 - x0) * 0.7) + 1).filter((y) => y != null);
  return { w: r.w, h: r.h, scale, top, padFrom: (x0 + (x1 - x0) * 0.3 - r.w / 2) * scale, padTo: (x0 + (x1 - x0) * 0.7 - r.w / 2) * scale,
    padY: (Math.min(...mid) - r.h / 2) * scale };
}

// --- Worlds --------------------------------------------------------------------------------------

function newGame(pick = state.pick) {
  Object.assign(state, { pick, world: 0, tour: 1, score: 0, ships: 3, landings: 0, auto: null });
  $("pick").hidden = true;
  startWorld();
}

function startWorld() {
  const w = WORLDS[state.world];
  Object.assign(state, { rocks: [], sparks: [], retros: RETROS, retro: 0, wind: 0, carrier: null, ventIn: 2 });
  if (w.carrier) {
    state.ground = []; state.pads = [];
    state.carrier = { x: W / 2, y: H - 120, vx: 0, vy: 0, phase: 0 };
  } else makeGround(w);
  spawn();
  banner(`${w.name}${state.tour > 1 ? ` (tour ${state.tour})` : ""}`, w.carrier ? "Land on the lit stretch of the carrier's deck. It is moving." :
    `Gravity ${gravity().toFixed(0)}.${w.slick ? " Slick pads: come in with almost no sideways drift." : ""}${w.wind ? " Wind and air." : ""}${w.vents ? " Vents throw rocks." : ""}`, 2.2);
}

const gravity = () => WORLDS[state.world].g * (1 + (state.tour - 1) * 0.15);

// Midpoint displacement for the ground, then flat pads pressed into it,
// narrower on later tours.
function makeGround(w) {
  const n = 64, pts = new Array(n + 1).fill(0);
  pts[0] = 140 + Math.random() * 80; pts[n] = 140 + Math.random() * 80;
  for (let step = n / 2, rough = 120 * (w.jag ?? 1); step >= 1; step /= 2, rough *= 0.55)
    for (let i = step; i < n; i += step * 2) pts[i] = (pts[i - step] + pts[i + step]) / 2 + (Math.random() - 0.5) * rough;
  state.ground = pts.map((h, i) => ({ x: (i / n) * W, y: H - Math.max(40, Math.min(300, h)) }));
  state.pads = [];
  const slots = [0.15, 0.5, 0.82].sort(() => Math.random() - 0.5);
  w.pads.forEach(([width, mult], i) => {
    const wd = Math.max(34, width * (1 - (state.tour - 1) * 0.12)), cx = slots[i] * W + (Math.random() - 0.5) * 60;
    const x0 = Math.max(10, cx - wd / 2), x1 = Math.min(W - 10, cx + wd / 2);
    const y = Math.min(...state.ground.filter((p) => p.x >= x0 - 14 && p.x <= x1 + 14).map((p) => p.y)) + 6;
    state.pads.push({ x0, x1, y, mult });
  });
  // Press each pad flat, with the ground meeting its ends.
  for (const p of state.pads) {
    state.ground = state.ground.filter((q) => q.x < p.x0 - 2 || q.x > p.x1 + 2);
    state.ground.push({ x: p.x0, y: p.y }, { x: p.x1, y: p.y });
  }
  state.ground.sort((a, b) => a.x - b.x);
  state.vents = w.vents ? [...state.ground].filter((q) => !state.pads.some((p) => q.x > p.x0 - 30 && q.x < p.x1 + 30)).sort((a, b) => b.y - a.y).slice(0, w.vents) : [];
}

function groundAt(x) {
  const g = state.ground;
  for (let i = 1; i < g.length; i++) if (x <= g[i].x) { const a = g[i - 1], b = g[i], f = (x - a.x) / (b.x - a.x || 1); return a.y + (b.y - a.y) * f; }
  return g.at(-1)?.y ?? H;
}

function spawn() {
  const k = hulls[state.pick], fromLeft = Math.random() < 0.5;
  state.me = { k, x: fromLeft ? 80 : W - 80, y: 60, vx: (fromLeft ? 1 : -1) * (30 + Math.random() * 30), vy: 0, heading: 0, fuel: k.fuel,
    thrust: false, alive: true, landed: false };
  state.phase = "fly";
}

// --- Input ---------------------------------------------------------------------------------------

function fireRetro() {
  const me = state.me;
  if (state.phase !== "fly" || !me?.alive || state.retros <= 0 || state.retro > 0) return false;
  state.retros--; state.retro = 0.45;
  play("send");
  return true;
}
const held = new Set(), touch = new Set();
addEventListener("keydown", (e) => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (e.target.closest?.("button") && (k === " " || k === "Enter")) return;
  if (k.startsWith("Arrow") || k === " ") e.preventDefault();
  if ((k === "Shift" || k === "b") && !e.repeat) fireRetro();
  if (k === "Enter" && state.phase === "over") showPick();
  held.add(k);
});
addEventListener("keyup", (e) => held.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key));
addEventListener("blur", () => held.clear());
for (const b of document.querySelectorAll("[data-pad]")) {
  const on = (e) => { e.preventDefault(); if (b.dataset.pad === "retro") fireRetro(); else touch.add(b.dataset.pad); b.setPointerCapture?.(e.pointerId); };
  const off = () => touch.delete(b.dataset.pad);
  b.addEventListener("pointerdown", on);
  for (const ev of ["pointerup", "pointercancel", "lostpointercapture"]) b.addEventListener(ev, off);
}
function controls() {
  const c = { turn: 0, thrust: held.has("ArrowUp") || held.has("w") || held.has(" ") || touch.has("up") };
  if (held.has("ArrowLeft") || held.has("a") || touch.has("left")) c.turn -= 1;
  if (held.has("ArrowRight") || held.has("d") || touch.has("right")) c.turn += 1;
  return c;
}

// --- Update --------------------------------------------------------------------------------------

function update(dt) {
  state.t += dt;
  for (const s of state.sparks) { s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 40 * dt; s.life -= dt; }
  state.sparks = state.sparks.filter((s) => s.life > 0);
  if (bannerUntil && state.t > bannerUntil) { $("banner").hidden = true; bannerUntil = 0; }
  if (state.phase === "pick" || state.phase === "loading") return;
  const w = WORLDS[state.world];
  if (state.carrier) {
    const c = state.carrier, ox = c.x, oy = c.y;
    c.phase += dt;
    c.x = W / 2 + Math.sin(c.phase * 0.22) * 230 * (1 + (state.tour - 1) * 0.2);
    c.y = H - 120 + Math.sin(c.phase * 0.7) * 6;
    c.vx = (c.x - ox) / dt; c.vy = (c.y - oy) / dt;
  }
  if (w.wind) state.wind = Math.sin(state.t * 0.35) * w.wind * 0.7 + Math.sin(state.t * 1.7 + 1) * w.wind * 0.3;
  if (w.vents) vents(dt);
  for (const r of state.rocks) { r.x += r.vx * dt; r.y += r.vy * dt; r.vy += gravity() * dt; }
  state.rocks = state.rocks.filter((r) => r.y < groundAt(r.x) && r.x > -20 && r.x < W + 20);
  if (state.phase === "fly") fly(dt, w);
  else if (state.phase === "landed" || state.phase === "crashed") {
    if (state.phase === "landed" && state.carrier) { state.me.x += state.carrier.vx * dt; state.me.y += state.carrier.vy * dt; }
    if ((state.wait -= dt) <= 0) afterTouchdown();
  }
}

function fly(dt, w) {
  const me = state.me, k = me.k, c = state.auto ?? controls();
  me.heading = (me.heading + c.turn * k.turn * dt + 360) % 360;
  me.thrust = c.thrust && me.fuel > 0;
  if (c.retro) fireRetro();
  if (me.thrust) {
    const a = rad(frameIndex(me.heading) * 10);                  // along the frame shown
    me.vx += Math.sin(a) * k.thrust * dt; me.vy -= Math.cos(a) * k.thrust * dt;
    me.fuel = Math.max(0, me.fuel - dt);
    if (Math.random() < 0.6) exhaust(me, a);
  }
  if (state.retro > 0) {                                         // retro rockets: speed bleeds away fast
    const keep = Math.pow(0.25, dt / 0.45);
    me.vx *= keep; me.vy *= keep; state.retro -= dt;
    for (let i = 0; i < 3; i++) state.sparks.push({ x: me.x, y: me.y + 6, vx: (Math.random() - 0.5) * 160, vy: -40 - Math.random() * 60, life: 0.3, max: 0.3, color: "#b49bff" });
  }
  me.vy += gravity() * dt;
  me.vx += state.wind * dt;
  if (w.air) { me.vx *= 1 - w.air * dt; me.vy *= 1 - w.air * dt * 0.5; }
  me.x += me.vx * dt; me.y += me.vy * dt;
  if (me.x < 10 || me.x > W - 10) { me.x = Math.max(10, Math.min(W - 10, me.x)); me.vx *= -0.3; }
  for (const r of state.rocks) if (Math.hypot(r.x - me.x, r.y - me.y) < r.r + 10) return crash("Hit by a lava bomb");
  const foot = me.y + 11;
  if (state.carrier) return deckContact(me, foot);
  if (me.y > H + 40) return crash("Lost below");
  if (foot < groundAt(me.x - 7) && foot < groundAt(me.x + 7) && foot < groundAt(me.x)) return;
  const pad = state.pads.find((p) => me.x - 6 >= p.x0 && me.x + 6 <= p.x1);
  touchdown(me, pad, 0, 0);
}

function deckContact(me, foot) {
  const c = state.carrier, d = deck;
  if (me.y > H + 40) return crash("Missed the carrier");
  const col = Math.round((me.x - c.x) / d.scale + d.w / 2);
  const tops = [-6, 0, 6].map((dx) => d.top[col + Math.round(dx / d.scale)]).filter((y) => y != null);
  if (!tops.length) return;
  const top = c.y + (Math.min(...tops) - d.h / 2) * d.scale;
  if (foot < top) return;
  const onPad = me.x >= c.x + d.padFrom + 4 && me.x <= c.x + d.padTo - 4;
  touchdown(me, onPad ? { mult: 5, carrier: true } : null, c.vx, c.vy);
}

// Upright (within 12°), slow down (42) and across (22, or 10 on slick pads),
// relative to whatever you land on.
function touchdown(me, pad, ux, uy) {
  const w = WORLDS[state.world], tilt = Math.min(frameIndex(me.heading) * 10, 360 - frameIndex(me.heading) * 10);
  const vx = Math.abs(me.vx - ux), vy = me.vy - uy, sideways = w.slick ? 10 : SAFE.vx;
  const why = !pad ? "Came down off the pad" : tilt > SAFE.tilt ? `Landed tilted ${tilt}°` : vy > SAFE.vy ? `Too fast down (${Math.round(vy)})` : vx > sideways ? `Too fast across (${Math.round(vx)})` : null;
  if (why) return crash(why);
  me.landed = true; me.vx = 0; me.vy = 0; me.heading = 0;
  const pts = Math.round((50 + me.fuel * 10) * pad.mult * state.tour);
  state.score += pts; state.landings++;
  state.phase = "landed"; state.wait = 2.2;
  play("won");
  banner("Touchdown", `×${pad.mult} pad, ${me.fuel.toFixed(1)} s of fuel left: ${pts.toLocaleString()} points.`, 0);
}

function crash(why) {
  const me = state.me;
  me.alive = false; state.lastCrash = why;
  state.ships--;
  state.phase = "crashed"; state.wait = 2;
  for (let i = 0; i < 50; i++) { const a = Math.random() * Math.PI * 2, v = 40 + Math.random() * 140; state.sparks.push({ x: me.x, y: me.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: 0.4 + Math.random() * 0.8, max: 1.2, color: i % 3 ? "#ff7a59" : "#ffcf6b" }); }
  play("lost");
  banner("Crashed", `${why}. ${state.ships > 0 ? `${state.ships} ${state.ships === 1 ? "ship" : "ships"} left.` : ""}`, 0);
}

function afterTouchdown() {
  if (state.phase === "crashed" && state.ships <= 0) return gameOver();
  if (state.phase === "crashed") { spawn(); state.retros = RETROS; $("banner").hidden = true; return; }
  state.world++;
  if (state.world >= WORLDS.length) { state.world = 0; state.tour++; }
  startWorld();
}

function vents(dt) {
  if ((state.ventIn -= dt) > 0) return;
  state.ventIn = 2.5 + Math.random() * 2.5;
  const v = state.vents[Math.floor(Math.random() * state.vents.length)];
  if (!v) return;
  for (let i = 0; i < 4 + Math.floor(Math.random() * 3); i++)
    state.rocks.push({ x: v.x, y: v.y - 4, vx: (Math.random() - 0.5) * 120, vy: -150 - Math.random() * 120, r: 3 + Math.random() * 3 });
  play("error");
}

function exhaust(me, a) {
  const bx = me.x - Math.sin(a) * LENGTH * 0.5, by = me.y + Math.cos(a) * LENGTH * 0.5;
  state.sparks.push({ x: bx, y: by, vx: -Math.sin(a) * 120 + (Math.random() - 0.5) * 30, vy: Math.cos(a) * 120 + (Math.random() - 0.5) * 30, life: 0.25, max: 0.25, color: Math.random() < 0.5 ? "#ffb340" : "#ffe08a" });
}

function gameOver() {
  state.phase = "over";
  const best = load(), key = hulls[state.pick].ship.slug + (hulls[state.pick].ship.edition === "override" ? "-98" : ""), record = !best[key] || state.score > best[key];
  if (record) save({ ...best, [key]: state.score });
  banner("Game over", `${hulls[state.pick].name}: ${state.score.toLocaleString()} points, ${state.landings} landings${record ? " — your best with this hull" : ""}. Enter to fly again.`, 0);
}

let bannerUntil = 0;
function banner(title, text, secs) {
  $("banner-title").textContent = title; $("banner-text").textContent = text; $("banner").hidden = false;
  bannerUntil = secs ? state.t + secs : 0;
}

// --- Drawing -------------------------------------------------------------------------------------

const stars = Array.from({ length: 120 }, () => ({ x: Math.random() * W, y: Math.random() * H * 0.7, z: 0.2 + Math.random() * 0.8 }));

function draw() {
  const w = WORLDS[state.world];
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, w.sky[0]); sky.addColorStop(1, w.sky[1]);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  for (const s of stars) { ctx.fillStyle = `rgb(200 210 240 / ${s.z * (w.air ? 0.35 : 1)})`; ctx.fillRect(s.x, s.y, 1, 1); }
  // The world you are landing on, or (for the carrier) the gas giant below.
  // (drawShip turns smoothing off for crisp sprites; the planets want it on.)
  const p = planetArt[w.planet];
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
  if (w.carrier) ctx.drawImage(p, W * 0.3, H * 0.38, 380, 380);
  else if (p) { ctx.globalAlpha = 0.85; ctx.drawImage(p, W - 170, 30, 110, 110); ctx.globalAlpha = 1; }
  if (state.ground.length) {
    const g = ctx.createLinearGradient(0, H - 300, 0, H);
    g.addColorStop(0, w.ground[0]); g.addColorStop(1, w.ground[1]);
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, H);
    for (const q of state.ground) ctx.lineTo(q.x, q.y);
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgb(255 255 255 / 0.25)"; ctx.beginPath();
    state.ground.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke();
    for (const v of state.vents ?? []) { ctx.fillStyle = `rgb(255 ${90 + 60 * Math.sin(state.t * 5)} 30)`; ctx.beginPath(); ctx.ellipse(v.x, v.y + 2, 9, 4, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.font = "700 12px ui-monospace, monospace"; ctx.textAlign = "center";
    for (const pd of state.pads) {
      ctx.fillStyle = "#cfd6dd"; ctx.fillRect(pd.x0, pd.y - 3, pd.x1 - pd.x0, 4);
      const blink = Math.floor(state.t * 2) % 2;
      ctx.fillStyle = blink ? "#7ef0a8" : "#2f7a4c"; ctx.fillRect(pd.x0, pd.y - 6, 3, 3); ctx.fillRect(pd.x1 - 3, pd.y - 6, 3, 3);
      ctx.fillStyle = pd.mult >= 4 ? "#ffcf6b" : "#e6edf3"; ctx.fillText(`×${pd.mult}`, (pd.x0 + pd.x1) / 2, pd.y + 16);
    }
  }
  if (state.carrier) {
    const c = state.carrier, s = art[`${CARRIER[0]}/${CARRIER[1]}`];
    drawShip(ctx, s, 90, c.x, c.y, deck.scale);
    const blink = Math.floor(state.t * 3) % 2;
    ctx.fillStyle = blink ? "#7ef0a8" : "#2f7a4c";
    for (let x = c.x + deck.padFrom; x <= c.x + deck.padTo; x += 8) ctx.fillRect(x - 1, c.y + deck.padY - 3, 2, 2);
    ctx.font = "700 12px ui-monospace, monospace"; ctx.textAlign = "center"; ctx.fillStyle = "#ffcf6b";
    ctx.fillText("×5", c.x + (deck.padFrom + deck.padTo) / 2, c.y + deck.padY - 10);
  }
  for (const r of state.rocks) { ctx.fillStyle = "#ff8a3d"; ctx.shadowColor = "#ff5a1f"; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.fill(); }
  ctx.shadowBlur = 0;
  const me = state.me;
  if (me?.alive && state.phase !== "pick") drawShip(ctx, me.k.ship, me.heading, me.x, me.y, me.k.scale);
  for (const s of state.sparks) { ctx.globalAlpha = Math.min(1, (s.life / s.max) * 1.5); ctx.fillStyle = s.color; ctx.fillRect(s.x - 1, s.y - 1, 2, 2); }
  ctx.globalAlpha = 1;
  if (w.wind && state.phase !== "pick") {                       // a windsock top left
    ctx.strokeStyle = "#e6edf3"; ctx.lineWidth = 2; ctx.beginPath();
    ctx.moveTo(60, 30); ctx.lineTo(60 + state.wind * 2.5, 30); ctx.stroke(); ctx.lineWidth = 1;
    ctx.fillStyle = "#e6edf3"; ctx.textAlign = "left"; ctx.fillText("wind", 20, 34);
  }
}

function hud() {
  const me = state.me, w = WORLDS[state.world];
  $("score").textContent = state.score.toLocaleString();
  $("ships").textContent = Math.max(0, state.ships);
  $("world").textContent = `${state.world + 1}/${WORLDS.length}${state.tour > 1 ? ` ·${state.tour}` : ""}`;
  $("retros").textContent = state.retros;
  if (!me) return;
  const ux = state.carrier?.vx ?? 0, uy = state.carrier?.vy ?? 0;
  const vy = Math.round(me.vy - uy), vx = Math.round(me.vx - ux), tilt = Math.min(frameIndex(me.heading) * 10, 360 - frameIndex(me.heading) * 10);
  const alt = Math.max(0, Math.round((state.carrier ? state.carrier.y - 20 : groundAt(me.x)) - me.y - 11));
  const set = (id, text, ok) => { const el = $(id); el.textContent = text; el.className = `yc-value ${ok ? "ok" : "bad"}`; };
  set("vy", vy, vy <= SAFE.vy); set("vx", vx, Math.abs(vx) <= (w.slick ? 10 : SAFE.vx)); set("tilt", `${tilt}°`, tilt <= SAFE.tilt);
  $("alt").textContent = alt;
  $("fuel-bar").style.width = `${(100 * me.fuel) / me.k.fuel}%`;
}

// --- Pick ----------------------------------------------------------------------------------------

function showPick() {
  state.phase = "pick";
  $("banner").hidden = true;
  const best = load();
  $("hulls").replaceChildren(...hulls.map((h, i) => {
    const b = document.createElement("button"), key = h.ship.slug + (h.ship.edition === "override" ? "-98" : "");
    b.type = "button"; b.className = "hull";
    b.innerHTML = `<img src="${h.ship.urls.yard}" alt=""><span class="name">${h.name}</span>` +
      `<span class="specs">thrust ${Math.round(h.thrust)} · turn ${h.turn}°/s · fuel ${h.fuel} s</span>` +
      (best[key] ? `<span class="best">Best ${best[key].toLocaleString()}</span>` : "");
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

const wanted = [...HULLS, CARRIER];
const types = WORLDS.map((w) => w.planet);
const [ships, planets] = await Promise.all([Promise.all(wanted.map(([ed, slug]) => loadShip(ed, slug))),
  Promise.all(types.map((t) => loadImage(new URL(`planets/${t}/large/planet.png`, PACK_BASE).href)))]);
wanted.forEach(([ed, slug], i) => { art[`${ed}/${slug}`] = ships[i]; ships[i].len = hullLength(ships[i]); });
types.forEach((t, i) => { planetArt[t] = planets[i]; });
hulls = HULLS.map((h) => handling(art[`${h[0]}/${h[1]}`], h));
deck = deckProfile(art[`${CARRIER[0]}/${CARRIER[1]}`], 3.2);
$("mute").onclick = () => { setMuted(!isMuted()); $("mute").textContent = `Sound: ${isMuted() ? "off" : "on"}`; $("mute").setAttribute("aria-pressed", String(isMuted())); };
$("mute").textContent = `Sound: ${isMuted() ? "off" : "on"}`;
$("new").onclick = showPick;
makeGround(WORLDS[0]);                                      // the moon behind the pick screen
showPick();
// tick(n) runs n steps of 1/60 s; state.auto ({turn, thrust, retro}) flies
// without key events. groundAt and gravity are for a play-test's autopilot.
globalThis.touchdown = { state, newGame, fireRetro, groundAt, gravity, WORLDS, SAFE, get deck() { return deck; }, W, H,
  tick: (n = 1) => { for (let i = 0; i < n; i++) update(STEP); } };
