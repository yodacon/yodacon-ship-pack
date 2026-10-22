// A rider for tools/drive_page.mjs: plays Wake with ?hull=0–5 using the rivals'
// own reckoning (most open room, a deep look) and the jump when boxed in,
// stepping the game with tick(). Plays ?games=N games (default 3) and
// reports the arena each one ended in. ?stopArena=N freezes the first game
// mid-round in that arena, for a screenshot.
while (!globalThis.wake || globalThis.wake.state.phase === "loading") await sleep(100);
const g = globalThis.wake, st = g.state, q = new URLSearchParams(location.search);
const pick = Number(q.get("hull") ?? 0), games = Number(q.get("games") ?? 3), stopArena = Number(q.get("stopArena") ?? 0);
const deep = { ...g.ARENAS[4], look: 3000, bold: 0, jumps: true };
const results = [], outs = [];
for (let n = 0; n < games; n++) {
  g.newGame(pick);
  st.auto = (me) => g.think(me, deep);
  let steps = 0;
  while (st.phase !== "over" && steps < 60 * 60 * 20) {
    const lives = st.lives; g.tick(1); steps++;
    if (st.lives < lives) outs.push(`${st.arena + 1}: ${st.riders[0].out}`);
    if (stopArena && st.arena + 1 >= stopArena && st.phase === "play" && st.riders.filter((r) => r.alive).length === 4 && st.riders[0].cells > 60) {
      st.phase = "frozen";
      return `frozen in arena ${st.arena + 1}`;
    }
    if (steps % 600 === 0) await sleep(0);
  }
  results.push(`${st.phase === "over" ? "" : "still going in "}arena ${st.arena + 1} (into ${st.riders[0].out ?? "nothing"})${document.getElementById("banner-title").textContent === "Champion" ? " (champion)" : ""}, ${st.score} pts`);
}
return `${st.riders[0].name}: ${results.join("; ")}\nlives lost — ${outs.join(" · ")}`;
