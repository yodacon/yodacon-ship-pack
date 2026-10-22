// A solver for tools/drive_page.mjs: for each of Tug's yards, a breadth-first
// search over pushes (the tug's reachable area standing in for where it is)
// finds the fewest pushes, then plays the solution through the game's own
// move() and checks the yard reads as solved. Reports pushes against par.
// It then tries a pull and an undo on the first yard. ?stop=N leaves yard N
// half-solved for a screenshot.
while (!globalThis.tug || globalThis.tug.state.phase === "loading") await sleep(100);
const g = globalThis.tug, st = g.state, stop = Number(new URLSearchParams(location.search).get("stop") ?? -1);
const D = Object.entries(g.DIRS);
function solve() {
  const walls = st.walls, goals = [...st.goals], k = (x, y) => `${x},${y}`;
  const reach = (px, py, boxes) => {
    const seen = new Map([[k(px, py), null]]), q = [[px, py]];
    for (let i = 0; i < q.length; i++) {
      const [x, y] = q[i];
      for (const [d, [dx, dy]] of D) {
        const n = k(x + dx, y + dy);
        if (!walls.has(n) && !boxes.has(n) && !seen.has(n)) { seen.set(n, [k(x, y), d]); q.push([x + dx, y + dy]); }
      }
    }
    return seen;
  };
  const path = (seen, to) => { const out = []; for (let c = to; seen.get(c); c = seen.get(c)[0]) out.unshift(seen.get(c)[1]); return out; };
  const start = { me: [st.me.x, st.me.y], boxes: new Set(st.hulls.map((h) => k(h.x, h.y))), moves: [] };
  const sig = (s, r) => [...s.boxes].sort().join(";") + "|" + [...r.keys()].sort()[0];
  const seen = new Set(), queue = [start];
  seen.add(sig(start, reach(...start.me, start.boxes)));
  for (let i = 0; i < queue.length && i < 300000; i++) {
    const s = queue[i];
    if (goals.every((gk) => s.boxes.has(gk))) return s.moves;
    const r = reach(...s.me, s.boxes);
    for (const b of s.boxes) {
      const [bx, by] = b.split(",").map(Number);
      for (const [d, [dx, dy]] of D) {
        const from = k(bx - dx, by - dy), to = k(bx + dx, by + dy);
        if (!r.has(from) || walls.has(to) || s.boxes.has(to)) continue;
        const boxes = new Set(s.boxes); boxes.delete(b); boxes.add(to);
        const n = { me: [bx, by], boxes, moves: [...s.moves, ...path(r, from), d] };
        const sg = sig(n, reach(bx, by, boxes));
        if (!seen.has(sg)) { seen.add(sg); queue.push(n); }
      }
    }
  }
  return null;
}
const out = [];
for (let n = 0; n < g.LEVELS.length; n++) {
  g.startLevel(n);
  const moves = solve();
  if (!moves) { out.push(`${n + 1}: NO SOLUTION`); continue; }
  for (const [i, d] of moves.entries()) {
    if (n === stop && i >= Math.floor(moves.length * 0.6)) { st.anim = 0; return `stopped yard ${n + 1} at move ${i}`; }
    g.move(d);
  }
  out.push(`${n + 1}: ${g.solved() && st.phase === "won" ? "solved" : "NOT SOLVED"} in ${st.moves} moves, ${st.pushes} pushes (par ${g.LEVELS[n].par})`);
  await sleep(0);
}
// The pull and undo on yard 1: back away from a hull with Shift, then undo.
g.startLevel(0);
const before = JSON.stringify(st.hulls.map((h) => [h.x, h.y]));
g.move("down"); g.move("right");                       // beside the hull at (3, 2)
const pulled = g.move("left", true) && st.hulls.some((h) => h.x === 2 && h.y === 2), pullsLeft = st.pulls;
while (g.undo());
const restored = JSON.stringify(st.hulls.map((h) => [h.x, h.y])) === before && st.pulls === 2;
return out.join("\n") + `\npull: ${pulled ? `moved, ${pullsLeft} left` : "did not move"}; undo all: ${restored ? "restored" : "NOT restored"}`;
