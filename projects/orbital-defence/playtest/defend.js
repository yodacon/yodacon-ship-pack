// A defending player for tools/drive_page.mjs: buys Defenders and repairs
// between waves, launches waves, and fires at the nearest enemy, until the
// planet falls or WAVES waves are held. Reports how far it got.
const WAVES = 6;
const g = () => orbital.game;
let shots = 0, lastWave = 0;
const until = performance.now() + 150000;   // a time budget, so a long run still reports
while (performance.now() < until) {
  if (g().over) break;
  if (g().wave !== lastWave) { lastWave = g().wave; log(`wave ${lastWave}: hp ${Math.round(g().hp)}, defenders ${g().defenders.length}, credits ${g().credits}`); }
  if (g().phase === "build") {
    if (g().wave >= WAVES) break;
    while (g().credits >= 50 && g().defenders.length < 6) orbital.buyDefender();
    while (g().credits >= 30 && g().hp < 90) orbital.repair();
    document.getElementById("launch").click();     // through the page, as a player would
  }
  const e = [...g().enemies].sort((a, b) => Math.hypot(a.x - 380, a.y - 280) - Math.hypot(b.x - 380, b.y - 280))[0];
  if (e) { orbital.fireAt(e.x, e.y); shots++; }
  await sleep(30);
}
return `waves held: ${g().phase === "build" ? g().wave : g().wave - 1}, over: ${g().over}, hp ${Math.round(g().hp)}, ` +
  `defenders ${g().defenders.length}, score ${g().score}, credits ${g().credits}, player shots ${shots}`;
