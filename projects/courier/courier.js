// ConEx Courier: Escape Velocity in miniature.
// Canvas flight between four systems, landing, trade, courier missions, a
// shipyard and pirates. The ten ConEx 1.2 hulls are for sale, with their
// numbers from the 1997 shïp records; the pirates fly the 1998 Override ships.
// Past Ember lies the Override Reach: the richest market, and pirates every
// time, the 1998 Yodacon and Callisto among them. Once a launch you can make
// an emergency jump (Shift+J or E): from anywhere, for two fuel.
import { loadShip, loadShipMeta, loadImage, drawShip, PACK_BASE } from "../../lib/yodacon-ship-pack.js";
import { play, isMuted, setMuted } from "../../lib/yodacon-sound.js";

const $ = (id) => document.getElementById(id);
const canvas = $("screen"), ctx = canvas.getContext("2d");
const W = canvas.width, H = canvas.height;
const SAVE = "conex-courier-v1";
const JUMP_RADIUS = 900, LAND_REACH = 70, LAND_SPEED = 150;

// --- The universe --------------------------------------------------------------------------------

const GOODS = [
  { key: "food", name: "Food", base: 60 },
  { key: "industrial", name: "Industrial", base: 140 },
  { key: "medical", name: "Medical", base: 300 },
  { key: "electronics", name: "Electronics", base: 480 },
  { key: "luxuries", name: "Luxuries", base: 750 },
];
const LEVEL = { L: 0.8, M: 1, H: 1.2 };

// Prices read food, industrial, medical, electronics, luxuries.
const SYSTEMS = [
  { name: "Consolidated", danger: 0, links: [1, 3], planets: [
    { name: "Express Yard", type: "ice", size: "large", x: -260, y: -120, prices: "HLMLH",
      blurb: "Consolidated Express's home yard: hangars, cranes and a waiting list for Pins." },
    { name: "Pinhold", type: "rocky", size: "medium", x: 380, y: 260, prices: "MLHMM",
      blurb: "A mining rock that builds Pin hulls from its own ore." } ] },
  { name: "Vela", danger: 0.3, links: [0, 2], planets: [
    { name: "Vela Prime", type: "gas", size: "large", x: 120, y: -300, prices: "LHMHM",
      blurb: "Cloud cities over a gas giant, short of everything that isn't air." },
    { name: "Drift", type: "ice", size: "small", x: -360, y: 280, prices: "LMLMH",
      blurb: "An ice moon with a free port and very few questions." } ] },
  { name: "Hollow", danger: 0.55, links: [1, 3], planets: [
    { name: "Hollow Rock", type: "rocky", size: "large", x: -200, y: 200, prices: "HMHLL",
      blurb: "A hollowed asteroid. The pirates drink here too." },
    { name: "Cinder", type: "lava", size: "medium", x: 340, y: -220, prices: "HHMML",
      blurb: "Foundries on the day side, dormitories on the night side." } ] },
  { name: "Ember", danger: 0.8, links: [2, 0, 4], planets: [
    { name: "Ember", type: "lava", size: "large", x: 0, y: 0, prices: "MLLHH",
      blurb: "A furnace world that pays well for anything that arrives intact." },
    { name: "Ash", type: "rocky", size: "small", x: 420, y: 330, prices: "HMLMH",
      blurb: "A clinic station on a cinder of a moon." } ] },
  { name: "Override Reach", danger: 1, links: [3], pirates: ["defender", "necromancer", "callisto", "yodacon"], planets: [
    { name: "Garden Rest", type: "garden", size: "large", x: -180, y: -200, prices: "HHHLH",
      blurb: "Green and quiet, the last port before the Override fleet's anchorage. Everything is short here but electronics." },
    { name: "Outpost 98", type: "ice", size: "medium", x: 360, y: 240, prices: "HHHHL",
      blurb: "The Override's own trading post. They pay for anything from outside, and sell luxuries cheap to whoever gets this far." } ] },
];
const PLANETS = SYSTEMS.flatMap((s, si) => s.planets.map((p) => Object.assign(p, { system: si })));

// Shortest jump count between systems.
function jumps(a, b) {
  const seen = new Map([[a, 0]]), q = [a];
  while (q.length) { const s = q.shift(); for (const n of SYSTEMS[s].links) if (!seen.has(n)) { seen.set(n, seen.get(s) + 1); q.push(n); } }
  return seen.get(b);
}

function price(planet, good) {
  const i = GOODS.indexOf(good), level = planet.prices[i];
  const drift = 1 + 0.05 * Math.sin(state.day * 1.7 + i * 2.3 + PLANETS.indexOf(planet));
  return Math.round(good.base * LEVEL[level] * drift);
}

// --- Ships -----------------------------------------------------------------------------------------

const YARD = ["small-pin", "medium-pin", "large-pin", "dart", "defender", "gryphon", "trident", "necromancer", "yodacon", "tomaquad"];
const PIRATES = ["gryphon", "trident", "defender", "necromancer"];
const hulls = {};            // conex slug → stats
const sprites = {};          // "edition/slug" → loaded ship

function hullStats(meta, pirate = false) {
  const s = meta.meta.stats;
  return {
    slug: meta.slug, name: meta.name, comm: meta.urls.comm,
    cargo: Math.round(s.Holds / 8),
    shield: Math.round(s.Shield / 4), armour: Math.round(s.Armor / 4),
    speed: s.Speed * (pirate ? 0.7 : 0.8), accel: s.Accel * 0.8, turn: s.Maneuver * 45,
    guns: Math.max(1, (s.WeapCount ?? []).reduce((a, b) => a + Math.max(0, b), 0)),
    price: Math.round(Math.sqrt(s.Cost) * 20 / 100) * 100,
  };
}

async function sprite(edition, slug) {
  const key = `${edition}/${slug}`;
  return sprites[key] ??= await loadShip(edition, slug);
}

// --- State -------------------------------------------------------------------------------------------

let state;           // what's saved: credits, ship, cargo, missions, where
let me, pirates = [], bolts = [], sparks = [], landedAt = null, offers = [], tab = "trade", lastPort = 0;
let msg = "", msgUntil = 0, won = false;
const keys = new Set();

function freshState() {
  return { credits: 3000, ship: "small-pin", fuel: 4, cargo: {}, missions: [], day: 0, port: 0, armour: null, won: false };
}
const hull = () => hulls[state.ship];
const used = () => Object.values(state.cargo).reduce((a, b) => a + b, 0) + state.missions.reduce((a, m) => a + m.tons, 0);
const free = () => hull().cargo - used();
const maxFuel = 4;

function save() { try { localStorage.setItem(SAVE, JSON.stringify(state)); } catch {} }
function load() {
  try { const s = JSON.parse(localStorage.getItem(SAVE)); if (s && hulls[s.ship]) return { ...freshState(), ...s }; } catch {}
  return freshState();
}

function say(text, seconds = 3) { msg = text; msgUntil = performance.now() + seconds * 1000; $("status").textContent = text; }

// --- Flight ------------------------------------------------------------------------------------------

function spawnMe(x, y, heading = 0, vx = 0, vy = 0) {
  const h = hull();
  me = { x, y, vx, vy, heading, shield: h.shield, armour: state.armour ?? h.armour, cool: 0, hitAt: -9, side: "me" };
}

async function spawnPirates() {
  pirates = [];
  const danger = SYSTEMS[currentSystem()].danger;
  let n = Math.random() < danger ? 1 : 0;
  if (n && Math.random() < danger * 0.6) n++;
  for (let i = 0; i < n; i++) {
    const kinds = SYSTEMS[currentSystem()].pirates ?? PIRATES;
    const slug = kinds[Math.floor(Math.random() * kinds.length)];
    const meta = await loadShipMeta("override", slug);
    const h = hullStats(meta, true);
    const a = Math.random() * Math.PI * 2;
    if (slug === "yodacon") { h.name = "1998 Yodacon"; h.speed *= 1.6; }   // its 1998 Speed is 100: give it a chance to catch you
    pirates.push({ ...h, edition: "override", x: Math.cos(a) * 750, y: Math.sin(a) * 750, vx: 0, vy: 0, heading: 0,
      hp: h.shield + h.armour, max: h.shield + h.armour, cool: 1 + Math.random(), sprite: await sprite("override", slug) });
  }
  if (n) say(n > 1 ? "Two pirates on the radar." : "A pirate on the radar.");
}
const currentSystem = () => landedAt ? landedAt.system : state.system ?? PLANETS[state.port].system;

const dir = (deg) => [Math.sin(deg * Math.PI / 180), -Math.cos(deg * Math.PI / 180)];
const angleTo = (dx, dy) => (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
const turnToward = (from, to, max) => { const d = ((to - from + 540) % 360) - 180; return (from + Math.max(-max, Math.min(max, d)) + 360) % 360; };

function fly(ship, h, dt, { left, right, thrust, retro }) {
  if (retro && Math.hypot(ship.vx, ship.vy) > 5) ship.heading = turnToward(ship.heading, angleTo(-ship.vx, -ship.vy), h.turn * dt);
  else ship.heading = (ship.heading + (right - left) * h.turn * dt + 360) % 360;
  if (thrust) { const [dx, dy] = dir(ship.heading); ship.vx += dx * h.accel * dt; ship.vy += dy * h.accel * dt; }
  const v = Math.hypot(ship.vx, ship.vy);
  if (v > h.speed) { ship.vx *= h.speed / v; ship.vy *= h.speed / v; }
  ship.x += ship.vx * dt; ship.y += ship.vy * dt;
}

function fire(ship, damage, side) {
  const [dx, dy] = dir(ship.heading);
  bolts.push({ x: ship.x + dx * 20, y: ship.y + dy * 20, vx: ship.vx + dx * 620, vy: ship.vy + dy * 620, life: 0.9, damage, side });
  play("shot");
}

function burst(x, y, n, colour) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = 40 + Math.random() * 160;
    sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.4 + Math.random() * 0.5, colour });
  }
}

function step(dt) {
  if (landedAt || won) return;
  const h = hull(), now = performance.now() / 1000;
  fly(me, h, dt, { left: keys.has("left"), right: keys.has("right"), thrust: keys.has("thrust"), retro: keys.has("retro") });
  me.cool -= dt;
  if (keys.has("fire") && me.cool <= 0) { fire(me, 22, "me"); me.cool = 0.4 / Math.min(h.guns, 3); }
  if (now - me.hitAt > 1.5) me.shield = Math.min(h.shield, me.shield + h.shield * 0.08 * dt);

  for (const p of pirates) {
    const lead = 0.4, tx = me.x + me.vx * lead - p.x, ty = me.y + me.vy * lead - p.y, dist = Math.hypot(tx, ty);
    const want = angleTo(tx, ty), off = Math.abs(((want - p.heading + 540) % 360) - 180);
    p.heading = turnToward(p.heading, want, p.turn * dt);
    if (dist > 220 && off < 50) { const [dx, dy] = dir(p.heading); p.vx += dx * p.accel * dt; p.vy += dy * p.accel * dt; }
    const v = Math.hypot(p.vx, p.vy);
    if (v > p.speed) { p.vx *= p.speed / v; p.vy *= p.speed / v; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.cool -= dt;
    if (off < 10 && dist < 480 && p.cool <= 0) { fire(p, 9, "pirate"); p.cool = 0.7; }
  }

  for (const b of bolts) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    const targets = b.side === "me" ? pirates : [me];
    for (const t of targets) {
      if (b.life > 0 && Math.hypot(t.x - b.x, t.y - b.y) < 22) { b.life = 0; hit(t, b.damage); }
    }
  }
  bolts = bolts.filter((b) => b.life > 0);
  for (const s of sparks) { s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt; }
  sparks = sparks.filter((s) => s.life > 0);
}

function hit(target, damage) {
  burst(target.x, target.y, 6, "#ffd27a");
  if (target === me) {
    me.hitAt = performance.now() / 1000;
    const onShield = Math.min(me.shield, damage);
    me.shield -= onShield;
    me.armour -= damage - onShield;
    play("hit");
    if (me.armour <= 0) destroyed();
    return;
  }
  target.hp -= damage;
  play("hit");
  if (target.hp <= 0) {
    pirates = pirates.filter((p) => p !== target);
    burst(target.x, target.y, 40, "#ff8a3d");
    const bounty = 400 + Math.round(target.max * 6);
    state.credits += bounty;
    say(`Pirate ${target.name} destroyed: bounty ${bounty.toLocaleString()} credits.`);
    play("boom");
    hud();
  }
}

function destroyed() {
  burst(me.x, me.y, 60, "#ff5a3d");
  play("lost");
  const fee = Math.round(state.credits * 0.1);
  state.credits -= fee;
  state.cargo = {};
  state.armour = null;
  const port = PLANETS[lastPort];
  banner("Disabled", `Towed to ${port.name}. The cargo is gone and the tow cost ${fee.toLocaleString()} credits. Missions survive.`);
  setTimeout(() => { $("banner").hidden = true; dock(port); }, 2200);
  landedAt = port;                   // freeze the flight until the tow lands
}

// --- Landing and jumping ------------------------------------------------------------------------------

function nearest() {
  let best = null, bestD = Infinity;
  for (const p of SYSTEMS[currentSystem()].planets) {
    const d = Math.hypot(p.x - me.x, p.y - me.y) - planetRadius(p);
    if (d < bestD) { best = p; bestD = d; }
  }
  return { planet: best, dist: bestD };
}

function tryLand() {
  if (landedAt) return;
  const { planet, dist } = nearest();
  if (dist > LAND_REACH) { say(`Too far to land: ${planet.name} is ${Math.round(dist)} out.`); play("error"); return; }
  if (Math.hypot(me.vx, me.vy) > LAND_SPEED) { say(`Too fast to land on ${planet.name}: slow down (↓ then ↑).`); play("error"); return; }
  dock(planet, true);
}

function dock(planet, flewIn = false) {
  landedAt = planet;
  lastPort = PLANETS.indexOf(planet);
  state.port = lastPort; state.system = planet.system;
  if (flewIn) state.armour = Math.max(1, Math.round(me.armour));
  pirates = []; bolts = [];
  // Deliveries.
  const done = state.missions.filter((m) => m.to === lastPort);
  for (const m of done) { state.credits += m.pay; say(`Delivered ${m.tons} t of ${m.what} to ${planet.name}: ${m.pay.toLocaleString()} credits.`, 4); play("coin"); }
  state.missions = state.missions.filter((m) => m.to !== lastPort);
  offers = makeOffers(planet);
  if (me) play("conquered");          // not on the first, silent load
  tab = "trade";
  save();
  $("port").hidden = false;
  renderPort();
  hud();
}

function takeOff() {
  if (!landedAt) return;
  const p = landedAt;
  landedAt = null;
  $("port").hidden = true;
  const a = Math.random() * 360, [dx, dy] = dir(a);
  spawnMe(p.x + dx * (planetRadius(p) + 30), p.y + dy * (planetRadius(p) + 30), a, dx * 60, dy * 60);
  emergencyUsed = false;
  spawnPirates();
  play("send");
  hud();
}

// An emergency jump goes from anywhere, close to a planet or not, for two
// fuel; once a launch.
let emergencyUsed = false;
function tryJump(emergency = false) {
  if (landedAt) { say("Take off first."); play("error"); return; }
  const to = Number($("jump-to").value);
  if (emergency && emergencyUsed) { say("The emergency jump drive is still cooling. Land to reset it."); play("error"); return; }
  if (!emergency && Math.hypot(me.x, me.y) < JUMP_RADIUS) { say(`Fly clear of the planets to jump: ${Math.round(JUMP_RADIUS - Math.hypot(me.x, me.y))} more (or Shift+J, an emergency jump for 2 fuel).`); play("error"); return; }
  const cost = emergency ? 2 : 1;
  if (state.fuel < cost) { say(emergency ? "An emergency jump takes 2 fuel." : "No fuel. Land and refuel."); play("error"); return; }
  if (emergency) { emergencyUsed = true; burst(me.x, me.y, 30, "#b49bff"); }
  state.fuel -= cost; state.day++; state.system = to;
  // Arrive on the side facing where you came from, heading in.
  const a = Math.random() * 360, [dx, dy] = dir(a);
  spawnMe(dx * 800, dy * 800, (a + 180) % 360, -dx * 120, -dy * 120);
  bolts = [];
  say(`Arrived in ${SYSTEMS[to].name}.`);
  play("won");
  spawnPirates();
  fillJumps();
  hud();
}

// --- The port --------------------------------------------------------------------------------------------

const WHAT = ["mail", "medical crates", "machine parts", "sealed cases", "seed stock"];
function makeOffers(planet) {
  const here = PLANETS.indexOf(planet), list = [];
  for (let i = 0; i < 3; i++) {
    let to; do { to = Math.floor(Math.random() * PLANETS.length); } while (to === here);
    const j = jumps(planet.system, PLANETS[to].system);
    const tons = [2, 4, 6, 10, 15][Math.floor(Math.random() * 5)];
    const risk = Math.max(SYSTEMS[PLANETS[to].system].danger, j ? 0.2 : 0);
    const pay = Math.round((300 + j * 900 + tons * 60) * (1 + risk) / 50) * 50;
    list.push({ to, tons, what: WHAT[Math.floor(Math.random() * WHAT.length)], pay });
  }
  return list;
}

function renderPort() {
  const p = landedAt;
  $("port-name").textContent = `${p.name} · ${SYSTEMS[p.system].name}`;
  $("port-blurb").textContent = p.blurb;
  for (const b of document.querySelectorAll("[data-tab]")) b.setAttribute("aria-selected", String(b.dataset.tab === tab));
  const body = $("port-body");
  if (tab === "trade") {
    body.innerHTML = `<table><thead><tr><th>Goods</th><th class="n">Price</th><th class="n">Held</th><th></th></tr></thead><tbody>${
      GOODS.map((g) => { const lv = p.prices[GOODS.indexOf(g)];
        return `<tr><td>${g.name}</td><td class="n ${lv === "L" ? "low" : lv === "H" ? "high" : ""}">${price(p, g)}${lv === "L" ? " low" : lv === "H" ? " high" : ""}</td>
        <td class="n">${state.cargo[g.key] ?? 0}</td><td class="acts">
        <button type="button" class="yc-plate" data-buy="${g.key}" data-n="1">Buy</button>
        <button type="button" class="yc-plate" data-buy="${g.key}" data-n="max">Max</button>
        <button type="button" class="yc-plate" data-sell="${g.key}" data-n="1">Sell</button>
        <button type="button" class="yc-plate" data-sell="${g.key}" data-n="all">All</button></td></tr>`; }).join("")
    }</tbody></table><p class="muted">Hold: ${used()} of ${hull().cargo} t used. Green prices are low here, amber high.</p>`;
  } else if (tab === "missions") {
    body.innerHTML = offers.length ? `<ul class="offers">${offers.map((o, i) => {
      const dest = PLANETS[o.to], j = jumps(p.system, dest.system);
      return `<li><span>Carry ${o.tons} t of ${o.what} to <b>${dest.name}</b> (${SYSTEMS[dest.system].name}, ${j ? `${j} jump${j > 1 ? "s" : ""}` : "this system"}) for ${o.pay.toLocaleString()} credits.</span>
        <button type="button" class="yc-plate" data-accept="${i}">Accept</button></li>`; }).join("")}</ul>`
      : `<p class="muted">No more work here today.</p>`;
  } else if (tab === "shipyard") {
    const tradeIn = Math.round(hull().price / 2);
    body.innerHTML = `<p class="muted">Your ${hull().name} trades in for ${tradeIn.toLocaleString()}.</p><div class="yard">${YARD.map((slug) => {
      const h = hulls[slug], mine = slug === state.ship;
      return `<div class="hull ${mine ? "current" : ""}"><img src="${h.comm}" alt=""><span class="name">${h.name}</span>
        <span class="specs">Hold ${h.cargo} t · shield ${h.shield} · armour ${h.armour}<br>speed ${Math.round(h.speed)} · guns ${h.guns}</span>
        <span>${h.price.toLocaleString()} credits</span>
        ${mine ? `<span class="muted">Yours</span>` : `<button type="button" class="yc-plate" data-hull="${slug}">Buy</button>`}</div>`; }).join("")}</div>`;
  } else {
    const fuelCost = (maxFuel - state.fuel) * 50, armourCost = Math.round((hull().armour - (state.armour ?? hull().armour)) * 4);
    body.innerHTML = `<ul class="offers">
      <li><span>Fuel ${state.fuel} of ${maxFuel} jumps.</span><button type="button" class="yc-plate" data-service="fuel" ${fuelCost ? "" : "disabled"}>Refuel (${fuelCost})</button></li>
      <li><span>Armour ${state.armour ?? hull().armour} of ${hull().armour}.</span><button type="button" class="yc-plate" data-service="repair" ${armourCost ? "" : "disabled"}>Repair (${armourCost})</button></li>
      <li><span>Start over in a Small Pin with 3,000 credits.</span><button type="button" class="yc-plate" data-service="reset">New game</button></li></ul>`;
  }
}

function portClick(e) {
  const b = e.target.closest("button");
  if (!b || !landedAt) return;
  const d = b.dataset, p = landedAt;
  if (d.tab) { tab = d.tab; play("select"); }
  else if (d.buy) {
    const g = GOODS.find((x) => x.key === d.buy), cost = price(p, g);
    const n = d.n === "max" ? Math.min(free(), Math.floor(state.credits / cost)) : Math.min(1, free(), Math.floor(state.credits / cost));
    if (n <= 0) { play("error"); say(free() <= 0 ? "The hold is full." : "Not enough credits."); }
    else { state.credits -= n * cost; state.cargo[g.key] = (state.cargo[g.key] ?? 0) + n; play("pickup"); }
  } else if (d.sell) {
    const g = GOODS.find((x) => x.key === d.sell), have = state.cargo[g.key] ?? 0;
    const n = d.n === "all" ? have : Math.min(1, have);
    if (!n) play("error");
    else { state.credits += n * price(p, g); state.cargo[g.key] = have - n; if (!state.cargo[g.key]) delete state.cargo[g.key]; play("coin"); }
  } else if (d.accept !== undefined) {
    const o = offers[Number(d.accept)];
    if (o.tons > free()) { play("error"); say(`That needs ${o.tons} t free; you have ${free()}.`); }
    else { state.missions.push(o); offers = offers.filter((x) => x !== o); play("send"); }
  } else if (d.hull) {
    const h = hulls[d.hull], net = h.price - Math.round(hull().price / 2);
    if (net > state.credits) { play("error"); say(`You need ${(net - state.credits).toLocaleString()} more credits.`); }
    else if (used() > h.cargo) { play("error"); say(`The ${h.name} holds ${h.cargo} t; you're carrying ${used()}.`); }
    else {
      state.credits -= net; state.ship = d.hull; state.armour = null;
      sprite("conex", d.hull);
      play("won");
      say(`The ${h.name} is yours.`);
      if (d.hull === "large-pin" && !state.won) { state.won = true; banner("Large Pin", "You own the flagship of the Pin line. Keep flying."); setTimeout(() => { $("banner").hidden = true; }, 3500); }
    }
  } else if (d.service === "fuel") {
    const cost = (maxFuel - state.fuel) * 50;
    if (cost > state.credits) { play("error"); say("Not enough credits."); } else { state.credits -= cost; state.fuel = maxFuel; play("coin"); }
  } else if (d.service === "repair") {
    const cost = Math.round((hull().armour - state.armour) * 4);
    if (cost > state.credits) { play("error"); say("Not enough credits."); } else { state.credits -= cost; state.armour = null; play("coin"); }
  } else if (d.service === "reset") {
    state = freshState(); landedAt = null; dock(PLANETS[0]); return;
  }
  save();
  renderPort();
  hud();
}

// --- Drawing ----------------------------------------------------------------------------------------------

const planetArt = {};
const planetRadius = (p) => ({ small: 32, medium: 64, large: 96 })[p.size] * 0.8;
const stars = Array.from({ length: 220 }, () => ({ x: Math.random() * 4000, y: Math.random() * 4000, d: 0.15 + Math.random() * 0.6 }));

function draw() {
  const sys = SYSTEMS[currentSystem()];
  const camX = me && !landedAt ? me.x : landedAt?.x ?? 0, camY = me && !landedAt ? me.y : landedAt?.y ?? 0;
  ctx.fillStyle = "#020306";
  ctx.fillRect(0, 0, W, H);
  for (const s of stars) {
    const x = ((s.x - camX * s.d) % W + W) % W, y = ((s.y - camY * s.d) % H + H) % H;
    ctx.fillStyle = `rgba(200,220,255,${0.25 + s.d})`;
    ctx.fillRect(x, y, s.d > 0.55 ? 2 : 1, s.d > 0.55 ? 2 : 1);
  }
  const sx = (x) => x - camX + W / 2, sy = (y) => y - camY + H / 2;
  // The jump ring.
  ctx.strokeStyle = "rgba(120,200,255,0.12)";
  ctx.setLineDash([6, 10]);
  ctx.beginPath(); ctx.arc(sx(0), sy(0), JUMP_RADIUS, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
  for (const p of sys.planets) {
    const img = planetArt[`${p.type}/${p.size}`], r = planetRadius(p);
    if (img) ctx.drawImage(img, sx(p.x) - r, sy(p.y) - r, r * 2, r * 2);
    ctx.fillStyle = "rgba(160,220,255,0.75)";
    ctx.font = "12px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText(p.name, sx(p.x), sy(p.y) + r + 16);
  }
  for (const b of bolts) {
    ctx.strokeStyle = b.side === "me" ? "#8fe3ff" : "#ff7a5a";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(sx(b.x), sy(b.y)); ctx.lineTo(sx(b.x - b.vx * 0.02), sy(b.y - b.vy * 0.02)); ctx.stroke();
  }
  for (const p of pirates) {
    drawShip(ctx, p.sprite, p.heading, sx(p.x), sy(p.y));
    ctx.fillStyle = "#ff5a3d";
    ctx.fillRect(sx(p.x) - 15, sy(p.y) - 30, 30 * Math.max(0, p.hp / p.max), 3);
  }
  const mySprite = sprites[`conex/${state.ship}`];
  if (me && !landedAt && mySprite) drawShip(ctx, mySprite, me.heading, W / 2, H / 2);
  for (const s of sparks) { ctx.fillStyle = s.colour; ctx.globalAlpha = Math.min(1, s.life * 2); ctx.fillRect(sx(s.x), sy(s.y), 2, 2); }
  ctx.globalAlpha = 1;
  if (!landedAt && me) {
    drawRadar(sys);
    const { planet, dist } = nearest();
    if (dist < LAND_REACH) {
      ctx.fillStyle = "#9cffb0"; ctx.textAlign = "center"; ctx.font = "13px ui-monospace, monospace";
      ctx.fillText(Math.hypot(me.vx, me.vy) > LAND_SPEED ? `Slow down to land on ${planet.name}` : `L to land on ${planet.name}`, W / 2, 28);
    }
  } else if (landedAt) {
    ctx.fillStyle = "rgba(2,4,6,0.55)"; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#cfe8ff"; ctx.textAlign = "center"; ctx.font = "16px ui-monospace, monospace";
    ctx.fillText(`Landed on ${landedAt.name}`, W / 2, 34);
  }
  if (msg && performance.now() > msgUntil) { msg = ""; $("status").textContent = ""; }
}

function drawRadar(sys) {
  const R = 58, cx = W - R - 12, cy = R + 12, k = R / 1300;
  ctx.fillStyle = "rgba(0,20,10,0.75)"; ctx.strokeStyle = "rgba(120,255,160,0.4)";
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = "rgba(120,200,255,0.3)";
  ctx.beginPath(); ctx.arc(cx - me.x * k, cy - me.y * k, JUMP_RADIUS * k, 0, Math.PI * 2); ctx.stroke();
  const dot = (x, y, c, s = 3) => {
    const dx = (x - me.x) * k, dy = (y - me.y) * k, d = Math.hypot(dx, dy), f = d > R - 3 ? (R - 3) / d : 1;
    ctx.fillStyle = c; ctx.fillRect(cx + dx * f - s / 2, cy + dy * f - s / 2, s, s);
  };
  for (const p of sys.planets) dot(p.x, p.y, "#7fd6ff", 5);
  for (const p of pirates) dot(p.x, p.y, "#ff5a3d");
  ctx.fillStyle = "#ffffff"; ctx.fillRect(cx - 1, cy - 1, 3, 3);
}

function banner(title, text) {
  $("banner-title").textContent = title;
  $("banner-text").textContent = text;
  $("banner").hidden = false;
}

function hud() {
  const h = hull();
  $("credits").textContent = state.credits.toLocaleString();
  $("system").textContent = SYSTEMS[currentSystem()].name;
  $("fuel").textContent = `${state.fuel}/${maxFuel}`;
  $("hold").textContent = `${used()}/${h.cargo}`;
  $("ship-name").textContent = h.name;
  $("ship-comm").src = h.comm;
  const shield = landedAt || !me ? h.shield : me.shield, armour = landedAt || !me ? (state.armour ?? h.armour) : me.armour;
  $("shield-bar").style.width = `${100 * shield / h.shield}%`;
  $("armour-bar").style.width = `${100 * Math.max(0, armour) / h.armour}%`;
  $("missions").innerHTML = state.missions.length
    ? state.missions.map((m) => `<li>${m.tons} t ${m.what} → ${PLANETS[m.to].name} (${SYSTEMS[PLANETS[m.to].system].name}): ${m.pay.toLocaleString()}</li>`).join("")
    : `<li class="muted">None. Find work on a port's mission board.</li>`;
}

function fillJumps() {
  const here = currentSystem(), sel = $("jump-to"), keep = Number(sel.value);
  sel.replaceChildren(...SYSTEMS[here].links.map((i) => new Option(`${SYSTEMS[i].name}${SYSTEMS[i].danger >= 0.5 ? " (pirates)" : ""}`, i)));
  if (SYSTEMS[here].links.includes(keep)) sel.value = keep;
}

// --- Input and the loop -----------------------------------------------------------------------------------------

const KEYMAP = { ArrowLeft: "left", a: "left", ArrowRight: "right", d: "right", ArrowUp: "thrust", w: "thrust", ArrowDown: "retro", s: "retro", " ": "fire" };
document.addEventListener("keydown", (e) => {
  if (e.target.closest?.("select, input, textarea")) return;
  const k = KEYMAP[e.key.length === 1 ? e.key.toLowerCase() : e.key];
  if (k) { keys.add(k); e.preventDefault(); return; }
  if (e.key === "l" || e.key === "L") landedAt ? null : tryLand();
  else if (e.key === "j" || e.key === "J") tryJump(e.shiftKey);
  else if (e.key === "e" || e.key === "E") tryJump(true);
});
document.addEventListener("keyup", (e) => { const k = KEYMAP[e.key.length === 1 ? e.key.toLowerCase() : e.key]; if (k) keys.delete(k); });
window.addEventListener("blur", () => keys.clear());
for (const b of document.querySelectorAll("#pad [data-key]")) {
  const on = (e) => { e.preventDefault(); keys.add(b.dataset.key); b.classList.add("down"); };
  const off = () => { keys.delete(b.dataset.key); b.classList.remove("down"); };
  b.addEventListener("pointerdown", on); b.addEventListener("pointerup", off); b.addEventListener("pointercancel", off); b.addEventListener("pointerleave", off);
}
$("pad").addEventListener("click", (e) => { const t = e.target.closest("[data-tap]")?.dataset.tap; if (t === "land") tryLand(); else if (t === "jump") tryJump(); else if (t === "ejump") tryJump(true); });
$("port").addEventListener("click", portClick);
$("takeoff").addEventListener("click", takeOff);
const showMute = () => { $("mute").textContent = isMuted() ? "Sound: off" : "Sound: on"; $("mute").setAttribute("aria-pressed", String(isMuted())); };
$("mute").addEventListener("click", () => { setMuted(!isMuted()); showMute(); });
showMute();

let last = performance.now(), hudTick = 0;
function frame(t) {
  const dt = Math.min(0.05, (t - last) / 1000);
  last = t;
  step(dt);
  draw();
  if ((hudTick += dt) > 0.15 && !landedAt) { hudTick = 0; hud(); }
  requestAnimationFrame(frame);
}

// For play-test scripts (playtest/).
globalThis.courier = {
  get state() { return state; }, get me() { return me; }, get landedAt() { return landedAt; }, get pirates() { return pirates; },
  get offers() { return offers; }, keys, tryJump, PLANETS, SYSTEMS, GOODS, hulls, price, jumps, JUMP_RADIUS, LAND_REACH, LAND_SPEED,
};

// Load everything the screen draws, then put the player in port.
await Promise.all(YARD.map(async (slug) => { hulls[slug] = hullStats(await loadShipMeta("conex", slug)); }));
$("goal-price").textContent = hulls["large-pin"].price.toLocaleString();
await Promise.all([...new Set(PLANETS.map((p) => `${p.type}/${p.size}`))].map(async (k) => { planetArt[k] = await loadImage(`${PACK_BASE}planets/${k}/planet.png`); }));
state = load();
await sprite("conex", state.ship);
lastPort = state.port;
fillJumps();
dock(PLANETS[state.port]);
requestAnimationFrame(frame);
