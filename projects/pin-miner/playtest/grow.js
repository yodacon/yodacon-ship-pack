// An idle player for tools/drive_page.mjs: starts over, then for two minutes
// buys whatever is cheapest that it can afford, through the page's buttons.
// Checks credits grow, ships fly and sell, and the save survives a reload check.
localStorage.removeItem("pin-miner-v1");
const out = [];
const start = performance.now();
let buys = 0, lastLog = 0;
while (performance.now() - start < 120000) {
  const buttons = [...document.querySelectorAll("#yard button, #upgrades button")].filter((b) => !b.disabled);
  const cheapest = buttons.sort((a, b) => Number(a.textContent.replace(/\D/g, "")) - Number(b.textContent.replace(/\D/g, "")))[0];
  if (cheapest) { cheapest.click(); buys++; }
  if (performance.now() - lastLog > 20000) {
    lastLog = performance.now();
    log(`t ${Math.round((performance.now() - start) / 1000)} s: credits ${Math.floor(pinMiner.save.credits)}, ships ${pinMiner.fleet.length}, earned ${pinMiner.save.total}, rate ${document.getElementById("rate").textContent}/min`);
  }
  await sleep(500);
}
const states = pinMiner.fleet.reduce((m, u) => (m[u.state] = (m[u.state] ?? 0) + 1, m), {});
out.push(`after 2 min: ${buys} purchases, ships ${pinMiner.fleet.length} ${JSON.stringify(pinMiner.save.owned)}, ` +
  `upgrades ${JSON.stringify(pinMiner.save.upgrades)}, total earned ${pinMiner.save.total}, ship states ${JSON.stringify(states)}`);
const kept = JSON.parse(localStorage.getItem("pin-miner-v1"));
out.push(`saved: ${kept ? `credits ${Math.floor(kept.credits)}, total ${kept.total}` : "NOTHING"}`);
return out.join("\n");
