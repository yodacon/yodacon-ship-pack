// Flak: Missile Command with the pack's ships. Raiders dive at a fleet at
// anchor, each drawn on the frame for its line of attack; three Defender
// batteries turn on their own frames to aim where you point and throw flak
// that bursts where you clicked. Necromancers split into Tridents on the way
// down, Darts take two bursts. Save what you can; every 10,000 points brings a
// lost ship back.
import { loadShip, drawShip, loadImage, PACK_BASE } from "../../lib/yodacon-ship-pack.js";
import { play, isMuted, setMuted } from "../../lib/yodacon-sound.js";

const $ = (id) => document.getElementById(id);
const canvas = $("screen"), ctx = canvas.getContext("2d");
const W = canvas.width, H = canvas.height, GROUND = 520, SAVE = "flak-v1";
const deg = (r) => (r * 180) / Math.PI;

// The fleet at anchor (the Large Pin the only Pin), the batteries, the raiders.
const FLEET = [["conex", "yodacon", 150], ["override", "callisto", 235], ["conex", "large-pin", 320],
  ["conex", "tomaquad", 480], ["konex", "advisor", 565], ["konex", "citrus", 650]];
const BATTERIES = [60, 400, 740];
const RAIDERS = {
  trident: { ship: ["conex", "trident"], speed: 42, hp: 1, points: 25 },
  gryphon: { ship: ["conex", "gryphon"], speed: 68, hp: 1, points: 50 },
  necromancer: { ship: ["conex", "necromancer"], speed: 34, hp: 1, points: 75, splits: true },
  dart: { ship: ["conex", "dart"], speed: 26, hp: 2, points: 100 },
  yodacon98: { ship: ["override", "yodacon"], speed: 20, hp: 4, points: 400 },
};
const AMMO = 10, SHELL = 380, SHELL_FAST = 560, BURST = 42, BONUS_EVERY = 10000;

const state = { phase: "loading", wave: 0, score: 0, nextBonus: BONUS_EVERY, fleet: [], batteries: [], raiders: [], shells: [],
  bursts: [], sparks: [], queue: [], spawnIn: 0, cursor: { x: W / 2, y: H / 2 }, t: 0, between: 0, lost: {} };
let kinds = {}, defender = null, planet = null;
const stars = Array.from({ length: 110 }, () => ({ x: Math.random() * W, y: Math.random() * GROUND, z: 0.2 + Math.random() * 0.8 }));

function load() { try { return JSON.parse(localStorage.getItem(SAVE)) ?? {}; } catch { return {}; } }
function save(d) { try { localStorage.setItem(SAVE, JSON.stringify(d)); } catch { /* not kept */ } }

// --- Waves ---------------------------------------------------------------------------------------

function newGame() {
  Object.assign(state, { phase: "play", wave: 0, score: 0, nextBonus: BONUS_EVERY, raiders: [], shells: [], bursts: [], lost: {} });
  state.fleet = FLEET.map(([ed, slug, x]) => ({ k: kinds[`${ed}/${slug}`], x, y: GROUND - 22, alive: true }));
  $("banner").hidden = true;
  nextWave();
}

function nextWave() {
  state.wave++;
  const w = state.wave, n = 8 + 3 * w, list = [];
  for (let i = 0; i < n; i++) {
    const r = Math.random();
    list.push(w >= 4 && r < 0.12 ? "dart" : w >= 3 && r < 0.3 ? "necromancer" : w >= 2 && r < 0.55 ? "gryphon" : "trident");
  }
  if (w % 5 === 0) list.push("yodacon98");                       // every fifth wave, the 1998 Yodacon itself
  state.queue = list;
  state.spawnIn = 1.2;
  state.batteries = BATTERIES.map((x) => ({ x, y: GROUND - 14, ammo: AMMO, alive: true, aim: 0 }));
  banner(`Wave ${w}`, w === 1 ? "Click where the flak should burst. 1, 2, 3 fire a chosen battery." : `${list.length} raiders inbound.`, 1.6);
}

function spawn(name, from = null, toward = null) {
  const kd = RAIDERS[name], pace = 1 + (state.wave - 1) * 0.08;
  const targets = [...state.fleet.filter((f) => f.alive), ...state.batteries.filter((b) => b.alive)];
  const goal = toward ?? targets[Math.floor(Math.random() * targets.length)] ?? { x: W / 2, y: GROUND };
  const x = from?.x ?? 20 + Math.random() * (W - 40), y = from?.y ?? -30;
  const dx = goal.x + (Math.random() - 0.5) * 16 - x, dy = goal.y - y, d = Math.hypot(dx, dy), v = kd.speed * pace * (0.85 + Math.random() * 0.3);
  state.raiders.push({ kind: name, kd, k: kinds[kd.ship.join("/")], x, y, sx: x, sy: y, vx: (dx / d) * v, vy: (dy / d) * v,
    heading: deg(Math.atan2(dx, -dy)), hp: kd.hp, goal, splitAt: kd.splits ? 160 + Math.random() * 140 : Infinity });
}

// --- Firing --------------------------------------------------------------------------------------

function fire(x, y, which = null) {
  if (state.phase !== "play") return false;
  y = Math.min(y, GROUND - 40);
  const live = state.batteries.filter((b) => b.alive && b.ammo > 0);
  const b = which !== null ? state.batteries[which] : live.sort((a, c) => Math.abs(a.x - x) - Math.abs(c.x - x))[0];
  if (!b || !b.alive || b.ammo <= 0) { play("error"); return false; }
  b.ammo--;
  b.aim = deg(Math.atan2(x - b.x, -(y - b.y)));
  const speed = b.x === 400 ? SHELL_FAST : SHELL, d = Math.hypot(x - b.x, y - b.y);
  state.shells.push({ x: b.x, y: b.y - 10, sx: b.x, sy: b.y - 10, tx: x, ty: y, vx: ((x - b.x) / d) * speed, vy: ((y - b.y) / d) * speed, left: d / speed });
  play("shot");
  return true;
}

// --- Update --------------------------------------------------------------------------------------

function update(dt) {
  state.t += dt;
  for (const s of state.sparks) { s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 40 * dt; s.life -= dt; }
  state.sparks = state.sparks.filter((s) => s.life > 0);
  if (bannerUntil && state.t > bannerUntil) { $("banner").hidden = true; bannerUntil = 0; }
  if (state.phase === "between" && state.t >= state.between) { state.phase = "play"; nextWave(); }
  if (state.phase !== "play") return;

  if (state.queue.length && (state.spawnIn -= dt) <= 0) {
    spawn(state.queue.shift());
    if (state.wave >= 3 && state.queue.length && Math.random() < 0.35) spawn(state.queue.shift());
    state.spawnIn = Math.max(0.35, 1.1 - state.wave * 0.05) * (0.6 + Math.random() * 0.8);
  }
  for (const s of state.shells) {
    s.x += s.vx * dt; s.y += s.vy * dt;
    if ((s.left -= dt) <= 0) { s.done = true; state.bursts.push({ x: s.tx, y: s.ty, r: 0, age: 0, max: BURST, hit: new Set() }); play("boom"); }
  }
  state.shells = state.shells.filter((s) => !s.done);
  for (const b of state.bursts) {                                // grow, hold, fade
    b.age += dt;
    b.r = b.age < 0.35 ? (b.age / 0.35) * b.max : b.age < 0.6 ? b.max : Math.max(0, b.max * (1 - (b.age - 0.6) / 0.3));
  }
  state.bursts = state.bursts.filter((b) => b.age < 0.9);

  for (const r of state.raiders) {
    r.x += r.vx * dt; r.y += r.vy * dt;
    for (const b of state.bursts) {
      if (b.hit.has(r) || Math.hypot(r.x - b.x, r.y - b.y) > b.r + r.k.ship.sprite.frame_width * 0.18) continue;
      b.hit.add(r);
      if (--r.hp <= 0) { r.dead = true; kill(r); break; }
      burst(r.x, r.y, 6, "#ffb340", 60);
    }
    if (r.dead) continue;
    if (r.y > r.splitAt) {                                       // a Necromancer splits into three Tridents
      r.dead = true;
      burst(r.x, r.y, 10, "#c26bd8", 70);
      const targets = [...state.fleet.filter((f) => f.alive), ...state.batteries.filter((b) => b.alive)];
      for (let i = 0; i < 3; i++) spawn("trident", r, targets[Math.floor(Math.random() * targets.length)]);
      continue;
    }
    if (r.y >= r.goal.y - 8) { r.dead = true; impact(r); }
  }
  state.raiders = state.raiders.filter((r) => !r.dead);

  if (!state.fleet.some((f) => f.alive)) return gameOver();
  if (!state.queue.length && !state.raiders.length && !state.shells.length && !state.bursts.length) waveDone();
}

function kill(r) {
  state.score += r.kd.points;
  burst(r.x, r.y, r.kind === "yodacon98" ? 50 : 18, "#ffe3a0", 90);
  state.bursts.push({ x: r.x, y: r.y, r: 0, age: 0.1, max: 18, hit: new Set() });   // a small chain burst
  bonusCheck();
}

function impact(r) {
  const g = r.goal;
  burst(g.x, g.y, 36, "#ff7a59", 130);
  play("hit");
  if (g.alive) {
    g.alive = false;
    if (g.k) { state.lost[g.k.name] = (state.lost[g.k.name] ?? 0) + 1; play("lost"); }
    else g.ammo = 0;
  }
}

function bonusCheck() {
  while (state.score >= state.nextBonus) {
    state.nextBonus += BONUS_EVERY;
    const back = state.fleet.find((f) => !f.alive);
    if (back) { back.alive = true; banner("Reinforcement", `The ${back.k.name} is back on station.`, 1.6); play("held"); }
  }
}

function waveDone() {
  const ammo = state.batteries.reduce((a, b) => a + (b.alive ? b.ammo : 0), 0), ships = state.fleet.filter((f) => f.alive).length;
  const mult = Math.min(6, Math.ceil(state.wave / 2));
  const bonus = (ammo * 5 + ships * 100) * mult;
  state.score += bonus;
  bonusCheck();
  play("held");
  state.phase = "between"; state.between = state.t + 2.4;
  banner(`Wave ${state.wave} held`, `${ships} ship${ships === 1 ? "" : "s"} afloat, ${ammo} rounds left: ${bonus.toLocaleString()} bonus (×${mult}).`, 2.3);
}

function gameOver() {
  state.phase = "over";
  const best = load(), record = state.score > (best.score ?? 0);
  if (record) save({ score: state.score, wave: state.wave });
  play("lost");
  banner("The fleet is lost", `${state.score.toLocaleString()} points, wave ${state.wave}${record ? " — your best" : best.score ? `; best ${best.score.toLocaleString()}` : ""}. Click or press Enter to play again.`, 0);
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

function draw() {
  ctx.fillStyle = "#03050a"; ctx.fillRect(0, 0, W, H);
  for (const s of stars) { ctx.fillStyle = `rgb(170 180 220 / ${s.z})`; ctx.fillRect(s.x, s.y, 1, 1); }
  if (planet) { ctx.globalAlpha = 0.55; ctx.drawImage(planet, W - 230, 40, 180, 180); ctx.globalAlpha = 1; }
  // The ground: an orbital platform the fleet is moored to.
  const g = ctx.createLinearGradient(0, GROUND, 0, H);
  g.addColorStop(0, "#4c5457"); g.addColorStop(0.1, "#2b3134"); g.addColorStop(1, "#14181a");
  ctx.fillStyle = g; ctx.fillRect(0, GROUND, W, H - GROUND);
  ctx.fillStyle = "rgb(255 255 255 / 0.05)"; for (let x = 0; x < W; x += 32) ctx.fillRect(x, GROUND + 4, 1, H - GROUND - 8);

  for (const f of state.fleet) {
    if (f.alive) drawShip(ctx, f.k.ship, 0, f.x, f.y, Math.min(1, 58 / f.k.ship.sprite.frame_width));
    else { ctx.fillStyle = "rgb(255 122 89 / 0.35)"; ctx.fillRect(f.x - 14, GROUND - 6, 28, 6); }
  }
  for (const b of state.batteries) {
    if (!b.alive) { ctx.fillStyle = "#3a1a14"; ctx.fillRect(b.x - 16, GROUND - 6, 32, 6); continue; }
    drawShip(ctx, defender, b.aim, b.x, b.y, 1.4);
    for (let i = 0; i < b.ammo; i++) { ctx.fillStyle = "#ffb340"; ctx.fillRect(b.x - 19 + (i % 5) * 8, GROUND + 10 + Math.floor(i / 5) * 6, 5, 3); }
  }
  // Raiders, with the trail of their dive behind them.
  ctx.lineWidth = 1;
  for (const r of state.raiders) {
    ctx.strokeStyle = "rgb(255 90 70 / 0.35)"; ctx.beginPath(); ctx.moveTo(r.sx, r.sy); ctx.lineTo(r.x, r.y); ctx.stroke();
    drawShip(ctx, r.k.ship, r.heading, r.x, r.y, r.kind === "yodacon98" ? 0.9 : r.kind === "dart" ? 0.75 : 1);
  }
  for (const s of state.shells) {
    ctx.strokeStyle = "rgb(127 233 255 / 0.5)"; ctx.beginPath(); ctx.moveTo(s.sx, s.sy); ctx.lineTo(s.x, s.y); ctx.stroke();
    ctx.strokeStyle = "#7fe9ff"; ctx.beginPath();
    ctx.moveTo(s.tx - 4, s.ty - 4); ctx.lineTo(s.tx + 4, s.ty + 4); ctx.moveTo(s.tx + 4, s.ty - 4); ctx.lineTo(s.tx - 4, s.ty + 4); ctx.stroke();
  }
  for (const b of state.bursts) {
    const hue = Math.floor(state.t * 20) % 2;
    ctx.fillStyle = hue ? "rgb(255 227 160 / 0.75)" : "rgb(255 179 64 / 0.7)";
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
  }
  for (const p of state.sparks) { ctx.globalAlpha = Math.min(1, (p.life / p.max) * 1.5); ctx.fillStyle = p.color; ctx.fillRect(p.x - 1, p.y - 1, 2, 2); }
  ctx.globalAlpha = 1;
  if (state.phase === "play") {                                 // the crosshair
    const { x, y } = state.cursor;
    ctx.strokeStyle = "#e8f4ff"; ctx.beginPath();
    ctx.moveTo(x - 10, y); ctx.lineTo(x - 3, y); ctx.moveTo(x + 3, y); ctx.lineTo(x + 10, y);
    ctx.moveTo(x, y - 10); ctx.lineTo(x, y - 3); ctx.moveTo(x, y + 3); ctx.lineTo(x, y + 10); ctx.stroke();
  }
}

function hud() {
  $("score").textContent = state.score.toLocaleString();
  $("wave").textContent = state.wave;
  $("afloat").textContent = `${state.fleet.filter((f) => f.alive).length}/${FLEET.length}`;
  $("best").textContent = (load().score ?? 0).toLocaleString();
}

// --- Input ---------------------------------------------------------------------------------------

const toGame = (e) => { const b = canvas.getBoundingClientRect(); return { x: ((e.clientX - b.left) / b.width) * W, y: ((e.clientY - b.top) / b.height) * H }; };
canvas.addEventListener("pointermove", (e) => { state.cursor = toGame(e); });
canvas.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  state.cursor = toGame(e);
  if (state.phase === "title" || state.phase === "over") { newGame(); return; }
  fire(state.cursor.x, state.cursor.y);
});
addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if ((state.phase === "title" || state.phase === "over") && k === "enter") return newGame();
  const which = { 1: 0, 2: 1, 3: 2, a: 0, s: 1, d: 2 }[k];
  if (which !== undefined) fire(state.cursor.x, state.cursor.y, which);
  else if (k === " ") { e.preventDefault(); fire(state.cursor.x, state.cursor.y); }
  else if (k.startsWith("arrow")) {                              // the crosshair on the keys too
    e.preventDefault();
    const step = e.shiftKey ? 40 : 14;
    if (k === "arrowleft") state.cursor.x = Math.max(0, state.cursor.x - step);
    if (k === "arrowright") state.cursor.x = Math.min(W, state.cursor.x + step);
    if (k === "arrowup") state.cursor.y = Math.max(0, state.cursor.y - step);
    if (k === "arrowdown") state.cursor.y = Math.min(GROUND - 40, state.cursor.y + step);
  }
});

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

const wanted = [...FLEET.map(([ed, slug]) => [ed, slug]), ...Object.values(RAIDERS).map((r) => r.ship), ["conex", "defender"]];
const ships = await Promise.all(wanted.map(([ed, slug]) => loadShip(ed, slug)));
wanted.forEach(([ed, slug], i) => { kinds[`${ed}/${slug}`] = { ship: ships[i], name: ships[i].name }; });
defender = kinds["conex/defender"].ship;
planet = await loadImage(new URL("planets/gas/large/planet.png", PACK_BASE).href).catch(() => null);
state.fleet = FLEET.map(([ed, slug, x]) => ({ k: kinds[`${ed}/${slug}`], x, y: GROUND - 22, alive: true }));
state.batteries = BATTERIES.map((x) => ({ x, y: GROUND - 14, ammo: AMMO, alive: true, aim: 0 }));
state.phase = "title";
banner("Flak", "Raiders are diving on the fleet. Click to start.", 0);
$("mute").onclick = () => { setMuted(!isMuted()); $("mute").textContent = `Sound: ${isMuted() ? "off" : "on"}`; $("mute").setAttribute("aria-pressed", String(isMuted())); };
$("mute").textContent = `Sound: ${isMuted() ? "off" : "on"}`;
// tick(n) runs n simulation steps at once, for play-tests on slow machines.
globalThis.flak = { state, newGame, fire, nextWave, SHELL, SHELL_FAST, BURST, GROUND,
  tick: (n = 1) => { for (let i = 0; i < n; i++) update(STEP); } };
