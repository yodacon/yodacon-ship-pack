// A pilot for tools/drive_page.mjs: plays Rockfall with ?hull=0–6 (default 0,
// the Gryphon). It turns to lead the nearest target and fires when lined up;
// if a rock will come within reach in the next half second it turns away and
// thrusts, and if one is about to hit it jumps to hyperspace. Flies through
// state.auto and steps the game with tick(); reports how far it got.
while (!globalThis.rockfall || globalThis.rockfall.state.phase === "loading") await sleep(100);
const g = globalThis.rockfall, st = g.state, deg = (r) => (r * 180) / Math.PI;
const pick = Number(new URLSearchParams(location.search).get("hull") ?? 0);
const stopWave = Number(new URLSearchParams(location.search).get("stopWave") ?? Infinity);
g.newGame(pick);
const wrapD = (d, span) => { d = ((d % span) + span) % span; return d > span / 2 ? d - span : d; };
const rel = (o, me, t = 0) => ({ x: wrapD(o.x + o.vx * t - me.x - me.vx * t, g.W), y: wrapD(o.y + o.vy * t - me.y - me.vy * t, g.H) });
let steps = 0, jumps = 0;
while (st.phase !== "over" && steps < 60 * 60 * 12) {
  const me = st.me;
  if (st.phase === "play" && me.alive) {
    const c = { turn: 0, thrust: false, fire: false };
    let danger = null, soonest = Infinity;
    for (const r of st.rocks) for (const t of [0.15, 0.3, 0.5]) {
      const p = rel(r, me, t);
      if (Math.hypot(p.x, p.y) < r.r + me.k.radius + 14 && t < soonest) { soonest = t; danger = r; }
    }
    if (danger && soonest <= 0.15 && me.safe <= 0 && st.jumps > 0) { g.hyperspace(); jumps++; }
    const targets = [...st.rocks, ...(st.raider ? [st.raider] : [])];
    let aim = null, best = Infinity;
    for (const o of targets) {
      const p = rel(o, me), d = Math.hypot(p.x, p.y), t = d / g.BOLT, q = rel(o, me, t);
      if (d < best) { best = d; aim = q; }
    }
    if (danger) {                                          // turn away from it and thrust
      const p = rel(danger, me, soonest), away = deg(Math.atan2(-p.x, p.y));
      const diff = ((away - me.heading + 540) % 360) - 180;
      c.turn = Math.sign(diff); c.thrust = Math.abs(diff) < 60;
    } else if (aim) {
      const want = deg(Math.atan2(aim.x, -aim.y)), diff = ((want - me.heading + 540) % 360) - 180;
      c.turn = Math.abs(diff) > 3 ? Math.sign(diff) : 0;
      c.thrust = best > 260 && Math.abs(diff) < 20 && Math.hypot(me.vx, me.vy) < 80;
    }
    if (aim) { const want = deg(Math.atan2(aim.x, -aim.y)); c.fire = Math.abs(((want - me.heading + 540) % 360) - 180) < 9; }
    st.auto = c;
  }
  g.tick(1); steps++;
  if (st.wave >= stopWave && st.rocks.length > 8 && st.phase === "play" && document.getElementById("banner").hidden && st.me.alive && st.me.safe <= 0 && (st.raider || st.wave > stopWave)) { st.phase = "frozen"; return `frozen in wave ${st.wave}`; }
  if (steps % 300 === 0) await sleep(0);
}
return `${st.me.k.name}: ${st.phase === "over" ? "game over" : "still flying"} in wave ${st.wave}, ${st.score} points, ${Math.round(steps / 60)} s, ${jumps} jumps, deaths ${JSON.stringify(st.deaths)}`;
