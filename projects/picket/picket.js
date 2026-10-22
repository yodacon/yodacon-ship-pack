// Picket: hold the lane to the station. Build a picket line of pack ships
// beside the lane; raiders fly it in waves, each drawn on the frame for the
// way it is going, and your ships turn to face what they shoot. Every hull's
// price, range and guns come from its 1997 record.
import { loadShip, loadImage, drawShip, PACK_BASE } from "../../lib/yodacon-ship-pack.js";
import { play, isMuted, setMuted } from "../../lib/yodacon-sound.js";

const $ = (id) => document.getElementById(id);
const canvas = $("screen"), ctx = canvas.getContext("2d");
const W = canvas.width, H = canvas.height, CELL = 40, COLS = W / CELL, ROWS = H / CELL;
const SAVE = "picket-v1", WAVES = 15;
const deg = (r) => (r * 180) / Math.PI;
const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

// --- Hulls ---------------------------------------------------------------------------------------

// Your picket: six hulls. konex's Advisor and Citrus have no 1997 record, so
// their numbers are set here in the same ranges.
const PICKET = [["conex", "gryphon"], ["conex", "defender"], ["konex", "advisor"], ["konex", "citrus"],
  ["override", "callisto"], ["conex", "yodacon"]];
// The raiders: five more, the Large Pin (the only Pin) as the heavy.
const RAIDERS = [["conex", "trident"], ["conex", "dart"], ["conex", "necromancer"], ["conex", "tomaquad"], ["conex", "large-pin"]];
const KONEX_STATS = {
  advisor: { Speed: 380, Accel: 600, Maneuver: 4, Shield: 350, Armor: 150, Cost: 1500000 },
  citrus: { Speed: 420, Accel: 650, Maneuver: 5, Shield: 180, Armor: 120, Cost: 800000 },
};
// What each picket hull does beyond shooting.
const ROLES = {
  gryphon: "Cheap and steady.",
  defender: "Short range, very quick guns.",
  advisor: "Long range.",
  citrus: "Its tractor slows what it hits by 40%.",
  callisto: "Twin heavy guns.",
  yodacon: "Shots burst, hitting everything close by.",
};

const record = (ship) => ({ ...(ship.meta.stats ?? {}), ...(KONEX_STATS[ship.slug] ?? {}) });
// A picket ship from its record: price from Cost (on a log scale), range from
// Speed, rate of fire from Maneuver, damage from size.
function picketOf(ship) {
  const st = record(ship), size = ship.sprite.frame_width;
  const k = { ship, slug: ship.slug, name: ship.name, record: st,
    price: Math.round(56 + 31 * Math.log10(st.Cost / 50000)),
    range: Math.round(80 + st.Speed / 5), every: 1.6 / st.Maneuver, damage: Math.round(3 + size / 8),
    twin: size >= 60, slow: ship.slug === "citrus", splash: ship.slug === "yodacon" ? 50 : 0 };
  if (ship.slug === "defender") { k.range -= 30; k.every *= 0.5; }
  if (ship.slug === "advisor") k.range += 50;
  if (ship.slug === "callisto") k.every *= 0.7;
  return k;
}
// A raider from its record: toughness 4·√(Shield + Armor), lane speed from Speed.
function raiderOf(ship) {
  const st = record(ship);
  return { ship, slug: ship.slug, name: ship.name, hp: 4 * Math.sqrt(st.Shield + st.Armor), speed: st.Speed * 0.28,
    bounty: Math.round(1 + Math.sqrt(st.Shield + st.Armor) / 12), radius: ship.sprite.frame_width * 0.3 };
}

// --- Maps ----------------------------------------------------------------------------------------

// The lane as cell corners, from the left edge to the station. A short lane
// gets slower raiders (pace), so both give the picket about as long to shoot.
const MAPS = [
  { name: "The Long Way Round", pace: 1, station: [10, 6], lane: [[-1, 1], [17, 1], [17, 10], [2, 10], [2, 4], [13, 4], [13, 7], [10, 7], [10, 6]] },
  { name: "The Switchback (harder)", pace: 0.62, station: [18, 6], lane: [[-1, 2], [4, 2], [4, 9], [9, 9], [9, 3], [14, 3], [14, 9], [18, 9], [18, 6]] },
];

// --- State ---------------------------------------------------------------------------------------

const state = { phase: "loading", map: 0, credits: 0, hull: 20, wave: 0, towers: [], raiders: [], spawnQueue: [], beams: [],
  sparks: [], building: null, selected: null, fast: false, kills: 0, time: 0 };
let pickets = {}, raiders = {}, stationArt = null, lanePts = [], laneCells = new Set();
const stars = Array.from({ length: 160 }, () => [Math.random() * W, Math.random() * H, Math.random()]);

function load() { try { return JSON.parse(localStorage.getItem(SAVE)) ?? {}; } catch { return {}; } }
function save(d) { try { localStorage.setItem(SAVE, JSON.stringify(d)); } catch { /* not kept */ } }

const centre = ([c, r]) => ({ x: c * CELL + CELL / 2, y: r * CELL + CELL / 2 });
function buildLane() {
  const m = MAPS[state.map];
  lanePts = m.lane.map(centre);
  laneCells = new Set();
  for (let i = 1; i < m.lane.length; i++) {               // every cell the lane passes through
    const [c0, r0] = m.lane[i - 1], [c1, r1] = m.lane[i];
    for (let c = Math.min(c0, c1); c <= Math.max(c0, c1); c++) for (let r = Math.min(r0, r1); r <= Math.max(r0, r1); r++) laneCells.add(`${c},${r}`);
  }
  const [sc, sr] = m.station;
  for (let c = sc - 1; c <= sc + 1; c++) for (let r = sr - 1; r <= sr + 1; r++) laneCells.add(`${c},${r}`);
}

function newGame() {
  Object.assign(state, { phase: "build", credits: 200, hull: 20, wave: 0, towers: [], raiders: [], spawnQueue: [], beams: [],
    sparks: [], building: null, selected: null, kills: 0, time: 0 });
  buildLane();
  $("banner").hidden = true;
  renderShop(); renderInfo(); readouts();
}

// --- Waves ---------------------------------------------------------------------------------------

// Wave n: mostly the hulls unlocked so far, more of them, a little tougher;
// a Large Pin every fifth wave.
function waveOf(n) {
  const pool = ["trident", "dart", "necromancer", "tomaquad"].slice(0, Math.min(4, 1 + Math.floor(n / 3)));
  const list = [];
  const count = 5 + Math.floor(n * 1.5);
  for (let i = 0; i < count; i++) list.push(pool[i % pool.length]);
  if (n % 5 === 0) list.push("large-pin");
  return { list, toughness: 1 + 0.45 * (n - 1) };
}

function launchWave() {
  if (state.phase !== "build") return;
  state.wave++;
  const w = waveOf(state.wave);
  state.spawnQueue = w.list.map((slug, i) => ({ slug, at: state.time + i * 0.9, toughness: w.toughness }));
  state.phase = "wave";
  play("send");
  readouts();
}

function spawn(q) {
  const k = raiders[q.slug], hp = k.hp * q.toughness;
  state.raiders.push({ k, hp, max: hp, seg: 1, x: lanePts[0].x, y: lanePts[0].y, heading: 90, slowUntil: 0, alive: true });
}

// --- Building ------------------------------------------------------------------------------------

const cellAt = (x, y) => [Math.floor(x / CELL), Math.floor(y / CELL)];
const towerAt = (c, r) => state.towers.find((t) => t.c === c && t.r === r);
function canBuild(c, r) { return c >= 0 && r >= 0 && c < COLS && r < ROWS && !laneCells.has(`${c},${r}`) && !towerAt(c, r); }

function build(slug, c, r) {
  const k = pickets[slug];
  if (!k || !canBuild(c, r) || state.credits < k.price || state.phase === "over") { play("error"); return false; }
  state.credits -= k.price;
  const t = { k, c, r, ...centre([c, r]), heading: 90, cool: 0, level: 1, spent: k.price };
  state.towers.push(t);
  state.selected = t;
  play("select");
  renderInfo(); readouts(); renderShop();
  return true;
}
const upgradeCost = (t) => Math.round(t.k.price * 0.8 * t.level);
function upgrade(t) {
  if (!t || t.level >= 3 || state.credits < upgradeCost(t)) { play("error"); return; }
  state.credits -= upgradeCost(t);
  t.spent += upgradeCost(t);
  t.level++;
  play("pickup");
  renderInfo(); readouts(); renderShop();
}
function sell(t) {
  if (!t) return;
  state.credits += Math.round(t.spent * 0.6);
  state.towers.splice(state.towers.indexOf(t), 1);
  state.selected = null;
  play("cancel");
  renderInfo(); readouts(); renderShop();
}
// A tower's numbers at its level: +30% damage and +12% range a level.
const stat = (t) => ({ damage: t.k.damage * (1 + 0.3 * (t.level - 1)), range: t.k.range * (1 + 0.12 * (t.level - 1)), every: t.k.every });

canvas.addEventListener("pointerdown", (e) => {
  if (state.phase === "loading") return;
  const box = canvas.getBoundingClientRect();
  const [c, r] = cellAt(((e.clientX - box.left) / box.width) * W, ((e.clientY - box.top) / box.height) * H);
  const t = towerAt(c, r);
  if (t) { state.selected = t; state.building = null; play("target"); renderInfo(); renderShop(); return; }
  if (state.building) { build(state.building, c, r); return; }
  state.selected = null; renderInfo();
});
let hover = null;
canvas.addEventListener("pointermove", (e) => {
  const box = canvas.getBoundingClientRect();
  hover = cellAt(((e.clientX - box.left) / box.width) * W, ((e.clientY - box.top) / box.height) * H);
});
canvas.addEventListener("pointerleave", () => { hover = null; });
addEventListener("keydown", (e) => {
  if (e.target.closest?.("select, input")) return;
  const n = Number(e.key);
  if (n >= 1 && n <= PICKET.length) { state.building = PICKET[n - 1][1]; state.selected = null; renderShop(); renderInfo(); }
  if (e.key === "Escape") { state.building = null; state.selected = null; renderShop(); renderInfo(); }
  if (e.key === " " || e.key === "Enter") { e.preventDefault(); if (state.phase === "over") newGame(); else launchWave(); }
  if (e.key === "u") upgrade(state.selected);
  if (e.key === "x") sell(state.selected);
  if (e.key === "f") toggleFast();
});

// --- Simulation ----------------------------------------------------------------------------------

function moveRaider(m, dt) {
  const slow = m.slowUntil > state.time ? 0.6 : 1;
  let left = m.k.speed * slow * MAPS[state.map].pace * dt;
  while (left > 0 && m.seg < lanePts.length) {
    const p = lanePts[m.seg], d = dist(m, p);
    if (d > 0.01) m.heading = deg(Math.atan2(p.x - m.x, -(p.y - m.y)));   // face along the lane
    if (d <= left) { m.x = p.x; m.y = p.y; left -= d; m.seg++; }
    else { m.x += ((p.x - m.x) / d) * left; m.y += ((p.y - m.y) / d) * left; left = 0; }
  }
  if (m.seg >= lanePts.length) {                           // reached the station
    m.alive = false;
    state.hull -= m.k.slug === "large-pin" ? 5 : 1;
    burst(m.x, m.y, 20, "#ff7a59", 80);
    play("hit");
    readouts();
    if (state.hull <= 0) end(false);
  }
}
// How far along the lane a raider is, so towers can pick the leader.
const along = (m) => m.seg * 1e4 - dist(m, lanePts[Math.min(m.seg, lanePts.length - 1)]);

function fireTower(t, dt) {
  t.cool -= dt;
  const s = stat(t);
  let target = null;
  for (const m of state.raiders) if (m.alive && dist(t, m) <= s.range && (!target || along(m) > along(target))) target = m;
  if (!target) return;
  t.heading = deg(Math.atan2(target.x - t.x, -(target.y - t.y)));
  if (t.cool > 0) return;
  t.cool = s.every;
  const hits = t.k.splash ? state.raiders.filter((m) => m.alive && dist(m, target) <= t.k.splash) : [target];
  for (const m of hits) damage(m, s.damage * (t.k.twin ? 2 : 1), t);
  state.beams.push({ x0: t.x, y0: t.y, x1: target.x, y1: target.y, life: 0.1, color: t.k.slow ? "#ffcf6b" : t.k.splash ? "#ff9d80" : "#7ef0a8", splash: t.k.splash });
}

function damage(m, d, t) {
  m.hp -= d;
  if (t.k.slow) m.slowUntil = state.time + 1.5;
  if (m.hp > 0) return;
  m.alive = false;
  state.kills++;
  state.credits += m.k.bounty;
  burst(m.x, m.y, 26, "#ffcf6b", 120);
  state.sparks.push({ ring: true, x: m.x, y: m.y, r: m.k.radius, life: 0.4, max: 0.4 });
  play("boom");
  readouts(); renderShop();
}

function burst(x, y, n, color, speed) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = speed * (0.3 + Math.random());
    state.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.2 + Math.random() * 0.5, max: 0.7, color });
  }
}

function update(dt) {
  for (const p of state.sparks) { p.life -= dt; if (!p.ring) { p.x += p.vx * dt; p.y += p.vy * dt; } }
  state.sparks = state.sparks.filter((p) => p.life > 0);
  for (const b of state.beams) b.life -= dt;
  state.beams = state.beams.filter((b) => b.life > 0);
  if (state.phase !== "wave") return;
  state.time += dt;
  while (state.spawnQueue.length && state.spawnQueue[0].at <= state.time) spawn(state.spawnQueue.shift());
  for (const m of state.raiders) if (m.alive) moveRaider(m, dt);
  if (state.phase !== "wave") return;
  for (const t of state.towers) fireTower(t, dt);
  state.raiders = state.raiders.filter((m) => m.alive);
  if (!state.raiders.length && !state.spawnQueue.length) {
    if (state.wave === WAVES) return end(true);
    state.phase = "build";
    state.credits += 20 + state.wave * 3;                  // the station pays between waves
    play("conquered");
    readouts(); renderShop();
  }
}

function end(won) {
  state.phase = "over";
  const best = load(), key = String(state.map);
  const score = won ? state.hull * 100 + state.credits : state.wave;
  const record = won && (!best[key] || score > best[key]);
  if (record) save({ ...best, [key]: score });
  play(won ? "won" : "lost");
  $("banner-title").textContent = won ? "The picket held" : "Station lost";
  $("banner-text").textContent = won
    ? `All ${WAVES} waves turned back on ${MAPS[state.map].name}, the station at ${state.hull}/20, ${state.kills} raiders down. Score ${score}${record ? " — your best here" : ""}. Space for a new game.`
    : `The raiders broke through in wave ${state.wave}, after ${state.kills} kills. Space for a new game.`;
  $("banner").hidden = false;
}

// --- Panels --------------------------------------------------------------------------------------

function readouts() {
  $("credits").textContent = state.credits;
  $("station").textContent = `${Math.max(0, state.hull)}/20`;
  $("wave").textContent = `${state.wave}/${WAVES}`;
  $("launch").disabled = state.phase !== "build";
  $("launch").textContent = state.phase === "wave" ? "Wave under way" : state.wave === 0 ? "Launch wave 1" : `Launch wave ${state.wave + 1}`;
}

function renderShop() {
  $("shop").replaceChildren(...PICKET.map(([, slug], i) => {
    const k = pickets[slug];
    if (!k) return document.createElement("span");
    const b = document.createElement("button");
    b.type = "button";
    b.className = "buy";
    b.setAttribute("aria-pressed", String(state.building === slug));
    b.disabled = state.credits < k.price;
    b.innerHTML = `<img src="${k.ship.urls.comm}" alt="" width="40" height="40"><span><b>${i + 1}. ${k.name}</b> ${k.price} cr<br>` +
      `<small>Range ${k.range} · ${(k.damage * (k.twin ? 2 : 1) / k.every).toFixed(0)} dmg/s. ${ROLES[slug]}</small></span>`;
    b.addEventListener("click", () => { state.building = state.building === slug ? null : slug; state.selected = null; play("select"); renderShop(); renderInfo(); });
    return b;
  }));
}

function renderInfo() {
  const t = state.selected, box = $("info");
  if (!t) {
    box.innerHTML = state.building
      ? `<p class="muted">Click a free square beside the lane to build a ${pickets[state.building].name}. <kbd>Esc</kbd> cancels.</p>`
      : `<p class="muted">Pick a ship to build (<kbd>1</kbd>–<kbd>6</kbd>), or click one of yours to upgrade or sell it.</p>`;
    return;
  }
  const s = stat(t);
  box.innerHTML = `<div class="sel"><img src="${t.k.ship.urls.target}" alt=""><div><p class="name">${t.k.name} · level ${t.level}</p>` +
    `<p class="muted">Range ${Math.round(s.range)} · ${Math.round((s.damage * (t.k.twin ? 2 : 1)) / s.every)} dmg/s</p></div></div>` +
    `<p class="acts"><button type="button" class="yc-plate" id="up" ${t.level >= 3 || state.credits < upgradeCost(t) ? "disabled" : ""}>` +
    `${t.level >= 3 ? "Fully upgraded" : `Upgrade (${upgradeCost(t)} cr)`}</button>` +
    `<button type="button" class="yc-plate" id="sell">Sell (${Math.round(t.spent * 0.6)} cr)</button></p>`;
  $("up").onclick = () => upgrade(t);
  $("sell").onclick = () => sell(t);
}

function toggleFast() {
  state.fast = !state.fast;
  $("fast").setAttribute("aria-pressed", String(state.fast));
  $("fast").textContent = state.fast ? "Speed: ×2" : "Speed: ×1";
}

// --- Drawing -------------------------------------------------------------------------------------

function draw() {
  ctx.fillStyle = "#04050a";
  ctx.fillRect(0, 0, W, H);
  for (const [x, y, b] of stars) { ctx.fillStyle = `rgb(160 170 210 / ${0.25 + b * 0.5})`; ctx.fillRect(x, y, 1, 1); }
  // The lane: a dashed ribbon with chevrons pointing the way.
  ctx.strokeStyle = "rgb(255 122 89 / 0.16)"; ctx.lineWidth = CELL - 6; ctx.lineJoin = "round";
  ctx.beginPath(); lanePts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
  ctx.strokeStyle = "rgb(255 122 89 / 0.45)"; ctx.lineWidth = 1; ctx.setLineDash([4, 10]);
  ctx.beginPath(); lanePts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke(); ctx.setLineDash([]);
  const st = centre(MAPS[state.map].station);
  ctx.drawImage(stationArt, st.x - stationArt.width / 2, st.y - stationArt.height / 2);

  if (hover && state.building) {                           // where the next ship would go, and its reach
    const [c, r] = hover, ok = canBuild(c, r) && state.credits >= pickets[state.building].price, p = centre([c, r]);
    ctx.fillStyle = ok ? "rgb(126 240 168 / 0.18)" : "rgb(255 122 89 / 0.2)";
    ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
    ctx.strokeStyle = "rgb(126 240 168 / 0.35)";
    ctx.beginPath(); ctx.arc(p.x, p.y, pickets[state.building].range, 0, Math.PI * 2); ctx.stroke();
  }
  if (state.selected) {
    ctx.strokeStyle = "rgb(143 216 255 / 0.5)";
    ctx.beginPath(); ctx.arc(state.selected.x, state.selected.y, stat(state.selected).range, 0, Math.PI * 2); ctx.stroke();
  }
  for (const t of state.towers) {
    ctx.fillStyle = "rgb(126 240 168 / 0.08)"; ctx.fillRect(t.c * CELL + 2, t.r * CELL + 2, CELL - 4, CELL - 4);
    const big = t.k.ship.sprite.frame_width;
    drawShip(ctx, t.k.ship, t.heading, t.x, t.y, 1);
    if (big > 56) {                                        // a big hull spills over its square; mark the square
      ctx.strokeStyle = "rgb(126 240 168 / 0.25)"; ctx.strokeRect(t.c * CELL + 2.5, t.r * CELL + 2.5, CELL - 5, CELL - 5);
    }
    for (let i = 1; i < t.level; i++) { ctx.fillStyle = "#ffcf6b"; ctx.fillRect(t.c * CELL + 4 + i * 6, t.r * CELL + CELL - 6, 4, 3); }
  }
  for (const m of state.raiders) {
    drawShip(ctx, m.k.ship, m.heading, m.x, m.y, 1);
    ctx.fillStyle = "rgb(255 255 255 / 0.15)"; ctx.fillRect(m.x - 14, m.y - m.k.radius - 8, 28, 3);
    ctx.fillStyle = m.slowUntil > state.time ? "#ffcf6b" : "#ff7a59";
    ctx.fillRect(m.x - 14, m.y - m.k.radius - 8, (28 * Math.max(0, m.hp)) / m.max, 3);
  }
  for (const b of state.beams) {
    ctx.globalAlpha = b.life / 0.1;
    ctx.strokeStyle = b.color; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(b.x0, b.y0); ctx.lineTo(b.x1, b.y1); ctx.stroke();
    if (b.splash) { ctx.beginPath(); ctx.arc(b.x1, b.y1, b.splash, 0, Math.PI * 2); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  for (const p of state.sparks) {
    const t = p.life / p.max;
    if (p.ring) { ctx.strokeStyle = `rgb(255 220 150 / ${t})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (3 - 2 * t), 0, Math.PI * 2); ctx.stroke(); }
    else { ctx.globalAlpha = Math.min(1, t * 1.5); ctx.fillStyle = p.color; ctx.fillRect(p.x - 1, p.y - 1, 2, 2); ctx.globalAlpha = 1; }
  }
  if (state.phase === "build" && state.wave < WAVES) {
    const w = waveOf(state.wave + 1), counts = {};
    for (const s of w.list) counts[s] = (counts[s] ?? 0) + 1;
    ctx.fillStyle = "#c9d1ea"; ctx.font = "700 12px ui-monospace, monospace";
    ctx.fillText(`Next: ${Object.entries(counts).map(([s, n]) => `${n} ${raiders[s].name}`).join(", ")}`, 8, H - 10);
  }
}

// --- Start ---------------------------------------------------------------------------------------

const STEP = 1 / 60;
let last = performance.now(), acc = 0;
requestAnimationFrame(function frame(now) {
  acc += Math.min(0.25, (now - last) / 1000) * (state.fast ? 2 : 1);
  last = now;
  while (acc >= STEP) { update(STEP); acc -= STEP; }
  if (state.phase !== "loading") draw();
  requestAnimationFrame(frame);
});

const [own, foes, art] = await Promise.all([
  Promise.all(PICKET.map(([ed, s]) => loadShip(ed, s))),
  Promise.all(RAIDERS.map(([ed, s]) => loadShip(ed, s))),
  loadImage(new URL("planets/ice/large/planet.png", PACK_BASE).href),
]);
own.forEach((s) => { pickets[s.slug] = picketOf(s); });
foes.forEach((s) => { raiders[s.slug] = raiderOf(s); });
stationArt = art;
$("map").replaceChildren(...MAPS.map((m, i) => new Option(m.name, i)));
$("map").onchange = () => { state.map = Number($("map").value); newGame(); };
$("launch").onclick = () => launchWave();
$("new").onclick = () => newGame();
$("fast").onclick = toggleFast;
$("mute").onclick = () => { setMuted(!isMuted()); $("mute").textContent = `Sound: ${isMuted() ? "off" : "on"}`; $("mute").setAttribute("aria-pressed", String(isMuted())); };
$("mute").textContent = `Sound: ${isMuted() ? "off" : "on"}`;
newGame();
// tick(n) runs n simulation steps at once, for play-tests on slow machines.
globalThis.picket = { state, MAPS, pickets, build, upgrade, launchWave, newGame, canBuild, tick: (n = 1) => { for (let i = 0; i < n; i++) update(STEP); } };
