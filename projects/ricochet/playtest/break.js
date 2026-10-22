// A player for tools/drive_page.mjs: plays Ricochet with ?paddle=0–2. It works
// out where the lowest falling ball will reach the paddle's line, bouncing off
// the walls, and moves there, a little off centre to send the ball toward the
// most ships; it launches at once, and on its last life it uses the tractor.
// Moves through state.autoX and steps the game with tick().
while (!globalThis.ricochet || globalThis.ricochet.state.phase === "loading") await sleep(100);
const g = globalThis.ricochet, st = g.state, q = new URLSearchParams(location.search);
const paddle = Number(q.get("paddle") ?? 0), stopLevel = Number(q.get("stopLevel") ?? Infinity);
g.newGame(paddle);
let steps = 0, tractors = 0;
function landing(b) {
  let x = b.x, y = b.y, vx = b.vx, vy = b.vy;
  if (vy <= 0) { const t = (y - g.BALL_R) / -vy; x += vx * t; y = g.BALL_R; vy = -vy; }
  const t = (g.PADDLE_Y - 10 - y) / vy;
  x += vx * t;
  const span = g.W - 2 * g.BALL_R;
  x -= g.BALL_R; x = ((x % (2 * span)) + 2 * span) % (2 * span); if (x > span) x = 2 * span - x;
  return { x: x + g.BALL_R, t: t + (b.vy <= 0 ? (b.y - g.BALL_R) / -b.vy : 0) };
}
while (st.phase !== "over" && steps < 60 * 60 * 20) {
  if (st.balls.some((b) => b.held)) g.launch();
  const live = st.balls.filter((b) => !b.held).map((b) => ({ b, ...landing(b) })).sort((a, z) => a.t - z.t)[0];
  if (live) {
    // Aim: hit off-centre toward the side with more ships left.
    const ships = st.ships.filter((s) => s.hp > 0), left = ships.filter((s) => s.x + s.w / 2 < live.x).length;
    const lean = ships.length ? (left > ships.length - left ? 1 : -1) * 0.35 : 0;
    st.autoX = live.x + lean * (g.paddleWidth() / 2);
    if (st.lives === 1 && st.tractors > 0 && !st.holding && live.b.vy > 0 && live.t < 0.4) { g.tractor(); tractors++; }
  }
  g.tick(1); steps++;
  if (st.level >= stopLevel && st.phase === "play" && document.getElementById("banner").hidden && st.ships.filter((s) => s.hp > 0).length < st.ships.length * 0.7) { st.phase = "frozen"; return `frozen in formation ${st.level + 1}`; }
  if (steps % 300 === 0) await sleep(0);
}
return `${st.paddle.k.name}: ${st.phase === "over" ? "game over" : "still playing"} in formation ${st.level + 1} (${g.FORMATIONS[st.level % g.FORMATIONS.length].name}), ` +
  `${st.score} points, ${Math.round(steps / 60)} s, ${tractors} tractors, ships left ${st.ships.filter((s) => s.hp > 0).length}`;
