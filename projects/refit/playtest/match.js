// A pilot for tools/drive_page.mjs: plays ?games= games (default 3) of Refit.
// Each move it tries every swap on a copy of the board's types, scores what
// it would clear at once (specials count for their blast), and plays the
// best, by mouse drag for the first move of a game and by trySwap after.
// Late in a level, with eight moves left, it scraps the commonest kind.
// Steps the game with tick(); reports the level reached and points.
// ?stopAfter=n stops after n moves with a ship picked (for screenshots).
while (!globalThis.refit || globalThis.refit.state.phase === "loading") await sleep(100);
const g = globalThis.refit, st = g.state, N = g.N, games = Number(new URLSearchParams(location.search).get("games") ?? 3);
const c = document.getElementById("screen"), stopAfter = Number(new URLSearchParams(location.search).get("stopAfter") ?? Infinity);
let played = 0, scraps = 0;
function best() {
  let top = null;
  for (let r = 0; r < N; r++) for (let col = 0; col < N; col++) for (const [dr, dc] of [[0, 1], [1, 0]]) {
    const a = [r, col], b = [r + dr, col + dc];
    if (!g.at(...b)) continue;
    const ta = g.at(...a), tb = g.at(...b);
    if (g.isRock(ta) || g.isRock(tb)) continue;
    let v = (ta.special === "pin" ? 15 : ta.special ? 9 : 0) + (tb.special === "pin" ? 15 : tb.special ? 9 : 0);
    g.swapCells(a, b);
    for (const grp of g.findGroups()) v += grp.cells.length + (grp.runs.length > 1 || grp.cells.length >= 5 ? 8 : grp.cells.length === 4 ? 4 : 0);
    g.swapCells(a, b);
    v += r / N;                                                   // lower moves stir up more cascades
    if (v > 0 && (!top || v > top.v)) top = { a, b, v };
  }
  return top;
}
const out = [];
for (let n = 0; n < games; n++) {
  g.newGame();
  let first = true, steps = 0;
  while (st.phase === "play" && steps < 60 * 60 * 40) {
    if (!st.busy) {
      if (st.scrap === "ready" && st.moves <= 8 && st.levelScore < g.targetFor(st.level)) {   // late in a level: scrap the commonest kind
        const count = {}; let top = null;
        for (let r = 0; r < N; r++) for (let col = 0; col < N; col++) { const t = g.at(r, col); if (!t.special) { count[t.type] = (count[t.type] ?? 0) + 1; if (!top || count[t.type] > count[top.type]) top = { r, col, type: t.type }; } }
        document.getElementById("scrap").click(); g.scrap(top.r, top.col); scraps++;
        g.tick(2); steps += 2; continue;
      }
      const m = best();
      if (m && first) {                                           // drag, as a person would
        const box = c.getBoundingClientRect(), cell = box.width / N;
        const pt = ([r, col]) => ({ clientX: box.left + (col + 0.5) * cell, clientY: box.top + (r + 0.5) * cell });
        c.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, ...pt(m.a) }));
        c.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, ...pt(m.b) }));
        first = false;
      } else if (m) g.trySwap(m.a, m.b);
      if (m && ++played >= stopAfter) { g.tick(120); st.sel = m.a; return `stopped after ${played} moves for a screenshot`; }
    }
    g.tick(2); steps += 2;
    if (steps % 600 === 0) await sleep(0);
  }
  const rocks = st.grid.flat().filter(g.isRock).length;
  out.push(`level ${st.level}, ${st.score} points, ${scraps} scraps, ${rocks} rocks left (${st.levelScore}/${g.targetFor(st.level)} on the last)`);
}
return out.join("; ");
