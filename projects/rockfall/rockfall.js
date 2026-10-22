// Rockfall: Asteroids with the pack's ships. Turn on the sprite's frames,
// thrust along the frame shown, and break up the rocks: big into two middling,
// middling into two small. A Necromancer crosses now and then and shoots at
// you; from wave 4 a Dart does too, faster and better aimed. The screen wraps.
// Hyperspace (H or Shift) drops you somewhere at random: three charges a
// wave, and a one-in-eight chance the jump goes wrong and costs a life.
import { loadShip, drawShip, frameRect, frameIndex } from "../../lib/yodacon-ship-pack.js";
import { play, isMuted, setMuted } from "../../lib/yodacon-sound.js";

const $ = (id) => document.getElementById(id);
const canvas = $("screen"), ctx = canvas.getContext("2d");
const W = canvas.width, H = canvas.height, SAVE = "rockfall-v1";
const rad = (d) => (d * Math.PI) / 180, deg = (r) => (r * 180) / Math.PI;
const LENGTH = 30, BOLT = 520, BOLT_LIFE = 0.9, JUMPS = 3, EXTRA_LIFE = 10000;
const ROCK = { 3: { r: 40, points: 20, speed: 40 }, 2: { r: 22, points: 50, speed: 70 }, 1: { r: 12, points: 100, speed: 105 } };

// Your ship: seven hulls, each flying by its record. konex's Advisor and
// Citrus get numbers in the 1997 ranges.
const HULLS = [["conex", "gryphon"], ["conex", "defender"], ["conex", "trident"], ["konex", "citrus"],
  ["konex", "advisor"], ["override", "callisto"], ["conex", "yodacon"]];
const KONEX_STATS = { advisor: { Speed: 380, Accel: 600, Maneuver: 4 }, citrus: { Speed: 420, Accel: 650, Maneuver: 5 } };
const RAIDERS = { necromancer: ["conex", "necromancer"], dart: ["conex", "dart"] };

const state = { phase: "loading", pick: 0, wave: 0, score: 0, lives: 3, nextLife: EXTRA_LIFE, me: null, rocks: [], bolts: [],
  raider: null, raiderIn: 8, sparks: [], jumps: JUMPS, t: 0, deaths: {} };
let hulls = [], raiders = {};
const stars = Array.from({ length: 150 }, () => ({ x: Math.random() * W, y: Math.random() * H, z: 0.2 + Math.random() * 0.8 }));

function load() { try { return JSON.parse(localStorage.getItem(SAVE)) ?? {}; } catch { return {}; } }
function save(d) { try { localStorage.setItem(SAVE, JSON.stringify(d)); } catch { /* not kept */ } }

// A hull's length on frame 0, from its alpha, so every ship is drawn about as
// long (the sprites run from 32 to 96 px; the hulls in them from 24 to 87).
function hullLength(ship) {
  const r = frameRect(ship, 0), c = new OffscreenCanvas(r.w, r.h), g = c.getContext("2d");
  g.drawImage(ship.sheet, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
  const a = g.getImageData(0, 0, r.w, r.h).data;
  let lo = r.h, hi = 0;
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) if (a[(y * r.w + x) * 4 + 3] > 40) { lo = Math.min(lo, y); hi = Math.max(hi, y); }
  return hi - lo + 1;
}
function handling(ship) {
  const st = { ...(ship.meta.stats ?? {}), ...(KONEX_STATS[ship.slug] ?? {}) }, scale = LENGTH / hullLength(ship);
  return { ship, name: ship.name, scale, record: st, turn: st.Maneuver * 55, accel: st.Accel * 0.45, top: st.Speed * 0.7,
    every: 0.3 - st.Maneuver * 0.02, radius: LENGTH * 0.4 };
}

// --- Game ----------------------------------------------------------------------------------------

function newGame(pick = state.pick) {
  Object.assign(state, { phase: "play", pick, wave: 0, score: 0, lives: 3, nextLife: EXTRA_LIFE, bolts: [], sparks: [], raider: null, deaths: {} });
  $("pick").hidden = true; $("banner").hidden = true;
  nextWave();
}

function nextWave() {
  state.wave++;
  state.jumps = JUMPS;
  state.rocks = [];
  for (let i = 0; i < 3 + state.wave; i++) {               // big rocks round the edges, away from the middle
    const a = Math.random() * Math.PI * 2, d = 220 + Math.random() * 120;
    addRock(3, W / 2 + Math.cos(a) * d * 1.3, H / 2 + Math.sin(a) * d);
  }
  state.raiderIn = 10 + Math.random() * 6;
  spawnMe();
  banner(`Wave ${state.wave}`, state.wave === 4 ? "Darts from now on: faster, and they aim." : `${state.rocks.length} rocks.`, 1.4);
}

function spawnMe() {
  state.me = { k: hulls[state.pick], x: W / 2, y: H / 2, vx: 0, vy: 0, heading: 0, cool: 0, safe: 2, alive: true, thrust: false };
}

function addRock(size, x, y, base = null) {
  const a = Math.random() * Math.PI * 2, v = ROCK[size].speed * (0.6 + Math.random() * 0.8) * (1 + state.wave * 0.04);
  const points = Array.from({ length: 11 }, () => 0.72 + Math.random() * 0.32);
  state.rocks.push({ size, x, y, vx: Math.cos(a) * v + (base?.vx ?? 0) * 0.4, vy: Math.sin(a) * v + (base?.vy ?? 0) * 0.4,
    r: ROCK[size].r, spin: (Math.random() - 0.5) * 1.6, angle: Math.random() * 6.3, points, tone: Math.random() });
}

// Hyperspace: somewhere at random, not in the middle of a rock if it can help
// it; one jump in eight goes wrong.
function hyperspace() {
  const me = state.me;
  if (state.phase !== "play" || !me?.alive || state.jumps <= 0) return false;
  state.jumps--;
  burst(me.x, me.y, 18, "#b49bff", 90);
  if (Math.random() < 1 / 8) { die("A bad jump"); return true; }
  let x = 0, y = 0;
  for (let tries = 0; tries < 30; tries++) {
    x = 40 + Math.random() * (W - 80); y = 40 + Math.random() * (H - 80);
    if (!state.rocks.some((r) => Math.hypot(r.x - x, r.y - y) < r.r + 60)) break;
  }
  Object.assign(me, { x, y, vx: 0, vy: 0, safe: 0.6 });
  burst(x, y, 18, "#b49bff", 90);
  play("send");
  return true;
}

// --- Input ---------------------------------------------------------------------------------------

const held = new Set(), touch = new Set();
addEventListener("keydown", (e) => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (state.phase === "play" && (k.startsWith("Arrow") || k === " ")) e.preventDefault();
  if ((k === "h" || k === "Shift") && !e.repeat) hyperspace();
  if (k === "Enter" && state.phase === "over") showPick();
  held.add(k);
});
addEventListener("keyup", (e) => held.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key));
addEventListener("blur", () => held.clear());
for (const b of document.querySelectorAll("[data-pad]")) {
  const on = (e) => { e.preventDefault(); if (b.dataset.pad === "jump") hyperspace(); else touch.add(b.dataset.pad); b.setPointerCapture?.(e.pointerId); };
  const off = () => touch.delete(b.dataset.pad);
  b.addEventListener("pointerdown", on);
  for (const ev of ["pointerup", "pointercancel", "lostpointercapture"]) b.addEventListener(ev, off);
}
let padJump = false;
function controls() {
  const c = { turn: 0, thrust: held.has("ArrowUp") || held.has("w") || touch.has("up"), fire: held.has(" ") || touch.has("fire") };
  if (held.has("ArrowLeft") || held.has("a") || touch.has("left")) c.turn -= 1;
  if (held.has("ArrowRight") || held.has("d") || touch.has("right")) c.turn += 1;
  const pad = [...(navigator.getGamepads?.() ?? [])].find(Boolean);
  if (pad) {
    const ax = pad.axes[0] ?? 0, b = (n) => pad.buttons[n]?.pressed;
    if (Math.abs(ax) > 0.25) c.turn = ax;
    if (b(14)) c.turn = -1; if (b(15)) c.turn = 1;
    c.thrust ||= b(12) || b(7); c.fire ||= b(0) || b(2) || b(5);
    if (b(1) && !padJump) hyperspace();
    padJump = b(1);
  }
  return c;
}

// --- Update --------------------------------------------------------------------------------------

const wrap = (o, m = 0) => {
  if (o.x < -m) o.x += W + 2 * m; else if (o.x > W + m) o.x -= W + 2 * m;
  if (o.y < -m) o.y += H + 2 * m; else if (o.y > H + m) o.y -= H + 2 * m;
};
const near = (a, b, d) => { let dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y); dx = Math.min(dx, W - dx); dy = Math.min(dy, H - dy); return dx * dx + dy * dy < d * d; };

function update(dt) {
  state.t += dt;
  for (const s of state.sparks) { s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt; }
  state.sparks = state.sparks.filter((s) => s.life > 0);
  if (bannerUntil && state.t > bannerUntil) { $("banner").hidden = true; bannerUntil = 0; }
  if (state.phase === "pick") for (const r of state.rocks) { r.x += r.vx * dt; r.y += r.vy * dt; r.angle += r.spin * dt; wrap(r, r.r); }
  if (state.phase !== "play" && state.phase !== "dying") return;
  for (const r of state.rocks) { r.x += r.vx * dt; r.y += r.vy * dt; r.angle += r.spin * dt; wrap(r, r.r); }
  for (const b of state.bolts) { b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; wrap(b); }
  raiderStep(dt);
  if (state.phase === "dying") {
    if ((state.respawn -= dt) <= 0) {
      if (state.lives <= 0) return gameOver();
      spawnMe(); state.phase = "play";
    }
  } else shipStep(dt);
  hits();
  state.bolts = state.bolts.filter((b) => b.life > 0);
  if (state.phase === "play" && !state.rocks.length && !state.raider) nextWave();
}

function shipStep(dt) {
  const me = state.me, k = me.k, c = state.auto ?? controls();
  me.heading = (me.heading + c.turn * k.turn * dt + 360) % 360;
  me.thrust = c.thrust;
  if (c.thrust) { const a = rad(frameIndex(me.heading) * 10); me.vx += Math.sin(a) * k.accel * dt; me.vy -= Math.cos(a) * k.accel * dt; }
  me.vx *= 1 - 0.35 * dt; me.vy *= 1 - 0.35 * dt;                  // a little drag, so you can stop
  const v = Math.hypot(me.vx, me.vy);
  if (v > k.top) { me.vx *= k.top / v; me.vy *= k.top / v; }
  me.x += me.vx * dt; me.y += me.vy * dt; wrap(me);
  me.safe -= dt; me.cool -= dt;
  if (c.fire && me.cool <= 0 && state.bolts.filter((b) => b.mine).length < 6) {
    const a = rad(me.heading);
    state.bolts.push({ x: me.x + Math.sin(a) * LENGTH * 0.5, y: me.y - Math.cos(a) * LENGTH * 0.5,
      vx: me.vx + Math.sin(a) * BOLT, vy: me.vy - Math.cos(a) * BOLT, life: BOLT_LIFE, mine: true });
    me.cool = k.every;
    play("shot");
  }
}

// A raider crosses the screen and shoots: the Necromancer at random, the
// Dart (from wave 4) at you, leading its shot.
function raiderStep(dt) {
  if (!state.raider) {
    if (state.phase === "play" && (state.raiderIn -= dt) <= 0 && state.rocks.length) {
      const dart = state.wave >= 4 && Math.random() < 0.5, k = raiders[dart ? "dart" : "necromancer"];
      const fromLeft = Math.random() < 0.5, y = 60 + Math.random() * (H - 120);
      state.raider = { k, dart, x: fromLeft ? -40 : W + 40, y, vx: (fromLeft ? 1 : -1) * (dart ? 120 : 75), vy: 0, cool: 1.5, weave: Math.random() * 6,
        hp: dart ? 1 : 2, points: dart ? 1000 : 500 };
      play("error");
    }
    return;
  }
  const r = state.raider;
  r.weave += dt;
  r.vy = Math.sin(r.weave * 1.3) * 60;
  r.x += r.vx * dt; r.y += r.vy * dt;
  if (r.y < 20 || r.y > H - 20) r.y = Math.max(20, Math.min(H - 20, r.y));
  if (r.x < -60 || r.x > W + 60) { state.raider = null; state.raiderIn = 10 + Math.random() * 8; return; }
  if ((r.cool -= dt) <= 0 && state.me?.alive) {
    const me = state.me;
    const a = r.dart ? Math.atan2(me.x + me.vx * 0.4 - r.x, -(me.y + me.vy * 0.4 - r.y)) : Math.random() * Math.PI * 2;
    state.bolts.push({ x: r.x, y: r.y, vx: Math.sin(a) * 300, vy: -Math.cos(a) * 300, life: 1.6, mine: false });
    r.cool = r.dart ? 1.1 : 1.6;
  }
}

function hits() {
  const me = state.me, alive = state.phase === "play" && me?.alive;
  for (const b of state.bolts) {
    if (b.life <= 0) continue;
    for (const r of state.rocks) if (!r.dead && near(b, r, r.r)) { b.life = 0; breakRock(r, b.mine); break; }
    if (b.life > 0 && b.mine && state.raider && near(b, state.raider, 22)) {
      b.life = 0;
      if (--state.raider.hp <= 0) { score(state.raider.points); burst(state.raider.x, state.raider.y, 40, "#ffcf6b", 140); play("boom"); state.raider = null; state.raiderIn = 10 + Math.random() * 8; }
      else play("hit");
    }
    if (b.life > 0 && !b.mine && alive && me.safe <= 0 && near(b, me, me.k.radius)) { b.life = 0; die(`Shot by a ${state.raider?.k.name ?? "raider"}`); }
  }
  state.rocks = state.rocks.filter((r) => !r.dead);
  if (!alive || me.safe > 0) return;
  for (const r of state.rocks) if (near(r, me, r.r * 0.85 + me.k.radius)) { breakRock(r, true); die("Hit by a rock"); return; }
  if (state.raider && near(state.raider, me, 22 + me.k.radius)) { state.raider = null; die("Rammed a raider"); }
}

function breakRock(r, mine) {
  r.dead = true;
  if (mine) score(ROCK[r.size].points);
  burst(r.x, r.y, 6 + r.size * 5, "#b0a89a", 60 + r.size * 20);
  play(r.size === 3 ? "boom" : "hit");
  if (r.size > 1) for (let i = 0; i < 2; i++) addRock(r.size - 1, r.x, r.y, r);
}

function score(n) {
  state.score += n;
  if (state.score >= state.nextLife) { state.lives++; state.nextLife += EXTRA_LIFE; play("held"); }
}

function die(why) {
  const me = state.me;
  me.alive = false;
  state.deaths[why] = (state.deaths[why] ?? 0) + 1;
  burst(me.x, me.y, 40, "#ff7a59", 150);
  play("lost");
  state.lives--;
  state.phase = "dying"; state.respawn = 1.6;
}

function gameOver() {
  state.phase = "over";
  const best = load(), key = hulls[state.pick].ship.slug, record = !best[key] || state.score > best[key];
  if (record) save({ ...best, [key]: state.score });
  banner("Game over", `${hulls[state.pick].name}: ${state.score.toLocaleString()} points, wave ${state.wave}${record ? " — your best with this hull" : ""}. Enter to choose again.`, 0);
}

function burst(x, y, n, color, speed) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = speed * (0.3 + Math.random());
    state.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.2 + Math.random() * 0.6, max: 0.8, color });
  }
}

let bannerUntil = 0;
function banner(title, text, secs) {
  $("banner-title").textContent = title; $("banner-text").textContent = text; $("banner").hidden = false;
  bannerUntil = secs ? state.t + secs : 0;
}

// --- Drawing -------------------------------------------------------------------------------------

function drawRock(r) {
  ctx.save(); ctx.translate(r.x, r.y); ctx.rotate(r.angle);
  const g = ctx.createLinearGradient(-r.r, -r.r, r.r, r.r);
  const light = r.tone < 0.5 ? ["#8a8278", "#4d4741", "#1d1a17"] : ["#8a8c90", "#4a4e54", "#1a1c20"];
  g.addColorStop(0, light[0]); g.addColorStop(0.55, light[1]); g.addColorStop(1, light[2]);
  ctx.fillStyle = g; ctx.strokeStyle = "#141210";
  ctx.beginPath();
  r.points.forEach((p, i) => { const a = (i / r.points.length) * Math.PI * 2; i ? ctx.lineTo(Math.cos(a) * r.r * p, Math.sin(a) * r.r * p) : ctx.moveTo(Math.cos(a) * r.r * p, Math.sin(a) * r.r * p); });
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "rgb(0 0 0 / 0.3)";
  for (let i = 0; i < r.size; i++) { ctx.beginPath(); ctx.arc(Math.cos(i * 2.4) * r.r * 0.4, Math.sin(i * 2.4) * r.r * 0.4, r.r * 0.14, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

function draw() {
  ctx.fillStyle = "#03050a"; ctx.fillRect(0, 0, W, H);
  for (const s of stars) { ctx.fillStyle = `rgb(170 180 220 / ${s.z})`; ctx.fillRect(s.x, s.y, 1, 1); }
  for (const r of state.rocks) drawRock(r);
  const rd = state.raider;
  if (rd) drawShip(ctx, rd.k.ship, rd.vx > 0 ? 90 : 270, rd.x, rd.y, rd.dart ? 0.6 : 0.9);
  ctx.lineWidth = 2;
  for (const b of state.bolts) {
    ctx.strokeStyle = b.mine ? "#7ef0a8" : "#ff7a59";
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * 0.015, b.y - b.vy * 0.015); ctx.stroke();
  }
  ctx.lineWidth = 1;
  const me = state.me;
  if (me?.alive && state.phase !== "pick" && (me.safe <= 0 || Math.floor(me.safe * 10) % 2)) {
    if (me.thrust) {
      const a = rad(frameIndex(me.heading) * 10), d = LENGTH * 0.55;
      ctx.fillStyle = "#ffb340"; ctx.beginPath(); ctx.arc(me.x - Math.sin(a) * d, me.y + Math.cos(a) * d, 2 + Math.random() * 3, 0, Math.PI * 2); ctx.fill();
    }
    drawShip(ctx, me.k.ship, me.heading, me.x, me.y, me.k.scale);
  }
  for (const p of state.sparks) { ctx.globalAlpha = Math.min(1, (p.life / p.max) * 1.5); ctx.fillStyle = p.color; ctx.fillRect(p.x - 1, p.y - 1, 2, 2); }
  ctx.globalAlpha = 1;
}

function hud() {
  $("score").textContent = state.score.toLocaleString();
  $("lives").textContent = Math.max(0, state.lives);
  $("wave").textContent = state.wave;
  $("jumps").textContent = state.jumps;
}

// --- Pick ----------------------------------------------------------------------------------------

function renderPick() {
  const best = load();
  $("hulls").replaceChildren(...hulls.map((h, i) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "hull";
    b.innerHTML = `<img src="${h.ship.urls.yard}" alt=""><span class="name">${h.name}</span>` +
      `<span class="specs">Turn ${h.turn}°/s · thrust ${Math.round(h.accel)} · ${(1 / h.every).toFixed(1)} shots/s</span>` +
      (best[h.ship.slug] ? `<span class="best">Best ${best[h.ship.slug].toLocaleString()}</span>` : "");
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

const ships = await Promise.all([...HULLS, ...Object.values(RAIDERS)].map(([ed, slug]) => loadShip(ed, slug)));
hulls = ships.slice(0, HULLS.length).map(handling);
Object.keys(RAIDERS).forEach((key, i) => { const s = ships[HULLS.length + i]; raiders[key] = { ship: s, name: s.name }; });
for (let i = 0; i < 6; i++) addRock(3, Math.random() * W, Math.random() * H);   // drifting behind the pick screen
$("mute").onclick = () => { setMuted(!isMuted()); $("mute").textContent = `Sound: ${isMuted() ? "off" : "on"}`; $("mute").setAttribute("aria-pressed", String(isMuted())); };
$("mute").textContent = `Sound: ${isMuted() ? "off" : "on"}`;
$("new").onclick = showPick;
showPick();
state.phase = "pick";
// tick(n) runs n simulation steps at once; auto (a controls object) lets a
// play-test fly without key events.
globalThis.rockfall = { state, newGame, hyperspace, near, W, H, BOLT, tick: (n = 1) => { for (let i = 0; i < n; i++) update(STEP); } };
