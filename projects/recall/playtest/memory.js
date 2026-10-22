// A player with perfect memory for tools/drive_page.mjs: plays every level by
// clicking the cards, remembering each one it has seen, and reports the moves.
// It knows a card by its label, which the page hides until a match, so it
// tests the rules, not recognition. With perfect memory n pairs take about
// 1.5n–1.7n moves. On Expert it turns sets of three, after trying the scan
// (every card up for a second, once a deal).
while (!globalThis.recall?.state.cards.length) await sleep(100);
const r = globalThis.recall, st = r.state, out = [];
let scanned = 0, scanAgain = null;
const cards = () => [...document.querySelectorAll("#board .card")];
const nameOf = (el) => el.querySelector(".label").textContent;
for (const level of ["easy", "normal", "hard", "expert"]) {
  document.querySelector(`[data-level="${level}"]`).click();
  await sleep(50);
  const size = r.LEVELS[level].faces.length;              // 2, or 3 on Expert
  if (level === "expert") {                               // the scan: every card up for a second, once
    document.getElementById("scan").click();
    scanned = cards().filter((el) => el.classList.contains("up")).length;
    await sleep(1150);
    scanAgain = r.scan();
  }
  const seen = new Map();                                 // card index -> ship name
  const click = async (i) => { cards()[i].click(); seen.set(i, nameOf(cards()[i])); await sleep(30); };
  while (!st.done) {
    const left = cards().map((el, i) => i).filter((i) => !cards()[i].classList.contains("matched"));
    const known = left.filter((i) => seen.has(i));
    // A whole set known? Turn it.
    const set = known.map((i) => known.filter((j) => seen.get(j) === seen.get(i))).find((g) => g.length === size);
    if (set) { for (const i of set) await click(i); continue; }
    // Otherwise turn an unseen card, then its known partners, then unseen ones, until it matches or misses.
    const fresh = left.filter((i) => !seen.has(i));
    const first = fresh.shift(), turned = [first];
    await click(first);
    while (turned.length < size) {
      const name = seen.get(first);
      const partner = known.find((j) => seen.get(j) === name && !turned.includes(j));
      const next = partner ?? fresh.shift();
      turned.push(next);
      await click(next);
      if (seen.get(next) !== name) break;
    }
    if (!cards()[first].classList.contains("matched")) await sleep(r.SHOW_MS + 100);
  }
  out.push(`${level}: ${st.matched} ${size === 3 ? "sets" : "pairs"} in ${st.moves} moves`);
  await sleep(600);
}
return out.join(" | ") + ` | scan showed ${scanned} cards, second scan allowed ${scanAgain}`;
