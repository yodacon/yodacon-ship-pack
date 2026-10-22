// Slingshot: gravity golf with the 1997 ConEx Dart.
// One push per launch; after that only the planets steer. The same simulate()
// flies the ship, draws the aiming preview, and lets a play-test prove every
// level can be made in par (playtest/solve.js). Once a launch you may burn
// the engine mid-flight (Space, or a click toward where you want to go): a
// kick of 90 px/s, and the rest of the flight is worked out again from there.
import { loadShip, drawShip, loadImage, PACK_BASE } from "../../lib/yodacon-ship-pack.js";
import { play, isMuted, setMuted } from "../../lib/yodacon-sound.js";

const $ = (id) => document.getElementById(id);
const canvas = $("screen"), ctx = canvas.getContext("2d");
const W = canvas.width, H = canvas.height;
const SIZES = { small: 16, medium: 32, large: 48 };   // radius in px, as the planet PNGs are drawn
const G = 520;                 // pull: G × radius² / distance², px/s²
const MAX_PULL = 120, SPEED_PER_PX = 2.6;
const DT = 1 / 120, MAX_FLIGHT = 14, GATE_R = 22, BURN = 90;

// x, y in canvas pixels. Each level was solved in par by playtest/solve.js.
export const LEVELS = [
  { name: "First light", tee: [100, 280], gate: [800, 280], par: 1,
    planets: [["garden", "medium", 450, 190]] },
  { name: "In the way", tee: [100, 280], gate: [800, 280], par: 1,
    planets: [["gas", "large", 450, 280]] },
  { name: "Round the back", tee: [120, 460], gate: [780, 110], par: 2,
    planets: [["rocky", "large", 450, 300], ["ice", "small", 650, 380]] },
  { name: "The channel", tee: [80, 100], gate: [820, 460], par: 2,
    planets: [["lava", "medium", 300, 200], ["garden", "medium", 600, 380], ["ice", "small", 450, 300]] },
  { name: "Over the top", tee: [100, 500], gate: [450, 90], par: 2,
    planets: [["gas", "large", 450, 260]] },
  { name: "The gauntlet", tee: [60, 280], gate: [850, 280], par: 3,
    planets: [["rocky", "large", 300, 150], ["lava", "large", 300, 410], ["gas", "medium", 600, 280],
      ["ice", "small", 750, 150], ["garden", "small", 750, 410]] },
  { name: "Binary", tee: [80, 460], gate: [820, 100], par: 2,
    planets: [["gas", "large", 380, 250], ["lava", "large", 540, 340], ["ice", "small", 700, 190], ["rocky", "small", 220, 120]] },
];

const planetsOf = (level) => level.planets.map(([type, size, x, y]) => ({ type, size, x, y, r: SIZES[size] }));

/** Fly one launch: where it ends and the path it took. Pure: no game state. */
export function simulate(level, angle, power, { keepPath = true, maxTime = MAX_FLIGHT, from = null } = {}) {
  const planets = planetsOf(level);
  const speed = Math.max(0, Math.min(1, power)) * MAX_PULL * SPEED_PER_PX;
  // `from` carries on a flight already under way (after a burn): x, y, vx, vy, t.
  let x = from?.x ?? level.tee[0], y = from?.y ?? level.tee[1];
  let vx = from?.vx ?? Math.cos(angle) * speed, vy = from?.vy ?? Math.sin(angle) * speed;
  const path = keepPath ? [[x, y]] : null;
  for (let t = from?.t ?? 0; t < maxTime; t += DT) {
    let ax = 0, ay = 0;
    for (const p of planets) {
      const dx = p.x - x, dy = p.y - y, d2 = dx * dx + dy * dy, d = Math.sqrt(d2);
      if (d < p.r * 0.9) return { result: "crash", x, y, t, path, planet: p };
      const a = G * p.r * p.r / (d2 + 40);
      ax += a * dx / d; ay += a * dy / d;
    }
    vx += ax * DT; vy += ay * DT;
    x += vx * DT; y += vy * DT;
    if (keepPath && Math.round(t / DT) % 4 === 0) path.push([x, y]);
    if (Math.hypot(x - level.gate[0], y - level.gate[1]) < GATE_R) return { result: "gate", x, y, t, path };
    if (x < -40 || x > W + 40 || y < -40 || y > H + 40) return { result: "out", x, y, t, path };
  }
  return { result: "timeout", x, y, t: maxTime, path };
}

// --- The game -----------------------------------------------------------------------------------

const BEST_KEY = "slingshot-best";
let best = {};
try { best = JSON.parse(localStorage.getItem(BEST_KEY) ?? "{}"); } catch { /* none kept */ }

let dart, planetImages = new Map();
const state = { level: 0, strokes: 0, total: 0, flight: null, aim: { angle: 0, power: 0.55 },
  drag: null, done: false, results: [] };

let nextTimer = null;   // the pending "next level": cancelled if a level is picked first
function startLevel(i) {
  clearTimeout(nextTimer);
  state.level = i;
  state.strokes = 0;
  state.flight = null;
  state.done = false;
  const lv = LEVELS[i];
  state.aim.angle = Math.atan2(lv.gate[1] - lv.tee[1], lv.gate[0] - lv.tee[0]);
  $("banner").hidden = true;
  renderLevels();
  hud();
}

export function launch(angle, power) {
  if (state.flight || state.done) return false;
  state.strokes++;
  const lv = LEVELS[state.level];
  const outcome = simulate(lv, angle, power);
  state.flight = { outcome, t: 0, angle, power, burnt: false };
  play("send");
  hud();
  return true;
}

function finishFlight() {
  const { outcome } = state.flight;
  state.flight = null;
  if (outcome.result === "gate") {
    const lv = LEVELS[state.level];
    state.total += state.strokes;
    state.results[state.level] = state.strokes;
    const key = String(state.level);
    if (!best[key] || state.strokes < best[key]) {
      best[key] = state.strokes;
      try { localStorage.setItem(BEST_KEY, JSON.stringify(best)); } catch { /* not kept */ }
    }
    const verdict = state.strokes < lv.par ? "Under par!" : state.strokes === lv.par ? "Par." : `${state.strokes - lv.par} over par.`;
    play(state.strokes <= lv.par ? "won" : "conquered");
    if (state.level + 1 < LEVELS.length) {
      showBanner(`${lv.name}: through`, `${state.strokes} launch${state.strokes > 1 ? "es" : ""}. ${verdict}`);
      nextTimer = setTimeout(() => startLevel(state.level + 1), 1800);
    } else {
      state.done = true;
      const par = LEVELS.reduce((s, l) => s + l.par, 0);
      showBanner("All levels flown", `${state.total} launches for a par of ${par}. Click to fly them again.`);
    }
  } else {
    play(outcome.result === "crash" ? "boom" : "cancel");
  }
  hud();
}

// The burn: where the ship is now, its velocity from the path, a 90 px/s
// kick toward `toward` (or along the way it is going), then the rest of the
// flight again from there. Once a launch; it is not another launch.
export function burn(toward = null) {
  const f = state.flight;
  if (!f || f.burnt) return false;
  const path = f.outcome.path, idx = Math.min(path.length - 2, Math.floor(f.t / (DT * 4)));
  if (idx < 1) return false;
  const [x, y] = path[idx], [px, py] = path[idx - 1], step = DT * 4;
  let vx = (x - px) / step, vy = (y - py) / step;
  const dx = toward ? toward.x - x : vx, dy = toward ? toward.y - y : vy, d = Math.hypot(dx, dy) || 1;
  vx += (dx / d) * BURN; vy += (dy / d) * BURN;
  const rest = simulate(LEVELS[state.level], 0, 0, { from: { x, y, vx, vy, t: idx * step } });
  f.outcome = { ...rest, path: [...path.slice(0, idx + 1), ...rest.path] };
  f.burnt = true; f.burnAt = { x, y, dx: dx / d, dy: dy / d, life: 0.4 };
  play("select");
  hud();
  return true;
}

// --- Input: drag back and release, or the keyboard ---------------------------------------------

function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) };
}
canvas.addEventListener("pointerdown", (e) => {
  if (state.done) { state.total = 0; state.results = []; startLevel(0); return; }
  if (state.flight) { burn(canvasPoint(e)); return; }
  state.drag = canvasPoint(e);
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", (e) => {
  if (!state.drag) return;
  const p = canvasPoint(e), [tx, ty] = LEVELS[state.level].tee;
  // Pull back from the ship: the launch goes the opposite way.
  const dx = tx - p.x, dy = ty - p.y;
  state.aim.angle = Math.atan2(dy, dx);
  state.aim.power = Math.min(1, Math.hypot(dx, dy) / MAX_PULL);
});
canvas.addEventListener("pointerup", () => {
  if (!state.drag) return;
  state.drag = null;
  if (state.aim.power > 0.05) launch(state.aim.angle, state.aim.power);
});
canvas.addEventListener("keydown", (e) => {
  const step = e.shiftKey ? 0.01 : 0.05;
  if (e.key === "ArrowLeft") state.aim.angle -= step;
  else if (e.key === "ArrowRight") state.aim.angle += step;
  else if (e.key === "ArrowUp") state.aim.power = Math.min(1, state.aim.power + step);
  else if (e.key === "ArrowDown") state.aim.power = Math.max(0.05, state.aim.power - step);
  else if (e.key === " ") { if (state.flight) burn(); else launch(state.aim.angle, state.aim.power); }
  else if (e.key === "r" || e.key === "R") startLevel(state.level);
  else return;
  e.preventDefault();
});
$("restart").addEventListener("click", () => startLevel(state.level));
const showMute = () => { $("mute").textContent = isMuted() ? "Sound: off" : "Sound: on"; $("mute").setAttribute("aria-pressed", String(isMuted())); };
$("mute").addEventListener("click", () => { setMuted(!isMuted()); showMute(); });
showMute();

// --- Drawing -------------------------------------------------------------------------------------

const stars = Array.from({ length: 160 }, () => [Math.random() * W, Math.random() * H, Math.random()]);

function render(dt) {
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
  for (const [x, y, b] of stars) { ctx.fillStyle = `rgba(255,255,255,${0.2 + b * 0.6})`; ctx.fillRect(x, y, 1, 1); }
  const lv = LEVELS[state.level];
  ctx.imageSmoothingEnabled = false;
  for (const p of planetsOf(lv)) {
    ctx.strokeStyle = "rgba(127,233,255,0.07)";     // a faint well around each planet
    for (const k of [2.2, 3.4]) { ctx.beginPath(); ctx.arc(p.x, p.y, p.r * k, 0, Math.PI * 2); ctx.stroke(); }
    ctx.drawImage(planetImages.get(`${p.type}/${p.size}`), p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
  }
  // The gate: a green ring with Escape Velocity's corner brackets.
  const [gx, gy] = lv.gate;
  ctx.strokeStyle = "#5cff5c"; ctx.lineWidth = 2;
  ctx.shadowColor = "#5cff5c"; ctx.shadowBlur = 10;
  ctx.beginPath(); ctx.arc(gx, gy, GATE_R, 0, Math.PI * 2); ctx.stroke();
  ctx.shadowBlur = 0; ctx.lineWidth = 1;

  const [tx, ty] = lv.tee;
  if (state.flight) {
    const f = state.flight;
    f.t += dt;
    const path = f.outcome.path;
    const idx = Math.min(path.length - 1, Math.floor(f.t / (DT * 4)));
    ctx.strokeStyle = "rgba(255,179,64,0.5)";
    ctx.beginPath(); path.slice(0, idx + 1).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
    const [x, y] = path[idx], [px, py] = path[Math.max(0, idx - 1)];
    const heading = (Math.atan2(x - px, -(y - py)) * 180 / Math.PI + 360) % 360;
    drawShip(ctx, dart, heading, x, y, 0.5);
    if (f.burnAt && f.burnAt.life > 0) {                 // the burn's flare, behind the kick
      f.burnAt.life -= dt;
      ctx.fillStyle = `rgba(255,179,64,${f.burnAt.life * 2})`;
      ctx.beginPath(); ctx.arc(f.burnAt.x - f.burnAt.dx * 10, f.burnAt.y - f.burnAt.dy * 10, 6, 0, Math.PI * 2); ctx.fill();
    }
    if (idx >= path.length - 1) finishFlight();
  } else if (!state.done) {
    // The aim: a short preview of the first second of flight.
    const preview = simulate(lv, state.aim.angle, state.aim.power, { maxTime: 1.1 });
    ctx.fillStyle = "rgba(92,255,92,0.7)";
    preview.path.forEach(([x, y], i) => { if (i % 3 === 0) ctx.fillRect(x - 1, y - 1, 2, 2); });
    const heading = (state.aim.angle * 180 / Math.PI + 90 + 360) % 360;
    drawShip(ctx, dart, heading, tx, ty, 0.5);
    ctx.fillStyle = "#ffb340";
    ctx.fillRect(tx - 20, ty + 26, 40 * state.aim.power, 3);
  }
}

function hud() {
  const lv = LEVELS[state.level];
  $("level").textContent = state.level + 1;
  $("strokes").textContent = state.strokes;
  $("par").textContent = lv.par;
  $("total").textContent = state.total;
  $("status").lastChild.textContent = state.done ? "All levels flown" : state.flight ? (state.flight.burnt ? "In flight (burn used)" : "In flight: Space or click to burn") : `${lv.name}: aim and launch`;
  const b = best[String(state.level)];
  $("best").textContent = b ? `Your best here: ${b} launch${b > 1 ? "es" : ""}.` : "";
}

function renderLevels() {
  $("levels").replaceChildren(...LEVELS.map((lv, i) => {
    const li = document.createElement("li");
    const btn = Object.assign(document.createElement("button"), { type: "button", className: "yc-plate", textContent: String(i + 1) });
    btn.title = `${lv.name}, par ${lv.par}`;
    btn.setAttribute("aria-current", String(i === state.level));
    btn.addEventListener("click", () => startLevel(i));
    li.append(btn);
    return li;
  }));
}

let showTimer;
function showBanner(title, text) {
  $("banner-title").textContent = title;
  $("banner-text").textContent = text;
  $("banner").hidden = false;
  clearTimeout(showTimer);
  if (!state.done) showTimer = setTimeout(() => { $("banner").hidden = true; }, 1700);
}

let last = performance.now();
function frame(now) {
  // A flight follows a path worked out at launch, so it can play in real time
  // even when frames are slow (1 fps still plays it in time); only a stall over
  // a second (a hidden tab) is capped.
  render(Math.min(1, (now - last) / 1000));
  last = now;
  requestAnimationFrame(frame);
}

// For play-test scripts (playtest/).
globalThis.slingshot = { get state() { return state; }, LEVELS, simulate, launch, burn, startLevel };

const types = new Set(LEVELS.flatMap((l) => l.planets.map(([t, s]) => `${t}/${s}`)));
[dart] = await Promise.all([
  loadShip("conex", "dart", PACK_BASE),
  ...[...types].map(async (k) => planetImages.set(k, await loadImage(new URL(`planets/${k}/planet.png`, PACK_BASE).href))),
]);
startLevel(0);
requestAnimationFrame(frame);
