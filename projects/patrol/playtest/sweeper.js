// A sweeper for tools/drive_page.mjs: plays Patrol with ?hull=0–5. At each
// tile it searches the lanes (breadth first) for the nearest pod, fuel cell or
// fleeing pirate, keeping two tiles clear of every pirate still hunting; with
// no safe way it runs from the nearest one, and drops the decoy when a hunter
// is three tiles off. Steers through state.auto and steps with tick().
// ?stopLevel=N freezes the game mid-level for a screenshot.
while (!globalThis.patrol || globalThis.patrol.state.phase === "loading") await sleep(100);
const g = globalThis.patrol, st = g.state, q = new URLSearchParams(location.search);
const stopLevel = Number(q.get("stopLevel") ?? 0);
g.newGame(Number(q.get("hull") ?? 0));
const key = (x, y) => y * g.COLS + x, wrap = (x) => (x + g.COLS) % g.COLS;
function hunters() {
  return st.pirates.filter((p) => p.mode === "out" && !p.scared).map((p) => { const [x, y] = g.pos(p); return [Math.round(x), Math.round(y), p]; });
}
function danger() {
  const bad = new Set();
  for (const [x, y, p] of hunters()) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (Math.abs(dx) + Math.abs(dy) <= 2) bad.add(key(wrap(x + dx), y + dy));
  return bad;
}
function plan(me) {
  const bad = danger(), start = key(me.x, me.y);
  const prey = new Set(st.pirates.filter((p) => p.mode === "out" && p.scared && st.fright > 1).map((p) => { const [x, y] = g.pos(p); return key(Math.round(x), Math.round(y)); }));
  const seen = new Map([[start, null]]), queue = [[me.x, me.y]];
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i], k = key(x, y);
    if (k !== start && (st.pods[y][x] || prey.has(k))) {
      let c = k; while (seen.get(c)?.from !== start) c = seen.get(c).from;
      return seen.get(c).dir;
    }
    for (const d of Object.keys(g.DIRS)) {
      const nx = wrap(x + g.DIRS[d][0]), ny = y + g.DIRS[d][1], nk = key(nx, ny);
      if (!g.open(nx, ny) || seen.has(nk) || bad.has(nk)) continue;
      seen.set(nk, { from: k, dir: d }); queue.push([nx, ny]);
    }
  }
  // Nowhere safe: the open way that ends farthest from the nearest hunter.
  const h = hunters();
  let best = null, far = -1;
  for (const d of Object.keys(g.DIRS)) {
    const nx = wrap(me.x + g.DIRS[d][0]), ny = me.y + g.DIRS[d][1];
    if (!g.open(nx, ny)) continue;
    const dist = Math.min(99, ...h.map(([x, y]) => Math.abs(x - nx) + Math.abs(y - ny)));
    if (dist > far) { far = dist; best = d; }
  }
  return best;
}
st.auto = (me) => {
  const near = hunters().some(([x, y]) => Math.abs(x - me.x) + Math.abs(y - me.y) <= 3);
  if (near && st.decoys > 0) g.dropDecoy();
  if (me.prog === 0 || near) return plan(me);
  return null;
};
let steps = 0, deaths = [];
const levels = [];
let lives = st.lives, level = st.level;
while (st.phase !== "over" && steps < 60 * 60 * 25) {
  g.tick(1); steps++;
  if (st.lives < lives) deaths.push(`L${st.level}: ${st.lastDeath}`);
  lives = st.lives;
  if (st.level !== level) { levels.push(Math.round(steps / 60)); level = st.level; }
  if (stopLevel && st.level >= stopLevel && st.phase === "play" && st.left < st.total * 0.55 && st.pirates.every((p) => p.mode === "out") && st.fright > 3) {
    st.phase = "frozen"; return `frozen on level ${st.level}`;
  }
  if (steps % 600 === 0) await sleep(0);
}
return `${st.phase === "over" ? "game over" : "still flying"} on level ${st.level}, ${st.score} points, ${Math.round(steps / 60)} s; levels cleared at ${levels.join(", ")} s; deaths ${deaths.join(", ")}`;
