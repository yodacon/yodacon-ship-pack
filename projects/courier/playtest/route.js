// An autopilot for tools/drive_page.mjs: flies a trade run through the page
// with key presses only. Buys Electronics at Express Yard (low), takes the
// missions that fit, flies past the jump ring, jumps to Vela, lands on Vela
// Prime (Electronics high) and sells; then flies on to deliver a mission.
const out = [];
const c = courier;
const key = (type, k) => document.dispatchEvent(new KeyboardEvent(type, { key: k, bubbles: true }));
const hold = new Set();
const press = (k, on) => { if (on && !hold.has(k)) { key("keydown", k); hold.add(k); } else if (!on && hold.has(k)) { key("keyup", k); hold.delete(k); } };
const release = () => { for (const k of [...hold]) press(k, false); };
const tap = async (k) => { key("keydown", k); key("keyup", k); await sleep(60); };
const click = (sel) => { const b = document.querySelector(sel); if (!b) throw new Error(`no ${sel}`); b.click(); };
const angleTo = (dx, dy) => (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;

// Steer to a point and arrive slowly enough to land (stop = metres short of it).
async function flyTo(tx, ty, stop, limit = 90000, done = () => false) {
  const t0 = performance.now();
  while (performance.now() - t0 < limit) {
    const me = c.me, h = c.hulls[c.state.ship];
    if (c.landedAt) return "landed";
    if (done()) { release(); return "arrived"; }
    const dx = tx - me.x, dy = ty - me.y, dist = Math.hypot(dx, dy) - stop;
    if (dist < 10 && Math.hypot(me.vx, me.vy) < c.LAND_SPEED * 0.6) { release(); return "arrived"; }
    const want = Math.min(h.speed * 0.95, Math.sqrt(2 * h.accel * 0.5 * Math.max(0, dist)));
    const d = Math.hypot(dx, dy) || 1;
    const dvx = dx / d * want - me.vx, dvy = dy / d * want - me.vy;
    const err = ((angleTo(dvx, dvy) - me.heading + 540) % 360) - 180;
    const needs = Math.hypot(dvx, dvy) > 15;
    press("ArrowLeft", needs && err < -4); press("ArrowRight", needs && err > 4);
    press("ArrowUp", needs && Math.abs(err) < 25);
    await sleep(30);
  }
  release();
  return "timeout";
}

const cr0 = c.state.credits;
out.push(`start: ${c.landedAt.name}, ${c.state.credits} credits, ${c.hulls[c.state.ship].name} (hold ${c.hulls[c.state.ship].cargo} t)`);
// Missions first, so cargo leaves them room.
click('[data-tab="missions"]');
for (let i = 2; i >= 0; i--) { const b = document.querySelector(`[data-accept="${i}"]`); if (b && c.offers[i].tons <= 4) b.click(); }
click('[data-tab="trade"]');
click('[data-buy="electronics"][data-n="max"]');
out.push(`bought ${c.state.cargo.electronics ?? 0} t electronics at ${c.price(c.landedAt, c.GOODS[3])}; missions: ${c.state.missions.map((m) => c.PLANETS[m.to].name).join(", ") || "none"}`);
click("#takeoff");
await sleep(200);
// Out past the ring, then jump.
const me = c.me, a = Math.atan2(me.y, me.x);
let r = await flyTo(Math.cos(a) * (c.JUMP_RADIUS + 400), Math.sin(a) * (c.JUMP_RADIUS + 400), 0, 90000,
  () => Math.hypot(c.me.x, c.me.y) > c.JUMP_RADIUS + 40);
out.push(`to the jump ring: ${r}, ${Math.round(Math.hypot(c.me.x, c.me.y))} out`);
document.getElementById("jump-to").value = "1";
await tap("j");
out.push(`jumped: now in ${c.SYSTEMS[c.state.system].name}, fuel ${c.state.fuel}, pirates ${c.pirates.length}`);
const prime = c.PLANETS.find((p) => p.name === "Vela Prime");
r = await flyTo(prime.x, prime.y, 96 * 0.8 + 30);
await tap("l");
out.push(`to Vela Prime: ${r}; landed on ${c.landedAt?.name ?? "nothing"}`);
if (c.landedAt) {
  const before = c.state.credits;
  click('[data-sell="electronics"][data-n="all"]');
  out.push(`sold electronics for ${c.state.credits - before}; credits ${cr0} → ${c.state.credits}`);
  // Deliver a mission if one is in this system.
  const m = c.state.missions.find((m) => c.PLANETS[m.to].system === c.state.system);
  if (m) {
    const dest = c.PLANETS[m.to], pay = m.pay, cr = c.state.credits;
    click("#takeoff"); await sleep(200);
    r = await flyTo(dest.x, dest.y, { small: 32, medium: 64, large: 96 }[dest.size] * 0.8 + 30);
    await tap("l");
    out.push(`delivery to ${dest.name}: ${r}, paid ${c.state.credits - cr} (offered ${pay})`);
  }
  click('[data-tab="shipyard"]'); click('[data-tab="services"]'); click('[data-service="fuel"]');
  out.push(`refuelled: fuel ${c.state.fuel}, credits ${c.state.credits}`);
}
return out.join("\n");
