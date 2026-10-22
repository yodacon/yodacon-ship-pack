// A commander for tools/drive_page.mjs: plays a whole game on ?map= (0 or 1).
// Before each wave it builds on the free square that covers the most lane,
// Gryphons first and then a rotation of the others, and spends what is left on
// upgrades; then it launches the wave and steps the game with tick().
while (!globalThis.picket || globalThis.picket.state.phase === "loading") await sleep(100);
const p = globalThis.picket, st = p.state;
const map = Number(new URLSearchParams(location.search).get("map") || 0);
if (map) { const sel = document.getElementById("map"); sel.value = String(map); sel.dispatchEvent(new Event("change")); }
const lane = p.MAPS[map].lane.flatMap(([c0, r0], i, a) => {           // points every half cell along the lane
  if (!i) return [];
  const [c1, r1] = a[i - 1], n = 2 * Math.max(Math.abs(c1 - c0), Math.abs(r1 - r0));
  return Array.from({ length: n }, (_, k) => ({ x: (c1 + ((c0 - c1) * k) / n) * 40 + 20, y: (r1 + ((r0 - r1) * k) / n) * 40 + 20 }));
});
const cover = (c, r, range) => lane.filter((q) => Math.hypot(q.x - (c * 40 + 20), q.y - (r * 40 + 20)) <= range).length;
const order = ["gryphon", "gryphon", "advisor", "citrus", "gryphon", "callisto", "advisor", "yodacon", "defender"];
let n = 0, deepest = 0;
function spend() {
  for (;;) {
    let slug = order[n % order.length];
    if (st.credits < p.pickets[slug].price) slug = "gryphon";   // can't afford the next one: a Gryphon will do
    const k = p.pickets[slug];
    if (st.credits < k.price) break;
    let best = null;
    for (let c = 0; c < 20; c++) for (let r = 0; r < 12; r++) {
      if (!p.canBuild(c, r)) continue;
      const v = cover(c, r, k.range);
      if (!best || v > best.v) best = { c, r, v };
    }
    if (!best || best.v < 4) break;
    p.build(slug, best.c, best.r);
    n++;
  }
  for (const t of [...st.towers].sort((a, b) => a.level - b.level)) if (t.level < 3 && st.credits >= Math.round(t.k.price * 0.8 * t.level) + 20) p.upgrade(t);
}
while (st.phase !== "over") {
  if (st.phase === "build") { spend(); p.launchWave(); }
  for (let i = 0; i < 30; i++) { p.tick(1); for (const m of st.raiders) deepest = Math.max(deepest, m.seg / p.MAPS[st.map].lane.length); }
  await sleep(0);
}
return `map ${st.map} (${p.MAPS[st.map].name}): ${st.hull > 0 ? "HELD" : "LOST"} at wave ${st.wave}/15, station ${st.hull}/20, ${st.kills} kills, ${st.towers.length} ships (levels ${st.towers.map((t) => t.level).join("")}), ${st.credits} cr left; deepest raider ${Math.round(deepest * 100)}% down the lane`;
