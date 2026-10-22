// A pilot for tools/drive_page.mjs: picks a hull (HULL below), then flies
// player one with key presses only, aiming ahead of the nearest enemy, until
// it is champion, gives up after MAX_RETRIES, or runs out of time. When its
// shields are nearly gone it overcharges them (Shift), once a round.
const HULL = new URLSearchParams(location.search).get("hull") || "yodacon";
const MAX_RETRIES = 30, MAX_SECONDS = 1500;   // of fighting, in game time
while (!globalThis.gauntlet) await sleep(100);
const g = globalThis.gauntlet, st = g.state;
const press = (key, on) => dispatchEvent(new KeyboardEvent(on ? "keydown" : "keyup", { key }));
const down = new Set();
const set = (key, on) => { if (on !== down.has(key)) { press(key, on); on ? down.add(key) : down.delete(key); } };
const deg = (r) => (r * 180) / Math.PI;

g.choose(HULL);
let lastRound = -1, steps = 0;
while (st.time < MAX_SECONDS) {
  if (st.phase === "champion") break;
  if (st.retries > MAX_RETRIES) break;
  if (st.phase !== "fight") {
    for (const k of [...down]) set(k, false);
    if (st.phase === "lost") log(`  lost to the ${st.ladder[st.round].name} (retry ${st.retries})`);
    if (st.phase === "intro" && st.round !== lastRound) { log(`round ${st.round + 1}: ${st.ladder[st.round].name}`); lastRound = st.round; }
    g.advance();
    await sleep(0);
    continue;
  }
  const me = st.ships.find((s) => s.side === "you" && s.player === 0);
  const foes = st.ships.filter((s) => s.alive && s.side === "them");
  if (!me?.alive || !foes.length) { g.tick(2); await sleep(0); continue; }
  const f = foes.reduce((a, b) => (Math.hypot(a.x - me.x, a.y - me.y) < Math.hypot(b.x - me.x, b.y - me.y) ? a : b));
  const d = Math.hypot(f.x - me.x, f.y - me.y), lead = d / g.BOLT_SPEED;
  const ax = f.x + (f.vx - me.vx) * lead, ay = f.y + (f.vy - me.vy) * lead;
  let want = deg(Math.atan2(ax - me.x, -(ay - me.y)));
  const tooClose = d < 120;
  if (tooClose) want += 160;
  const diff = ((want - me.heading + 540) % 360) - 180;
  set("ArrowLeft", diff < -5);
  set("ArrowRight", diff > 5);
  set("ArrowUp", Math.abs(diff) < 40 && (d > 220 || tooClose));
  set(" ", !tooClose && Math.abs(diff) < 12 && d < 450);
  if (me.overcharge && me.shield < me.hull.shieldMax * 0.15) { press("Shift", true); press("Shift", false); }   // shields nearly gone: overcharge
  g.tick(2);                                       // two 1/60 s steps per decision
  if (++steps % 40 === 0) await sleep(0);
}
for (const k of [...down]) set(k, false);
return `${HULL}: ${st.phase === "champion" ? "CHAMPION" : `stopped in round ${st.round + 1} (${st.ladder[st.round]?.name})`} after ${Math.round(st.time)} s of fighting, ${st.retries} retries`;
