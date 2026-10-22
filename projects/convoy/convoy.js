// Convoy: see a Large Pin freighter across a pirate-held corridor to the
// station at the far end. You fly one of three escorts, and two wingmen fly
// the others and take your orders, as escorts did in Escape Velocity. The
// target panel shows each ship's 1997 targeting picture; hails come with
// comm portraits.
import { loadShip, loadImage, drawShip, frameIndex, PACK_BASE } from "../../lib/yodacon-ship-pack.js";
import { play, isMuted, setMuted } from "../../lib/yodacon-sound.js";

const $ = (id) => document.getElementById(id);
const canvas = $("screen"), ctx = canvas.getContext("2d");
const VW = canvas.width, VH = canvas.height;
const WORLD = { w: 6000, h: 1200 }, STATION_X = 5750;
const BOLT_SPEED = 520, BOLT_LIFE = 0.9, SAVE = "convoy-v1";
const rad = (d) => (d * Math.PI) / 180, deg = (r) => (r * 180) / Math.PI;
const angleTo = (a, b) => deg(Math.atan2(b.x - a.x, -(b.y - a.y)));
const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
const wrap = (d) => ((d + 540) % 360) - 180;

// --- Ships ---------------------------------------------------------------------------------------

const ESCORTS = [["override", "callisto"], ["konex", "advisor"], ["konex", "citrus"]];
const RAIDERS = [["conex", "gryphon"], ["conex", "trident"], ["conex", "defender"], ["conex", "dart"],
  ["conex", "necromancer"], ["conex", "tomaquad"], ["conex", "yodacon"]];
const FREIGHTER = ["conex", "large-pin"];
// konex's ships have no 1997 record; these sit in the same ranges.
const KONEX_STATS = {
  advisor: { Speed: 380, Accel: 600, Maneuver: 4, Shield: 350, Armor: 150 },
  citrus: { Speed: 420, Accel: 650, Maneuver: 5, Shield: 180, Armor: 120 },
};
function hullOf(ship) {
  const st = { ...(ship.meta.stats ?? {}), ...(KONEX_STATS[ship.slug] ?? {}) };
  const total = 4 * Math.sqrt(st.Shield + st.Armor), size = ship.sprite.frame_width;
  return { ship, slug: ship.slug, name: ship.name,
    shieldMax: Math.round((total * st.Shield) / (st.Shield + st.Armor)),
    armourMax: Math.round((total * st.Armor) / (st.Shield + st.Armor)),
    speed: st.Speed * 0.6, accel: st.Accel * 0.6, turn: st.Maneuver * 45,
    damage: Math.round(4 + size / 12), twin: size >= 60, radius: size * 0.32 };
}

// --- The run -------------------------------------------------------------------------------------

const DIFFICULTY = {
  easy: { label: "Easy", extra: 0, fire: 0.85, aim: 0.6 },
  normal: { label: "Normal", extra: 2, fire: 0.85, aim: 0.85 },
  hard: { label: "Hard", extra: 4, fire: 0.95, aim: 0.95 },
};
// Raids, by how far along the freighter is: who comes, and from where.
const RAIDS = [
  { at: 700, from: "ahead", kinds: ["gryphon", "gryphon"] },
  { at: 1600, from: "below", kinds: ["trident", "defender", "gryphon"] },
  { at: 2600, from: "ahead", kinds: ["dart", "trident", "trident"] },
  { at: 3500, from: "behind", kinds: ["necromancer", "defender", "defender", "gryphon"] },
  { at: 4400, from: "above", kinds: ["tomaquad", "trident", "gryphon", "defender"] },
  { at: 5100, from: "ahead", kinds: ["yodacon", "dart", "necromancer"] },
];
const TAUNTS = ["Cut your engines and dump the cargo.", "That Pin is ours. Walk away.", "Nice freighter. We'll take it from here.",
  "You picked the wrong corridor, escort.", "Nobody has to get hurt. Except you."];

const state = { phase: "loading", diff: "normal", ships: [], bolts: [], sparks: [], raid: 0, time: 0, kills: 0,
  relaunches: 3, target: null, order: "escort", log: [] };
const hulls = {};
let station = null;
const stars = Array.from({ length: 900 }, () => [Math.random() * WORLD.w, Math.random() * WORLD.h, Math.random()]);

function load() { try { return JSON.parse(localStorage.getItem(SAVE)) ?? {}; } catch { return {}; } }
function save(d) { try { localStorage.setItem(SAVE, JSON.stringify(d)); } catch { /* not kept */ } }

function spawn(hull, x, y, heading, side, role, extra = {}) {
  return { hull, x, y, vx: 0, vy: 0, heading, side, role, shield: hull.shieldMax, armour: hull.armourMax,
    cool: 1, regenWait: 0, alive: true, lastHitBy: null, ...extra };
}
const freighter = () => state.ships.find((s) => s.role === "freighter");
const player = () => state.ships.find((s) => s.role === "player");

function newRun() {
  const pick = $("hull").value, diff = DIFFICULTY[state.diff];
  state.ships = []; state.bolts = []; state.sparks = []; state.log = [];
  state.raid = 0; state.time = 0; state.kills = 0; state.relaunches = 3; state.target = null; state.order = "escort";
  const fr = spawn(hulls[FREIGHTER[1]], 200, WORLD.h / 2, 90, "us", "freighter");
  fr.shield *= 3; fr.armour *= 3;                     // a freighter's hull, not a fighter's
  fr.hull = { ...fr.hull, shieldMax: fr.shield, armourMax: fr.armour };
  state.ships.push(fr);
  state.ships.push(spawn(hulls[pick], 260, WORLD.h / 2 - 110, 90, "us", "player"));
  ESCORTS.map(([, s]) => s).filter((s) => s !== pick).forEach((s, i) => {
    state.ships.push(spawn(hulls[s], 120, WORLD.h / 2 + (i ? 120 : -170), 90, "us", "wing", { slot: i }));
  });
  state.diffCfg = diff;
  state.phase = "run";
  $("banner").hidden = true;
  say(fr, "Consolidated Express 12, heavy with cargo. Keep them off us to the station.");
  renderWing();
}

// --- Messages ------------------------------------------------------------------------------------

function say(ship, text) {
  state.log.unshift({ ship, text, t: state.time });
  state.log.length = Math.min(state.log.length, 6);
  $("comms").replaceChildren(...state.log.map(({ ship: s, text: tx }) => {
    const li = document.createElement("li");
    const img = Object.assign(document.createElement("img"), { src: s.hull.ship.urls.comm, alt: "", width: 40, height: 40 });
    const who = s.role === "freighter" ? "Freighter" : s.role === "wing" ? `Wing ${s.slot + 1}, ${s.hull.name}` : `Pirate ${s.hull.name}`;
    li.append(img, Object.assign(document.createElement("p"), { innerHTML: `<b>${who}:</b> ` }));
    li.lastChild.append(tx);
    return li;
  }));
}

// --- Input ---------------------------------------------------------------------------------------

const held = new Set(), touch = new Set();
const KEYS = { left: ["ArrowLeft", "a"], right: ["ArrowRight", "d"], thrust: ["ArrowUp", "w"], brake: ["ArrowDown", "s"], fire: [" "] };
addEventListener("keydown", (e) => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (state.phase === "run" && (k.startsWith("Arrow") || k === " " || k === "Tab")) e.preventDefault();
  if (!e.repeat) {
    if (k === "Tab" || k === "t") nextTarget(e.shiftKey ? -1 : 1);
    if (k === "1") orderWing("attack");
    if (k === "2") orderWing("escort");
    if (k === "3") orderWing("form");
    if (k === "Enter" && state.phase !== "run") { e.preventDefault(); newRun(); }
  }
  held.add(k);
});
addEventListener("keyup", (e) => held.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key));
addEventListener("blur", () => held.clear());
for (const b of document.querySelectorAll("#pad [data-key]")) {
  b.addEventListener("pointerdown", (e) => { e.preventDefault(); touch.add(b.dataset.key); b.classList.add("down"); });
  for (const ev of ["pointerup", "pointerleave", "pointercancel"]) b.addEventListener(ev, () => { touch.delete(b.dataset.key); b.classList.remove("down"); });
}
$("pad-target").addEventListener("click", () => nextTarget(1));
let padPrev = {};
function controls() {
  const c = Object.fromEntries(Object.entries(KEYS).map(([w, keys]) => [w, keys.some((k) => held.has(k)) || touch.has(w)]));
  const pad = [...(navigator.getGamepads?.() ?? [])].find(Boolean);
  if (pad) {
    const x = pad.axes[0] ?? 0, b = (n) => pad.buttons[n]?.pressed;
    c.left ||= x < -0.4 || b(14); c.right ||= x > 0.4 || b(15);
    c.thrust ||= b(0) || (pad.buttons[7]?.value ?? 0) > 0.3; c.brake ||= (pad.buttons[6]?.value ?? 0) > 0.3;
    c.fire ||= b(2) || b(5);
    if (b(3) && !padPrev.y) nextTarget(1);             // Y: next target
    if (b(9) && !padPrev.start && state.phase !== "run") newRun();
    padPrev = { y: b(3), start: b(9) };
  }
  return c;
}

// Targets cycle nearest first, like EV's Tab.
function nextTarget(dir) {
  const me = player();
  if (!me?.alive) return;
  const list = state.ships.filter((s) => s.alive && s.side === "them").sort((a, b) => dist(me, a) - dist(me, b));
  if (!list.length) { state.target = null; renderTarget(); return; }
  const i = list.indexOf(state.target);
  state.target = list[(i + dir + list.length) % list.length] ?? list[0];
  play("target");
  renderTarget();
}

function orderWing(order) {
  state.order = order;
  const wing = state.ships.filter((s) => s.role === "wing" && s.alive);
  const words = { attack: "Engaging your target.", escort: "Back on the freighter.", form: "Forming on you." };
  if (wing[0]) say(wing[0], order === "attack" && !state.target ? "No target, lead. Staying put." : words[order]);
  for (const o of document.querySelectorAll("[data-order]")) o.setAttribute("aria-pressed", String(o.dataset.order === order));
  play("select");
}
for (const b of document.querySelectorAll("[data-order]")) b.addEventListener("click", () => orderWing(b.dataset.order));

// --- Simulation ----------------------------------------------------------------------------------

function steer(s, c, dt) {
  const h = s.hull;
  if (c.left) s.heading -= h.turn * dt;
  if (c.right) s.heading += h.turn * dt;
  s.heading = (s.heading + 360) % 360;
  if (c.thrust) {
    const a = rad(frameIndex(s.heading) * 10);
    s.vx += Math.sin(a) * h.accel * dt; s.vy -= Math.cos(a) * h.accel * dt;
  }
  if (c.brake) { s.vx *= 1 - 2 * dt; s.vy *= 1 - 2 * dt; }
  const v = Math.hypot(s.vx, s.vy), max = c.cruise ?? h.speed;
  if (v > max) { s.vx *= max / v; s.vy *= max / v; }
  if (c.fire && s.cool <= 0) fire(s);
}

function fire(s) {
  s.cool = s.role === "player" ? 0.22 : s.side === "us" ? 0.55 : 1.4 - state.diffCfg.fire;
  const a = rad(s.heading), dx = Math.sin(a), dy = -Math.cos(a), r = s.hull.radius;
  const dmg = s.side === "them" ? s.hull.damage * 0.7 : s.hull.damage;
  for (const o of s.hull.twin ? [-0.4, 0.4] : [0]) {
    state.bolts.push({ x: s.x + dx * r - dy * o * r, y: s.y + dy * r + dx * o * r, vx: s.vx + dx * BOLT_SPEED, vy: s.vy + dy * BOLT_SPEED,
      life: BOLT_LIFE, side: s.side, damage: dmg, from: s });
  }
  if (s.role === "player") play("shot");
}

// Fly at a (led) point and shoot when lined up; break off when too close.
function attack(s, t, aim) {
  const d = dist(s, t), lead = (d / BOLT_SPEED) * aim;
  const p = { x: t.x + (t.vx - s.vx) * lead, y: t.y + (t.vy - s.vy) * lead };
  let want = angleTo(s, p);
  const close = d < s.hull.radius + t.hull.radius + 60;
  if (close) want += 150;
  const diff = wrap(want - s.heading);
  return { left: diff < -4, right: diff > 4, thrust: Math.abs(diff) < 50 && (d > 160 || close),
    fire: !close && Math.abs(diff) < 9 && d < BOLT_SPEED * BOLT_LIFE * 0.9 };
}
// Hold a station relative to something, matching its speed.
function holdStation(s, at) {
  const d = dist(s, at), want = angleTo(s, at), diff = wrap(want - s.heading);
  if (d < 40) { const fr = freighter(); return { left: false, right: false, thrust: false, brake: Math.hypot(s.vx - (fr?.vx ?? 0), s.vy) > 30 }; }
  return { left: diff < -4, right: diff > 4, thrust: Math.abs(diff) < 40, cruise: Math.min(s.hull.speed, 40 + d) };
}

function nearestFoe(s, side, within = Infinity, from = s) {
  let best = null, bd = within;
  for (const o of state.ships) if (o.alive && o.side === side) { const d = dist(from, o); if (d < bd) { bd = d; best = o; } }
  return best;
}

function think(s) {
  const fr = freighter(), me = player();
  if (s.role === "freighter") {                          // straight down the corridor, weaving a little
    const want = 90 + 20 * Math.sin(s.x / 500);
    const diff = wrap(want - s.heading);
    return { left: diff < -2, right: diff > 2, thrust: true, cruise: 38 };
  }
  if (s.role === "raider") {
    // Raiders go for the freighter, unless someone has been shooting them.
    const t = s.lastHitBy?.alive && dist(s, s.lastHitBy) < 500 && s.grudge > state.time ? s.lastHitBy : fr?.alive ? fr : nearestFoe(s, "us");
    return t ? attack(s, t, state.diffCfg.aim) : {};
  }
  // Wingmen: attack your target, guard the freighter, or form on you.
  if (state.order === "attack" && state.target?.alive) return attack(s, state.target, 0.9);
  if (state.order === "form" && me?.alive) {
    const near = nearestFoe(s, "them", 280);
    if (near) return attack(s, near, 0.9);
    return holdStation(s, { x: me.x - 70, y: me.y + (s.slot ? 70 : -70) });
  }
  if (fr?.alive) {
    const threat = nearestFoe(s, "them", 520, fr);
    if (threat) return attack(s, threat, 0.9);
    return holdStation(s, { x: fr.x + 40, y: fr.y + (s.slot ? 110 : -110) });
  }
  return {};
}

function move(s, dt) {
  s.x += s.vx * dt; s.y += s.vy * dt;
  const r = s.hull.radius;
  if (s.y < r) { s.y = r; s.vy = Math.abs(s.vy) * 0.5; }
  if (s.y > WORLD.h - r) { s.y = WORLD.h - r; s.vy = -Math.abs(s.vy) * 0.5; }
  if (s.x < r) { s.x = r; s.vx = Math.abs(s.vx) * 0.5; }
  if (s.x > WORLD.w - r) { s.x = WORLD.w - r; s.vx = -Math.abs(s.vx) * 0.5; }
  s.cool -= dt; s.regenWait -= dt;
  if (s.regenWait <= 0) s.shield = Math.min(s.hull.shieldMax, s.shield + s.hull.shieldMax * 0.05 * dt);
}

function hit(s, b) {
  const toShield = Math.min(s.shield, b.damage);
  s.shield -= toShield; s.armour -= b.damage - toShield;
  s.regenWait = 3;
  if (s.side === "them") { s.lastHitBy = b.from; s.grudge = state.time + 4; }
  burst(s.x, s.y, 4, toShield > 0 ? "#8fd8ff" : "#ffb347", 60);
  if (s.armour > 0) { if (s.role === "player" || s.role === "freighter" || b.from.role === "player") play("hit"); return; }
  s.alive = false;
  burst(s.x, s.y, 40, "#ffcf6b", 160); burst(s.x, s.y, 20, "#ff5a3c", 90);
  state.sparks.push({ ring: true, x: s.x, y: s.y, r: s.hull.radius, life: 0.5, max: 0.5 });
  play("boom");
  if (s.side === "them") { state.kills++; if (state.target === s) { state.target = null; nextTarget(1); } }
  if (s.role === "wing") say(s, "I'm hit — punching out!");
  if (s.role === "player") {
    if (state.relaunches > 0) {
      state.relaunches--;
      state.relaunchAt = state.time + 4;
      say(freighter() ?? s, `Escort down. Launching a spare ${s.hull.name} in four seconds (${state.relaunches} left).`);
    } else say(freighter() ?? s, "No spares left. We're on our own.");
  }
  if (s.role === "freighter") end(false);
}

function burst(x, y, n, color, speed) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = speed * (0.3 + Math.random());
    state.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.3 + Math.random() * 0.5, max: 0.8, color });
  }
}

function raid() {
  const fr = freighter(), r = RAIDS[state.raid];
  if (!fr || fr.x < r.at) return;
  state.raid++;
  const kinds = [...r.kinds, ...RAIDS.slice(0, state.diffCfg.extra).map((x) => x.kinds[0])];
  kinds.forEach((slug, i) => {
    const spread = (i - (kinds.length - 1) / 2) * 90;
    const at = { ahead: [fr.x + 750, fr.y + spread], behind: [fr.x - 650, fr.y + spread],
      above: [fr.x + 200 + spread, 40], below: [fr.x + 200 + spread, WORLD.h - 40] }[r.from];
    const s = spawn(hulls[slug], at[0], at[1], 0, "them", "raider");
    s.heading = angleTo(s, fr);
    state.ships.push(s);
  });
  const lead = state.ships.filter((s) => s.role === "raider").at(-kinds.length);
  say(lead, TAUNTS[(state.raid - 1) % TAUNTS.length]);
  play("error");
  if (!state.target?.alive) nextTarget(1);
}

function update(dt) {
  for (const p of state.sparks) { p.life -= dt; if (!p.ring) { p.x += p.vx * dt; p.y += p.vy * dt; } }
  state.sparks = state.sparks.filter((p) => p.life > 0);
  if (state.phase !== "run") return;
  state.time += dt;
  if (state.raid < RAIDS.length) raid();
  if (state.relaunchAt && state.time >= state.relaunchAt) {
    state.relaunchAt = 0;
    const fr = freighter(), old = player();
    if (fr && old) Object.assign(old, spawn(old.hull, fr.x + 60, fr.y - 60, 90, "us", "player"), { vx: fr.vx, vy: fr.vy });
    play("send");
  }
  for (const s of state.ships) {
    if (!s.alive) continue;
    steer(s, s.role === "player" ? controls() : think(s), dt);
    move(s, dt);
  }
  for (const b of state.bolts) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    for (const s of state.ships) {
      if (b.life <= 0 || !s.alive || s.side === b.side) continue;
      if (dist(s, b) < s.hull.radius + 6) { b.life = 0; hit(s, b); }
    }
  }
  state.bolts = state.bolts.filter((b) => b.life > 0);
  const fr = freighter();
  if (fr?.alive && fr.x >= STATION_X) end(true);
}

function end(won) {
  if (state.phase !== "run") return;
  state.phase = won ? "won" : "lost";
  const fr = freighter(), hullPct = fr?.alive ? Math.round((100 * (fr.shield + fr.armour)) / (fr.hull.shieldMax + fr.hull.armourMax)) : 0;
  const pay = won ? 2000 + hullPct * 100 + state.kills * 250 : 0;
  const key = `${state.diff}:${$("hull").value}`, best = load();
  const record = won && (!best[key] || pay > best[key]);
  if (record) save({ ...best, [key]: pay });
  play(won ? "won" : "lost");
  $("banner-title").textContent = won ? "Delivered" : "Freighter lost";
  $("banner-text").textContent = won
    ? `The Pin docked with ${hullPct}% of its hull. ${state.kills} raiders down. Paid ${pay.toLocaleString()} credits${record ? " — your best on this run" : ""}. Enter to fly again.`
    : `The raiders got the cargo after ${Math.round(state.time)} s, ${state.kills} of them down. Enter to try again.`;
  $("banner").hidden = false;
}

// --- Panels --------------------------------------------------------------------------------------

function bar(el, v, max) { el.style.width = `${Math.max(0, Math.min(100, (100 * v) / max))}%`; }
function renderTarget() {
  const t = state.target;
  $("target-box").hidden = !t;
  $("no-target").hidden = !!t;
  if (!t) return;
  $("target-pic").src = t.hull.ship.urls.target;
  $("target-name").textContent = `Pirate ${t.hull.name}`;
}
function renderWing() {
  const wing = state.ships.filter((s) => s.role === "wing");
  $("wing").replaceChildren(...wing.map((s) => {
    const li = document.createElement("li");
    li.innerHTML = `<img src="${s.hull.ship.urls.comm}" alt="" width="40" height="40"><div><p class="who">Wing ${s.slot + 1}: ${s.hull.name}</p>` +
      `<p class="bar"><i data-shield></i></p><p class="bar armour"><i data-armour></i></p></div>`;
    li.ship = s;
    return li;
  }));
}
let lastPanel = 0;
function panels(now) {
  if (now - lastPanel < 150) return;
  lastPanel = now;
  const t = state.target;
  if (t) {
    bar($("target-shield"), t.shield, t.hull.shieldMax); bar($("target-armour"), t.armour, t.hull.armourMax);
    const me = player();
    $("target-range").textContent = me ? `Range ${Math.round(dist(me, t))}` : "";
  }
  for (const li of $("wing").children) {
    bar(li.querySelector("[data-shield]"), li.ship.alive ? li.ship.shield : 0, li.ship.hull.shieldMax);
    bar(li.querySelector("[data-armour]"), li.ship.alive ? li.ship.armour : 0, li.ship.hull.armourMax);
    li.classList.toggle("down", !li.ship.alive);
  }
}

// --- Drawing -------------------------------------------------------------------------------------

function draw() {
  const me = player(), fr = freighter(), focus = me?.alive ? me : fr ?? { x: VW / 2, y: WORLD.h / 2 };
  const ox = Math.round(Math.max(0, Math.min(WORLD.w - VW, focus.x - VW / 2)));
  const oy = Math.round(Math.max(0, Math.min(WORLD.h - VH, focus.y - VH / 2)));
  ctx.fillStyle = "#04050a"; ctx.fillRect(0, 0, VW, VH);
  for (const [x, y, b] of stars) {
    const px = x - ox * (0.3 + b * 0.5), py = y - oy * (0.3 + b * 0.5);
    const sx = ((px % WORLD.w) + WORLD.w) % WORLD.w, sy = ((py % WORLD.h) + WORLD.h) % WORLD.h;
    if (sx < VW && sy < VH) { ctx.fillStyle = `rgb(160 170 210 / ${0.3 + b * 0.6})`; ctx.fillRect(sx, sy, 1, 1); }
  }
  ctx.save(); ctx.translate(-ox, -oy);
  ctx.drawImage(station, STATION_X + 80 - station.width / 2, WORLD.h / 2 - station.height / 2);
  ctx.strokeStyle = "rgb(126 240 168 / 0.35)"; ctx.setLineDash([6, 10]);
  ctx.beginPath(); ctx.moveTo(STATION_X, 0); ctx.lineTo(STATION_X, WORLD.h); ctx.stroke(); ctx.setLineDash([]);
  for (const b of state.bolts) {
    ctx.strokeStyle = b.side === "us" ? "#7ef0a8" : "#ff7a59"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02); ctx.stroke();
  }
  for (const s of state.ships) {
    if (!s.alive) continue;
    drawShip(ctx, s.hull.ship, s.heading, s.x, s.y, 1);
    if (s === state.target) {                          // EV-style corner brackets
      const r = s.hull.radius + 10, k = 8;
      ctx.strokeStyle = "#ff7a59"; ctx.lineWidth = 2;
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        ctx.beginPath(); ctx.moveTo(s.x + sx * r, s.y + sy * (r - k)); ctx.lineTo(s.x + sx * r, s.y + sy * r); ctx.lineTo(s.x + sx * (r - k), s.y + sy * r); ctx.stroke();
      }
    }
  }
  for (const p of state.sparks) {
    const t = p.life / p.max;
    if (p.ring) { ctx.strokeStyle = `rgb(255 220 150 / ${t})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (3 - 2 * t), 0, Math.PI * 2); ctx.stroke(); }
    else { ctx.globalAlpha = Math.min(1, t * 1.5); ctx.fillStyle = p.color; ctx.fillRect(p.x - 1, p.y - 1, 2, 2); ctx.globalAlpha = 1; }
  }
  ctx.restore();
  radar(me, fr);
  hud(me, fr);
}

// The route strip: the whole corridor, the freighter's progress and every ship.
function radar(me, fr) {
  const x0 = 10, y0 = VH - 34, w = VW - 20, h = 24, s = w / WORLD.w;
  ctx.fillStyle = "rgb(4 5 10 / 0.8)"; ctx.fillRect(x0, y0, w, h);
  ctx.strokeStyle = "rgb(126 240 168 / 0.4)"; ctx.strokeRect(x0 + 0.5, y0 + 0.5, w, h);
  for (const r of RAIDS) { ctx.fillStyle = "rgb(255 122 89 / 0.35)"; ctx.fillRect(x0 + r.at * s, y0, 1, h); }
  for (const o of state.ships) {
    if (!o.alive) continue;
    ctx.fillStyle = o.role === "freighter" ? "#ffcf6b" : o.side === "us" ? (o === me ? "#e6ebff" : "#7ef0a8") : "#ff7a59";
    const sz = o.role === "freighter" ? 4 : 2;
    ctx.fillRect(x0 + o.x * s - sz / 2, y0 + (o.y / WORLD.h) * h - sz / 2, sz, sz);
  }
  ctx.fillStyle = "#7ef0a8"; ctx.fillRect(x0 + STATION_X * s, y0, 2, h);
}

function hud(me, fr) {
  ctx.font = "700 12px ui-monospace, monospace";
  const line = (text, x, y, color) => { ctx.fillStyle = color; ctx.fillText(text, x, y); };
  if (fr) {
    const pct = Math.round((100 * Math.max(0, fr.shield + fr.armour)) / (fr.hull.shieldMax + fr.hull.armourMax));
    line(`FREIGHTER ${pct}%  ·  ${Math.max(0, Math.round((STATION_X - fr.x) / 10))} km to the station`, 10, 18, "#ffcf6b");
  }
  if (me) {
    line(`${me.hull.name.toUpperCase()}  shield ${Math.round((100 * me.shield) / me.hull.shieldMax)}%  armour ${Math.max(0, Math.round((100 * me.armour) / me.hull.armourMax))}%  ·  spares ${state.relaunches}`, 10, 34, me.alive ? "#7ef0a8" : "#ff7a59");
  }
  line(`Wing: ${{ attack: "attacking your target", escort: "guarding the freighter", form: "on you" }[state.order]}  ·  kills ${state.kills}`, 10, 50, "#8fd8ff");
}

// --- Start ---------------------------------------------------------------------------------------

const STEP = 1 / 60;
let last = performance.now(), acc = 0;
requestAnimationFrame(function frame(now) {
  acc += Math.min(0.25, (now - last) / 1000);
  last = now;
  while (acc >= STEP) { update(STEP); acc -= STEP; }
  if (state.phase !== "loading") { draw(); panels(now); }
  requestAnimationFrame(frame);
});

const all = [...ESCORTS, ...RAIDERS, FREIGHTER];
const [ships, stationImg] = await Promise.all([
  Promise.all(all.map(([ed, slug]) => loadShip(ed, slug))),
  loadImage(new URL("planets/garden/large/planet.png", PACK_BASE).href),
]);
ships.forEach((s) => { hulls[s.slug] = hullOf(s); });
station = stationImg;

$("hull").replaceChildren(...ESCORTS.map(([, s]) => new Option(hulls[s].name, s)));
$("diff").replaceChildren(...Object.entries(DIFFICULTY).map(([k, d]) => new Option(d.label, k)));
$("diff").value = state.diff;
$("diff").onchange = () => { state.diff = $("diff").value; };
$("start").onclick = () => newRun();
$("mute").onclick = () => { setMuted(!isMuted()); $("mute").textContent = `Sound: ${isMuted() ? "off" : "on"}`; $("mute").setAttribute("aria-pressed", String(isMuted())); };
$("mute").textContent = `Sound: ${isMuted() ? "off" : "on"}`;
state.diffCfg = DIFFICULTY[state.diff];
state.phase = "ready";
$("banner-title").textContent = "Convoy";
$("banner-text").textContent = "Pick your escort and press Start (or Enter). Get the Large Pin to the station.";
$("banner").hidden = false;
// tick(n) runs n simulation steps at once, for play-tests on slow machines.
globalThis.convoy = { state, newRun, nextTarget, orderWing, freighter, player, tick: (n = 1) => { for (let i = 0; i < n; i++) update(STEP); } };
