// Broadside: turn-based artillery across a field of planets. Two fleets of
// three face each other; on its turn a ship turns on its frames to the angle
// you give it and fires one shell, and every planet's gravity bends the shot.
// A direct hit does full damage, a near miss half. Once a battle each ship
// can fire its special: a heavy shell (double damage) from a big hull, a
// spread of three from a small one. Three maps; the computer aims by trying
// shots in its head, more or less carefully by level.
import { loadShip, drawShip, loadImage, PACK_BASE } from "../../lib/yodacon-ship-pack.js";
import { play, isMuted, setMuted } from "../../lib/yodacon-sound.js";

const $ = (id) => document.getElementById(id);
const canvas = $("screen"), ctx = canvas.getContext("2d");
const W = canvas.width, H = canvas.height, SAVE = "broadside-v1";
const rad = (d) => (d * Math.PI) / 180, deg = (r) => (r * 180) / Math.PI;
const G = 520, SIZES = { small: 16, medium: 32, large: 48 }, MAX_POWER = 420, DT = 1 / 120, MAX_FLIGHT = 7;
const DIRECT = 20, SPLASH = 46;

// Three maps, each with its planets and both fleets. Between them every
// design flies once; the Large Pin is the only Pin.
const MAPS = [
  { name: "The Gap", planets: [["gas", "large", 450, 260]],
    you: [["conex", "yodacon"], ["conex", "tomaquad"], ["conex", "defender"]],
    them: [["conex", "necromancer"], ["override", "callisto"], ["konex", "citrus"]] },
  { name: "Twin Moons", planets: [["ice", "medium", 420, 150], ["rocky", "medium", 480, 380]],
    you: [["conex", "dart"], ["conex", "gryphon"], ["conex", "large-pin"]],
    them: [["conex", "trident"], ["konex", "advisor"], ["override", "yodacon"]] },
  { name: "The Maze", planets: [["lava", "large", 330, 300], ["garden", "medium", 560, 170], ["ice", "small", 600, 400], ["rocky", "small", 250, 110]],
    you: [["conex", "yodacon"], ["konex", "advisor"], ["conex", "trident"]],
    them: [["override", "callisto"], ["conex", "dart"], ["conex", "gryphon"]] },
];
const LEVELS = { easy: { label: "Easy", angle: 12, power: 0.2, tries: 60 }, normal: { label: "Normal", angle: 6, power: 0.1, tries: 160 },
  hard: { label: "Hard", angle: 1.5, power: 0.025, tries: 400 } };
const KONEX = { advisor: { Shield: 350, Armor: 150 }, citrus: { Shield: 180, Armor: 120 } };

const state = { phase: "loading", map: 0, level: "normal", ships: [], turn: "you", idx: { you: -1, them: -1 }, active: null,
  aim: { angle: 90, power: 0.55 }, special: false, shells: [], sparks: [], drag: null, log: [], t: 0, wait: 0 };
let shipArt = {}, planetArt = {};

function load() { try { return JSON.parse(localStorage.getItem(SAVE)) ?? {}; } catch { return {}; } }
function save(d) { try { localStorage.setItem(SAVE, JSON.stringify(d)); } catch { /* not kept */ } }
const planetsOf = (m) => m.planets.map(([type, size, x, y]) => ({ type, size, x, y, r: SIZES[size] }));

// --- Battle --------------------------------------------------------------------------------------

function newBattle(map = state.map) {
  const m = MAPS[map];
  state.map = map;
  $("map").value = map;
  const place = (list, side) => list.map(([ed, slug], i) => {
    const ship = shipArt[`${ed}/${slug}`], st = { ...(ship.meta.stats ?? {}), ...(KONEX[slug] ?? {}) }, size = ship.sprite.frame_width;
    const hp = Math.round(2 * Math.sqrt(st.Shield + st.Armor));
    const x = side === "you" ? 70 + (i % 2) * 70 : W - 70 - (i % 2) * 70, y = 110 + i * 150;
    return { ship, side, name: ed === "override" && slug === "yodacon" ? "1998 Yodacon" : ship.name, x, y, hp, max: hp,
      heading: side === "you" ? 90 : 270, size, big: size >= 60, special: true, r: Math.max(14, size * 0.3) };
  });
  state.ships = [...place(m.you, "you"), ...place(m.them, "them")];
  state.planets = planetsOf(m);
  Object.assign(state, { phase: "aim", turn: "them", idx: { you: -1, them: -1 }, shells: [], log: [] });
  $("banner").hidden = true;
  log(`${m.name}: your ${m.you.length} against their ${m.them.length}.`);
  nextTurn();
}

const alive = (side) => state.ships.filter((s) => s.side === side && s.hp > 0);

function nextTurn() {
  if (!alive("you").length || !alive("them").length) return finish();
  state.turn = state.turn === "you" ? "them" : "you";
  const list = state.ships.filter((s) => s.side === state.turn);
  let i = state.idx[state.turn];
  do i = (i + 1) % list.length; while (list[i].hp <= 0);
  state.idx[state.turn] = i;
  state.active = list[i];
  state.special = false;
  state.aim = { angle: state.active.heading, power: state.aim.power };
  state.phase = "aim";
  if (state.turn === "them") { state.phase = "thinking"; state.wait = state.auto ? 0 : 0.7; }
  render();
}

/** Fly one shell with gravity: where it ends and the path. Pure. */
function simulate(from, angle, power, keepPath = false) {
  const planets = state.planets;
  let x = from.x + Math.sin(rad(angle)) * (from.r + 6), y = from.y - Math.cos(rad(angle)) * (from.r + 6);
  let vx = Math.sin(rad(angle)) * power * MAX_POWER, vy = -Math.cos(rad(angle)) * power * MAX_POWER;
  const path = keepPath ? [[x, y]] : null;
  for (let t = 0; t < MAX_FLIGHT; t += DT) {
    for (const p of planets) {
      const dx = p.x - x, dy = p.y - y, d2 = dx * dx + dy * dy, d = Math.sqrt(d2);
      if (d < p.r * 0.95) return { end: "planet", x, y, path };
      const a = (G * p.r * p.r) / (d2 + 40);
      vx += (a * dx) / d * DT; vy += (a * dy) / d * DT;
    }
    x += vx * DT; y += vy * DT;
    if (keepPath && Math.round(t / DT) % 3 === 0) path.push([x, y]);
    for (const s of state.ships) if (s.hp > 0 && s !== from && Math.hypot(s.x - x, s.y - y) < s.r + 4) return { end: "ship", ship: s, x, y, path };
    if (x < -40 || x > W + 40 || y < -40 || y > H + 40) return { end: "out", x, y, path };
  }
  return { end: "spent", x, y, path };
}

function fire() {
  if (state.phase !== "aim" && state.phase !== "thinking") return false;
  const s = state.active, { angle, power } = state.aim;
  s.heading = angle;
  const spread = state.special && !s.big, heavy = state.special && s.big;
  if (state.special) s.special = false;
  for (const d of spread ? [-4, 0, 4] : [0]) {
    const r = simulate(s, angle + d, power, true);
    state.shells.push({ path: r.path, result: r, t: 0, heavy, from: s });
  }
  state.phase = "flying";
  play("shot");
  render();
  return true;
}

// The computer: try angles and powers in its head, keep the shot that ends
// nearest an enemy, then miss by its level's margin.
function think() {
  const s = state.active, lv = LEVELS[state.level], foes = alive("you");
  let best = null;
  for (let i = 0; i < lv.tries; i++) {
    const angle = 200 + Math.random() * 140, power = 0.25 + Math.random() * 0.75;
    const r = simulate(s, angle, power);
    const d = Math.min(...foes.map((f) => Math.hypot(f.x - r.x, f.y - r.y))) - (r.end === "ship" && r.ship.side === "you" ? 1000 : 0) + (r.end === "ship" && r.ship.side === "them" ? 2000 : 0);
    if (!best || d < best.d) best = { angle, power, d };
  }
  // Refine round the best guess, then add the level's error.
  for (let i = 0; i < lv.tries / 2; i++) {
    const angle = best.angle + (Math.random() - 0.5) * 6, power = Math.max(0.1, Math.min(1, best.power + (Math.random() - 0.5) * 0.08));
    const r = simulate(s, angle, power);
    const d = Math.min(...foes.map((f) => Math.hypot(f.x - r.x, f.y - r.y))) - (r.end === "ship" && r.ship.side === "you" ? 1000 : 0) + (r.end === "ship" && r.ship.side === "them" ? 2000 : 0);
    if (d < best.d) best = { angle, power, d };
  }
  state.aim = { angle: best.angle + (Math.random() - 0.5) * 2 * lv.angle, power: Math.max(0.1, Math.min(1, best.power + (Math.random() - 0.5) * 2 * lv.power)) };
  state.special = s.special && alive("you").length <= 2;   // it saves its special for the end game
  fire();
}

function land(shell) {
  const r = shell.result, dmgBase = 18 + shell.from.size / 4;
  burst(r.x, r.y, r.end === "ship" ? 30 : 14, r.end === "planet" ? "#b0a89a" : "#ffcf6b", 120);
  let hitAny = false;
  for (const s of state.ships) {
    if (s.hp <= 0) continue;
    const d = Math.hypot(s.x - r.x, s.y - r.y);
    const dmg = (r.end === "ship" && r.ship === s) || d < DIRECT ? dmgBase : d < SPLASH ? dmgBase / 2 : 0;
    if (!dmg) continue;
    const total = Math.round(dmg * (shell.heavy ? 2 : 1));
    s.hp = Math.max(0, s.hp - total);
    hitAny = true;
    log(`${shell.from.side === "you" ? "Your" : "Their"} ${shell.from.name} hits ${s.side === "you" ? "your" : "their"} ${s.name} for ${total}${s.hp === 0 ? ": destroyed." : "."}`);
    if (s.hp === 0) { burst(s.x, s.y, 50, "#ff7a59", 160); play("boom"); }
  }
  if (!hitAny) { log(`${shell.from.side === "you" ? "Your" : "Their"} ${shell.from.name}: ${r.end === "planet" ? "into a planet" : "a miss"}.`); play(r.end === "planet" ? "hit" : "cancel"); }
  else play("hit");
}

function finish() {
  state.phase = "over";
  const won = alive("you").length > 0, best = load(), key = `${state.map}:${state.level}`;
  if (won) save({ ...best, [key]: (best[key] ?? 0) + 1 });
  play(won ? "won" : "lost");
  banner(won ? "Victory" : "Defeat", `${won ? `Their fleet is gone; ${alive("you").length} of yours afloat.` : "Your fleet is gone."} ` +
    `Wins on this map and level: ${load()[key] ?? 0}. Enter or New battle to fight again.`);
  render();
}

// --- Update --------------------------------------------------------------------------------------

function update(dt) {
  state.t += dt;
  for (const s of state.sparks) { s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt; }
  state.sparks = state.sparks.filter((s) => s.life > 0);
  if (state.phase === "thinking" && (state.wait -= dt) <= 0) think();
  if (state.phase !== "flying") return;
  for (const sh of state.shells) {
    if (sh.done) continue;
    sh.t += dt * (state.auto ? 4 : 1);
    if (Math.floor(sh.t / (DT * 3)) >= sh.path.length - 1) { sh.done = true; land(sh); }
  }
  if (state.shells.every((sh) => sh.done)) { state.shells = []; nextTurn(); }
}

function burst(x, y, n, color, speed) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = speed * (0.3 + Math.random());
    state.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.2 + Math.random() * 0.6, max: 0.8, color });
  }
}

function log(text) { state.log.unshift(text); state.log.length = Math.min(state.log.length, 7); }
function banner(title, text) { $("banner-title").textContent = title; $("banner-text").textContent = text; $("banner").hidden = false; }

// --- Input ---------------------------------------------------------------------------------------

const toGame = (e) => { const b = canvas.getBoundingClientRect(); return { x: ((e.clientX - b.left) / b.width) * W, y: ((e.clientY - b.top) / b.height) * H }; };
const myTurn = () => state.phase === "aim" && state.turn === "you";
canvas.addEventListener("pointerdown", (e) => {
  if (state.phase === "over") { newBattle(); return; }
  if (!myTurn()) return;
  state.drag = toGame(e);
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", (e) => {
  if (!state.drag || !myTurn()) return;
  const p = toGame(e), s = state.active, dx = s.x - p.x, dy = s.y - p.y;   // pull back from the ship, like a slingshot
  state.aim.angle = (deg(Math.atan2(dx, -dy)) + 360) % 360;
  state.aim.power = Math.max(0.1, Math.min(1, Math.hypot(dx, dy) / 150));
  s.heading = state.aim.angle;
});
canvas.addEventListener("pointerup", () => { if (state.drag) { state.drag = null; if (myTurn()) fire(); } });
addEventListener("keydown", (e) => {
  if (e.target.closest?.("select")) return;
  if (e.key === "Enter" && state.phase === "over") { newBattle(); return; }
  if (!myTurn()) return;
  const step = e.shiftKey ? 0.5 : 2;
  if (e.key === "ArrowLeft") state.aim.angle = (state.aim.angle - step + 360) % 360;
  else if (e.key === "ArrowRight") state.aim.angle = (state.aim.angle + step) % 360;
  else if (e.key === "ArrowUp") state.aim.power = Math.min(1, state.aim.power + step / 100);
  else if (e.key === "ArrowDown") state.aim.power = Math.max(0.1, state.aim.power - step / 100);
  else if (e.key === " ") fire();
  else if (e.key === "s" || e.key === "S") toggleSpecial();
  else return;
  e.preventDefault();
  state.active.heading = state.aim.angle;
  render();
});
function toggleSpecial() { if (myTurn() && state.active.special) { state.special = !state.special; play("select"); render(); } }

// --- Drawing -------------------------------------------------------------------------------------

const stars = Array.from({ length: 160 }, () => [Math.random() * W, Math.random() * H, Math.random()]);
function draw() {
  ctx.fillStyle = "#03050a"; ctx.fillRect(0, 0, W, H);
  for (const [x, y, b] of stars) { ctx.fillStyle = `rgb(170 180 220 / ${0.2 + b * 0.6})`; ctx.fillRect(x, y, 1, 1); }
  ctx.imageSmoothingEnabled = false;
  for (const p of state.planets ?? []) {
    ctx.strokeStyle = "rgb(127 233 255 / 0.07)";
    for (const k of [2.2, 3.4]) { ctx.beginPath(); ctx.arc(p.x, p.y, p.r * k, 0, Math.PI * 2); ctx.stroke(); }
    ctx.drawImage(planetArt[`${p.type}/${p.size}`], p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
  }
  for (const s of state.ships) {
    if (s.hp <= 0) { ctx.globalAlpha = 0.25; drawShip(ctx, s.ship, s.heading, s.x, s.y, 1); ctx.globalAlpha = 1; continue; }
    if (s === state.active && state.phase !== "over") {
      ctx.strokeStyle = s.side === "you" ? "#5cff5c" : "#ff7a59"; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r + 10, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    }
    drawShip(ctx, s.ship, s.heading, s.x, s.y, 1);
    ctx.fillStyle = "rgb(255 255 255 / 0.15)"; ctx.fillRect(s.x - 20, s.y + s.r + 6, 40, 4);
    ctx.fillStyle = s.side === "you" ? "#5cff5c" : "#ff7a59"; ctx.fillRect(s.x - 20, s.y + s.r + 6, (40 * s.hp) / s.max, 4);
  }
  if (myTurn()) {                                              // the aim: half a second of the flight, and the power
    const s = state.active, pre = simulate(s, state.aim.angle, state.aim.power, true);
    ctx.fillStyle = state.special ? "#ffb340" : "rgb(92 255 92 / 0.8)";
    pre.path.slice(0, 22).forEach(([x, y], i) => { if (i % 2 === 0) ctx.fillRect(x - 1, y - 1, 2, 2); });
    ctx.fillStyle = "#ffb340"; ctx.fillRect(s.x - 20, s.y - s.r - 12, 40 * state.aim.power, 3);
  }
  for (const sh of state.shells) {
    const i = Math.min(sh.path.length - 1, Math.floor(sh.t / (DT * 3)));
    ctx.strokeStyle = sh.heavy ? "rgb(255 122 89 / 0.6)" : "rgb(255 207 107 / 0.5)";
    ctx.beginPath(); sh.path.slice(Math.max(0, i - 25), i + 1).forEach(([x, y], j) => (j ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
    if (!sh.done) { const [x, y] = sh.path[i]; ctx.fillStyle = sh.heavy ? "#ff7a59" : "#ffe3a0"; ctx.beginPath(); ctx.arc(x, y, sh.heavy ? 4 : 3, 0, Math.PI * 2); ctx.fill(); }
  }
  for (const p of state.sparks) { ctx.globalAlpha = Math.min(1, (p.life / p.max) * 1.5); ctx.fillStyle = p.color; ctx.fillRect(p.x - 1, p.y - 1, 2, 2); }
  ctx.globalAlpha = 1;
}

function render() {
  const s = state.active;
  $("turn").textContent = state.phase === "over" ? "–" : state.turn === "you" ? "Yours" : "Theirs";
  $("you-left").textContent = `${alive("you").length}/3`;
  $("them-left").textContent = `${alive("them").length}/3`;
  $("who").textContent = s ? `${s.side === "you" ? "Your" : "Their"} ${s.name}` : "";
  $("aim").textContent = s && myTurn() ? `Angle ${Math.round(state.aim.angle)}° · power ${Math.round(state.aim.power * 100)}%` : state.phase === "thinking" ? "Taking aim…" : state.phase === "flying" ? "Shell away" : "";
  const sp = $("special");
  sp.hidden = !myTurn();
  if (s && myTurn()) {
    sp.disabled = !s.special;
    sp.textContent = !s.special ? "Special used" : s.big ? `Heavy shell${state.special ? " (armed)" : ""}` : `Spread of three${state.special ? " (armed)" : ""}`;
    sp.setAttribute("aria-pressed", String(state.special));
  }
  $("fire").disabled = !myTurn();
  $("log").replaceChildren(...state.log.map((t) => Object.assign(document.createElement("li"), { textContent: t })));
}

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

const wanted = [...new Map(MAPS.flatMap((m) => [...m.you, ...m.them]).map((s) => [s.join("/"), s])).values()];
const pkeys = [...new Set(MAPS.flatMap((m) => m.planets.map(([t, sz]) => `${t}/${sz}`)))];
const [ships, arts] = await Promise.all([Promise.all(wanted.map(([ed, slug]) => loadShip(ed, slug))),
  Promise.all(pkeys.map((k) => loadImage(new URL(`planets/${k}/planet.png`, PACK_BASE).href)))]);
wanted.forEach((k, i) => { shipArt[k.join("/")] = ships[i]; });
pkeys.forEach((k, i) => { planetArt[k] = arts[i]; });
$("map").replaceChildren(...MAPS.map((m, i) => new Option(m.name, i)));
$("map").onchange = () => { $("map").blur(); newBattle(Number($("map").value)); };
$("level").onchange = () => { state.level = $("level").value; $("level").blur(); newBattle(); };
$("fire").onclick = () => fire();
$("special").onclick = () => toggleSpecial();
$("new").onclick = () => newBattle();
$("mute").onclick = () => { setMuted(!isMuted()); $("mute").textContent = `Sound: ${isMuted() ? "off" : "on"}`; $("mute").setAttribute("aria-pressed", String(isMuted())); };
$("mute").textContent = `Sound: ${isMuted() ? "off" : "on"}`;
newBattle(0);
// tick(n) runs n simulation steps at once; auto plays your side with the
// computer's own aim (for play-tests), at four times the flight speed.
globalThis.broadside = { state, newBattle, fire, think, simulate, alive, LEVELS,
  tick: (n = 1) => { for (let i = 0; i < n; i++) { if (state.auto && state.phase === "aim" && state.turn === "you") autoAim(); update(STEP); } } };
function autoAim() {                                           // your side, flown by the computer at the chosen level
  const lv = LEVELS[state.autoLevel ?? "normal"], s = state.active;
  const foes = alive("them");
  let best = null;
  for (let i = 0; i < lv.tries * 1.5; i++) {
    const angle = 20 + Math.random() * 140, power = 0.25 + Math.random() * 0.75, r = simulate(s, angle, power);
    const d = Math.min(...foes.map((f) => Math.hypot(f.x - r.x, f.y - r.y))) - (r.end === "ship" && r.ship.side === "them" ? 1000 : 0) + (r.end === "ship" && r.ship.side === "you" ? 2000 : 0);
    if (!best || d < best.d) best = { angle, power, d };
  }
  state.aim = { angle: best.angle + (Math.random() - 0.5) * 2 * lv.angle, power: Math.max(0.1, Math.min(1, best.power + (Math.random() - 0.5) * 2 * lv.power)) };
  state.special = s.special && alive("them").length <= 2;
  fire();
}
