// Spec Sheet: Top Trumps on the 1997 records. Twelve cards, six each; whoever
// has the turn picks a line from their top card, and the higher number takes
// both cards (a tie leaves them in the middle for the next winner). The
// winner picks next. Twice a game you can scan the computer's card before
// you choose. On Admiral the computer looks at yours.
import { loadShipMeta } from "../../lib/yodacon-ship-pack.js";
import { play as sound, isMuted, setMuted } from "../../lib/yodacon-sound.js";

// No sound until the visitor has touched the page: the computer may have the
// first call, and browsers refuse audio before a gesture.
let touched = false;
for (const ev of ["pointerdown", "keydown"]) addEventListener(ev, () => { touched = true; }, { once: true, capture: true });
const play = (name) => { if (touched) sound(name); };

const $ = (id) => document.getElementById(id);
const SAVE = "spec-sheet-v1", ROUNDS = 30, SCANS = 2, SHOW_MS = 1500;

// The deck: twelve designs, the Large Pin the only Pin, and the 1998 Yodacon.
const DECK = [["conex", "yodacon"], ["conex", "dart"], ["conex", "necromancer"], ["conex", "tomaquad"], ["conex", "defender"],
  ["conex", "gryphon"], ["conex", "trident"], ["conex", "large-pin"], ["override", "callisto"], ["override", "yodacon"],
  ["konex", "advisor"], ["konex", "citrus"]];
// konex has no 1997 record for its two ships: these sit in the same ranges.
const KONEX = {
  advisor: { Speed: 380, Accel: 600, Maneuver: 4, Shield: 350, Armor: 150, Holds: 40, Crew: 6, WeapCount: [2, 0, 0, 0], Cost: 1500000 },
  citrus: { Speed: 420, Accel: 650, Maneuver: 5, Shield: 180, Armor: 120, Holds: 30, Crew: 3, WeapCount: [2, 0, 0, 0], Cost: 800000 },
};
const LINES = [
  { key: "Speed", label: "Speed" }, { key: "Accel", label: "Acceleration" }, { key: "Maneuver", label: "Maneuver" },
  { key: "Shield", label: "Shield" }, { key: "Armor", label: "Armour" }, { key: "Holds", label: "Cargo (t)" },
  { key: "Crew", label: "Crew" }, { key: "Guns", label: "Guns" }, { key: "Cost", label: "Price (cr)" },
];

const state = { phase: "loading", level: "normal", you: [], them: [], pot: [], turn: "you", round: 0, scans: SCANS, scanned: false,
  pickedLine: null, result: null, fast: false, log: [] };
let cards = [], maxima = {};

function load() { try { return JSON.parse(localStorage.getItem(SAVE)) ?? {}; } catch { return {}; } }
function save(d) { try { localStorage.setItem(SAVE, JSON.stringify(d)); } catch { /* not kept */ } }

function cardOf(meta, edition, slug) {
  const st = { ...(meta.meta.stats ?? {}), ...(KONEX[slug] ?? {}) };
  const values = Object.fromEntries(LINES.map(({ key }) => [key, key === "Guns" ? (st.WeapCount ?? []).reduce((a, b) => a + Math.max(0, b), 0) : st[key] ?? 0]));
  return { id: `${edition}/${slug}`, name: edition === "override" && slug === "yodacon" ? "1998 Yodacon" : meta.name,
    source: KONEX[slug] ? "konex (numbers set by this game)" : edition === "override" ? "ConEx Override, 1998" : "ConEx, 1997",
    yard: meta.urls.yard, values };
}

// How a value ranks in the deck, 0 to 1: the computer plays its best line.
const rank = (card, key) => cards.filter((c) => c.values[key] < card.values[key]).length / (cards.length - 1);

// --- Play ----------------------------------------------------------------------------------------

function newGame() {
  const deck = [...cards].sort(() => Math.random() - 0.5);
  Object.assign(state, { phase: "choose", you: deck.slice(0, 6), them: deck.slice(6), pot: [], turn: Math.random() < 0.5 ? "you" : "them",
    round: 0, scans: SCANS, scanned: false, pickedLine: null, result: null, log: [] });
  $("banner").hidden = true;
  startRound();
}

function startRound() {
  if (!state.you.length || !state.them.length || state.round >= ROUNDS) return finish();
  state.round++;
  state.phase = "choose"; state.scanned = false; state.pickedLine = null; state.result = null;
  render();
  if (state.turn === "them") setTimeout(computerChooses, state.fast ? 0 : 700);
}

function computerChooses() {
  if (state.phase !== "choose" || state.turn !== "them") return;
  const mine = state.them[0], yours = state.you[0];
  // Admiral reads your card and takes the line it wins by most; otherwise it
  // plays the line where its own card ranks highest in the deck.
  const score = (key) => (state.level === "admiral" ? (mine.values[key] - yours.values[key]) / (maxima[key] || 1) : rank(mine, key));
  const key = LINES.map((l) => l.key).sort((a, b) => score(b) - score(a))[0];
  choose(key);
}

function choose(key) {
  if (state.phase !== "choose") return false;
  const a = state.you[0], b = state.them[0], va = a.values[key], vb = b.values[key];
  state.pickedLine = key;
  state.result = va > vb ? "you" : vb > va ? "them" : "tie";
  state.phase = "reveal";
  const label = LINES.find((l) => l.key === key).label;
  log(`${state.turn === "you" ? "You" : "They"} called ${label}: your ${a.name} ${fmt(key, va)}, their ${b.name} ${fmt(key, vb)}` +
    (state.result === "tie" ? ". A tie: both cards to the middle." : state.result === "you" ? ". Yours." : ". Theirs."));
  play(state.result === "you" ? "pickup" : state.result === "them" ? "cancel" : "select");
  render();
  setTimeout(settle, state.fast ? 0 : SHOW_MS);
  return true;
}

function settle() {
  const a = state.you.shift(), b = state.them.shift();
  if (state.result === "tie") state.pot.push(a, b);
  else {
    const winner = state[state.result];
    winner.push(a, b, ...state.pot);                      // the winner takes the middle too
    state.pot = [];
    state.turn = state.result;
  }
  startRound();
}

function scan() {
  if (state.phase !== "choose" || state.turn !== "you" || state.scans <= 0 || state.scanned) return false;
  state.scans--; state.scanned = true;
  play("target");
  render();
  return true;
}

function finish() {
  state.phase = "over";
  const you = state.you.length, them = state.them.length, won = you > them;
  const best = load(), key = state.level;
  if (won) save({ ...best, [key]: (best[key] ?? 0) + 1 });
  play(won ? "won" : you === them ? "held" : "lost");
  $("banner-title").textContent = won ? "You win the deck" : you === them ? "A draw" : "They win the deck";
  $("banner-text").textContent = `${you} cards to ${them}${state.pot.length ? `, ${state.pot.length} in the middle` : ""} after ${state.round} rounds. ` +
    `Wins on ${state.level === "admiral" ? "Admiral" : "Normal"}: ${load()[key] ?? 0}.`;
  $("banner").hidden = false;
  render();
}

const fmt = (key, v) => (key === "Cost" ? v.toLocaleString("en-US") : String(v));
function log(text) { state.log.unshift(text); state.log.length = Math.min(state.log.length, 6); }

// --- Drawing -------------------------------------------------------------------------------------

function cardEl(card, { side, faceUp, clickable }) {
  const el = document.createElement("article");
  el.className = `card ${side}${faceUp ? "" : " down"}`;
  if (!faceUp) { el.innerHTML = `<div class="back"><span>Consolidated Express</span><b>SPEC SHEET</b></div>`; return el; }
  const rows = LINES.map(({ key, label }) => {
    // Prices run from 50,000 to 133 million: their bar is on a log scale.
    const v = card.values[key], pct = Math.round(100 * (key === "Cost" ? Math.log10(Math.max(1, v)) / Math.log10(maxima[key]) : v / (maxima[key] || 1)));
    const picked = state.pickedLine === key, verdict = picked && state.result ? (state.result === "tie" ? "tie" : state.result === side ? "win" : "lose") : "";
    return `<button type="button" class="line ${picked ? `picked ${verdict}` : ""}" data-key="${key}" ${clickable ? "" : "disabled"}>` +
      `<span class="label">${label}</span><span class="bar"><i style="width:${pct}%"></i></span><span class="value">${fmt(key, v)}</span></button>`;
  }).join("");
  el.innerHTML = `<img src="${card.yard}" alt=""><h3>${card.name}</h3><p class="source">${card.source}</p><div class="lines">${rows}</div>`;
  if (clickable) for (const b of el.querySelectorAll(".line")) b.addEventListener("click", () => choose(b.dataset.key));
  return el;
}

function render() {
  const yours = state.you[0], theirs = state.them[0], reveal = state.phase === "reveal" || state.phase === "over";
  const myChoice = state.phase === "choose" && state.turn === "you";
  $("your-card").replaceChildren(yours ? cardEl(yours, { side: "you", faceUp: true, clickable: myChoice }) : document.createElement("div"));
  $("their-card").replaceChildren(theirs ? cardEl(theirs, { side: "them", faceUp: reveal || state.scanned }) : document.createElement("div"));
  $("you-count").textContent = state.you.length;
  $("them-count").textContent = state.them.length;
  $("pot").textContent = state.pot.length;
  $("round").textContent = `${state.round}/${ROUNDS}`;
  $("prompt").textContent = state.phase === "over" ? "" : myChoice ? "Your call: pick a line on your card." :
    state.phase === "choose" ? "Their call…" : state.result === "tie" ? "A tie." : state.result === "you" ? "You take it." : "They take it.";
  $("scan").disabled = !myChoice || state.scans <= 0 || state.scanned;
  $("scan").textContent = `Scan their card (${state.scans})`;
  $("log").replaceChildren(...state.log.map((t) => Object.assign(document.createElement("li"), { textContent: t })));
}

// --- Start ---------------------------------------------------------------------------------------

addEventListener("keydown", (e) => {
  if (e.target.closest?.("select")) return;
  const n = Number(e.key);
  if (n >= 1 && n <= LINES.length && state.phase === "choose" && state.turn === "you") choose(LINES[n - 1].key);
  if (e.key === "s" || e.key === "S") scan();
  if (e.key === "Enter" && state.phase === "over") newGame();
});
$("scan").onclick = scan;
$("new").onclick = newGame;
$("level").onchange = () => { state.level = $("level").value; $("level").blur(); newGame(); };
$("mute").onclick = () => { setMuted(!isMuted()); $("mute").textContent = `Sound: ${isMuted() ? "off" : "on"}`; $("mute").setAttribute("aria-pressed", String(isMuted())); };
$("mute").textContent = `Sound: ${isMuted() ? "off" : "on"}`;

const metas = await Promise.all(DECK.map(([ed, slug]) => loadShipMeta(ed, slug)));
cards = metas.map((m, i) => cardOf(m, ...DECK[i]));
for (const { key } of LINES) maxima[key] = Math.max(...cards.map((c) => c.values[key]));
// Load every shipyard picture first, so a card drawn afresh shows its picture at once.
await Promise.all(cards.map((c) => { const img = new Image(); img.src = c.yard; return img.decode().catch(() => {}); }));
newGame();
globalThis.specSheet = { state, newGame, choose, scan, rank, LINES };
