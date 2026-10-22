// A pilot for tools/drive_page.mjs: flies every level with the arrow keys.
// It steers by wanted velocity (turn to the change it needs, then burn the
// main engine or the retro), heads for a point behind the carrier's stern
// where the carrier will be pointing by the time it gets there, goes round
// the carrier rather than through it, then turns onto the carrier's frame and
// sits still in the wedge until the beam takes it. Steps the game with tick().
while (!globalThis.dock || globalThis.dock.state.phase === "loading") await sleep(100);
const g = globalThis.dock, st = g.state, C = g.CARRIER;
const rad = (d) => (d * Math.PI) / 180, deg = (r) => (r * 180) / Math.PI;
const wrap = (a) => ((((a + 180) % 360) + 360) % 360) - 180;
const down = new Set();
const set = (key, on) => { if (on !== down.has(key)) { dispatchEvent(new KeyboardEvent(on ? "keydown" : "keyup", { key })); on ? down.add(key) : down.delete(key); } };
const release = () => { for (const k of [...down]) set(k, false); };

function steer(face, burn) {                       // turn toward a heading; burn "up", "down" or nothing
  const me = st.me, err = wrap(face - me.heading), slack = me.k.turn / 60 * 2.5;
  set("ArrowLeft", err < -slack); set("ArrowRight", err > slack);
  set("ArrowUp", burn === "up"); set("ArrowDown", burn === "down");
}

function fly() {
  const me = st.me, k = me.k, p = { x: me.x, y: me.y };
  const dist0 = Math.hypot(p.x - C.x, p.y - C.y);
  // Where the carrier will point when we arrive.
  const eta = Math.max(1, dist0 / 45);
  const ahead = Math.floor(((st.heading + st.spin * eta) % 360) / 10) * 10, u = { x: Math.sin(rad(ahead)), y: -Math.cos(rad(ahead)) };
  const l = g.local(me.x, me.y), speed = Math.hypot(me.vx, me.vy);
  if (g.inWedge(l) && -l.along < g.BAY + 150) {                   // final: on the frame, slow, wait for the beam
    const face = g.carrierFrame() * 10, va = me.vx * Math.sin(rad(face)) - me.vy * Math.cos(rad(face));
    const aligned = Math.abs(wrap(face - me.heading)) < 8;
    steer(face, aligned && speed > 18 ? (va > 0 ? "down" : "up") : null);
    return "final";
  }
  let target = { x: C.x - u.x * (g.BAY + 95), y: C.y - u.y * (g.BAY + 95) };
  // Go round, not through: if the carrier is in the way, aim for a point on a
  // ring 170 out, 50° on toward the target.
  const ap = Math.atan2(p.x - C.x, -(p.y - C.y)), at = Math.atan2(target.x - C.x, -(target.y - C.y));
  const gap = wrap(deg(at - ap));
  if (Math.abs(gap) > 55) {
    const a = ap + rad(Math.sign(gap) * 50);
    target = { x: C.x + Math.sin(a) * 175, y: C.y - Math.cos(a) * 175 };
  }
  for (const m of st.mines) {                                     // shy away from mines close by
    const q = g.minePos(m), d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d < 80) { target.x = p.x + (p.x - q.x) * 3; target.y = p.y + (p.y - q.y) * 3; }
  }
  const dx = target.x - p.x, dy = target.y - p.y, d = Math.hypot(dx, dy);
  const want = Math.min(45, k.top * 0.8, Math.sqrt(2 * k.retro * 0.7 * d) + 2);
  const vd = { x: (dx / (d || 1)) * want, y: (dy / (d || 1)) * want };
  if (d < 25) { vd.x = vd.y = 0; }
  const dvx = vd.x - me.vx, dvy = vd.y - me.vy, dv = Math.hypot(dvx, dvy);
  if (dv < 10) { steer(d < 40 ? g.carrierFrame() * 10 : deg(Math.atan2(dvx, -dvy)), null); return "coast"; }
  const hd = deg(Math.atan2(dvx, -dvy)), ef = Math.abs(wrap(hd - me.heading)), er = Math.abs(wrap(hd + 180 - me.heading));
  if (ef <= er + 40) steer(hd, ef < 12 ? "up" : null); else steer(hd + 180, er < 12 ? "down" : null);
  return "approach";
}

const results = [];
for (let level = 0; level < g.LEVELS.length; level++) {
  let tries = 0, done = false;
  while (!done && tries < 3) {
    tries++;
    g.start(level);
    let steps = 0;
    while (st.phase === "play" || st.phase === "pull") {
      if (st.phase === "play") fly(); else release();
      g.tick(2); steps += 2;
      if (steps > 60 * 150) break;                                 // 150 s of game time
      if (steps % 120 === 0) await sleep(0);
    }
    release();
    const me = st.me;
    if (st.phase === "docked") {
      done = true;
      results.push(`${level + 1} ${me.k.name}: docked ${"★".repeat(st.stars)} in ${Math.round(st.t)} s, ${Math.round((me.fuel / me.k.fuel) * 100)}% fuel, ${st.bumps} bumps (try ${tries})`);
    } else if (tries === 3) results.push(`${level + 1} ${me.k.name}: FAILED (${st.phase}, ${Math.round(st.t)} s, fuel ${Math.round(me.fuel)}, hull ${st.hull}, "${st.message}")`);
  }
}
return results.join("\n");
