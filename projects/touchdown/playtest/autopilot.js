// An autopilot for tools/drive_page.mjs: flies Touchdown with ?hull=0–10.
// It picks the pad worth most for the distance, holds height over the ground
// until it is above it, then comes down with a speed that shrinks with height;
// the thrust is pointed along the acceleration it wants (gravity and wind
// included), tilted no more than 45°, upright for the last stretch. Retro
// rockets when falling too fast too low. Steps with tick(); reports each
// landing and crash. ?stopWorld=N freezes on world N, low over the pad.
while (!globalThis.touchdown || globalThis.touchdown.state.phase === "loading") await sleep(100);
const g = globalThis.touchdown, st = g.state, q = new URLSearchParams(location.search);
const stopWorld = Number(q.get("stopWorld") ?? 0), maxLandings = Number(q.get("landings") ?? 10);
g.newGame(Number(q.get("hull") ?? 0));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), deg = (r) => (r * 180) / Math.PI;
let pad = null;
function pilot() {
  const me = st.me, k = me.k, w = g.WORLDS[st.world], grav = g.gravity();
  let tx, ty, ux = 0, uy = 0;
  if (st.carrier) { const c = st.carrier, d = g.deck; tx = c.x + (d.padFrom + d.padTo) / 2; ty = c.y + d.padY; ux = c.vx; uy = c.vy; }
  else {
    if (!pad || !st.pads.includes(pad)) pad = [...st.pads].sort((a, b) => b.mult / (1 + Math.abs((b.x0 + b.x1) / 2 - me.x) / 250) - a.mult / (1 + Math.abs((a.x0 + a.x1) / 2 - me.x) / 250))[0];
    tx = (pad.x0 + pad.x1) / 2; ty = pad.y;
  }
  const dx = tx - me.x, alt = ty - (me.y + 11), over = Math.abs(dx) < (st.carrier ? 18 : Math.max(6, (pad.x1 - pad.x0) / 2 - 10));
  const across = over ? 0 : clamp(dx * 0.5, -70, 70);
  let down = alt > 160 ? 50 : alt > 70 ? 28 : alt > 25 ? 16 : 9;
  if (!over) down = alt > 120 ? 10 : -15;                        // stay up until over the pad
  // Keep 45 px above any ground between here and the pad.
  if (!st.carrier) {
    const lo = Math.min(me.x, tx) - 30, hi = Math.max(me.x, tx) + 30;
    let ridge = Infinity; for (let x = lo; x <= hi; x += 8) ridge = Math.min(ridge, g.groundAt(x));
    if (!over && me.y + 11 > ridge - 45) down = -40;
  }
  const ax = (across + ux - me.vx) * 1.6 - st.wind, ay = (down + uy - me.vy) * 1.6;
  const Tx = ax, Ty = ay - grav;
  let want = deg(Math.atan2(Tx, -Ty));
  want = clamp(want, -45, 45);
  if (alt < 30 && over) want = 0;
  const diff = ((want - me.heading + 540) % 360) - 180;
  const c = { turn: Math.abs(diff) > 4 ? Math.sign(diff) : 0, thrust: Math.abs(diff) < 25 && -Ty > 0 && Math.hypot(Tx, Ty) > k.thrust * 0.45, retro: false };
  if (alt < 70 && me.vy - uy > 75 && st.retros > 0) c.retro = true;
  return c;
}
let steps = 0, events = [], last = st.phase;
while (st.phase !== "over" && st.landings < maxLandings && steps < 60 * 60 * 15) {
  if (st.phase === "fly") st.auto = pilot();
  g.tick(1); steps++;
  if (st.phase !== last) {
    if (st.phase === "landed") events.push(`${g.WORLDS[st.world].name}: landed`);
    if (st.phase === "crashed") events.push(`${g.WORLDS[st.world].name}: ${st.lastCrash}`);
    last = st.phase;
  }
  if (stopWorld && st.world + 1 === stopWorld && st.phase === "fly" && document.getElementById("banner").hidden) {
    const me = st.me, ty = st.carrier ? st.carrier.y + g.deck.padY : pad?.y;
    if (ty && ty - me.y < 110 && me.thrust) { st.phase = "frozen"; return `frozen over world ${stopWorld}`; }
  }
  if (steps % 600 === 0) await sleep(0);
}
return `${st.me.k.name}: ${st.landings} landings, ${st.score} points, ${st.phase}, ${Math.round(steps / 60)} s\n${events.join("\n")}`;
