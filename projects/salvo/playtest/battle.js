// A pilot for tools/drive_page.mjs: plays ?games= games (default 20) of Salvo
// at ?level= (default normal) with the reveal delays off, picking its salvo
// with the computer's own probability map at the same level, and reports
// wins and turns. Then plays one more by clicking the board, to check input.
while (!globalThis.salvo || globalThis.salvo.state.phase === "loading") await sleep(100);
const g = globalThis.salvo, st = g.state, q = new URLSearchParams(location.search);
const games = Number(q.get("games") ?? 20), level = q.get("level") ?? "normal";
document.getElementById("level").value = level; st.level = level;
g.fast = true;
let wins = 0, turns = [];
for (let i = 0; i < games; i++) {
  g.newGame();
  while (st.phase !== "over") {
    for (const p of g.chooseSalvo(st.them, g.shotsFor(st.you), g.LEVELS[level].noise)) g.toggleAim(p.x, p.y);
    await g.fire();
  }
  if (st.winner === "you") wins++;
  turns.push(st.turn);
  if (i % 5 === 4) await sleep(0);
}
// One game by mouse: click the pirate board where the map says, and press Fire.
g.fast = false; g.newGame();
const c = document.getElementById("theirs"), b = c.getBoundingClientRect(), s = b.width / c.width;
for (const p of g.chooseSalvo(st.them, g.shotsFor(st.you), 0))
  c.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: b.left + (22 + p.x * 36 + 18) * s, clientY: b.top + (22 + p.y * 36 + 18) * s }));
const aimed = st.aim.length;
document.getElementById("fire").click();
await sleep(2500);
return `${level}: the map player won ${wins}/${games} against the computer, turns ${Math.min(...turns)}–${Math.max(...turns)} (mean ${(turns.reduce((a, b) => a + b, 0) / games).toFixed(1)}); ` +
  `clicked salvo aimed ${aimed}, after firing turn ${st.turn}, shots on pirates ${st.them.shots.size}, on us ${st.you.shots.size}; log: ${st.log.map((l) => l.text).join(" | ")}`;
