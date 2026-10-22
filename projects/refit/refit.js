// Refit: a match-3 with the pack's ships. Swap two neighbours to line up
// three or more of a kind. Every ship turns on its frames to face the way it
// moves: sideways when swapped, nose down as it falls into place, nose up
// again when it settles. Four in a row leaves a Yodacon, which clears the
// 3 × 3 round it when it is swapped or caught in a blast; five in a row, an
// L or a T leaves a Large Pin (the only Pin), which clears its row and
// column. Reach the level's target within the moves.
// Once a level a scrap order clears every ship of one kind, free. From level
// 5 asteroids drift into the yard: they can't be swapped or matched, and a
// match or blast beside one breaks it.
import { loadShip, drawShip, frameRect } from "../../lib/yodacon-ship-pack.js";
import { play, isMuted, setMuted } from "../../lib/yodacon-sound.js";

const $ = (id) => document.getElementById(id);
const canvas = $("screen"), ctx = canvas.getContext("2d");
const N = 8, CELL = 64, W = N * CELL, SAVE = "refit-v1";
const TYPES = [["conex", "gryphon"], ["conex", "trident"], ["conex", "defender"], ["conex", "dart"], ["conex", "necromancer"],
  ["konex", "citrus"], ["conex", "tomaquad"], ["override", "callisto"], ["konex", "advisor"]];
// Grey hulls alike at a glance, so each kind sits on its own colour.
const COLORS = ["92 255 92", "127 233 255", "255 179 64", "255 90 70", "194 107 216", "255 233 74", "74 125 255", "255 122 217", "232 244 255"];
const SPECIALS = { bomb: ["conex", "yodacon"], pin: ["conex", "large-pin"] };
const MOVES = 25, FALL = 900, TURN = 900;                         // px/s, degrees/s

const ROCK_LEVEL = 5;
const rocksFor = (level) => (level < ROCK_LEVEL ? 0 : Math.min(9, 4 + (level - ROCK_LEVEL)));
const isRock = (t) => t?.special === "rock";
const typesFor = (level) => Math.min(TYPES.length, 5 + Math.ceil(level / 2));   // 6, 6, 7, 7, 8, 8, 9 …
const targetFor = (level) => 1000 + level * 500;

const state = { phase: "loading", scrap: "ready", level: 1, score: 0, levelScore: 0, moves: MOVES, grid: [], sel: null, cursor: { r: 0, c: 0 },
  busy: "", timer: 0, swap: null, cascade: 0, idle: 0, hint: null, sparks: [], best: 0 };
let looks = {};

function load() { try { return JSON.parse(localStorage.getItem(SAVE)) ?? {}; } catch { return {}; } }
function save(d) { try { localStorage.setItem(SAVE, JSON.stringify(d)); } catch { /* not kept */ } }

// --- The board -----------------------------------------------------------------------------------

const randType = () => Math.floor(Math.random() * typesFor(state.level));
const tile = (type, r, c, fromY = null) => ({ type, special: null, x: c * CELL, y: fromY ?? r * CELL, heading: 0, want: 0, dying: 0 });
const at = (r, c) => (r >= 0 && c >= 0 && r < N && c < N ? state.grid[r][c] : null);
const same = (a, b) => a && b && !a.special && !b.special && a.type === b.type;

function fill() {                                                // a fresh board with no lines already made
  do {
    state.grid = Array.from({ length: N }, (_, r) => Array.from({ length: N }, (_, c) => tile(0, r, c, -CELL * (N - r + 2))));
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      let t;
      do t = randType(); while ((c >= 2 && state.grid[r][c - 1].type === t && state.grid[r][c - 2].type === t) ||
                                (r >= 2 && state.grid[r - 1][c].type === t && state.grid[r - 2][c].type === t));
      state.grid[r][c].type = t;
    }
    for (let i = 0; i < rocksFor(state.level); i++) {             // the asteroid yard: never in the top row
      const t = state.grid[1 + Math.floor(Math.random() * (N - 1))][Math.floor(Math.random() * N)];
      t.special = "rock"; t.rock = Math.random() * 1000;
    }
  } while (!findMove());
  state.busy = "fall";
}

// Lines of three or more, grouped where they cross (an L or a T is one group).
function findGroups() {
  const runs = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N;) {
    let e = c + 1; while (e < N && same(at(r, c), at(r, e))) e++;
    if (e - c >= 3) runs.push(Array.from({ length: e - c }, (_, i) => [r, c + i]));
    c = e;
  }
  for (let c = 0; c < N; c++) for (let r = 0; r < N;) {
    let e = r + 1; while (e < N && same(at(r, c), at(e, c))) e++;
    if (e - r >= 3) runs.push(Array.from({ length: e - r }, (_, i) => [r + i, c]));
    r = e;
  }
  const groups = [];
  for (const run of runs) {
    const g = groups.find((x) => run.some(([r, c]) => x.cells.some(([r2, c2]) => r2 === r && c2 === c)));
    if (g) { g.runs.push(run); for (const p of run) if (!g.cells.some(([r, c]) => r === p[0] && c === p[1])) g.cells.push(p); }
    else groups.push({ runs: [run], cells: [...run] });
  }
  return groups;
}

// A swap that makes a line, or uses a special: the first found.
function findMove() {
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) for (const [dr, dc] of [[0, 1], [1, 0]]) {
    const a = at(r, c), b = at(r + dr, c + dc);
    if (!b) continue;
    if (isRock(a) || isRock(b)) continue;
    if (a.special || b.special) return { a: [r, c], b: [r + dr, c + dc] };
    swapCells([r, c], [r + dr, c + dc]);
    const ok = findGroups().length > 0;
    swapCells([r, c], [r + dr, c + dc]);
    if (ok) return { a: [r, c], b: [r + dr, c + dc] };
  }
  return null;
}
function swapCells([r1, c1], [r2, c2]) { const t = state.grid[r1][c1]; state.grid[r1][c1] = state.grid[r2][c2]; state.grid[r2][c2] = t; }

// --- Turns ---------------------------------------------------------------------------------------

function trySwap(a, b) {
  if (state.busy || state.phase !== "play" || Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) !== 1) return false;
  if (isRock(at(...a)) || isRock(at(...b))) { play("error"); state.sel = null; return false; }
  swapCells(a, b);
  state.swap = { a, b };
  state.busy = "swap"; state.sel = null; state.hint = null; state.idle = 0; state.cascade = 0;
  play("select");
  return true;
}

// After a swap lands: specials go off, lines clear, or it swaps back.
function afterSwap() {
  const { a, b } = state.swap, ta = at(...a), tb = at(...b);
  const blast = new Set(), groups = findGroups();
  for (const [p, t] of [[a, ta], [b, tb]]) if (t.special && !isRock(t)) addBlast(blast, p, t.special);
  if (!groups.length && !blast.size) {                           // nothing: back it goes
    swapCells(a, b); state.busy = "swapback"; state.swap = null; play("error");
    return;
  }
  state.moves--;
  clear(groups, blast, [a, b]);
}

function addBlast(set, [r, c], kind) {
  const k = `${r},${c}`;
  if (set.has(k)) return;
  set.add(k);
  const cells = kind === "bomb"
    ? [-1, 0, 1].flatMap((dr) => [-1, 0, 1].map((dc) => [r + dr, c + dc]))
    : [...Array.from({ length: N }, (_, i) => [r, i]), ...Array.from({ length: N }, (_, i) => [i, c])];
  for (const [r2, c2] of cells) {
    const t = at(r2, c2);
    if (!t || set.has(`${r2},${c2}`)) continue;
    if (t.special && !isRock(t)) addBlast(set, [r2, c2], t.special);   // specials set each other off
    else set.add(`${r2},${c2}`);
  }
}

function clear(groups, blast, swapped = []) {
  state.cascade++;
  const gone = new Set(blast), make = [];
  for (const g of groups) {
    const long = Math.max(...g.runs.map((run) => run.length));
    const kind = long >= 5 || g.runs.length > 1 ? "pin" : long === 4 ? "bomb" : null;
    let keep = null;
    if (kind) {                                                  // the special stays where the player moved, or mid-line
      keep = swapped.find(([r, c]) => g.cells.some(([r2, c2]) => r2 === r && c2 === c)) ?? g.runs[0][Math.floor(g.runs[0].length / 2)];
      make.push({ at: keep, kind });
    }
    for (const [r, c] of g.cells) {
      if (keep && r === keep[0] && c === keep[1]) continue;
      const t = at(r, c);
      if (t.special) addBlast(gone, [r, c], t.special); else gone.add(`${r},${c}`);
    }
  }
  for (const m of make) gone.delete(m.at.join(","));
  for (const k of [...gone]) {                                   // asteroids beside anything cleared break up
    const [r, c] = k.split(",").map(Number);
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (isRock(at(r + dr, c + dc))) gone.add(`${r + dr},${c + dc}`);
  }
  const points = gone.size * 10 * state.cascade + make.length * 50;
  state.score += points; state.levelScore += points;
  for (const k of gone) {
    const [r, c] = k.split(",").map(Number), t = at(r, c);
    if (t) { t.dying = 0.001; burst(c * CELL + CELL / 2, r * CELL + CELL / 2, 6, t.special ? "#ffb340" : "#5cff5c"); }
  }
  for (const m of make) { const t = at(...m.at); t.special = m.kind; t.heading = 180; }
  play(blast.size || make.length ? "boom" : state.cascade > 1 ? "coin" : "pickup");
  state.busy = "clear"; state.timer = 0.22;
}

// Remove the cleared ships, let the rest fall, drop new ones in from above.
function collapse() {
  for (let c = 0; c < N; c++) {
    const col = [];
    for (let r = N - 1; r >= 0; r--) { const t = state.grid[r][c]; if (!t.dying) col.push(t); }
    const missing = N - col.length;
    for (let i = 0; i < missing; i++) col.push(tile(randType(), 0, c, -CELL * (i + 1)));
    for (let i = 0; i < N; i++) state.grid[N - 1 - i][c] = col[i];
  }
  state.busy = "fall";
}

function settled() {
  const groups = findGroups();
  if (groups.length) return clear(groups, new Set());
  state.busy = "";
  if (state.levelScore >= targetFor(state.level)) return levelUp();
  if (state.moves <= 0) return gameOver();
  if (!findMove()) { banner("No moves", "Reshuffling the yard.", 1.2); fill(); }
}

// The scrap order: once a level, every ship of one kind goes at once, free.
function scrap(r, c) {
  const t = at(r, c);
  if (state.scrap !== "armed" || state.busy || state.phase !== "play" || !t || t.special) { if (t?.special) play("error"); return false; }
  const all = new Set();
  for (let r2 = 0; r2 < N; r2++) for (let c2 = 0; c2 < N; c2++) { const o = at(r2, c2); if (!o.special && o.type === t.type) all.add(`${r2},${c2}`); }
  state.scrap = "used"; state.sel = null; state.hint = null; state.cascade = 0;
  clear([], all);
  return true;
}

function levelUp() {
  state.scrap = "ready";
  const left = state.moves, bonus = left * 40;
  state.score += bonus;
  play("won");
  banner(`Level ${state.level} refitted`, `${left} moves to spare: ${bonus} bonus.${state.level + 1 > 2 && typesFor(state.level + 1) > typesFor(state.level) ? " A new hull joins the yard." : ""}`, 1.8);
  state.level++; state.levelScore = 0; state.moves = MOVES;
  fill();
  renderYard();
}

function gameOver() {
  state.phase = "over";
  const best = load(), record = state.score > (best.score ?? 0);
  if (record) save({ score: state.score, level: state.level });
  play("lost");
  banner("Out of moves", `Level ${state.level}, ${state.score.toLocaleString()} points${record ? " — your best" : best.score ? `; best ${best.score.toLocaleString()}` : ""}. Press New game to start again.`, 0);
}

// --- Update --------------------------------------------------------------------------------------

function update(dt) {
  for (const s of state.sparks) { s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt; }
  state.sparks = state.sparks.filter((s) => s.life > 0);
  if (bannerUntil && (bannerT += dt) > bannerUntil) { $("banner").hidden = true; bannerUntil = 0; }
  if (state.phase === "loading") return;
  let moving = false;
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const t = state.grid[r][c], tx = c * CELL, ty = r * CELL, dx = tx - t.x, dy = ty - t.y, d = Math.hypot(dx, dy);
    if (t.dying) { t.dying += dt; continue; }
    if (d > 0.5) {
      const step = Math.min(d, (state.busy === "fall" ? FALL : 520) * dt);
      t.x += (dx / d) * step; t.y += (dy / d) * step;
      t.want = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 90 : 270) : (dy > 0 ? 180 : 0);   // face the way it moves
      moving = true;
    } else { t.x = tx; t.y = ty; t.want = t.special ? (t.heading + 120 * dt) % 360 : 0; }
    // Turn toward what it wants, the short way round.
    const diff = ((t.want - t.heading + 540) % 360) - 180;
    t.heading = (t.heading + Math.sign(diff) * Math.min(Math.abs(diff), TURN * dt) + 360) % 360;
  }
  if (state.busy === "swap" && !moving) afterSwap();
  else if (state.busy === "swapback" && !moving) state.busy = "";
  else if (state.busy === "clear" && (state.timer -= dt) <= 0) collapse();
  else if (state.busy === "fall" && !moving) settled();
  if (!state.busy && state.phase === "play" && (state.idle += dt) > 6 && !state.hint) state.hint = findMove();
}

function burst(x, y, n, color) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = 60 * (0.3 + Math.random());
    state.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.2 + Math.random() * 0.4, max: 0.6, color });
  }
}

let bannerUntil = 0, bannerT = 0;
function banner(title, text, secs) {
  $("banner-title").textContent = title; $("banner-text").textContent = text; $("banner").hidden = false;
  bannerUntil = secs; bannerT = 0;
}

// --- Drawing -------------------------------------------------------------------------------------

function draw(now) {
  ctx.fillStyle = "#05070a"; ctx.fillRect(0, 0, W, W);
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    ctx.fillStyle = (r + c) % 2 ? "#0b1014" : "#0e151a"; ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
  }
  const pulse = 0.5 + 0.5 * Math.sin(now / 160);
  if (state.hint) for (const [r, c] of [state.hint.a, state.hint.b]) {
    ctx.strokeStyle = `rgb(255 179 64 / ${0.3 + 0.5 * pulse})`; ctx.lineWidth = 2; ctx.strokeRect(c * CELL + 3, r * CELL + 3, CELL - 6, CELL - 6); ctx.lineWidth = 1;
  }
  if (state.sel) { const [r, c] = state.sel; ctx.fillStyle = "rgb(127 233 255 / 0.15)"; ctx.fillRect(c * CELL, r * CELL, CELL, CELL); }
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, W); ctx.clip();
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const t = state.grid[r][c];
    if (isRock(t)) { drawRock(t, now); continue; }
    const look = t.special ? looks[t.special] : looks[t.type];
    let s = look.scale;
    if (t.dying) { s *= Math.max(0, 1 - t.dying / 0.22); ctx.globalAlpha = Math.max(0, 1 - t.dying / 0.22); }
    const cx = t.x + CELL / 2, cy = t.y + CELL / 2;
    if (t.special) {                                             // specials: a bright ring
      ctx.strokeStyle = `rgb(255 255 255 / ${0.5 + 0.4 * pulse})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(cx, cy, CELL * 0.43 * (t.dying ? s / look.scale : 1), 0, Math.PI * 2); ctx.stroke(); ctx.lineWidth = 1;
    } else {
      const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, CELL * 0.44);
      glow.addColorStop(0, `rgb(${COLORS[t.type]} / 0.55)`); glow.addColorStop(1, `rgb(${COLORS[t.type]} / 0.08)`);
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, CELL * 0.44 * (t.dying ? s / look.scale : 1), 0, Math.PI * 2); ctx.fill();
    }
    const spin = state.sel && state.sel[0] === r && state.sel[1] === c && !state.busy ? (now / 3) % 360 : t.heading;
    drawShip(ctx, look.ship, spin, t.x + CELL / 2, t.y + CELL / 2, s);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  if (document.activeElement === canvas) {
    const { r, c } = state.cursor;
    ctx.strokeStyle = "#e8f4ff"; ctx.strokeRect(c * CELL + 1.5, r * CELL + 1.5, CELL - 3, CELL - 3);
  }
  for (const p of state.sparks) { ctx.globalAlpha = Math.min(1, (p.life / p.max) * 1.5); ctx.fillStyle = p.color; ctx.fillRect(p.x - 1, p.y - 1, 2, 2); }
  ctx.globalAlpha = 1;
}

// An asteroid: a lumpy grey polygon, lit from the upper left, tumbling slowly.
function drawRock(t, now) {
  const cx = t.x + CELL / 2, cy = t.y + CELL / 2, k = t.dying ? Math.max(0, 1 - t.dying / 0.22) : 1, spin = now / 4000 + t.rock;
  ctx.globalAlpha = k;
  const g = ctx.createLinearGradient(cx - 20, cy - 20, cx + 20, cy + 20);
  g.addColorStop(0, "#8a8278"); g.addColorStop(0.55, "#4d4741"); g.addColorStop(1, "#1d1a17");
  ctx.fillStyle = g; ctx.strokeStyle = "#141210";
  ctx.beginPath();
  for (let j = 0; j < 9; j++) {
    const a = spin + (j / 9) * Math.PI * 2, r = CELL * 0.36 * k * (0.78 + 0.22 * Math.sin(t.rock * 7 + j * 2.3));
    j ? ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r) : ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "rgb(0 0 0 / 0.35)";
  for (let j = 0; j < 3; j++) { const a = spin + t.rock + j * 2.1; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * 8 * k, cy + Math.sin(a) * 8 * k, 2.5 * k, 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = 1;
}

function hud() {
  $("scrap").disabled = state.scrap === "used" || state.phase !== "play";
  $("scrap").textContent = state.scrap === "armed" ? "Scrap: pick a ship" : state.scrap === "used" ? "Scrap used" : "Scrap order";
  $("scrap").setAttribute("aria-pressed", String(state.scrap === "armed"));
  $("level").textContent = state.level;
  $("score").textContent = state.score.toLocaleString();
  $("moves").textContent = state.moves;
  $("target").value = Math.min(1, state.levelScore / targetFor(state.level));
  $("target-text").textContent = `${state.levelScore.toLocaleString()} / ${targetFor(state.level).toLocaleString()}`;
  $("best").textContent = (load().score ?? 0).toLocaleString();
}

function renderYard() {
  $("yard").replaceChildren(...TYPES.slice(0, typesFor(state.level)).map((_, i) => {
    const li = document.createElement("li");
    li.innerHTML = `<img src="${looks[i].ship.urls.thumb ?? looks[i].ship.urls.frames(0)}" alt="" style="box-shadow: 0 0 0 2px rgb(${COLORS[i]})"><span>${looks[i].ship.name}</span>`;
    return li;
  }));
}

// --- Input ---------------------------------------------------------------------------------------

function cellOf(e) {
  const b = canvas.getBoundingClientRect();
  const c = Math.floor(((e.clientX - b.left) / b.width) * N), r = Math.floor(((e.clientY - b.top) / b.height) * N);
  return r >= 0 && c >= 0 && r < N && c < N ? [r, c] : null;
}
let down = null;
canvas.addEventListener("pointerdown", (e) => {
  const p = cellOf(e); if (!p || state.phase !== "play") return;
  if (state.scrap === "armed") { scrap(...p); return; }
  down = { p, x: e.clientX, y: e.clientY };
  state.cursor = { r: p[0], c: p[1] };
  if (state.sel && Math.abs(state.sel[0] - p[0]) + Math.abs(state.sel[1] - p[1]) === 1) { trySwap(state.sel, p); down = null; }
  else { state.sel = state.sel && state.sel[0] === p[0] && state.sel[1] === p[1] ? null : p; if (state.sel) play("select"); }
});
canvas.addEventListener("pointerup", (e) => {                   // or drag a ship onto its neighbour
  if (!down) return;
  const dx = e.clientX - down.x, dy = e.clientY - down.y, far = canvas.getBoundingClientRect().width / N / 3;
  if (Math.max(Math.abs(dx), Math.abs(dy)) > far) {
    const [r, c] = down.p, to = Math.abs(dx) > Math.abs(dy) ? [r, c + Math.sign(dx)] : [r + Math.sign(dy), c];
    if (at(...to)) trySwap(down.p, to);
  }
  down = null;
});
canvas.addEventListener("keydown", (e) => {
  const m = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[e.key];
  if (m) {
    e.preventDefault();
    const to = [state.cursor.r + m[0], state.cursor.c + m[1]];
    if (state.sel && at(...to)) { trySwap(state.sel, to); return; }
    state.cursor = { r: Math.max(0, Math.min(N - 1, to[0])), c: Math.max(0, Math.min(N - 1, to[1])) };
  } else if (e.key === "x" || e.key === "X") {
    $("scrap").click();
  } else if (e.key === " " || e.key === "Enter") {
    e.preventDefault();
    const p = [state.cursor.r, state.cursor.c];
    if (state.scrap === "armed") { scrap(...p); return; }
    state.sel = state.sel && state.sel[0] === p[0] && state.sel[1] === p[1] ? null : p;
  }
});

function newGame() {
  Object.assign(state, { phase: "play", scrap: "ready", level: 1, score: 0, levelScore: 0, moves: MOVES, sel: null, hint: null, idle: 0, busy: "" });
  $("banner").hidden = true;
  fill();
  renderYard();
}

// --- Start ---------------------------------------------------------------------------------------

// Each hull scaled so its longer side fills most of a cell (the sprites run
// from 32 to 96 px, the hulls inside them from 24 to 87).
function extent(ship) {
  const r = frameRect(ship, 0), c = new OffscreenCanvas(r.w, r.h), g = c.getContext("2d");
  g.drawImage(ship.sheet, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
  const a = g.getImageData(0, 0, r.w, r.h).data;
  let x0 = r.w, x1 = 0, y0 = r.h, y1 = 0;
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) if (a[(y * r.w + x) * 4 + 3] > 40) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return Math.max(x1 - x0, y1 - y0) + 1;
}

const STEP = 1 / 60;
let last = performance.now(), acc = 0;
requestAnimationFrame(function frame(now) {
  acc += Math.min(0.25, (now - last) / 1000);
  last = now;
  while (acc >= STEP) { update(STEP); acc -= STEP; }
  if (state.phase !== "loading") { draw(now); hud(); }
  requestAnimationFrame(frame);
});

const wanted = [...TYPES, SPECIALS.bomb, SPECIALS.pin];
const ships = await Promise.all(wanted.map(([ed, slug]) => loadShip(ed, slug)));
ships.forEach((ship, i) => { looks[i < TYPES.length ? i : i === TYPES.length ? "bomb" : "pin"] = { ship, scale: Math.min(2.2, (CELL * 0.8) / extent(ship)) }; });
$("new").onclick = newGame;
$("scrap").onclick = () => { if (state.scrap !== "used" && state.phase === "play") { state.scrap = state.scrap === "armed" ? "ready" : "armed"; play("select"); } };
$("mute").onclick = () => { setMuted(!isMuted()); $("mute").textContent = `Sound: ${isMuted() ? "off" : "on"}`; $("mute").setAttribute("aria-pressed", String(isMuted())); };
$("mute").textContent = `Sound: ${isMuted() ? "off" : "on"}`;
newGame();
// tick(n) runs n simulation steps at once, for play-tests on slow machines.
globalThis.refit = { state, newGame, trySwap, scrap, isRock, findGroups, swapCells, at, N, CELL, targetFor,
  tick: (n = 1) => { for (let i = 0; i < n; i++) update(STEP); } };
