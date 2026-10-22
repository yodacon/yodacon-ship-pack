// A player with perfect memory for tools/drive_page.mjs: plays every level by
// clicking the cards, remembering each one it has seen, and reports the moves.
// It knows a card by its label, which the page hides until a match, so it
// tests the rules, not recognition. With perfect memory n pairs take about
// 1.5n–1.7n moves.
while (!globalThis.recall?.state.cards.length) await sleep(100);
const r = globalThis.recall, st = r.state, out = [];
const cards = () => [...document.querySelectorAll("#board .card")];
const nameOf = (el) => el.querySelector(".label").textContent;
for (const level of ["easy", "normal", "hard"]) {
  document.querySelector(`[data-level="${level}"]`).click();
  await sleep(50);
  const seen = new Map();                                 // card index -> ship name
  const click = async (i) => { cards()[i].click(); seen.set(i, nameOf(cards()[i])); await sleep(30); };
  while (!st.done) {
    const left = cards().map((el, i) => i).filter((i) => !cards()[i].classList.contains("matched"));
    // A known pair? Turn it.
    const known = left.filter((i) => seen.has(i));
    const pair = known.flatMap((i) => known.filter((j) => j > i && seen.get(j) === seen.get(i)).map((j) => [i, j]))[0];
    if (pair) { await click(pair[0]); await click(pair[1]); continue; }
    // Otherwise turn an unseen card, then its partner if known, else another unseen one.
    const fresh = left.filter((i) => !seen.has(i));
    await click(fresh[0]);
    const partner = known.find((j) => seen.get(j) === seen.get(fresh[0]));
    await click(partner ?? fresh[1]);
    if (!cards()[fresh[0]].classList.contains("matched")) await sleep(r.SHOW_MS + 100);
  }
  out.push(`${level}: ${st.matched} pairs in ${st.moves} moves`);
  await sleep(600);
}
return out.join(" | ");
