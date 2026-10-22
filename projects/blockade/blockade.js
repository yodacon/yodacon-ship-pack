// Blockade: run a pirate blockade, a vertical scroller. Your ship flies nose
// up and banks through frames 35 and 34 (or 1 and 2) as it strafes; raiders
// come in nose down on frame 18, and divers turn on their real frames to come
// at you. Two stages, each ending with a capital ship: the Large Pin, then
// the 1998 Yodacon, and a third stage, the Override Line, where konex's
// Citrus and Advisor fly with the pirates and the Override Callisto leads.
// A smart bomb (B), once a stage, wipes every bomb on screen and hurts every
// raider.
import { loadShip, loadImage, drawShip, frameIndex, PACK_BASE } from "../../lib/yodacon-ship-pack.js";
import { play, isMuted, setMuted } from "../../lib/yodacon-sound.js";

const $ = (id) => document.getElementById(id);
const canvas = $("screen"), ctx = canvas.getContext("2d");
const W = canvas.width, H = canvas.height, SAVE = "blockade-v1";
const rad = (d) => (d * Math.PI) / 180, deg = (r) => (r * 180) / Math.PI;

// --- Ships ---------------------------------------------------------------------------------------

// Six to fly; konex's Advisor and Citrus get numbers in the 1997 ranges.
const FLYABLE = [["conex", "defender"], ["conex", "gryphon"], ["conex", "trident"], ["konex", "citrus"], ["konex", "advisor"], ["override", "callisto"]];
const ENEMIES = [["conex", "gryphon"], ["conex", "trident"], ["conex", "dart"], ["conex", "necromancer"], ["conex", "tomaquad"],
  ["conex", "yodacon"], ["conex", "defender"], ["conex", "large-pin"], ["override", "yodacon"],
  ["konex", "citrus"], ["konex", "advisor"], ["override", "callisto"]];
const KONEX_STATS = {
  advisor: { Speed: 380, Accel: 600, Maneuver: 4, Shield: 350, Armor: 150 },
  citrus: { Speed: 420, Accel: 650, Maneuver: 5, Shield: 180, Armor: 120 },
};
const record = (ship) => ({ ...(ship.meta.stats ?? {}), ...(KONEX_STATS[ship.slug] ?? {}) });
// Flying: strafe speed from Speed, how quickly it gets there from Accel, guns
// by size (big hulls fire two streams), hits it can take from Shield + Armor.
function flyerOf(ship) {
  const st = record(ship), size = ship.sprite.frame_width;
  return { ship, slug: ship.slug, name: ship.name, record: st, speed: 120 + st.Speed * 0.5, accel: 4 + st.Accel / 100,
    twin: size >= 60, every: 0.12 + size / 800, shield: Math.round(2 + Math.sqrt(st.Shield + st.Armor) / 8), radius: size * 0.22 };
}
const enemyHp = (ship) => { const st = record(ship); return 2 + Math.sqrt(st.Shield + st.Armor) / 3; };

// --- Stages --------------------------------------------------------------------------------------

// Each stage is a list of waves: [seconds in, pattern, hull, count].
const STAGES = [
  { name: "The Outer Picket", boss: "large-pin", planet: "gas", waves: [
    [1, "line", "gryphon", 5], [5, "swoop", "trident", 6], [9, "line", "gryphon", 6], [12, "dive", "dart", 3],
    [16, "swoop", "defender", 6], [20, "turret", "necromancer", 2], [24, "line", "trident", 7], [28, "dive", "dart", 4],
    [32, "tank", "tomaquad", 2], [36, "swoop", "gryphon", 8], [40, "dive", "defender", 5] ] },
  { name: "The Inner Blockade", boss: "yodacon98", planet: "lava", waves: [
    [1, "swoop", "trident", 8], [4, "dive", "dart", 4], [8, "turret", "necromancer", 3], [11, "line", "defender", 8],
    [15, "tank", "yodacon", 1], [18, "swoop", "gryphon", 10], [22, "dive", "dart", 6], [26, "tank", "tomaquad", 3],
    [30, "turret", "necromancer", 4], [34, "swoop", "defender", 10], [38, "dive", "dart", 6], [41, "tank", "yodacon", 2] ] },
  { name: "The Override Line", boss: "callisto98", planet: "garden", waves: [
    [1, "swoop", "citrus", 8], [4, "line", "advisor", 6], [8, "dive", "dart", 5], [11, "turret", "necromancer", 3],
    [14, "swoop", "trident", 10], [18, "tank", "yodacon", 2], [21, "dive", "citrus", 6], [24, "line", "advisor", 8],
    [28, "turret", "necromancer", 4], [31, "swoop", "defender", 12], [35, "dive", "dart", 7], [38, "tank", "tomaquad", 3],
    [41, "swoop", "citrus", 10], [44, "tank", "yodacon", 2] ] },
];
const BOMB_DAMAGE = 6;

// --- State ---------------------------------------------------------------------------------------

const state = { phase: "loading", hits: {}, hull: null, stage: 0, t: 0, wave: 0, score: 0, lives: 3, power: 0,
  me: null, enemies: [], shots: [], bombs: [], pickups: [], sparks: [], planet: null, bossOut: false };
let flyers = {}, kinds = {}, planets = {};
const stars = Array.from({ length: 120 }, () => ({ x: Math.random() * W, y: Math.random() * H, z: 0.3 + Math.random() * 0.7 }));

function load() { try { return JSON.parse(localStorage.getItem(SAVE)) ?? {}; } catch { return {}; } }
function save(d) { try { localStorage.setItem(SAVE, JSON.stringify(d)); } catch { /* not kept */ } }

function newGame(slug) {
  state.hull = flyers[slug];
  Object.assign(state, { stage: 0, score: 0, lives: 3, power: 0, hits: {} });
  startStage();
  $("pick").hidden = true;
  play("send");
}

function startStage() {
  Object.assign(state, { phase: "play", t: 0, wave: 0, enemies: [], shots: [], bombs: [], pickups: [], bossOut: false, smart: 1 });
  state.planet = { img: planets[STAGES[state.stage].planet], x: W * 0.72, y: -120 };
  respawn();
  banner(STAGES[state.stage].name, `Stage ${state.stage + 1} of ${STAGES.length}`, 1.8);
}

function respawn() {
  const h = state.hull;
  state.me = { k: h, x: W / 2, y: H - 70, vx: 0, bank: 0, cool: 0, shield: h.shield, safe: 2.5, alive: true };
}

let bannerUntil = 0;
function banner(title, text, secs) {
  $("banner-title").textContent = title;
  $("banner-text").textContent = text;
  $("banner").hidden = false;
  bannerUntil = secs ? state.t + secs : Infinity;
}

// --- Input ---------------------------------------------------------------------------------------

const held = new Set(), touch = { x: null, y: null };
addEventListener("keydown", (e) => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (state.phase === "play" && (k.startsWith("Arrow") || k === " ")) e.preventDefault();
  if (k === "Enter" && (state.phase === "over" || state.phase === "won")) showPick();
  if ((k === "b" || k === "x") && !e.repeat) smartBomb();
  held.add(k);
});
addEventListener("keyup", (e) => held.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key));
addEventListener("blur", () => held.clear());
// Touch: the ship follows your finger, a little above it, and fires on its own.
const toGame = (e) => { const b = canvas.getBoundingClientRect(); return { x: ((e.clientX - b.left) / b.width) * W, y: ((e.clientY - b.top) / b.height) * H - 50 }; };
canvas.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse") Object.assign(touch, toGame(e)); });
canvas.addEventListener("pointermove", (e) => { if (e.pointerType !== "mouse" && touch.x !== null) Object.assign(touch, toGame(e)); });
for (const ev of ["pointerup", "pointercancel"]) canvas.addEventListener(ev, () => { touch.x = touch.y = null; });

let padBomb = false;
// The smart bomb: once a stage, every bomb on screen gone and every raider
// hit for six (a boss too).
function smartBomb() {
  const me = state.me;
  if (state.phase !== "play" || !me?.alive || state.smart <= 0) return false;
  state.smart--;
  for (const b of state.bombs) { b.dead = true; burst(b.x, b.y, 2, "#e8f4ff", 30); }
  for (const e of state.enemies) if (e.alive && e.t >= 0 && e.y > -20) for (let i = 0; i < BOMB_DAMAGE && e.alive; i++) hitEnemy(e);
  state.sparks.push({ ring: true, x: me.x, y: me.y, life: 0.6, max: 0.6 });
  state.flash = 0.25;
  play("boom");
  return true;
}

function controls() {
  const c = { x: 0, y: 0, fire: held.has(" ") || $("auto").checked };
  if (held.has("ArrowLeft") || held.has("a")) c.x -= 1;
  if (held.has("ArrowRight") || held.has("d")) c.x += 1;
  if (held.has("ArrowUp") || held.has("w")) c.y -= 1;
  if (held.has("ArrowDown") || held.has("s")) c.y += 1;
  const pad = [...(navigator.getGamepads?.() ?? [])].find(Boolean);
  if (pad) {
    const ax = pad.axes[0] ?? 0, ay = pad.axes[1] ?? 0, b = (n) => pad.buttons[n]?.pressed;
    if (Math.abs(ax) > 0.25) c.x = ax; if (Math.abs(ay) > 0.25) c.y = ay;
    if (b(14)) c.x = -1; if (b(15)) c.x = 1; if (b(12)) c.y = -1; if (b(13)) c.y = 1;
    c.fire ||= b(0) || b(2) || b(7);
    if (b(3) && !padBomb) smartBomb();
    padBomb = b(3);
  }
  if (touch.x !== null && state.me) {
    const dx = touch.x - state.me.x, dy = touch.y - state.me.y;
    c.x = Math.max(-1, Math.min(1, dx / 30)); c.y = Math.max(-1, Math.min(1, dy / 30)); c.fire = true;
  }
  return c;
}

// --- Spawning ------------------------------------------------------------------------------------

function spawnWave([, pattern, slug, n]) {
  const k = kinds[slug];
  for (let i = 0; i < n; i++) {
    const e = { k, hp: enemyHp(k.ship) * (1 + state.stage * 0.5), pattern, t: -i * 0.35, x: 0, y: -40, heading: 180, cool: 1 + Math.random(), alive: true };
    if (pattern === "line") { e.x = ((i + 1) * W) / (n + 1); e.t = 0; e.y = -40 - (i % 2) * 30; }
    if (pattern === "swoop") { e.side = i % 2 ? 1 : -1; e.x = W / 2 + e.side * 160; }
    if (pattern === "dive") { e.x = 60 + Math.random() * (W - 120); e.t = -i * 0.7; }
    if (pattern === "turret") { e.x = ((i + 1) * W) / (n + 1); e.t = 0; e.hp *= 1.5; }
    if (pattern === "tank") { e.x = ((i + 1) * W) / (n + 1); e.t = -i * 1.2; e.hp *= 2; }
    state.enemies.push(e);
  }
}

function spawnBoss() {
  const slug = STAGES[state.stage].boss, k = kinds[slug];
  state.enemies.push({ k, hp: enemyHp(k.ship) * 8, max: enemyHp(k.ship) * 8, pattern: "boss", t: 0, x: W / 2, y: -80, heading: 180, cool: 1.5, alive: true, boss: true });
  state.bossOut = true;
  banner(k.name + (slug === "yodacon98" ? " (1998)" : slug === "callisto98" ? " (Override)" : ""), "Capital ship", 1.6);
  play("error");
}

// --- Simulation ----------------------------------------------------------------------------------

function fireAt(e, angle, speed = 170) {
  state.bombs.push({ x: e.x, y: e.y + e.k.radius * 0.6, vx: Math.sin(rad(angle)) * speed, vy: -Math.cos(rad(angle)) * speed });
}
const aimAtMe = (e) => (state.me?.alive ? deg(Math.atan2(state.me.x - e.x, -(state.me.y - e.y))) : 180);

// Where each pattern flies, and when it shoots. Headings are set from the
// direction of travel, so the right frame is drawn.
function fly(e, dt) {
  e.t += dt;
  if (e.t < 0) return;
  const px = e.x, py = e.y, me = state.me;
  switch (e.pattern) {
    case "line": e.y += 60 * dt; break;
    case "swoop": e.y += 110 * dt; e.x = W / 2 + e.side * (160 - 120 * Math.sin(e.t * 1.6)); break;
    case "dive":
      if (e.t < 1.2) e.y += 90 * dt;                       // drop in, then turn and dive at you
      else { const a = rad(e.dive ??= aimAtMe(e)); e.x += Math.sin(a) * 260 * dt; e.y -= Math.cos(a) * 260 * dt; }
      break;
    case "turret":                                        // hold station for ten seconds, then pull out
      if (e.t < 10) { e.y = Math.min(110, e.y + 70 * dt); e.x += Math.sin(e.t * 0.8) * 40 * dt; } else e.y -= 80 * dt;
      break;
    case "tank": e.y += 28 * dt; break;
    case "boss": e.y = Math.min(110, e.y + 40 * dt); e.x = W / 2 + Math.sin(e.t * 0.5) * (W / 2 - 80); break;
  }
  const dx = e.x - px, dy = e.y - py;
  if (e.pattern === "turret" || e.pattern === "boss") e.heading = e.pattern === "turret" ? aimAtMe(e) : 180;
  else if (Math.hypot(dx, dy) > 0.01) e.heading = deg(Math.atan2(dx, -dy));
  e.cool -= dt;
  if (e.cool <= 0 && e.y > 0 && me?.alive) {
    const sharp = 1 + state.stage * 0.3;
    if (e.pattern === "turret") { fireAt(e, aimAtMe(e)); e.cool = 1.6 / sharp; }
    else if (e.pattern === "tank") { for (const a of [160, 180, 200]) fireAt(e, a, 140); e.cool = 2 / sharp; }
    else if (e.pattern === "boss") {
      const spread = e.k.slug === "large-pin" ? [150, 165, 180, 195, 210] : [aimAtMe(e) - 20, aimAtMe(e), aimAtMe(e) + 20, 140, 220];
      for (const a of spread) fireAt(e, a, 160);
      e.cool = 1.1 / sharp;
    } else { if (Math.random() < 0.35 * sharp) fireAt(e, aimAtMe(e)); e.cool = 2 + Math.random() * 2; }
  }
  if (e.y > H + 60 || e.x < -80 || e.x > W + 80 || (e.t > 10 && e.y < -60)) e.alive = false;
}

function update(dt) {
  for (const s of stars) { s.y += 60 * s.z * dt; if (s.y > H) { s.y -= H; s.x = Math.random() * W; } }
  if (state.planet) state.planet.y += 14 * dt;
  if (state.flash > 0) state.flash -= dt;
  for (const p of state.sparks) { p.life -= dt; if (!p.ring) { p.x += p.vx * dt; p.y += p.vy * dt; } }
  state.sparks = state.sparks.filter((p) => p.life > 0);
  if (state.phase !== "play") return;
  state.t += dt;
  if (state.t > bannerUntil) { $("banner").hidden = true; bannerUntil = Infinity; }

  const stage = STAGES[state.stage];
  while (state.wave < stage.waves.length && stage.waves[state.wave][0] <= state.t) spawnWave(stage.waves[state.wave++]);
  if (state.wave === stage.waves.length && !state.bossOut && !state.enemies.some((e) => e.alive)) spawnBoss();

  // You: steer, bank, fire.
  const me = state.me;
  if (me?.alive) {
    const c = controls(), h = me.k;
    me.vx += (c.x * h.speed - me.vx) * Math.min(1, h.accel * dt);
    me.x = Math.max(20, Math.min(W - 20, me.x + me.vx * dt));
    me.y = Math.max(H * 0.35, Math.min(H - 30, me.y + c.y * h.speed * 0.8 * dt));
    me.bank = me.vx / h.speed;                                    // −1 … 1: which frame to show
    me.safe -= dt; me.cool -= dt;
    if (c.fire && me.cool <= 0) {
      me.cool = h.every;
      const lanes = h.twin ? [-8, 8] : [0];
      for (const o of lanes) state.shots.push({ x: me.x + o, y: me.y - 16, vx: 0, vy: -520 });
      if (state.power > 0) for (const a of [-12, 12]) state.shots.push({ x: me.x, y: me.y - 12, vx: Math.sin(rad(a)) * 520, vy: -Math.cos(rad(a)) * 520 });
      play("shot");
    }
  }
  if (state.power > 0) state.power -= dt;

  for (const e of state.enemies) if (e.alive) fly(e, dt);
  for (const s of state.shots) {
    s.x += s.vx * dt; s.y += s.vy * dt;
    for (const e of state.enemies) {
      if (!e.alive || e.t < 0 || s.dead) continue;
      if (Math.abs(e.x - s.x) < e.k.radius && Math.abs(e.y - s.y) < e.k.radius) { s.dead = true; hitEnemy(e); }
    }
  }
  state.shots = state.shots.filter((s) => !s.dead && s.y > -20 && s.x > -20 && s.x < W + 20);
  for (const b of state.bombs) {
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (me?.alive && me.safe <= 0 && Math.hypot(b.x - me.x, b.y - me.y) < me.k.radius) { b.dead = true; hitMe("bomb"); }
  }
  state.bombs = state.bombs.filter((b) => !b.dead && b.y < H + 10 && b.y > -10 && b.x > -10 && b.x < W + 10);
  for (const e of state.enemies) {                                // ramming hurts both
    if (e.alive && e.t >= 0 && me?.alive && me.safe <= 0 && Math.hypot(e.x - me.x, e.y - me.y) < e.k.radius + me.k.radius * 0.7) {
      if (!e.boss) { e.hp = 0; hitEnemy(e, true); }
      hitMe("ram");
    }
  }
  for (const p of state.pickups) {
    p.y += 60 * dt;
    if (me?.alive && Math.hypot(p.x - me.x, p.y - me.y) < 22) {
      p.dead = true;
      if (p.kind === "power") state.power = 12; else me.shield = Math.min(me.k.shield, me.shield + 2);
      state.score += 50;
      play("pickup");
    }
  }
  state.pickups = state.pickups.filter((p) => !p.dead && p.y < H + 20);
  state.enemies = state.enemies.filter((e) => e.alive);
  if (state.bossOut && !state.enemies.length) stageCleared();
  hud();
}

function hitEnemy(e, rammed = false) {
  e.hp -= rammed ? 999 : 1;
  burst(e.x, e.y, 3, "#8fd8ff", 50);
  if (e.hp > 0) { if (e.boss) play("hit"); return; }
  e.alive = false;
  const big = e.boss ? 60 : 18;
  burst(e.x, e.y, big, "#ffcf6b", e.boss ? 200 : 120);
  burst(e.x, e.y, big / 2, "#ff5a3c", 80);
  play("boom");
  state.score += e.boss ? 5000 : Math.round(enemyHp(e.k.ship) * 20);
  if (!e.boss && Math.random() < 0.08) state.pickups.push({ x: e.x, y: e.y, kind: Math.random() < 0.5 ? "power" : "shield" });
}

function hitMe(by) {
  const me = state.me;
  if (!me?.alive) return;
  state.hits[by] = (state.hits[by] ?? 0) + 1;              // what hurts, for the play-test
  me.shield--;
  burst(me.x, me.y, 6, "#8fd8ff", 60);
  play("hit");
  if (me.shield > 0) return;
  me.alive = false;
  burst(me.x, me.y, 40, "#ffcf6b", 160);
  play("boom");
  state.lives--;
  if (state.lives <= 0) return end(false);
  setTimeout(() => { if (state.phase === "play") respawn(); }, 1200);
}

function stageCleared() {
  state.stage++;
  play("conquered");
  if (state.stage === STAGES.length) return end(true);
  state.phase = "between";
  banner("Stage clear", `Next: ${STAGES[state.stage].name}.`, 0);
  setTimeout(() => startStage(), 2200);
}

function end(won) {
  state.phase = won ? "won" : "over";
  const best = load(), key = state.hull.slug, record = !best[key] || state.score > best[key];
  if (record) save({ ...best, [key]: state.score });
  play(won ? "won" : "lost");
  banner(won ? "Through the blockade" : "Shot down",
    `${state.hull.name}: ${state.score.toLocaleString()} points${record ? " — your best with this hull" : ""}. Enter for another run.`, 0);
  renderPick();
}

function burst(x, y, n, color, speed) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = speed * (0.3 + Math.random());
    state.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.2 + Math.random() * 0.5, max: 0.7, color });
  }
}

// --- Drawing -------------------------------------------------------------------------------------

function hud() {
  $("smart").textContent = state.smart > 0 ? "ready" : "used";
  $("score").textContent = state.score.toLocaleString();
  $("lives").textContent = Math.max(0, state.lives);
  $("stage").textContent = `${Math.min(state.stage + 1, STAGES.length)}/${STAGES.length}`;
}

function draw() {
  ctx.fillStyle = "#04050a";
  ctx.fillRect(0, 0, W, H);
  if (state.flash > 0) { ctx.fillStyle = `rgb(232 244 255 / ${state.flash * 2})`; ctx.fillRect(0, 0, W, H); }
  if (state.planet) { const p = state.planet; ctx.globalAlpha = 0.85; ctx.drawImage(p.img, p.x - p.img.width / 2, p.y - p.img.height / 2); ctx.globalAlpha = 1; }
  for (const s of stars) { ctx.fillStyle = `rgb(160 170 210 / ${s.z})`; ctx.fillRect(s.x, s.y, 1, s.z > 0.8 ? 2 : 1); }
  for (const p of state.pickups) {
    ctx.fillStyle = p.kind === "power" ? "#7ef0a8" : "#8fd8ff";
    ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#04140b"; ctx.font = "700 11px ui-monospace, monospace"; ctx.fillText(p.kind === "power" ? "P" : "S", p.x - 3.5, p.y + 4);
  }
  for (const e of state.enemies) {
    if (e.t < 0) continue;
    drawShip(ctx, e.k.ship, e.heading, e.x, e.y, 1);
    if (e.boss) {
      ctx.fillStyle = "rgb(255 255 255 / 0.15)"; ctx.fillRect(40, 10, W - 80, 5);
      ctx.fillStyle = "#ff7a59"; ctx.fillRect(40, 10, ((W - 80) * Math.max(0, e.hp)) / e.max, 5);
    }
  }
  const me = state.me;
  if (me?.alive && (me.safe <= 0 || Math.floor(me.safe * 10) % 2)) {
    // Banking: frame 0 level, 35/1 a slight bank, 34/2 a hard one.
    const bank = me.bank < -0.6 ? 340 : me.bank < -0.2 ? 350 : me.bank > 0.6 ? 20 : me.bank > 0.2 ? 10 : 0;
    drawShip(ctx, me.k.ship, bank, me.x, me.y, 1);
    if (state.power > 0) { ctx.strokeStyle = "rgb(126 240 168 / 0.5)"; ctx.beginPath(); ctx.arc(me.x, me.y, me.k.radius + 8, 0, Math.PI * 2); ctx.stroke(); }
  }
  ctx.strokeStyle = "#7ef0a8"; ctx.lineWidth = 2;
  for (const s of state.shots) { ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * 0.02, s.y - s.vy * 0.02); ctx.stroke(); }
  for (const b of state.bombs) { ctx.fillStyle = "#ff7a59"; ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill(); }
  for (const p of state.sparks) {
    if (p.ring) {                                                 // the smart bomb's shock ring
      ctx.strokeStyle = `rgb(232 244 255 / ${p.life / p.max})`; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(p.x, p.y, (1 - p.life / p.max) * H, 0, Math.PI * 2); ctx.stroke(); ctx.lineWidth = 1;
      continue;
    }
    ctx.globalAlpha = Math.min(1, (p.life / p.max) * 1.5); ctx.fillStyle = p.color; ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
  }
  ctx.globalAlpha = 1;
  if (me) {                                                       // shield pips
    for (let i = 0; i < me.k.shield; i++) { ctx.fillStyle = i < me.shield ? "#8fd8ff" : "rgb(255 255 255 / 0.15)"; ctx.fillRect(8 + i * 9, H - 12, 7, 5); }
  }
}

// --- Pick ----------------------------------------------------------------------------------------

function renderPick() {
  const best = load();
  $("hulls").replaceChildren(...FLYABLE.map(([, slug]) => {
    const h = flyers[slug];
    const b = document.createElement("button");
    b.type = "button"; b.className = "hull";
    b.innerHTML = `<img src="${h.ship.urls.yard}" alt=""><span class="name">${h.name}</span>` +
      `<span class="specs">Strafe ${Math.round(h.speed)} · ${h.twin ? "twin guns" : "one gun"} · shield ${h.shield}</span>` +
      (best[slug] ? `<span class="best">Best ${best[slug].toLocaleString()}</span>` : "");
    b.addEventListener("click", () => newGame(slug));
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
  if (state.phase !== "loading") draw();
  requestAnimationFrame(frame);
});

const [own, foes, ...arts] = await Promise.all([
  Promise.all(FLYABLE.map(([ed, s]) => loadShip(ed, s))),
  Promise.all(ENEMIES.map(([ed, s]) => loadShip(ed, s))),
  ...["gas", "lava", "garden"].map((t) => loadImage(new URL(`planets/${t}/large/planet.png`, PACK_BASE).href)),
]);
own.forEach((s) => { flyers[s.slug] = flyerOf(s); });
foes.forEach((s, i) => { kinds[ENEMIES[i][0] === "override" ? `${s.slug}98` : s.slug] = { ship: s, slug: s.slug, name: s.name, radius: s.sprite.frame_width * 0.38 }; });
planets = { gas: arts[0], lava: arts[1], garden: arts[2] };
$("mute").onclick = () => { setMuted(!isMuted()); $("mute").textContent = `Sound: ${isMuted() ? "off" : "on"}`; $("mute").setAttribute("aria-pressed", String(isMuted())); };
$("mute").textContent = `Sound: ${isMuted() ? "off" : "on"}`;
$("new").onclick = showPick;
$("bomb-btn").onclick = () => smartBomb();
showPick();
// tick(n) runs n simulation steps at once, for play-tests on slow machines.
globalThis.blockade = { state, newGame, showPick, smartBomb, tick: (n = 1) => { for (let i = 0; i < n; i++) update(STEP); } };
