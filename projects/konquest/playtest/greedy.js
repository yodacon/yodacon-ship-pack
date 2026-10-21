// A greedy human for tools/drive_page.mjs: every turn, each planet of ours
// with ships sends them all at the nearest planet it outnumbers. Plays until
// someone owns the galaxy or MAX_TURNS pass, reading only what the page shows.
const MAX_TURNS = 150;
const board = document.getElementById("board");
const cellsOf = () => [...board.querySelectorAll(".planet")].map((c) => {
  const i = [...board.children].indexOf(c), cols = Number(board.style.getPropertyValue("--cols"));
  return { c, name: c.dataset.planet, owner: c.style.getPropertyValue("--owner"),
    ships: Number(c.querySelector(".ships").textContent || "0"), row: Math.floor(i / cols), col: i % cols };
});
const mine = cellsOf().find((x) => x.name === "A").owner;
let turnsPlayed = 0;
for (let step = 0; step < 4000; step++) {
  const who = document.getElementById("who").textContent;
  if (/owns? the galaxy/.test(who)) return `END after ${turnsPlayed} human turns, turn ${document.getElementById("turn").textContent}: ${who}`;
  if (turnsPlayed >= MAX_TURNS) return `stopped at turn ${document.getElementById("turn").textContent}: ${who}`;
  if (document.getElementById("end-turn").disabled) { await sleep(200); continue; }
  const cells = cellsOf();
  for (const src of cells.filter((x) => x.owner === mine && x.ships > 5)) {
    const target = cells.filter((x) => x.owner !== mine && x.ships < src.ships - 2)
      .sort((a, b) => Math.hypot(a.row - src.row, a.col - src.col) - Math.hypot(b.row - src.row, b.col - src.col))[0];
    if (!target) continue;
    src.c.click(); target.c.click();
    document.getElementById("send-count").value = src.ships;
    document.getElementById("send-form").requestSubmit();
  }
  const t0 = performance.now();
  document.getElementById("end-turn").click();
  turnsPlayed++;
  if (performance.now() - t0 > 1000) log(`slow end turn: ${Math.round(performance.now() - t0)} ms`);
  await sleep(30);
}
return "ran out of steps";
