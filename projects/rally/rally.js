// Rally: three laps through a course of gates around the pack's planets,
// against five computer racers. Every hull handles by its record, so the
// Defender corners like a dart and the Tomaquad like a barge.
import { loadShip, loadImage, drawShip, frameIndex, PACK_BASE } from "../../lib/yodacon-ship-pack.js";
import { play, isMuted, setMuted } from "../../lib/yodacon-sound.js";

const $ = (id) => document.getElementById(id);
const canvas = $("screen"), ctx = canvas.getContext("2d");
const VW = canvas.width, VH = canvas.height;
const WORLD = { w: 2400, h: 1600 };
const LAPS = 3, GATE_R = 70, DRAG = 0.35, SAVE = "rally-v1";
const rad = (d) => (d * Math.PI) / 180, deg = (r) => (r * 180) / Math.PI;

// --- Hulls ---------------------------------------------------------------------------------------

// Eleven designs. The three Pins are one hull at three sizes, so only the
// Large Pin races; Advisor and Citrus (konex) get numbers in the 1997 ranges.
const ROSTER = [
  ["conex", "defender"], ["conex", "gryphon"], ["conex", "trident"], ["conex", "dart"], ["conex", "yodacon"],
  ["conex", "necromancer"], ["conex", "tomaquad"], ["conex", "large-pin"], ["override", "callisto"],
  ["konex", "advisor"], ["konex", "citrus"],
];
const KONEX_STATS = {
  advisor: { Speed: 380, Accel: 600, Maneuver: 4 },
  citrus: { Speed: 420, Accel: 650, Maneuver: 5 },
};
function handling(ship) {
  const st = { ...(ship.meta.stats ?? {}), ...(KONEX_STATS[ship.slug] ?? {}) };
  return { ship, slug: ship.slug, name: ship.name, record: st,
    speed: st.Speed * 0.75, accel: st.Accel * 0.75, turn: st.Maneuver * 50, radius: ship.sprite.frame_width * 0.3 };
}

// --- Tracks --------------------------------------------------------------------------------------

// Planets are obstacles; gates are taken in order, gate 0 is start and finish.
const TRACKS = [
  { name: "Consolidated Loop",
    planets: [["gas", "large", 1200, 800], ["ice", "medium", 600, 500], ["rocky", "medium", 1800, 1100]],
    gates: [[1200, 1350], [1900, 1350], [2150, 800], [1800, 300], [1200, 250], [600, 250], [250, 700], [500, 1250]] },
  { name: "Vela Slalom",
    planets: [["garden", "large", 700, 800], ["gas", "medium", 1200, 600], ["lava", "medium", 1700, 1000], ["ice", "small", 2050, 500]],
    gates: [[300, 1350], [700, 1300], [1000, 900], [1200, 1200], [1450, 800], [1700, 450], [2050, 900], [2200, 1400], [1300, 1480], [300, 300], [300, 800]] },
  { name: "Ember Figure-Eight",
    planets: [["lava", "large", 700, 800], ["rocky", "large", 1700, 800]],
    gates: [[1200, 800], [1550, 350], [2150, 450], [2200, 1150], [1700, 1300], [1200, 800], [850, 300], [300, 450], [250, 1150], [700, 1300]] },
];

// --- State ---------------------------------------------------------------------------------------

const state = { phase: "loading", track: 0, racers: [], planets: [], time: 0, countdown: 0, results: [] };
let hulls = [], planetArt = {};
const stars = Array.from({ length: 500 }, () => [Math.random() * WORLD.w, Math.random() * WORLD.h, Math.random()]);

function load() { try { return JSON.parse(localStorage.getItem(SAVE)) ?? {}; } catch { return {}; } }
function save(d) { try { localStorage.setItem(SAVE, JSON.stringify(d)); } catch { /* not kept */ } }

function newRace(quiet = false) {
  const track = TRACKS[state.track], mine = hulls.find((h) => h.slug === $("hull").value) ?? hulls[0];
  // Five rivals of other hulls, in a different order each race.
  const rivals = hulls.filter((h) => h !== mine).sort(() => Math.random() - 0.5).slice(0, 5);
  const [sx, sy] = track.gates[0], [nx, ny] = track.gates[1];
  const head = deg(Math.atan2(nx - sx, -(ny - sy))), back = rad(head + 180), side = rad(head + 90);
  state.racers = [mine, ...rivals].map((h, i) => {
    const row = Math.floor(i / 2) + 1, col = i % 2 ? 1 : -1;
    return { hull: h, you: i === 0, x: sx + Math.sin(back) * 90 * row + Math.sin(side) * 45 * col,
      y: sy - Math.cos(back) * 90 * row - Math.cos(side) * 45 * col, vx: 0, vy: 0, heading: head,
      gate: 0, lap: 0, lapStart: 0, laps: [], done: null, skill: 0.85 + Math.random() * 0.15 };
  });
  state.planets = track.planets.map(([type, size, x, y]) => ({ art: planetArt[`${type}/${size}`], x, y, r: planetArt[`${type}/${size}`].r }));
  state.time = 0;
  state.countdown = 3;
  state.results = [];
  state.phase = "countdown";
  $("banner").hidden = true;
  if (!quiet) play("select");
}

// --- Input ---------------------------------------------------------------------------------------

const held = new Set(), touch = new Set();
const KEYS = { left: ["ArrowLeft", "a"], right: ["ArrowRight", "d"], thrust: ["ArrowUp", "w"], brake: ["ArrowDown", "s"] };
addEventListener("keydown", (e) => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (state.phase === "race" || state.phase === "countdown") { if (k.startsWith("Arrow") || k === " ") e.preventDefault(); }
  if (k === "Enter" && !e.repeat && (state.phase === "results" || state.phase === "ready")) { e.preventDefault(); newRace(); }
  held.add(k);
});
addEventListener("keyup", (e) => held.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key));
addEventListener("blur", () => held.clear());
for (const b of document.querySelectorAll("#pad [data-key]")) {
  b.addEventListener("pointerdown", (e) => { e.preventDefault(); touch.add(b.dataset.key); b.classList.add("down"); });
  for (const ev of ["pointerup", "pointerleave", "pointercancel"]) b.addEventListener(ev, () => { touch.delete(b.dataset.key); b.classList.remove("down"); });
}
function controls() {
  const c = Object.fromEntries(Object.entries(KEYS).map(([what, keys]) => [what, keys.some((k) => held.has(k)) || touch.has(what)]));
  const pad = [...(navigator.getGamepads?.() ?? [])].find(Boolean);
  if (pad) {
    const x = pad.axes[0] ?? 0, b = (n) => pad.buttons[n]?.pressed;
    c.left ||= x < -0.4 || b(14);
    c.right ||= x > 0.4 || b(15);
    c.thrust ||= b(0) || b(12) || (pad.buttons[7]?.value ?? 0) > 0.3;
    c.brake ||= b(13) || (pad.buttons[6]?.value ?? 0) > 0.3;
  }
  return c;
}

// --- Simulation ----------------------------------------------------------------------------------

// A computer racer aims at the next gate, looking past it once close, swings
// wide of planets on the way, and lifts off when it must turn hard.
function drive(r) {
  const g = TRACKS[state.track].gates, [gx, gy] = g[r.gate], [hx, hy] = g[(r.gate + 1) % g.length];
  const d = Math.hypot(gx - r.x, gy - r.y), blend = Math.max(0, 1 - d / 260) * 0.5;
  const tx = gx + (hx - gx) * blend, ty = gy + (hy - gy) * blend;
  let want = deg(Math.atan2(tx - r.x, -(ty - r.y)));
  for (const p of r.slow > 1.5 ? [] : state.planets) {   // stuck? forget the planets, go straight
    const pd = Math.hypot(p.x - r.x, p.y - r.y);
    if (pd > d || pd > p.r + 260) continue;
    const toP = deg(Math.atan2(p.x - r.x, -(p.y - r.y))), off = ((toP - want + 540) % 360) - 180;
    const clear = deg(Math.asin(Math.min(1, (p.r + r.hull.radius + 40) / pd)));
    if (Math.abs(off) < clear) want = toP + (off > 0 ? -clear : clear);
  }
  const diff = ((want - r.heading + 540) % 360) - 180, v = Math.hypot(r.vx, r.vy);
  return { left: diff < -3, right: diff > 3, thrust: Math.abs(diff) < 30 || (Math.abs(diff) < 70 && v < r.hull.speed * 0.4),
    brake: Math.abs(diff) > 100 && v > r.hull.speed * 0.6 };
}

function step(r, c, dt) {
  const h = r.hull;
  if (c.left) r.heading -= h.turn * dt;
  if (c.right) r.heading += h.turn * dt;
  r.heading = (r.heading + 360) % 360;
  if (c.thrust) {
    const a = rad(frameIndex(r.heading) * 10);          // thrust along the frame shown
    r.vx += Math.sin(a) * h.accel * dt * (r.you ? 1 : r.skill);
    r.vy -= Math.cos(a) * h.accel * dt * (r.you ? 1 : r.skill);
  }
  const drag = 1 - (c.brake ? DRAG * 4 : DRAG) * dt;    // racing dampers: corners are possible
  r.vx *= drag; r.vy *= drag;
  const v = Math.hypot(r.vx, r.vy);
  if (v > h.speed) { r.vx *= h.speed / v; r.vy *= h.speed / v; }
  r.x += r.vx * dt; r.y += r.vy * dt;
  r.x = Math.max(0, Math.min(WORLD.w, r.x)); r.y = Math.max(0, Math.min(WORLD.h, r.y));
  for (const p of state.planets) {                       // planets push you off, and slow you
    const dx = r.x - p.x, dy = r.y - p.y, dist = Math.hypot(dx, dy), min = p.r + h.radius;
    if (dist < min) {
      const nx = dx / dist, ny = dy / dist, vn = r.vx * nx + r.vy * ny;
      r.x = p.x + nx * min; r.y = p.y + ny * min;
      if (vn < 0) { r.vx -= 1.6 * vn * nx; r.vy -= 1.6 * vn * ny; r.vx *= 0.6; r.vy *= 0.6; if (r.you) play("hit"); }
    }
  }
}

function checkGate(r) {
  const g = TRACKS[state.track].gates, [gx, gy] = g[r.gate];
  if (Math.hypot(gx - r.x, gy - r.y) > GATE_R) return;
  if (r.gate === 0) {
    if (r.lap > 0) r.laps.push(state.time - r.lapStart);
    r.lapStart = state.time;
    if (r.lap === LAPS) { r.done = state.time; if (r.you) finish(); return; }
    r.lap++;
    if (r.you && r.lap > 1) play("coin");
  } else if (r.you) play("pickup");
  r.gate = (r.gate + 1) % g.length;
}

// Place in the race: laps done, then gates, then distance to the next gate.
const progress = (r) => {
  const g = TRACKS[state.track].gates, [gx, gy] = g[r.gate];
  return r.done !== null ? 1e9 - r.done : (r.lap * g.length + r.gate) * 1e4 - Math.hypot(gx - r.x, gy - r.y);
};
const order = () => [...state.racers].sort((a, b) => progress(b) - progress(a));

function update(dt) {
  if (state.phase === "countdown") {
    const before = Math.ceil(state.countdown);
    state.countdown -= dt;
    if (Math.ceil(state.countdown) !== before) play(state.countdown <= 0 ? "send" : "select");
    if (state.countdown <= 0) state.phase = "race";
    return;
  }
  if (state.phase !== "race" && state.phase !== "results") return;
  state.time += dt;
  for (const r of state.racers) {
    if (r.done !== null) { r.vx *= 0.97; r.vy *= 0.97; step(r, {}, dt); continue; }
    if (r.you && state.phase === "results") continue;
    step(r, r.you ? controls() : drive(r), dt);
    r.slow = Math.hypot(r.vx, r.vy) < 40 ? (r.slow ?? 0) + dt : 0;
    checkGate(r);
  }
}

function finish() {
  state.phase = "results";
  const me = state.racers.find((r) => r.you), place = order().indexOf(me) + 1;
  const best = load(), key = `${state.track}:${me.hull.slug}`, lap = Math.min(...me.laps);
  const record = !best[key] || me.done < best[key].time;
  if (record) save({ ...best, [key]: { time: +me.done.toFixed(2), lap: +lap.toFixed(2) } });
  play(place === 1 ? "won" : "held");
  $("banner-title").textContent = place === 1 ? "First place" : `${ordinal(place)} place`;
  $("banner-text").textContent = `${me.hull.name} on ${TRACKS[state.track].name}: ${me.done.toFixed(2)} s, best lap ${lap.toFixed(2)} s` +
    (record ? " — your best with this hull." : ".") + " Enter for a rematch.";
  $("banner").hidden = false;
}
const ordinal = (n) => n + (["th", "st", "nd", "rd"][n % 10 > 3 || Math.floor(n / 10) === 1 ? 0 : n % 10] ?? "th");

// --- Drawing -------------------------------------------------------------------------------------

function draw() {
  const me = state.racers.find((r) => r.you);
  const cx = me ? Math.max(VW / 2, Math.min(WORLD.w - VW / 2, me.x)) : WORLD.w / 2;
  const cy = me ? Math.max(VH / 2, Math.min(WORLD.h - VH / 2, me.y)) : WORLD.h / 2;
  const ox = Math.round(cx - VW / 2), oy = Math.round(cy - VH / 2);
  ctx.fillStyle = "#04050a";
  ctx.fillRect(0, 0, VW, VH);
  for (const [x, y, b] of stars) {
    const sx = x - ox * (0.4 + b * 0.4), sy = y - oy * (0.4 + b * 0.4);   // two depths of parallax
    const px = ((sx % WORLD.w) + WORLD.w) % WORLD.w, py = ((sy % WORLD.h) + WORLD.h) % WORLD.h;
    if (px < VW && py < VH) { ctx.fillStyle = `rgb(160 170 210 / ${0.3 + b * 0.6})`; ctx.fillRect(px, py, 1, 1); }
  }
  ctx.save();
  ctx.translate(-ox, -oy);
  ctx.strokeStyle = "rgb(126 240 168 / 0.2)";
  ctx.strokeRect(0, 0, WORLD.w, WORLD.h);
  for (const p of state.planets) ctx.drawImage(p.art.img, p.x - p.art.img.width / 2, p.y - p.art.img.height / 2);

  const gates = TRACKS[state.track].gates;
  gates.forEach(([x, y], i) => {
    const next = me && i === me.gate && me.done === null;
    ctx.strokeStyle = next ? "#7ef0a8" : i === 0 ? "rgb(255 220 120 / 0.6)" : "rgb(143 216 255 / 0.25)";
    ctx.lineWidth = next ? 3 : 2;
    ctx.setLineDash(i === 0 ? [] : [8, 8]);
    ctx.beginPath(); ctx.arc(x, y, GATE_R, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.font = "700 12px ui-monospace, monospace";
    ctx.fillText(i === 0 ? "START" : String(i), x - (i === 0 ? 18 : 4), y - GATE_R - 6);
  });
  for (const r of state.racers) {
    drawShip(ctx, r.hull.ship, r.heading, r.x, r.y, 1);
    ctx.fillStyle = r.you ? "#7ef0a8" : "#c9d1ea";
    ctx.font = "11px ui-monospace, monospace";
    ctx.fillText(r.you ? "YOU" : r.hull.name, r.x - 14, r.y - r.hull.radius - 8);
  }
  ctx.restore();

  if (me && me.done === null) {                          // an arrow at the edge towards the next gate
    const [gx, gy] = gates[me.gate], a = Math.atan2(gx - me.x, -(gy - me.y));
    const sx = me.x - ox, sy = me.y - oy;
    if (Math.hypot(gx - me.x, gy - me.y) > 260) {
      ctx.save(); ctx.translate(sx + Math.sin(a) * 70, sy - Math.cos(a) * 70); ctx.rotate(a);
      ctx.fillStyle = "#7ef0a8"; ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(6, 4); ctx.lineTo(-6, 4); ctx.fill(); ctx.restore();
    }
  }
  minimap(me);
  hud(me);
}

function minimap(me) {
  const s = 0.06, mw = WORLD.w * s, mh = WORLD.h * s, x0 = VW - mw - 8, y0 = 8;
  ctx.fillStyle = "rgb(4 5 10 / 0.8)"; ctx.fillRect(x0, y0, mw, mh);
  ctx.strokeStyle = "rgb(126 240 168 / 0.4)"; ctx.strokeRect(x0 + 0.5, y0 + 0.5, mw, mh);
  ctx.fillStyle = "#5b6a8a";
  for (const p of state.planets) { ctx.beginPath(); ctx.arc(x0 + p.x * s, y0 + p.y * s, Math.max(2, p.r * s), 0, Math.PI * 2); ctx.fill(); }
  TRACKS[state.track].gates.forEach(([x, y], i) => {
    ctx.fillStyle = me && i === me.gate ? "#7ef0a8" : "rgb(143 216 255 / 0.5)";
    ctx.fillRect(x0 + x * s - 1, y0 + y * s - 1, 3, 3);
  });
  for (const r of state.racers) { ctx.fillStyle = r.you ? "#7ef0a8" : "#ffb347"; ctx.fillRect(x0 + r.x * s - 2, y0 + r.y * s - 2, 4, 4); }
}

function hud(me) {
  if (!me) return;
  ctx.font = "700 13px ui-monospace, monospace";
  ctx.fillStyle = "#7ef0a8";
  const place = order().indexOf(me) + 1;
  ctx.fillText(`LAP ${Math.max(1, Math.min(LAPS, me.lap))}/${LAPS}   ${ordinal(place).toUpperCase()}   ${state.time.toFixed(1)} s`, 10, 20);
  if (state.phase === "countdown") {
    ctx.font = "700 64px ui-monospace, monospace";
    ctx.fillStyle = "#e6ebff";
    ctx.fillText(String(Math.ceil(state.countdown)), VW / 2 - 18, VH / 2 - 40);
  }
}

// The standings panel, a few times a second.
let lastPanel = 0;
function panel(now) {
  if (now - lastPanel < 250 || !state.racers.length) return;
  lastPanel = now;
  $("standings").replaceChildren(...order().map((r, i) => {
    const li = document.createElement("li");
    if (r.you) li.className = "you";
    const img = Object.assign(document.createElement("img"), { src: r.hull.ship.urls.comm, alt: "", width: 28, height: 28 });
    const lap = r.done !== null ? `${r.done.toFixed(1)} s` : `lap ${Math.max(1, r.lap)}`;
    li.append(img, `${i + 1}. ${r.you ? "You" : r.hull.name}`, Object.assign(document.createElement("span"), { textContent: lap }));
    return li;
  }));
}

function showHull() {
  const h = hulls.find((x) => x.slug === $("hull").value);
  if (!h) return;
  $("hull-yard").src = h.ship.urls.yard;
  $("hull-stats").textContent = `Speed ${h.record.Speed} · Accel ${h.record.Accel} · Turn ${h.record.Maneuver}` +
    (KONEX_STATS[h.slug] ? " (konex: set by this game)" : "");
  const b = load()[`${$("track").value}:${h.slug}`];
  $("hull-best").textContent = b ? `Your best here: ${b.time} s (lap ${b.lap} s)` : "No time set here yet.";
}

// --- Start ---------------------------------------------------------------------------------------

const STEP = 1 / 60;
let last = performance.now(), acc = 0;
requestAnimationFrame(function frame(now) {
  acc += Math.min(0.25, (now - last) / 1000);
  last = now;
  while (acc >= STEP) { update(STEP); acc -= STEP; }
  draw();
  panel(now);
  requestAnimationFrame(frame);
});

const kinds = [...new Set(TRACKS.flatMap((t) => t.planets.map(([type, size]) => `${type}/${size}`)))];
const [ships, arts] = await Promise.all([
  Promise.all(ROSTER.map(([ed, slug]) => loadShip(ed, slug))),
  Promise.all(kinds.map((k) => loadImage(new URL(`planets/${k}/planet.png`, PACK_BASE).href))),
]);
hulls = ships.map(handling);
kinds.forEach((k, i) => { planetArt[k] = { img: arts[i], r: arts[i].width * 0.46 }; });

$("hull").replaceChildren(...hulls.map((h) => new Option(h.name, h.slug)));
$("track").replaceChildren(...TRACKS.map((t, i) => new Option(t.name, i)));
$("hull").value = "gryphon";
$("hull").onchange = showHull;
$("track").onchange = () => { state.track = Number($("track").value); showHull(); newRace(); };
$("start").onclick = () => newRace();
$("mute").onclick = () => { setMuted(!isMuted()); $("mute").textContent = `Sound: ${isMuted() ? "off" : "on"}`; $("mute").setAttribute("aria-pressed", String(isMuted())); };
$("mute").textContent = `Sound: ${isMuted() ? "off" : "on"}`;
showHull();
state.phase = "ready";
newRace(true);                                          // no sound before a click
state.phase = "ready";                                   // wait for Start or Enter on the first race
$("banner-title").textContent = "Rally";
$("banner-text").textContent = "Pick a hull and a track, then Start (or Enter). Three laps; take the gates in order.";
$("banner").hidden = false;
// tick(n) runs n simulation steps at once, for play-tests on slow machines.
globalThis.rally = { state, TRACKS, newRace, order, drive, tick: (n = 1) => { for (let i = 0; i < n; i++) update(STEP); } };
