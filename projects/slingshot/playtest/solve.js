// Prove every level can be flown in par, then fly them through the page.
// For each level: search angle × power with the game's own simulate() for a
// launch that reaches the gate (par 1), or, failing that, report the nearest
// miss. Then launch the solutions and wait for each flight to land.
const { LEVELS, simulate } = slingshot;
const report = [];
const solutions = [];
for (const [i, lv] of LEVELS.entries()) {
  let found = null, nearest = Infinity;
  for (let a = 0; a < 360 && !found; a += 0.5) {
    for (let p = 0.1; p <= 1.0001 && !found; p += 0.02) {
      const r = simulate(lv, a * Math.PI / 180, p, { keepPath: false });
      if (r.result === "gate") found = { angle: a * Math.PI / 180, power: p, t: r.t };
      else nearest = Math.min(nearest, Math.hypot(r.x - lv.gate[0], r.y - lv.gate[1]));
    }
  }
  solutions.push(found);
  report.push(`level ${i + 1} "${lv.name}" par ${lv.par}: ` + (found
    ? `one launch works (angle ${(found.angle * 180 / Math.PI).toFixed(1)}°, power ${found.power.toFixed(2)}, ${found.t.toFixed(1)} s)`
    : `NO single launch; nearest miss ${nearest.toFixed(0)} px`));
}
// Fly the solvable ones through the page.
for (const [i, sol] of solutions.entries()) {
  if (!sol) continue;
  slingshot.startLevel(i);
  await sleep(100);
  slingshot.launch(sol.angle, sol.power);
  const until = performance.now() + (sol.t * 2 + 6) * 1000;   // real time, with room for slow machines
  while (slingshot.state.flight && performance.now() < until) await sleep(50);
  const f = slingshot.state.flight;
  report.push(`flew level ${i + 1}: total now ${slingshot.state.total}` +
    (f ? ` (STILL FLYING at t ${f.t.toFixed(2)} of ${f.outcome.t.toFixed(2)}, level ${slingshot.state.level})` : ""));
  await sleep(200);
}
return report.join("\n");
