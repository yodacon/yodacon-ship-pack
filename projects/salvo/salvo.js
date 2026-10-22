// Salvo: Battleship by the salvo rule. Each turn a side fires one shot for
// every ship it still has afloat, so losses cost firepower. Your ConEx fleet
// against an Override and konex pirate fleet; ships may not touch, not even at
// the corners. Sunk ships show their 1997 targeting picture. The computer
// keeps a probability map: every way each surviving ship could still lie,
// weighted towards the hits it hasn't finished.
import { loadShip, drawShip, frameRect } from "../../lib/yodacon-ship-pack.js";
import { play, isMuted, setMuted } from "../../lib/yodacon-sound.js";

const $ = (id) => document.getElementById(id);
const N = 10, CELL = 36, PAD = 22, SIZE = PAD + N * CELL + 2, SAVE = "salvo-v1";
const LETTERS = "ABCDEFGHIJ";

// Sizes 5-4-3-3-2-2 a side; long thin hulls get the long berths. The Large Pin
// is the only Pin.
const FLEETS = {
  you: [["conex", "dart", 5], ["conex", "tomaquad", 4], ["conex", "large-pin", 3], ["conex", "yodacon", 3], ["conex", "gryphon", 2], ["conex", "defender", 2]],
  them: [["conex", "necromancer", 5], ["conex", "trident", 4], ["override", "yodacon", 3], ["konex", "citrus", 3], ["override", "callisto", 2], ["konex", "advisor", 2]],
};
const LEVELS = { easy: { noise: 2.5, label: "Easy" }, normal: { noise: 0.25, label: "Normal" }, hard: { noise: 0, label: "Hard" } };

const state = { phase: "loading", turn: 0, level: "normal", you: null, them: null, aim: [], cursor: { x: 0, y: 0 }, selected: null,
  log: [], busy: false, winner: null };
let kinds = {};
const salvo = { fast: false };                                   // play-tests turn the reveal delays off

function load() { try { return JSON.parse(localStorage.getItem(SAVE)) ?? {}; } catch { return {}; } }
function save(d) { try { localStorage.setItem(SAVE, JSON.stringify(d)); } catch { /* not kept */ } }

// --- Boards --------------------------------------------------------------------------------------

const key = (x, y) => `${x},${y}`;
const cellsOf = (s) => Array.from({ length: s.n }, (_, i) => (s.dir === "h" ? { x: s.x + i, y: s.y } : { x: s.x, y: s.y + i }));
const inside = (x, y) => x >= 0 && y >= 0 && x < N && y < N;

function fits(board, s, ignore = null) {
  const cells = cellsOf(s);
  if (!cells.every((c) => inside(c.x, c.y))) return false;
  for (const o of board.ships) {
    if (o === ignore) continue;
    for (const c of cellsOf(o)) for (const d of cells) if (Math.abs(c.x - d.x) <= 1 && Math.abs(c.y - d.y) <= 1) return false;
  }
  return true;
}

function randomBoard(side) {
  for (;;) {                                                     // rarely needs more than one go
    const board = { side, ships: [], shots: new Map() };
    let ok = true;
    for (const [ed, slug, n] of FLEETS[side]) {
      let placed = false;
      for (let tries = 0; tries < 300 && !placed; tries++) {
        const s = { k: kinds[`${ed}/${slug}`], n, dir: Math.random() < 0.5 ? "h" : "v", x: rnd(N), y: rnd(N), hits: new Set(), sunk: false };
        if (fits(board, s)) { board.ships.push(s); placed = true; }
      }
      if (!placed) { ok = false; break; }
    }
    if (ok) return board;
  }
}
const rnd = (n) => Math.floor(Math.random() * n);
const afloat = (board) => board.ships.filter((s) => !s.sunk).length;
const unshot = (board) => N * N - board.shots.size;

// Fire at one cell: "miss", "hit" or "sunk" (and which ship).
function shoot(board, x, y) {
  const s = board.ships.find((o) => cellsOf(o).some((c) => c.x === x && c.y === y));
  if (!s) { board.shots.set(key(x, y), "miss"); return { x, y, result: "miss" }; }
  board.shots.set(key(x, y), "hit");
  s.hits.add(key(x, y));
  if (s.hits.size === s.n) { s.sunk = true; return { x, y, result: "sunk", ship: s }; }
  return { x, y, result: "hit", ship: s };
}

// --- The computer --------------------------------------------------------------------------------

// Count every placement of every surviving ship that agrees with what is
// known; cells under more placements are likelier. Placements through open
// hits count far more, so it finishes what it starts.
function heat(board) {
  const known = board.shots, sunkNear = new Set(), open = [];
  for (const s of board.ships) if (s.sunk) for (const c of cellsOf(s)) for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) sunkNear.add(key(c.x + dx, c.y + dy));
  for (const [k, v] of known) if (v === "hit" && !sunkNear.has(k)) open.push(k);
  const map = Array.from({ length: N }, () => new Float64Array(N));
  for (const s of board.ships) {
    if (s.sunk) continue;                                        // the computer knows which are gone, as you do
    for (const dir of ["h", "v"]) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const cells = cellsOf({ n: s.n, dir, x, y });
      if (!cells.every((c) => inside(c.x, c.y))) continue;
      let through = 0, bad = false;
      for (const c of cells) {
        const k = key(c.x, c.y), v = known.get(k);
        if (v === "miss" || sunkNear.has(k)) { bad = true; break; }
        if (v === "hit") through++;
      }
      if (bad) continue;
      const w = through ? 40 ** through : open.length ? 0.02 : 1;
      for (const c of cells) if (!known.has(key(c.x, c.y))) map[c.y][c.x] += w;
    }
  }
  return map;
}

function chooseSalvo(board, shots, noise) {
  const picks = [];
  for (let i = 0; i < shots; i++) {
    const map = heat(board), cand = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (board.shots.has(key(x, y)) || picks.some((p) => p.x === x && p.y === y)) continue;
      // Spread a salvo: cells next to one already picked count for less, unless chasing a hit.
      const near = picks.some((p) => Math.abs(p.x - x) + Math.abs(p.y - y) === 1);
      cand.push({ x, y, w: map[y][x] * (near && map[y][x] < 30 ? 0.4 : 1) * (1 + noise * Math.random()) + Math.random() * 1e-6 });
    }
    if (!cand.length) break;
    cand.sort((a, b) => b.w - a.w);
    const p = cand[0];
    picks.push(p);
    board.shots.set(key(p.x, p.y), "miss");                     // a placeholder, so the next pick plans round it
  }
  for (const p of picks) board.shots.delete(key(p.x, p.y));
  return picks.map(({ x, y }) => ({ x, y }));
}

// --- Turns ---------------------------------------------------------------------------------------

function newGame() {
  Object.assign(state, { phase: "place", turn: 0, aim: [], selected: null, log: [], busy: false, winner: null });
  state.you = randomBoard("you");
  state.them = randomBoard("them");
  say(`Override pirates to ConEx fleet: you are in our space. Six ships a side, ${FLEETS.you.length} shots a turn while you have them.`);
  $("sunk").hidden = true;
  $("banner").hidden = true;
  refresh();
}

const shotsFor = (board) => Math.min(afloat(board), unshot(board === state.you ? state.them : state.you));

function toggleAim(x, y) {
  if (state.busy || state.phase === "over" || state.them.shots.has(key(x, y))) return;
  if (state.phase === "place") { state.phase = "aim"; state.selected = null; }
  const i = state.aim.findIndex((p) => p.x === x && p.y === y);
  if (i >= 0) state.aim.splice(i, 1);
  else if (state.aim.length < shotsFor(state.you)) { state.aim.push({ x, y }); play("target"); }
  else play("error");
  refresh();
}

async function fire() {
  if (state.busy || state.phase === "over" || state.aim.length !== shotsFor(state.you)) return;
  state.busy = true; state.phase = "aim"; state.turn++;
  const mine = state.aim; state.aim = [];
  play("send");
  for (const p of mine) { report("you", shoot(state.them, p.x, p.y)); refresh(); await pause(140); }
  if (!afloat(state.them)) return finish("you");
  await pause(350);
  const theirs = chooseSalvo(state.you, shotsFor(state.them), LEVELS[state.level].noise);
  for (const p of theirs) { report("them", shoot(state.you, p.x, p.y)); refresh(); await pause(140); }
  if (!afloat(state.you)) return finish("them");
  state.busy = false;
  refresh();
}

function report(by, r) {
  const where = `${LETTERS[r.x]}${r.y + 1}`;
  if (r.result === "miss") { if (by === "you") play("cancel"); return; }
  play(r.result === "sunk" ? "boom" : "hit");
  if (r.result === "sunk") {
    const s = r.ship;
    log(by === "you" ? `${where}: the pirate ${s.k.name} is destroyed.` : `${where}: our ${s.k.name} is lost.`, by === "you" ? "good" : "bad");
    if (by === "you") { $("sunk-img").src = s.k.ship.urls.target; $("sunk-img").alt = `The ${s.k.name}'s targeting picture`; $("sunk-name").textContent = s.k.name; $("sunk").hidden = false; }
  } else if (by === "you") log(`${where}: hit.`, "good");
}

function finish(winner) {
  state.phase = "over"; state.winner = winner; state.busy = false;
  const best = load(), lv = state.level, record = winner === "you" && (!best[lv] || state.turn < best[lv]);
  if (record) save({ ...best, [lv]: state.turn });
  play(winner === "you" ? "won" : "lost");
  $("banner-title").textContent = winner === "you" ? "Pirates routed" : "Fleet lost";
  $("banner-text").textContent = winner === "you"
    ? `All six pirate ships destroyed in ${state.turn} turns with ${afloat(state.you)} of yours afloat${record ? " — your best on this level" : ""}.`
    : `The pirates sank all six of ours in ${state.turn} turns. ${afloat(state.them)} of theirs got away.`;
  $("banner").hidden = false;
  for (const s of state.them.ships) s.shown = true;              // show where the rest were
  refresh();
}

const pause = (ms) => (salvo.fast ? null : new Promise((r) => setTimeout(r, ms)));
function say(text) { $("hail").textContent = text; }
function log(text, tone) { state.log.unshift({ text, tone }); state.log.length = Math.min(state.log.length, 8); }

// --- Placing your fleet --------------------------------------------------------------------------

function pickOwn(x, y) {
  if (state.phase !== "place") return;
  const at = state.you.ships.find((s) => cellsOf(s).some((c) => c.x === x && c.y === y));
  const sel = state.selected;
  if (at && at === sel) {                                        // click it again: turn it
    const turned = { ...sel, dir: sel.dir === "h" ? "v" : "h" };
    if (fits(state.you, turned, sel)) { sel.dir = turned.dir; play("select"); } else play("error");
  } else if (at) { state.selected = at; play("select"); }
  else if (sel) {                                                // empty water: move it there
    const moved = { ...sel, x, y };
    if (fits(state.you, moved, sel)) { sel.x = x; sel.y = y; play("select"); } else play("error");
  }
  refresh();
}

// --- Drawing -------------------------------------------------------------------------------------

function drawBoard(canvas, board, own) {
  // The boards only redraw when something happens, so keep them in memory:
  // a GPU canvas left idle in a hidden page can come back blank.
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#03060a"; ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.font = "700 11px 'Courier New', monospace"; ctx.fillStyle = "#2f9b34"; ctx.textAlign = "center";
  for (let i = 0; i < N; i++) { ctx.fillText(LETTERS[i], PAD + i * CELL + CELL / 2, 15); ctx.fillText(String(i + 1), 11, PAD + i * CELL + CELL / 2 + 4); }
  ctx.strokeStyle = "rgb(92 255 92 / 0.12)";
  for (let i = 0; i <= N; i++) {
    ctx.beginPath(); ctx.moveTo(PAD + i * CELL + 0.5, PAD); ctx.lineTo(PAD + i * CELL + 0.5, PAD + N * CELL); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(PAD, PAD + i * CELL + 0.5); ctx.lineTo(PAD + N * CELL, PAD + i * CELL + 0.5); ctx.stroke();
  }
  for (const s of board.ships) if (own || s.sunk || s.shown) drawHull(ctx, s, own && s === state.selected);
  for (const [k, v] of board.shots) {
    const [x, y] = k.split(",").map(Number), cx = PAD + x * CELL + CELL / 2, cy = PAD + y * CELL + CELL / 2;
    if (v === "miss") { ctx.strokeStyle = "rgb(127 233 255 / 0.4)"; ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.stroke(); }
    else {
      ctx.fillStyle = "rgb(255 122 89 / 0.85)"; ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ffe3a0"; ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill();
    }
  }
  if (!own) {
    for (const p of state.aim) {                                 // your salvo, waiting
      const cx = PAD + p.x * CELL + CELL / 2, cy = PAD + p.y * CELL + CELL / 2;
      ctx.strokeStyle = "#ffb340"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, 11, 0, Math.PI * 2); ctx.moveTo(cx - 15, cy); ctx.lineTo(cx + 15, cy); ctx.moveTo(cx, cy - 15); ctx.lineTo(cx, cy + 15); ctx.stroke();
      ctx.lineWidth = 1;
    }
    if (document.activeElement === canvas) {
      ctx.strokeStyle = "#e8f4ff"; ctx.strokeRect(PAD + state.cursor.x * CELL + 1.5, PAD + state.cursor.y * CELL + 1.5, CELL - 3, CELL - 3);
    }
  }
}

// The berth, then the sprite on frame 0 (bow north) or 9 (bow east), as big
// as fits the berth without spilling more than half a cell either side.
function drawHull(ctx, s, chosen) {
  const cells = cellsOf(s), a = cells[0], b = cells[cells.length - 1];
  const x0 = PAD + a.x * CELL + 3, y0 = PAD + a.y * CELL + 3, x1 = PAD + (b.x + 1) * CELL - 3, y1 = PAD + (b.y + 1) * CELL - 3;
  ctx.fillStyle = s.sunk ? "rgb(255 42 26 / 0.12)" : "rgb(127 233 255 / 0.07)";
  ctx.strokeStyle = chosen ? "#ffb340" : s.sunk ? "rgb(255 42 26 / 0.5)" : "rgb(127 233 255 / 0.35)";
  ctx.beginPath(); ctx.roundRect(x0, y0, x1 - x0, y1 - y0, 8); ctx.fill(); ctx.stroke();
  const k = s.k, span = s.n * CELL - 6;
  const scale = Math.min(3.5, span / k.len, (CELL * 1.7) / k.wid);
  ctx.globalAlpha = s.sunk ? 0.45 : 1;
  drawShip(ctx, k.ship, s.dir === "h" ? 90 : 0, (x0 + x1) / 2, (y0 + y1) / 2, scale);
  ctx.globalAlpha = 1;
}

function refresh() {
  if (state.phase === "loading") return;
  drawBoard($("theirs"), state.them, false);
  drawBoard($("yours"), state.you, true);
  const need = shotsFor(state.you);
  $("turn").textContent = state.turn;
  $("afloat-you").textContent = `${afloat(state.you)}/6`;
  $("afloat-them").textContent = `${afloat(state.them)}/6`;
  $("fire").disabled = state.busy || state.phase === "over" || state.aim.length !== need;
  $("fire").textContent = state.phase === "over" ? "Fire salvo" : `Fire salvo (${state.aim.length}/${need})`;
  $("shuffle").disabled = state.phase !== "place";
  $("place-hint").hidden = state.phase !== "place";
  $("log").replaceChildren(...state.log.map((l) => Object.assign(document.createElement("li"), { textContent: l.text, className: l.tone })));
  const best = load()[state.level];
  $("best").textContent = best ? `${best} turns` : "–";
  for (const [side, list] of [["you", "fleet-you"], ["them", "fleet-them"]]) {
    $(list).replaceChildren(...state[side].ships.map((s) => {
      const li = document.createElement("li");
      li.className = s.sunk ? "sunk" : "";
      li.textContent = `${s.k.name} (${s.n})${s.sunk ? " — sunk" : side === "you" && s.hits.size ? ` — ${s.hits.size} hit${s.hits.size > 1 ? "s" : ""}` : ""}`;
      return li;
    }));
  }
}

// --- Input ---------------------------------------------------------------------------------------

function cellAt(canvas, e) {
  const b = canvas.getBoundingClientRect(), s = SIZE / b.width;
  const x = Math.floor(((e.clientX - b.left) * s - PAD) / CELL), y = Math.floor(((e.clientY - b.top) * s - PAD) / CELL);
  return inside(x, y) ? { x, y } : null;
}
$("theirs").addEventListener("click", (e) => { const c = cellAt($("theirs"), e); if (c) { state.cursor = c; toggleAim(c.x, c.y); } });
$("yours").addEventListener("click", (e) => { const c = cellAt($("yours"), e); if (c) pickOwn(c.x, c.y); });
$("theirs").addEventListener("keydown", (e) => {
  const m = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
  if (m) { e.preventDefault(); state.cursor = { x: Math.max(0, Math.min(N - 1, state.cursor.x + m[0])), y: Math.max(0, Math.min(N - 1, state.cursor.y + m[1])) }; refresh(); }
  else if (e.key === " ") { e.preventDefault(); toggleAim(state.cursor.x, state.cursor.y); }
  else if (e.key === "Enter") { e.preventDefault(); fire(); }
});
for (const ev of ["focus", "blur"]) $("theirs").addEventListener(ev, refresh);
document.addEventListener("visibilitychange", refresh);
$("fire").onclick = fire;
$("shuffle").onclick = () => { if (state.phase === "place") { state.you = randomBoard("you"); state.selected = null; refresh(); } };
$("new").onclick = newGame;
$("level").onchange = () => { state.level = $("level").value; newGame(); };
$("mute").onclick = () => { setMuted(!isMuted()); $("mute").textContent = `Sound: ${isMuted() ? "off" : "on"}`; $("mute").setAttribute("aria-pressed", String(isMuted())); };
$("mute").textContent = `Sound: ${isMuted() ? "off" : "on"}`;

// --- Start ---------------------------------------------------------------------------------------

// Each hull's length and beam on frame 0, from its alpha, to size it to its berth.
function measure(ship) {
  const r = frameRect(ship, 0), c = new OffscreenCanvas(r.w, r.h), g = c.getContext("2d");
  g.drawImage(ship.sheet, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
  const a = g.getImageData(0, 0, r.w, r.h).data;
  let x0 = r.w, x1 = 0, y0 = r.h, y1 = 0;
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) if (a[(y * r.w + x) * 4 + 3] > 40) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return { len: y1 - y0 + 1, wid: x1 - x0 + 1 };
}
for (const id of ["theirs", "yours"]) { $(id).width = SIZE; $(id).height = SIZE; }
const all = [...FLEETS.you, ...FLEETS.them];
const loaded = await Promise.all(all.map(([ed, slug]) => loadShip(ed, slug)));
all.forEach(([ed, slug], i) => { const ship = loaded[i]; kinds[`${ed}/${slug}`] = { ship, name: ship.name, ...measure(ship) }; });
$("captain").src = loaded[all.findIndex(([ed, slug]) => ed === "override" && slug === "yodacon")].urls.comm;
newGame();
globalThis.salvo = Object.assign(salvo, { state, newGame, refresh, toggleAim, fire, chooseSalvo, shotsFor, afloat, LEVELS });
