// A pilot for tools/drive_page.mjs: starts Flak with a click on the canvas,
// then each step leads the most urgent raider nobody has a shell on yet (aim
// a little off, as a person would) and fires from the nearest battery with
// rounds. Steps the game with tick(); reports how far it got. ?noise= sets
// the aiming error in px, ?stopWave=n freezes mid-wave n (for screenshots).
while (!globalThis.flak || globalThis.flak.state.phase === "loading") await sleep(100);
const g = globalThis.flak, st = g.state, c = document.getElementById("screen"), b = c.getBoundingClientRect();
c.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: b.left + b.width / 2, clientY: b.top + b.height / 2 }));
const q = new URLSearchParams(location.search), noise = Number(q.get("noise") ?? 10), stopWave = Number(q.get("stopWave") ?? Infinity);
let steps = 0, cool = 0, fired = 0;
const claimed = new Map();                                        // raider -> time its shell bursts
while (st.phase !== "over" && st.wave <= 15 && steps < 60 * 60 * 30) {
  if (st.phase === "play" && (cool -= 1 / 60) <= 0) {
    const urgent = st.raiders.filter((r) => !(claimed.get(r) > st.t)).sort((a, z) => (a.goal.y - a.y) / a.vy - (z.goal.y - z.y) / z.vy);
    for (const r of urgent) {
      const bat = st.batteries.filter((x) => x.alive && x.ammo > 0).sort((a, z) => Math.abs(a.x - r.x) - Math.abs(z.x - r.x))[0];
      if (!bat) break;
      const speed = bat.x === 400 ? g.SHELL_FAST : g.SHELL;
      let x = r.x, y = r.y, t = 0;
      for (let i = 0; i < 3; i++) { t = Math.hypot(x - bat.x, y - bat.y) / speed + 0.2; x = r.x + r.vx * t; y = r.y + r.vy * t; }
      if (y > g.GROUND - 40 || y < 10) continue;
      g.fire(x + (Math.random() - 0.5) * 2 * noise, y + (Math.random() - 0.5) * 2 * noise, st.batteries.indexOf(bat));
      for (const o of st.raiders) if (Math.hypot(o.x + o.vx * t - x, o.y + o.vy * t - y) < g.BURST * 0.7) claimed.set(o, st.t + t + 0.3);
      fired++; cool = 0.12;
      break;
    }
  }
  g.tick(1); steps++;
  if (st.wave >= stopWave && st.raiders.length >= 6 && st.bursts.length >= 2 && st.shells.length) { st.phase = "frozen"; return `frozen in wave ${st.wave} for a screenshot`; }
  if (steps % 300 === 0) await sleep(0);
}
return `noise ${noise}: ${st.phase === "over" ? "fleet lost" : "still holding"} in wave ${st.wave}, ${st.score} points, ${fired} rounds, ` +
  `afloat ${st.fleet.filter((f) => f.alive).length}/6, lost ${JSON.stringify(st.lost)}, ${Math.round(steps / 60)} s`;
