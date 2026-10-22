// Recall: a memory game with the pack's pictures. Each ship is a pair of
// cards showing two of its pictures; turn two at a time and match them.
// Easy pairs the spinning sprite with the shipyard picture, Normal the
// shipyard picture with the 1997 targeting picture, Hard the comm portrait
// with the targeting picture. Names appear only once a pair is matched, so the
// pictures have to be recognised (screen readers hear the name at once). No canvas: buttons, images and <yodacon-ship>.
// Expert deals each ship three times, sprite, shipyard and targeting
// picture, and you turn all three to match. A sensor scan, once a deal,
// shows every card for a second.
import { loadShipMeta } from "../../lib/yodacon-ship-pack.js";
import { play, isMuted, setMuted } from "../../lib/yodacon-sound.js";

const $ = (id) => document.getElementById(id);
const SAVE = "recall-v1", SHOW_MS = 900;

// Eleven designs; the three Pins are one hull at three sizes, so only the
// Large Pin is dealt.
const SHIPS = [["conex", "yodacon"], ["conex", "dart"], ["conex", "necromancer"], ["conex", "tomaquad"],
  ["conex", "defender"], ["conex", "gryphon"], ["conex", "trident"], ["conex", "large-pin"],
  ["override", "callisto"], ["konex", "advisor"], ["konex", "citrus"]];
const LEVELS = {
  easy: { label: "Easy", pairs: 6, faces: ["sprite", "yard"], hint: "the ship to its shipyard picture" },
  normal: { label: "Normal", pairs: 8, faces: ["yard", "target"], hint: "the shipyard picture to the 1997 targeting picture" },
  hard: { label: "Hard", pairs: 11, faces: ["comm", "target"], hint: "the comm portrait to the targeting picture" },
  expert: { label: "Expert", pairs: 8, faces: ["sprite", "yard", "target"], hint: "each ship three times: sprite, shipyard and targeting picture" },
};
const FACE_NAME = { sprite: "sprite", yard: "shipyard picture", target: "targeting picture", comm: "comm portrait" };

const state = { scan: true, level: "easy", cards: [], open: [], matched: 0, moves: 0, start: 0, timer: 0, busy: false, done: false };
let ships = [];

function load() { try { return JSON.parse(localStorage.getItem(SAVE)) ?? {}; } catch { return {}; } }
function save(d) { try { localStorage.setItem(SAVE, JSON.stringify(d)); } catch { /* not kept */ } }

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// --- Dealing -------------------------------------------------------------------------------------

function face(ship, kind) {
  if (kind === "sprite") {
    const el = document.createElement("yodacon-ship");
    el.setAttribute("edition", ship.edition);
    el.setAttribute("ship", ship.slug);
    el.setAttribute("scale", ship.sprite.frame_width > 48 ? "1" : "2");
    el.setAttribute("spin", "");
    return el;
  }
  return Object.assign(document.createElement("img"), { src: ship.urls[kind], alt: "", loading: "eager" });
}

function deal() {
  const lv = LEVELS[state.level];
  const picked = shuffle([...ships]).slice(0, lv.pairs);
  state.cards = shuffle(picked.flatMap((ship) => lv.faces.map((kind) => ({ ship, kind }))));
  Object.assign(state, { open: [], matched: 0, moves: 0, start: 0, busy: false, done: false, scan: true });
  clearInterval(state.timer);
  $("board").className = `board pairs-${lv.pairs}${lv.faces.length === 3 ? " sets" : ""}`;
  $("board").replaceChildren(...state.cards.map((card, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "card";
    b.dataset.i = i;
    b.setAttribute("aria-label", `Card ${i + 1}, face down`);
    const front = document.createElement("span");
    front.className = `front ${card.kind}`;
    front.append(face(card.ship, card.kind), Object.assign(document.createElement("span"), { className: "label", textContent: card.ship.name }));
    b.append(Object.assign(document.createElement("span"), { className: "back", ariaHidden: "true" }), front);
    b.addEventListener("click", () => turn(i));
    card.el = b;
    return b;
  }));
  $("hint").textContent = `Match ${lv.hint}. ${lv.pairs} ${lv.faces.length === 3 ? "sets" : "pairs"}.`;
  $("scan").disabled = false;
  $("banner").hidden = true;
  readouts();
}

// --- Play ----------------------------------------------------------------------------------------

function turn(i) {
  const card = state.cards[i];
  if (state.busy || state.done || card.matched || state.open.includes(card)) return;
  if (!state.start) { state.start = performance.now(); state.timer = setInterval(readouts, 250); }
  reveal(card, true);
  state.open.push(card);
  play("select");
  const size = LEVELS[state.level].faces.length, ship = state.open[0].ship;
  if (state.open.every((c) => c.ship === ship)) {
    if (state.open.length < size) return;                      // a pair so far on Expert: turn the third
    state.moves++;
    for (const c of state.open) { c.matched = true; c.el.classList.add("matched"); c.el.setAttribute("aria-label", `${c.ship.name}, ${FACE_NAME[c.kind]}, matched`); }
    state.open = [];
    state.matched++;
    play("pickup");
    if (state.matched === LEVELS[state.level].pairs) finish();
  } else {
    state.moves++;
    state.busy = true;
    play("cancel");
    const wrong = [...state.open];
    setTimeout(() => { for (const c of wrong) reveal(c, false); state.open = []; state.busy = false; }, SHOW_MS);
  }
  readouts();
}

// The sensor scan: once a deal, every face-down card shows for a second.
function scan() {
  if (!state.scan || state.busy || state.done) return false;
  state.scan = false; state.busy = true;
  $("scan").disabled = true;
  if (!state.start) { state.start = performance.now(); state.timer = setInterval(readouts, 250); }
  const down = state.cards.filter((c) => !c.matched && !state.open.includes(c));
  for (const c of down) c.el.classList.add("up");
  play("target");
  setTimeout(() => { for (const c of down) c.el.classList.remove("up"); state.busy = false; }, 1000);
  return true;
}

function reveal(card, up) {
  card.el.classList.toggle("up", up);
  const i = state.cards.indexOf(card);
  card.el.setAttribute("aria-label", up ? `Card ${i + 1}: ${card.ship.name}, ${FACE_NAME[card.kind]}` : `Card ${i + 1}, face down`);
}

const seconds = () => (state.start ? (performance.now() - state.start) / 1000 : 0);
function readouts() {
  $("moves").textContent = state.moves;
  $("pairs").textContent = `${state.matched}/${LEVELS[state.level].pairs}`;
  $("time").textContent = `${Math.floor(seconds())} s`;
  const best = load()[state.level];
  $("best").textContent = best ? `${best.moves} moves, ${best.time} s` : "–";
}

function finish() {
  state.done = true;
  clearInterval(state.timer);
  const time = Math.round(seconds()), lv = LEVELS[state.level], perfect = state.moves === lv.pairs && state.scan;
  const best = load(), old = best[state.level];
  const record = !old || state.moves < old.moves || (state.moves === old.moves && time < old.time);
  if (record) save({ ...best, [state.level]: { moves: state.moves, time } });
  setTimeout(() => {
    play("won");
    $("banner-title").textContent = perfect ? "Perfect recall" : "All matched";
    $("banner-text").textContent = `${lv.pairs} ${lv.faces.length === 3 ? "sets" : "pairs"} in ${state.moves} moves and ${time} s${record ? " — your best on this level" : ""}.`;
    $("banner").hidden = false;
    readouts();
  }, 400);
}

// --- Start ---------------------------------------------------------------------------------------

for (const b of document.querySelectorAll("[data-level]")) {
  b.addEventListener("click", () => {
    state.level = b.dataset.level;
    for (const o of document.querySelectorAll("[data-level]")) o.setAttribute("aria-pressed", String(o === b));
    deal();
  });
}
$("again").addEventListener("click", () => deal());
$("scan").addEventListener("click", () => scan());
$("deal").addEventListener("click", () => deal());
$("mute").onclick = () => { setMuted(!isMuted()); $("mute").textContent = `Sound: ${isMuted() ? "off" : "on"}`; $("mute").setAttribute("aria-pressed", String(isMuted())); };
$("mute").textContent = `Sound: ${isMuted() ? "off" : "on"}`;

ships = await Promise.all(SHIPS.map(([ed, slug]) => loadShipMeta(ed, slug)));
deal();
globalThis.recall = { state, deal, turn, scan, LEVELS, SHOW_MS };
