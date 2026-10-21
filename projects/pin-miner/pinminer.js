// Pin Miner: an idle game in plain DOM. Every ship and rock is a <div>; ships
// show a frame of their sprite sheet through background-position, chosen from
// their heading. Cargo and speed come from each hull's 1997 record.
import { loadShip, frameRect, frameIndex, PACK_BASE } from "../../lib/yodacon-ship-pack.js";
import { play, isMuted, setMuted } from "../../lib/yodacon-sound.js";

const $ = (id) => document.getElementById(id);
const field = $("field");
const SAVE = "pin-miner-v1";
const OFFLINE_CAP_S = 8 * 3600;      // earnings while away: up to eight hours

// The fleet you can buy. Cargo is Holds / 10 tons of ore, speed is Speed × 0.45
// px/s (ship.json); prices rise 15% with each ship of a kind you own.
const HULLS = [
  { slug: "small-pin", price: 25 }, { slug: "medium-pin", price: 220 },
  { slug: "dart", price: 1400 }, { slug: "large-pin", price: 9000 },
];
const UPGRADES = [
  { key: "laser", name: "Mining lasers", text: "Mine 25% faster", base: 60, growth: 2.2 },
  { key: "price", name: "Ore contracts", text: "Ore sells for 20% more", base: 90, growth: 2.4 },
  { key: "rocks", name: "Survey drones", text: "Find another asteroid", base: 150, growth: 2.6, max: 6 },
];

const ships = new Map();          // slug → loaded pack ship
const startedAt = performance.now();
let save, rocks = [], fleet = [], lastSave = 0, earnedThisMinute = [];

const defaultSave = () => ({ credits: 30, owned: { "small-pin": 1 }, upgrades: { laser: 0, price: 0, rocks: 0 },
  savedAt: Date.now(), total: 0 });

function load() {
  try { save = { ...defaultSave(), ...JSON.parse(localStorage.getItem(SAVE) ?? "null") }; }
  catch { save = defaultSave(); }
}
function persist() {
  save.savedAt = Date.now();
  try { localStorage.setItem(SAVE, JSON.stringify(save)); } catch { /* not kept: fine */ }
}

// --- Numbers -----------------------------------------------------------------------------------

const orePrice = () => 2 * (1 + 0.2 * save.upgrades.price);
const mineRate = () => 2 * (1 + 0.25 * save.upgrades.laser);       // tons per second, per ship
const priceOf = (hull) => Math.round(hull.price * 1.15 ** (save.owned[hull.slug] ?? 0));
const upgradeCost = (u) => Math.round(u.base * u.growth ** save.upgrades[u.key]);
const statsOf = (slug) => ships.get(slug).meta.stats;
const cargoOf = (slug) => Math.max(4, Math.round(statsOf(slug).Holds / 10));
const speedOf = (slug) => statsOf(slug).Speed * 0.45;

/** The average flight from the station to an asteroid, in px. */
function meanDistance() {
  if (!rocks.length) return 500;
  const home = station();
  return rocks.reduce((s, r) => s + Math.hypot(r.x - home.x, r.y - home.y), 0) / rocks.length;
}

/** Credits a ship earns per second on average: one round trip, mined and sold. */
function yieldPerSecond(slug, distance = meanDistance()) {
  const trip = 2 * distance / speedOf(slug) + cargoOf(slug) / mineRate();
  return cargoOf(slug) * orePrice() / trip;
}

// --- The field ----------------------------------------------------------------------------------

function station() {
  const r = $("station").getBoundingClientRect(), f = field.getBoundingClientRect();
  return { x: r.left - f.left + r.width / 2, y: r.top - f.top + 30 };
}

function layoutRocks() {
  for (const r of rocks) r.el.remove();
  const w = field.clientWidth, h = field.clientHeight;
  const n = 3 + save.upgrades.rocks;
  rocks = Array.from({ length: n }, (_, i) => {
    const el = document.createElement("div");
    el.className = "rock";
    const size = [28, 40, 34, 46, 30, 38, 42, 32, 36][i % 9];
    el.innerHTML = `<img src="${new URL("planets/rocky/small/planet.png", PACK_BASE).href}" width="${size}" height="${size}" alt="">`;
    const x = w * (0.55 + 0.38 * ((i * 0.618) % 1)), y = h * (0.12 + 0.76 * ((i * 0.381 + 0.15) % 1));
    el.style.left = `${x}px`; el.style.top = `${y}px`;
    field.append(el);
    return { el, x, y };
  });
}

function addShipSprite(slug) {
  const ship = ships.get(slug);
  const el = document.createElement("div");
  el.className = "ship";
  const { frame_width: fw, frame_height: fh } = ship.sprite;
  Object.assign(el.style, { width: `${fw}px`, height: `${fh}px`, backgroundImage: `url("${ship.urls.sheet}")` });
  el.innerHTML = '<div class="cargo"><i></i></div>';
  el.title = ship.name;
  field.append(el);
  const s = station();
  const unit = { slug, el, x: s.x, y: s.y, cargo: 0, state: "out", rock: rocks[fleet.length % rocks.length], heading: 90, timer: 0 };
  fleet.push(unit);
  return unit;
}

function rebuildFleet() {
  for (const u of fleet) u.el.remove();
  fleet = [];
  for (const hull of HULLS) for (let i = 0; i < (save.owned[hull.slug] ?? 0); i++) addShipSprite(hull.slug);
}

function draw(u) {
  const ship = ships.get(u.slug);
  const r = frameRect(ship, frameIndex(u.heading));
  u.el.style.backgroundPosition = `-${r.x}px -${r.y}px`;
  u.el.style.transform = `translate(${u.x - r.w / 2}px, ${u.y - r.h / 2}px)`;
  u.el.querySelector("i").style.width = `${100 * u.cargo / cargoOf(u.slug)}%`;
}

// --- The loop: fly out, mine, fly home, sell ----------------------------------------------------------

function moveTowards(u, tx, ty, dt) {
  const dx = tx - u.x, dy = ty - u.y, d = Math.hypot(dx, dy);
  const step = speedOf(u.slug) * dt;
  if (d < 1) return true;
  u.heading = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
  if (d <= step) { u.x = tx; u.y = ty; return true; }
  u.x += dx / d * step; u.y += dy / d * step;
  return false;
}

function update(dt) {
  const home = station();
  for (const u of fleet) {
    if (u.state === "out") {
      if (moveTowards(u, u.rock.x - 20, u.rock.y, dt)) u.state = "mining";
    } else if (u.state === "mining") {
      u.cargo = Math.min(cargoOf(u.slug), u.cargo + mineRate() * dt);
      u.heading = (u.heading + dt * 30) % 360;     // turning slowly while the lasers work
      if (u.cargo >= cargoOf(u.slug)) u.state = "home";
    } else if (u.state === "home" && moveTowards(u, home.x + 30, home.y, dt)) {
      const earned = Math.round(u.cargo * orePrice());
      sell(earned, home);
      u.cargo = 0;
      u.rock = rocks[Math.floor(Math.random() * rocks.length)];
      u.state = "out";
    }
    draw(u);
  }
  if (performance.now() - lastSave > 2000) { persist(); lastSave = performance.now(); }
}

function sell(credits, at) {
  save.credits += credits;
  save.total += credits;
  earnedThisMinute.push([performance.now(), credits]);
  const f = Object.assign(document.createElement("div"), { className: "float", textContent: `+${credits}` });
  Object.assign(f.style, { left: `${at.x + 20}px`, top: `${at.y - 20}px` });
  field.append(f);
  setTimeout(() => f.remove(), 1300);
  if (credits >= 20) play("coin");
  hud();
}

// --- Buying ------------------------------------------------------------------------------------------

function buyShip(hull) {
  const price = priceOf(hull);
  if (save.credits < price) { play("error"); return false; }
  save.credits -= price;
  save.owned[hull.slug] = (save.owned[hull.slug] ?? 0) + 1;
  addShipSprite(hull.slug);
  logLine(`Bought a ${ships.get(hull.slug).name} for ${price}.`);
  play("pickup");
  persist(); renderShop(); hud();
  return true;
}

function buyUpgrade(u) {
  const cost = upgradeCost(u);
  if (save.credits < cost || (u.max && save.upgrades[u.key] >= u.max)) { play("error"); return false; }
  save.credits -= cost;
  save.upgrades[u.key]++;
  if (u.key === "rocks") { layoutRocks(); for (const s of fleet) s.rock = rocks[Math.floor(Math.random() * rocks.length)]; }
  logLine(`${u.name} ${save.upgrades[u.key]}.`);
  play("send");
  persist(); renderShop(); hud();
  return true;
}

function renderShop() {
  $("yard").replaceChildren(...HULLS.map((hull) => {
    const ship = ships.get(hull.slug);
    const li = document.createElement("li");
    li.innerHTML = `<img src="${ship.urls.yard}" alt="${ship.name}, in the shipyard">
      <span class="what"><b>${ship.name}</b> × ${save.owned[hull.slug] ?? 0}<br>${cargoOf(hull.slug)} t, ${Math.round(speedOf(hull.slug))} px/s,
      ~${(yieldPerSecond(hull.slug) * 60).toFixed(0)}/min</span>`;
    const b = Object.assign(document.createElement("button"), { type: "button", className: "yc-plate", textContent: `Buy ${priceOf(hull)}` });
    b.disabled = save.credits < priceOf(hull);
    b.addEventListener("click", () => buyShip(hull));
    li.append(b);
    return li;
  }));
  $("upgrades").replaceChildren(...UPGRADES.map((u) => {
    const li = document.createElement("li");
    const maxed = u.max && save.upgrades[u.key] >= u.max;
    li.innerHTML = `<img src="${new URL(u.key === "rocks" ? "planets/rocky/medium/planet.png" : "conex/ships/yodacon/target.png", PACK_BASE).href}" alt="">
      <span class="what"><b>${u.name}</b> ${save.upgrades[u.key]}${u.max ? `/${u.max}` : ""}<br>${u.text}</span>`;
    const b = Object.assign(document.createElement("button"), { type: "button", className: "yc-plate",
      textContent: maxed ? "Done" : `Buy ${upgradeCost(u)}` });
    b.disabled = maxed || save.credits < upgradeCost(u);
    b.addEventListener("click", () => buyUpgrade(u));
    li.append(b);
    return li;
  }));
}

function hud() {
  $("credits").textContent = Math.floor(save.credits).toLocaleString("en-US");
  const now = performance.now();
  earnedThisMinute = earnedThisMinute.filter(([t]) => now - t < 60000);
  const measured = earnedThisMinute.reduce((s, [, c]) => s + c, 0);
  const expected = fleet.reduce((s, u) => s + yieldPerSecond(u.slug) * 60, 0);
  // The measured minute once there is one; the estimate until then.
  const warm = now - startedAt > 60000;
  $("rate").textContent = Math.round(warm ? measured : expected).toLocaleString("en-US");
  $("count").textContent = fleet.length;
  for (const b of document.querySelectorAll("#yard button, #upgrades button")) {
    const cost = Number(b.textContent.replace(/\D/g, ""));
    if (cost) b.disabled = save.credits < cost;
  }
}

function logLine(text) {
  const li = document.createElement("li");
  li.textContent = text;
  $("log").prepend(li);
  while ($("log").children.length > 30) $("log").lastChild.remove();
}

// --- Away and back -------------------------------------------------------------------------------------

function offlineEarnings() {
  const away = Math.min(OFFLINE_CAP_S, (Date.now() - save.savedAt) / 1000);
  if (away < 30 || !fleet.length) return;
  const rate = fleet.reduce((s, u) => s + yieldPerSecond(u.slug), 0);
  const earned = Math.round(rate * away * 0.5);      // half rate while nobody watches
  save.credits += earned;
  save.total += earned;
  logLine(`While you were away (${Math.round(away / 60)} min), the fleet earned ${earned}.`);
}

$("reset").addEventListener("click", () => {
  if (!confirm("Start over with one Small Pin?")) return;
  save = defaultSave(); persist(); layoutRocks(); rebuildFleet(); renderShop(); hud();
  $("log").replaceChildren(); logLine("A new contract with Consolidated Express.");
});
const showMute = () => { $("mute").textContent = isMuted() ? "Sound: off" : "Sound: on"; $("mute").setAttribute("aria-pressed", String(isMuted())); };
$("mute").addEventListener("click", () => { setMuted(!isMuted()); showMute(); });
showMute();

let last = performance.now();
function frame(now) {
  update(Math.min(0.5, (now - last) / 1000));
  last = now;
  requestAnimationFrame(frame);
}
setInterval(hud, 1000);
new ResizeObserver(() => { if (rocks.length) layoutRocks(); }).observe(field);

// For play-test scripts (playtest/).
globalThis.pinMiner = { get save() { return save; }, get fleet() { return fleet; }, HULLS, UPGRADES,
  buyShip, buyUpgrade, priceOf, upgradeCost, yieldPerSecond };

await Promise.all(HULLS.map(async (h) => ships.set(h.slug, await loadShip("conex", h.slug, PACK_BASE))));
load();
layoutRocks();
rebuildFleet();
offlineEarnings();
renderShop();
hud();
logLine("Consolidated Express: haul ore from the field to ConEx.");
requestAnimationFrame(frame);
