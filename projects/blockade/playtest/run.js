// A pilot for tools/drive_page.mjs: flies ?hull= (default gryphon) with the
// arrow keys and auto-fire, lining up under the lowest enemy and sidestepping
// any bomb about to arrive. Steps the game with tick(); reports how far it got.
while (!globalThis.blockade || globalThis.blockade.state.phase === "loading") await sleep(100);
const g = globalThis.blockade, st = g.state, hull = new URLSearchParams(location.search).get("hull") || "gryphon";
document.getElementById("auto").checked = true;
g.newGame(hull);
const down = new Set();
const set = (key, on) => { if (on !== down.has(key)) { dispatchEvent(new KeyboardEvent(on ? "keydown" : "keyup", { key })); on ? down.add(key) : down.delete(key); } };
let steps = 0;
while (st.phase !== "over" && st.phase !== "won" && steps < 60 * 60 * 6) {
  const me = st.me;
  if (st.phase !== "play" || !me?.alive) { for (const k of [...down]) set(k, false); g.tick(2); steps += 2; await sleep(20); continue; }
  // Threat: a bomb that will pass within 24 px of us in the next 0.6 s.
  let dodge = 0;
  for (const b of st.bombs) {
    if (b.vy <= 0) continue;
    const t = (me.y - b.y) / b.vy;
    if (t < 0 || t > 0.6) continue;
    const x = b.x + b.vx * t;
    if (Math.abs(x - me.x) < 24) dodge += x < me.x ? 1 : -1;
  }
  // Keep clear of anything low enough to ram us; otherwise line up under the
  // lowest enemy that is still well above.
  for (const e of st.enemies) if (e.t >= 0 && me.y - e.y < 150 && Math.abs(e.x - me.x) < e.k.radius + 40) dodge += e.x < me.x ? 1 : -1;
  const foe = st.enemies.filter((e) => e.t >= 0 && e.y > 0 && me.y - e.y >= 150).sort((a, b) => b.y - a.y)[0];
  const goal = dodge ? me.x + Math.sign(dodge) * 70 : foe ? foe.x : 240;
  set("ArrowLeft", goal < me.x - 6);
  set("ArrowRight", goal > me.x + 6);
  set("ArrowDown", me.y < 560);
  g.tick(2); steps += 2;
  if (steps % 60 === 0) await sleep(0);
}
for (const k of [...down]) set(k, false);
return `${hull}: ${st.phase === "won" ? "THROUGH" : `down in stage ${st.stage + 1}`} — ${st.score} points, ${st.lives} lives left, ${Math.round(steps / 60)} s, hits ${JSON.stringify(st.hits)}; boss out ${st.bossOut}, waves ${st.wave}, left: ${st.enemies.map((e) => `${e.k.name}(${e.pattern} y${Math.round(e.y)} hp${Math.round(e.hp)})`).join(" ")}`;
