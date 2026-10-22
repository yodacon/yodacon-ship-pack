// A pilot for tools/drive_page.mjs: starts with Enter, then several times a
// second tries five steering settings, flies each ahead in its head (hold the
// turn, then straight), throws out any that meet a mine, the edge or the
// formation, and of the rest takes the one that ends nearest the stranded
// ship. Steers through state.steer and steps the game with tick().
// With nothing safe it phases, if it has a charge. ?mode=drift plays Drift.
// ?stopAt=n freezes the game once n ships are in line (for screenshots).
while (!globalThis.formation || globalThis.formation.state.phase === "loading") await sleep(100);
const g = globalThis.formation, st = g.state, rad = (d) => (d * Math.PI) / 180;
const q = new URLSearchParams(location.search), mode = q.get("mode"), games = Number(q.get("games") ?? 3), stopAt = Number(q.get("stopAt") ?? Infinity), out = [];
if (mode) { const m = document.getElementById("mode"); m.value = mode; m.dispatchEvent(new Event("change")); }
dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" })); dispatchEvent(new KeyboardEvent("keyup", { key: "Enter" }));
function plan() {
  const me = st.me, p = st.pickup, body = st.tail.slice(2);
  let best = null;
  for (const s of [-1, -0.5, 0, 0.5, 1]) for (const hold of [0.25, 0.6, 1.0]) {
    let x = me.x, y = me.y, h = me.heading, ok = true, near = Infinity, t = 0;
    for (; t < hold + 0.7; t += 1 / 30) {
      if (t < hold) h += s * 190 / 30;
      x += Math.sin(rad(h)) * me.speed / 30; y -= Math.cos(rad(h)) * me.speed / 30;
      if (x < g.EDGE + 8 || x > g.W - g.EDGE - 8 || y < g.EDGE + 8 || y > g.H - g.EDGE - 8) { ok = false; break; }
      if (st.mines.some((m) => Math.hypot(m.x - x, m.y - y) < 24)) { ok = false; break; }
      if (t > 0.15 && body.some((f) => Math.hypot(f.x - x, f.y - y) < g.SIZE * 0.75)) { ok = false; break; }
      near = Math.min(near, Math.hypot(p.x - x, p.y - y));
    }
    const score = (ok ? 1e6 : t * 1000) - near - Math.abs(s) * 3;
    if (!best || score > best.score) best = { s, score };
  }
  if (best.score < 1e5 && st.charges > 0 && !(st.phased > 0)) g.phase();   // nothing safe: phase through it
  return best.s;
}
for (let n = 0; n < games; n++) {
  if (n) g.newGame();
  let steps = 0;
  while (st.phase === "play" && steps < 60 * 60 * 6) {
    if (steps % 4 === 0) st.steer = plan();
    g.tick(1); steps++;
    if (st.tail.length >= stopAt) { st.phase = "frozen"; return `stopped at ${st.tail.length} ships for a screenshot`; }
    if (steps % 300 === 0) await sleep(0);
  }
  out.push(`${st.tail.length} ships, ${st.score} points, ${Math.round(steps / 60)} s (${st.phase === "over" ? st.cause : "time"})`);
}
return out.join("; ");
