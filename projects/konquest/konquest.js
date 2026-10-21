// Konquest in the browser: the board, orders and news around rules.js.
// rules.js holds every rule (and is tested on its own); this file only draws
// the galaxy and turns clicks into orders. Fleets in flight are pack ships.
import {
  DEFAULTS, NEUTRAL, newGame, sendFleet, cancelFleet, addStandingOrder, endTurn,
  planetByName, distance, travelTurns, isDead,
} from "./rules.js";
import { loadShip, drawShip, PACK_BASE } from "../../lib/yodacon-ship-pack.js";
import { play, isMuted, setMuted } from "./sound.js";

// Each seat flies one hull from the pack.
const HULLS = [["conex", "yodacon"], ["conex", "dart"], ["override", "callisto"], ["konex", "advisor"],
  ["conex", "gryphon"], ["konex", "citrus"], ["conex", "necromancer"], ["override", "tomaquad"],
  ["conex", "trident"], ["conex", "large-pin"]];
// Opponents by how they actually play (docs/research/2026-10-21-08-konquest-brains.md).
const TYPES = [["human", "Human"], ["easy", "Computer: Easy"], ["medium", "Computer: Medium"], ["hard", "Computer: Hard"]];
const AI_DELAY = 450;   // ms between computer turns when no human is playing

const $ = (id) => document.getElementById(id);
const hullUrl = (seat, file) => new URL(`${HULLS[seat][0]}/ships/${HULLS[seat][1]}/${file}`, PACK_BASE).href;
const hulls = new Map();                       // seat → loaded ship (sheet + sprite)
let game = null, source = null, target = null, waiting = false;

// --- Setup ---------------------------------------------------------------------------

let seats = [{ name: "You", type: "human" }, { name: "Computer", type: "medium" }];

function renderSetup() {
  const list = $("setup-players");
  list.replaceChildren(...seats.map((seat, i) => {
    const li = document.createElement("li");
    const img = new Image(32, 32);
    img.src = hullUrl(i, "frames/00.png");
    img.alt = HULLS[i][1];
    const name = Object.assign(document.createElement("input"), { value: seat.name, maxLength: 20,
      ariaLabel: `Player ${i + 1} name` });
    name.addEventListener("input", () => { seat.name = name.value; });
    const type = document.createElement("select");
    type.ariaLabel = `Player ${i + 1} type`;
    for (const [value, label] of TYPES) type.add(new Option(label, value, false, value === seat.type));
    type.addEventListener("change", () => { seat.type = type.value; });
    li.append(chip(DEFAULT_COLORS[i]), img, name, type);
    return li;
  }));
  $("add-player").disabled = seats.length >= HULLS.length;
  $("remove-player").disabled = seats.length <= 2;
}
const DEFAULT_COLORS = ["#8282ff", "#ffff00", "#ff0000", "#00ff00", "#ffffff",
  "#00ffff", "#ff00ff", "#eb992e", "#6a9d68", "#839980"];

$("add-player").addEventListener("click", () => {
  seats.push({ name: `Computer ${seats.length}`, type: "medium" }); renderSetup();
});
$("remove-player").addEventListener("click", () => { seats.pop(); renderSetup(); });
$("new-game").addEventListener("click", () => { renderSetup(); $("setup").showModal(); });
$("setup").addEventListener("close", () => {
  if ($("setup").returnValue !== "start") return;
  const options = {};
  for (const key of Object.keys(DEFAULTS.options)) {
    const el = $(`opt-${key}`);
    options[key] = el.type === "checkbox" ? el.checked : Number(el.value);
  }
  const seedText = $("opt-seed").value.trim();
  start({
    players: seats.map((s) => ({ ...s })),
    neutralPlanets: Number($("opt-neutrals").value), rows: Number($("opt-rows").value),
    cols: Number($("opt-cols").value), options,
    seed: seedText ? Number(seedText) >>> 0 : (Math.random() * 2 ** 32) >>> 0,
  });
});

// --- A game ----------------------------------------------------------------------------

async function start(config) {
  lastConfig = config;
  $("ending").hidden = true;
  $("cover").hidden = true;
  // A hull that fails to load (offline, a CDN hiccup) must not stop the game:
  // its fleets are drawn as markers instead, and it is retried next game.
  await Promise.all(config.players.map(async (_, seat) => {
    if (hulls.has(seat)) return;
    try { hulls.set(seat, await loadShip(HULLS[seat][0], HULLS[seat][1], PACK_BASE)); }
    catch (err) { console.warn(`Konquest: hull ${HULLS[seat].join("/")} not loaded:`, err.message); }
  }));
  game = newGame(config);
  source = target = null;
  $("news").replaceChildren();
  addNews(game.news, true);
  buildBoard();
  nextHuman();
}

const humansAlive = () => game.players.some((p, i) => p.type === "human" && !isDead(game, i));

let lastConfig = null;
function nextHuman() {
  render();
  if (game.over) { showEnding(); return; }
  if (!humansAlive()) {                         // computers only: watch it play out
    waiting = true;
    setTimeout(() => { waiting = false; addNews(endTurn(game)); nextHuman(); }, AI_DELAY);
    return;
  }
  // Hot seat: with two or more humans, hide the board between their turns.
  const humans = game.players.filter((p, i) => p.type === "human" && !isDead(game, i)).length;
  if (humans > 1) {
    const p = game.players[game.current];
    $("cover-text").textContent = `${p.name}, it's your turn (turn ${game.turn}).`;
    $("cover").hidden = false;
    $("cover-go").focus();
  }
}
$("cover-go").addEventListener("click", () => { $("cover").hidden = true; render(); });

// The end: who won, from the point of view of the humans at the table.
function showEnding() {
  const w = game.players[game.winner];
  const humans = game.players.filter((p) => p.type === "human");
  const title = $("ending-title");
  title.className = "ending-title";
  if (w.type === "human") {
    title.textContent = humans.length > 1 ? `${w.name} wins` : "Victory";
    title.classList.add("won");
  } else if (humans.length) {
    title.textContent = "Defeat";
    title.classList.add("lost");
  } else {
    title.textContent = `${w.name} wins`;
  }
  const s = w.stats;
  $("ending-text").textContent = `${owns(w.name)} the galaxy after ${game.turn} turns: ` +
    `${s.planetsConquered} planets conquered, ${s.enemyShipsDestroyed} ships destroyed.`;
  $("ending").hidden = false;
  $("rematch").focus();
}
$("rematch").addEventListener("click", () => start(lastConfig));
$("ending-new").addEventListener("click", () => { renderSetup(); $("setup").showModal(); });
$("ending-look").addEventListener("click", () => { $("ending").hidden = true; });

$("end-turn").addEventListener("click", () => {
  if (!game || game.over || waiting) return;
  source = target = null;
  play("endTurn");
  const news = endTurn(game);
  addNews(news);
  setTimeout(() => newsSound(news), 220);    // after the end-turn figure
  nextHuman();
});

// One sound for a turn's news, the most important first: a win, a human's
// planet lost, a planet taken by a human, a human's planet holding.
function newsSound(news) {
  const human = (i) => i !== NEUTRAL && game.players[i]?.type === "human";
  if (news.some((n) => n.kind === "won")) play("won");
  else if (news.some((n) => n.kind === "fell" && human(n.defender))) play("lost");
  else if (news.some((n) => n.kind === "fell" && human(n.player))) play("conquered");
  else if (news.some((n) => n.kind === "held" && human(n.defender))) play("held");
}

const muteButton = $("mute");
const showMute = () => {
  muteButton.textContent = isMuted() ? "Sound: off" : "Sound: on";
  muteButton.setAttribute("aria-pressed", String(isMuted()));
};
muteButton.addEventListener("click", () => { setMuted(!isMuted()); showMute(); if (!isMuted()) play("select"); });
showMute();

// --- The board ---------------------------------------------------------------------------

function buildBoard() {
  const board = $("board");
  board.style.setProperty("--rows", game.rows);
  board.style.setProperty("--cols", game.cols);
  const cells = [];
  for (let row = 0; row < game.rows; row++) {
    for (let col = 0; col < game.cols; col++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.role = "gridcell";
      const planet = game.planets.find((p) => p.row === row && p.col === col);
      if (planet) {
        cell.classList.add("planet");
        cell.dataset.planet = planet.name;
        cell.tabIndex = 0;
        cell.append(planetPicture(planet), Object.assign(document.createElement("span"), { className: "name", textContent: planet.name }),
          Object.assign(document.createElement("span"), { className: "ships" }));
        cell.addEventListener("click", () => pick(planet));
        cell.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(planet); } });
        cell.addEventListener("pointerenter", () => showTip(planet, cell));
        cell.addEventListener("pointerleave", () => { $("tip").hidden = true; });
        cell.addEventListener("focus", () => showTip(planet, cell));
        cell.addEventListener("blur", () => { $("tip").hidden = true; });
      }
      cells.push(cell);
    }
  }
  board.replaceChildren(...cells);
}

// Planets come from the pack's planets/: Konquest's ten looks (planet.cc picks
// one of ten pictures) map onto its five types, and production sets the size.
// If a picture fails to load, the planet is drawn in code instead.
const PLANET_TYPES = ["rocky", "gas", "ice", "lava", "garden"];
function planetPicture(planet) {
  const type = PLANET_TYPES[planet.look % PLANET_TYPES.length];
  const size = planet.production <= 7 ? "small" : planet.production <= 11 ? "medium" : "large";
  const img = new Image();
  img.className = `pic ${size}`;
  img.alt = `Planet ${planet.name}, ${type}`;
  img.src = new URL(`planets/${type}/${size}/planet.png`, PACK_BASE).href;
  img.addEventListener("error", () => img.replaceWith(planetCanvas(planet)), { once: true });
  return img;
}

// The fallback: a planet drawn in code, in one of ten looks.
const LOOKS = [["#d9a066", "#7a4a22"], ["#7fb2e5", "#1d3f73"], ["#c9d6df", "#5b6b78"], ["#e2734b", "#5a1f12"],
  ["#9bcf8a", "#2e5e2a"], ["#f2d675", "#8a6a1a"], ["#b28fd9", "#45266e"], ["#79d2c8", "#1f5b55"],
  ["#d98fa6", "#6e2640"], ["#a7a7a7", "#3c3c3c"]];
function planetCanvas(planet) {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  const [light, dark] = LOOKS[planet.look % LOOKS.length];
  let seed = [...planet.name].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7 + planet.look);
  const rand = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32);
  g.save();
  g.beginPath(); g.arc(32, 32, 28, 0, Math.PI * 2); g.clip();
  const body = g.createRadialGradient(22, 22, 4, 32, 32, 30);
  body.addColorStop(0, light); body.addColorStop(1, dark);
  g.fillStyle = body; g.fillRect(0, 0, 64, 64);
  g.globalAlpha = 0.18;                         // bands or craters, by look
  for (let i = 0; i < 6; i++) {
    g.fillStyle = i % 2 ? dark : light;
    if (planet.look % 2) g.fillRect(0, 8 + rand() * 48, 64, 2 + rand() * 5);
    else { g.beginPath(); g.arc(10 + rand() * 44, 10 + rand() * 44, 2 + rand() * 6, 0, Math.PI * 2); g.fill(); }
  }
  g.globalAlpha = 1;
  const shade = g.createRadialGradient(18, 18, 10, 32, 32, 34);   // night side
  shade.addColorStop(0.55, "rgba(0,0,0,0)"); shade.addColorStop(1, "rgba(0,0,0,0.65)");
  g.fillStyle = shade; g.fillRect(0, 0, 64, 64);
  g.restore();
  c.setAttribute("role", "img");
  c.ariaLabel = `Planet ${planet.name}`;
  return c;
}

// What the current human may see of a planet (BlindMap, NeutralsShow*).
const viewer = () => game.players[game.current];
function seesShips(planet) {
  if (planet.owner === game.current) return true;
  if (planet.owner === NEUTRAL) return game.options.NeutralsShowShips;
  return !game.options.BlindMap;
}
const seesStats = (planet) => planet.owner !== NEUTRAL || game.options.NeutralsShowStats;

function render() {
  if (!game) return;
  const p = viewer();
  $("turn").textContent = game.turn;
  $("who").innerHTML = "";
  if (game.over) {
    const w = game.players[game.winner];
    $("who").append(chip(w.color), `${owns(w.name)} the galaxy.`);
  } else if (!humansAlive()) {
    $("who").append("Computers playing");
  } else {
    $("who").append(chip(p.color, true), `${p.name} to move`);
  }
  $("end-turn").disabled = game.over || p.type !== "human" || waiting;
  for (const cell of $("board").querySelectorAll(".planet")) {
    const planet = planetByName(game, cell.dataset.planet);
    cell.style.setProperty("--owner", planet.owner === NEUTRAL ? "#8a8f99" : game.players[planet.owner].color);
    cell.querySelector(".ships").textContent = seesShips(planet) ? planet.ships : "";
    cell.classList.toggle("source", planet === source);
    cell.classList.toggle("target", planet === target);
  }
  renderSend();
  renderStandings();
  drawFleets();
}
// A player is a lamp in their colour (docs/STYLE.md: lamps, not fills).
const chip = (color, on = false) => Object.assign(document.createElement("span"),
  { className: on ? "yc-lamp yc-on" : "yc-lamp", style: `--lamp:${color}` });

function showTip(planet, cell) {
  const tip = $("tip");
  const rows = [["Planet", planet.name]];
  if (planet.owner !== NEUTRAL || seesStats(planet) || seesShips(planet)) {
    rows.push(["Owner", planet.owner === NEUTRAL ? "Neutral" : game.players[planet.owner].name]);
  }
  if (seesShips(planet)) rows.push(["Ships", planet.ships]);
  if (seesStats(planet)) rows.push(["Production", planet.production], ["Kill percent", planet.kill.toFixed(3)]);
  if (source && source !== planet) {
    rows.push(["From " + source.name, `${distance(source, planet).toFixed(2)} → ${travelTurns(source, planet)} turn(s)`]);
  }
  tip.innerHTML = "<dl>" + rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("") + "</dl>";
  tip.hidden = false;
  const box = cell.getBoundingClientRect(), wrap = $("board").getBoundingClientRect();
  tip.style.left = `${Math.min(box.right - wrap.left + 4, wrap.width - tip.offsetWidth)}px`;
  tip.style.top = `${box.top - wrap.top}px`;
}

// --- Orders ----------------------------------------------------------------------------------

function pick(planet) {
  if (!game || game.over || viewer().type !== "human") return;
  if (!source || (planet.owner === game.current && planet !== source && !target)) {
    if (planet.owner !== game.current) { play("error"); return; }   // not yours to send from
    source = planet; target = null;
    play("select");
  } else if (planet === source) {
    source = target = null;
    play("cancel");
  } else {
    target = planet;
    play("target");
  }
  render();
  if (target) { $("send-count").focus(); $("send-count").select(); }
}

function renderSend() {
  const form = $("send-form");
  form.hidden = !(source && target);
  $("send-hint").hidden = !form.hidden;
  if (source && !target) $("send-hint").textContent = `From ${source.name} (${source.ships} ships): pick a destination.`;
  else if (!source) $("send-hint").textContent = "Pick one of your planets, then a destination.";
  if (source && target) {
    const turns = travelTurns(source, target);
    $("send-route").textContent = `${source.name} → ${target.name}: arrives on turn ${game.turn + turns} (${turns} turn${turns > 1 ? "s" : ""}).`;
    $("send-count").max = source.ships;
    if (document.activeElement !== $("send-count")) $("send-count").value = source.ships;
  }
  const p = viewer();
  const items = [
    ...p.newFleets.map((f) => [`${f.ships} ships ${f.source} → ${f.destination}, turn ${f.arrival}`, () => cancelFleet(game, f.id)]),
    ...p.standingOrders.map((o) => [`Every turn: ${o.ships} ships ${o.source} → ${o.destination}`,
      () => { p.standingOrders = p.standingOrders.filter((x) => x !== o); }]),
  ];
  $("orders").replaceChildren(...items.map(([text, undo]) => {
    const li = document.createElement("li");
    const b = Object.assign(document.createElement("button"), { type: "button", textContent: "Cancel" });
    b.addEventListener("click", () => { undo(); play("cancel"); render(); });
    li.append(text, b);
    return li;
  }));
}

$("send-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const count = Number($("send-count").value);
  const ok = $("send-standing").checked ? addStandingOrder(game, source, target, count)
    : sendFleet(game, source, target, count);
  play(ok ? "send" : "error");
  if (ok) { target = null; if (source.ships === 0) source = null; }
  $("send-standing").checked = false;
  render();
});
function deselect() {
  if (source || target) play("cancel");
  source = target = null;
  render();
}
$("send-cancel").addEventListener("click", deselect);
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && game && !$("setup").open) deselect(); });

// --- Fleets in flight: pack ships on a canvas over the board ---------------------------------

function drawFleets() {
  const canvas = $("fleets"), board = $("board");
  const dpr = window.devicePixelRatio || 1;
  const w = board.clientWidth, h = board.clientHeight;
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const cw = w / game.cols, ch = h / game.rows;
  const centre = (planet) => [(planet.col + 0.5) * cw, (planet.row + 0.5) * ch];
  const me = game.current;
  const visible = (owner) => owner === me || !game.options.BlindMap;
  const fleets = [];
  game.players.forEach((p, owner) => {
    if (visible(owner)) fleets.push(...p.fleets.map((f) => ({ ...f, ordered: false })));
  });
  if (viewer().type === "human") fleets.push(...viewer().newFleets.map((f) => ({ ...f, ordered: true })));
  for (const f of fleets) {
    const from = planetByName(game, f.source), to = planetByName(game, f.destination);
    const [x0, y0] = centre(from), [x1, y1] = centre(to);
    const span = Math.max(1, f.arrival - f.launched);
    const t = f.ordered ? 0 : Math.min(1, (game.turn - f.launched) / span);
    const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
    const heading = (Math.atan2(x1 - x0, -(y1 - y0)) * 180 / Math.PI + 360) % 360;
    ctx.save();
    ctx.setLineDash([4, 5]);
    ctx.strokeStyle = game.players[f.owner].color;
    ctx.globalAlpha = 0.6;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.restore();
    const ship = hulls.get(f.owner);
    if (ship) {
      const frame = ship.sprite.frame_width;
      drawShip(ctx, ship, heading, x, y, Math.max(0.4, Math.min(1.5, (Math.min(cw, ch) * 0.7) / frame)));
    } else {                                   // no sprite: a marker in the owner's colour
      ctx.fillStyle = game.players[f.owner].color;
      ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.font = "600 11px ui-monospace, monospace";
    ctx.fillStyle = "#fff"; ctx.strokeStyle = "#000"; ctx.lineWidth = 3;
    const label = String(f.ships);
    ctx.strokeText(label, x + 8, y - 8); ctx.fillText(label, x + 8, y - 8);
  }
}
new ResizeObserver(() => game && drawFleets()).observe($("board"));

// "You own", "Easy owns": the default human is called You.
const owns = (name) => `${name} ${name === "You" ? "own" : "owns"}`;

// --- News and standings -----------------------------------------------------------------------

function addNews(items, first = false) {
  const list = $("news");
  const shown = items.filter((n) => n.kind !== "reinforced" || game.players[n.player].type === "human");
  if (!shown.length && !first) return;
  const turns = [...new Set(shown.map((n) => n.turn))];
  for (const turn of turns) {
    const head = Object.assign(document.createElement("li"), { className: "turnhead", textContent: `Turn ${turn}` });
    list.prepend(...[head, ...shown.filter((n) => n.turn === turn).map(newsItem)].reverse().reverse());
  }
  if (first) list.prepend(Object.assign(document.createElement("li"), { className: "turnhead",
    textContent: `A new galaxy: seed ${game.seed}. Turn 1.` }));
}

function newsItem(n) {
  const li = document.createElement("li");
  const who = game.players[n.player];
  const img = new Image(40, 40);
  img.src = hullUrl(n.player, "comm.png");
  img.alt = `${who.name}'s ${HULLS[n.player][1]}`;
  const name = (i) => i === NEUTRAL ? "the neutrals" : game.players[i].name;
  // Functions, so only the message for this kind is built (a reinforcement
  // has no defender to name).
  const text = {
    reinforced: () => `Reinforcements (${n.ships} ship${n.ships === 1 ? "" : "s"}) have arrived for planet ${n.planet}.`,
    held: () => `Planet ${n.planet} has held against an attack from ${who.name}.`,
    fell: () => `Planet ${n.planet} has fallen to ${who.name}${n.defender === NEUTRAL ? "" : `, taken from ${name(n.defender)}`}.`,
    won: () => `${owns(who.name)} the entire galaxy.`,
  }[n.kind]();
  const span = document.createElement("span");
  span.append(chip(who.color), text);
  li.append(img, span);
  return li;
}

function renderStandings() {
  $("standings").replaceChildren(...game.players.map((p, i) => {
    const tr = document.createElement("tr");
    const planets = game.planets.filter((pl) => pl.owner === i);
    const ships = planets.reduce((s, pl) => s + pl.ships, 0) + p.fleets.reduce((s, f) => s + f.ships, 0);
    const blind = game.options.BlindMap && i !== game.current;
    const td = (v) => Object.assign(document.createElement("td"), { textContent: v });
    const nameCell = document.createElement("td");
    nameCell.append(chip(p.color), p.name);
    tr.append(nameCell, td(planets.length), td(blind ? "?" : ships), td(p.stats.shipsBuilt),
      td(p.stats.planetsConquered), td(p.stats.fleetsLaunched), td(p.stats.enemyShipsDestroyed));
    if (isDead(game, i)) tr.className = "dead";
    return tr;
  }));
}

// --- Go -------------------------------------------------------------------------------------

// For play-test scripts (projects/konquest/playtest/): read-only access to the game.
globalThis.konquest = { get game() { return game; } };

const params = new URLSearchParams(location.search);
if (params.has("watch")) seats = [{ name: "Easy", type: "easy" }, { name: "Medium", type: "medium" }, { name: "Hard", type: "hard" }];
start({ players: seats.map((s) => ({ ...s })), neutralPlanets: DEFAULTS.neutralPlanets,
  rows: DEFAULTS.rows, cols: DEFAULTS.cols, options: {},
  seed: params.has("seed") ? Number(params.get("seed")) >>> 0 : (Math.random() * 2 ** 32) >>> 0 });
