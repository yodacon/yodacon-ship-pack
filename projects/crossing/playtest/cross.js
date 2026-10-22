// A pilot for tools/drive_page.mjs: plays Crossing with ?pilot=0|1|2 (Gryphon,
// Defender, Trident). Before each hop it checks the cell it would land on
// against where every ship will be over the hop and a little after; it hops up
// when that is safe, sidesteps when where it stands is about to be hit, and
// only hops into the bays when lined up with an empty one. Steps with tick().
while (!globalThis.crossing || globalThis.crossing.state.phase === "loading") await sleep(100);
const g = globalThis.crossing, st = g.state, C = g.CELL;
const pilot = Number(new URLSearchParams(location.search).get("pilot") ?? 0);
g.newGame(pilot);
const RIDE = (r) => r >= 1 && r <= 5, ROAD = (r) => r >= 7 && r <= 11;

function trafficClear(row, x, until) {
  for (let t = 0; t <= until; t += 0.05) if (g.under(row, x, t, 16)) return false;
  return true;
}
function rideFor(row, x, hop, ahead = 1.2) {                    // a freighter under x when we land, that keeps us in bounds a while
  const s = g.under(row, x, hop, -8);
  if (!s) return false;
  for (let t = hop; t < hop + 1.6; t += 0.2) if (!g.under(row, x + s.lane.dir * s.lane.speed * (t - hop), t, -4)) return false;   // not one about to jump away
  const nx = x + s.lane.dir * s.lane.speed * ahead;
  return nx > 30 && nx < 594;
}
// On the top lane the freighter only carries you one way: board it upstream of an empty bay.
function reachable(x, hop) {
  const s = g.under(1, x, hop, -8);
  return s && g.BAYS.some((b, i) => !st.bays[i] && (b - x) * s.lane.dir >= -8);
}
function safe(row, x, hop, staying) {
  if (x < C / 2 - 1 || x > 624 - C / 2 + 1 || row > 12) return false;
  if (row === 0) return g.BAYS.some((b, i) => !st.bays[i] && Math.abs(b - x) < g.BAY_HALF - 5);
  if (ROAD(row)) return trafficClear(row, x, (staying ? 0 : hop) + hop + 0.3);
  if (row === 1 && !reachable(x, staying ? 0 : hop)) return false;
  if (RIDE(row)) return staying ? rideFor(row, x, 0, row === 1 ? 1.2 : 2.2) : rideFor(row, x, hop);
  return true;
}

let steps = 0, was = "play";
const log2 = [];
while (st.phase !== "over" && steps < 60 * 60 * 15) {
  const me = st.me;
  if (st.phase === "play" && me.alive && me.hop <= 0) {
    const hop = g.hopTime(me.k), r = me.row, x = me.x;
    const goal = g.BAYS.find((b, i) => !st.bays[i] && Math.abs(b - x) < 60) ?? g.BAYS.filter((b, i) => !st.bays[i]).sort((a, b) => Math.abs(a - x) - Math.abs(b - x))[0];
    const side = Math.sign(goal - x) || 1;
    const moves = [[0, -1], ...(Math.abs(goal - x) > C * 0.75 && !RIDE(r) ? [[side, 0]] : []), [0, 0], [side, 0], [-side, 0], [0, 1]];
    for (const [dx, dy] of moves) {
      const stay = !dx && !dy;
      if (safe(r + dy, x + dx * C, hop, stay)) { if (!stay) g.hop(dx, dy); break; }
    }
  }
  g.tick(1); steps++;
  if (st.phase === "dying" && was !== "dying") log2.push(`${st.flash}@r${st.me.row},x${Math.round(st.me.x)}`);
  was = st.phase;
  if (steps % 240 === 0) await sleep(0);
}
return `${["Gryphon", "Defender", "Trident"][pilot]}: ${st.phase === "over" ? "game over" : "still going"} at level ${st.level}, ${st.score} points, ` +
  `bays ${st.bays.filter(Boolean).length}/5, ${Math.round(steps / 60)} s; deaths ${JSON.stringify(st.deaths)} ${log2.join(" ")} bays ${st.bays}`;
