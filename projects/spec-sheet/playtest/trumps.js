// A player for tools/drive_page.mjs: plays ?games= games (default 20) of Spec
// Sheet at ?level= (default normal) with the delays off, calling the line its
// card ranks best on in the deck, as the Normal computer does, and scanning
// when its best line ranks below 0.8. Plays the first call by clicking
// the card. Reports wins.
while (!globalThis.specSheet || globalThis.specSheet.state.phase === "loading") await sleep(100);
const g = globalThis.specSheet, st = g.state, q = new URLSearchParams(location.search);
const games = Number(q.get("games") ?? 20), level = q.get("level") ?? "normal";
const sel = document.getElementById("level"); sel.value = level; sel.dispatchEvent(new Event("change"));
st.fast = true;
let wins = 0, draws = 0, rounds = 0, scans = 0, clicked = false;
for (let n = 0; n < games; n++) {
  g.newGame();
  for (let k = 0; k < 200 && st.phase !== "over"; k++) {
    if (st.phase === "choose" && st.turn === "you") {
      const card = st.you[0], ranked = g.LINES.map((l) => l.key).sort((a, b) => g.rank(card, b) - g.rank(card, a));
      if (g.rank(card, ranked[0]) < 0.8 && st.scans > 0 && g.scan()) {
        scans++;
        const theirs = st.them[0];
        ranked.sort((a, b) => (card.values[b] - theirs.values[b]) / (Math.abs(theirs.values[b]) + 1) - (card.values[a] - theirs.values[a]) / (Math.abs(theirs.values[a]) + 1));
      }
      if (!clicked) { document.querySelector(`#your-card .line[data-key="${ranked[0]}"]`).click(); clicked = true; }
      else g.choose(ranked[0]);
    }
    await sleep(0);
  }
  rounds += st.round;
  if (st.you.length > st.them.length) wins++; else if (st.you.length === st.them.length) draws++;
}
return `${level}: won ${wins}, drew ${draws}, lost ${games - wins - draws} of ${games}; ${(rounds / games).toFixed(1)} rounds a game; ${scans} scans; first call by click ${clicked}`;
