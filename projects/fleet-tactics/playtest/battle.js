// A tactician for tools/drive_page.mjs: plays six full games through the
// page. Drafts the most hull and firepower per credit by clicking cards,
// presses Battle, and on each of its turns clicks a target: something it
// can finish off, else the enemy with the most firepower.
const out = [];
const cards = (row) => [...document.querySelectorAll(`#${row} .card`)];
const num = (b, sym) => Number(b.textContent.match(new RegExp(`${sym} (\\d+)`))[1]);
let wins = 0;
for (let game = 1; game <= 6; game++) {
  const byValue = tactics.offer.map((c, i) => ({ c, i })).sort((a, b) => (b.c.maxHp + 1.4 * b.c.atk) / b.c.cost - (a.c.maxHp + 1.4 * a.c.atk) / a.c.cost);
  for (const { i } of byValue) { cards("mine")[i].click(); await sleep(20); }   // unaffordable clicks are refused
  const chosen = tactics.mine.length || cards("mine").filter((b) => b.classList.contains("picked")).length;
  document.getElementById("go").click();
  let turns = 0;
  for (let k = 0; k < 600 && tactics.phase === "battle"; k++) {
    const targets = cards("enemy").filter((b) => b.classList.contains("targetable"));
    if (targets.length) {
      const atk = tactics.active.atk;
      const kill = targets.filter((b) => num(b, "♦") <= atk).sort((a, b) => num(b, "✸") - num(a, "✸"))[0];
      (kill ?? targets.sort((a, b) => num(b, "✸") - num(a, "✸"))[0]).click(); turns++;
    }
    await sleep(120);
  }
  const result = document.getElementById("phase").textContent;
  if (result === "Victory") wins++;
  out.push(`game ${game}: drafted ${chosen}, ${turns} of my turns, ${result}`);
  document.getElementById("again").click();
  await sleep(300);
}
out.push(`won ${wins} of 6`);
return out.join("\n");
