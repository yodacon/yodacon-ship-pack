// A careful human for tools/drive_page.mjs: keeps 40% of each planet's ships
// at home and attacks only where 60% clearly outnumbers the target. Plays to
// the end, then checks the ending screen and that Rematch starts a new game.
const MAX_TURNS = 250;
const board = document.getElementById("board");
const cellsOf = () => [...board.querySelectorAll(".planet")].map((c) => {
  const i = [...board.children].indexOf(c), cols = Number(board.style.getPropertyValue("--cols"));
  return { c, name: c.dataset.planet, owner: c.style.getPropertyValue("--owner"),
    ships: Number(c.querySelector(".ships").textContent || "0"), row: Math.floor(i / cols), col: i % cols };
});
const mine = cellsOf().find((x) => x.name === "A").owner;
let turns = 0;
while (turns < MAX_TURNS && $ending().hidden) {
  if (document.getElementById("end-turn").disabled) { await sleep(150); continue; }
  const cells = cellsOf();
  for (const src of cells.filter((x) => x.owner === mine)) {
    const send = Math.floor(src.ships * 0.6);
    // Neutral planets hide their ships: assume a few.
    const target = cells.filter((x) => x.owner !== mine && send > (x.ships || 4) * 1.6 + 3)
      .sort((a, b) => Math.hypot(a.row - src.row, a.col - src.col) - Math.hypot(b.row - src.row, b.col - src.col))[0];
    if (!target) continue;
    src.c.click(); target.c.click();
    document.getElementById("send-count").value = send;
    document.getElementById("send-form").requestSubmit();
  }
  document.getElementById("end-turn").click();
  turns++;
  await sleep(30);
}
function $ending() { return document.getElementById("ending"); }
const out = [`after ${turns} turns: ${document.getElementById("who").textContent}`,
  `ending shown: ${!$ending().hidden}`,
  `title: ${document.getElementById("ending-title").textContent}`,
  `text: ${document.getElementById("ending-text").textContent}`];
document.getElementById("rematch").click();
await sleep(1500);
out.push(`after rematch: turn ${document.getElementById("turn").textContent}, ending hidden: ${$ending().hidden}, ${document.getElementById("who").textContent}`);
return out.join("\n");
