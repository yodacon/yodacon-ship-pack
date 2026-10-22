// A pilot for tools/drive_page.mjs: flies one run on ?diff= (default normal)
// with ?hull= (default callisto), using key presses only. It stays with the
// freighter, Tabs to the raider nearest it, and attacks; the wing keeps its
// default order (guard). When two raiders are within 240 px it fires the ion
// pulse. ?from=x starts the run further along, with the earlier raids
// skipped. Reports delivered or lost, hull left and kills.
while (!globalThis.convoy || globalThis.convoy.state.phase === "loading") await sleep(100);
const q = new URLSearchParams(location.search), c = globalThis.convoy, st = c.state;
document.getElementById("hull").value = q.get("hull") || "callisto";
document.getElementById("diff").value = q.get("diff") || "normal";
document.getElementById("diff").dispatchEvent(new Event("change"));
const press = (key, on) => dispatchEvent(new KeyboardEvent(on ? "keydown" : "keyup", { key }));
const down = new Set();
const set = (key, on) => { if (on !== down.has(key)) { press(key, on); on ? down.add(key) : down.delete(key); } };
const tap = (key) => { press(key, true); press(key, false); };
const deg = (r) => (r * 180) / Math.PI;
tap("Enter");
let steps = 0, pulses = 0;
if (q.get("from")) {                                       // ?from=x: start the freighter (and escorts) further along, raids before it skipped
  const dx = Number(q.get("from")) - c.freighter().x;
  for (const s of st.ships) s.x += dx;
  st.raid = 6;
}
while (st.phase === "run" && st.time < 900) {
  const me = c.player(), fr = c.freighter();
  if (!me?.alive || !fr) { for (const k of [...down]) set(k, false); c.tick(2); await sleep(0); continue; }
  const raiders = st.ships.filter((s) => s.alive && s.side === "them");
  if (raiders.filter((s) => Math.hypot(s.x - me.x, s.y - me.y) < 240).length >= 2 && st.time >= st.pulseAt) { tap("e"); pulses++; }
  const nearFr = raiders.sort((a, b) => Math.hypot(a.x - fr.x, a.y - fr.y) - Math.hypot(b.x - fr.x, b.y - fr.y))[0];
  if (nearFr && st.target !== nearFr) { for (let i = 0; i < raiders.length && st.target !== nearFr; i++) tap("Tab"); }
  const t = st.target?.alive ? st.target : null;
  const goal = t ?? { x: fr.x + 80, y: fr.y - 90, vx: fr.vx, vy: fr.vy };
  const d = Math.hypot(goal.x - me.x, goal.y - me.y), lead = t ? d / 520 : 0;
  const ax = goal.x + (goal.vx - me.vx) * lead, ay = goal.y + (goal.vy - me.vy) * lead;
  let want = deg(Math.atan2(ax - me.x, -(ay - me.y)));
  const close = t && d < 110;
  if (close) want += 160;
  const diff = ((want - me.heading + 540) % 360) - 180, v = Math.hypot(me.vx - fr.vx, me.vy - fr.vy);
  set("ArrowLeft", diff < -5); set("ArrowRight", diff > 5);
  set("ArrowUp", Math.abs(diff) < 40 && (t ? d > 200 || close : d > 60));
  set("ArrowDown", !t && d < 80 && v > 40);
  set(" ", !!t && !close && Math.abs(diff) < 10 && d < 450);
  c.tick(2);                                       // two 1/60 s steps per decision
  if (++steps % 40 === 0) await sleep(0);
}
for (const k of [...down]) set(k, false);
const fr = c.freighter();
const pct = fr?.alive ? Math.round((100 * (fr.shield + fr.armour)) / (fr.hull.shieldMax + fr.hull.armourMax)) : 0;
return `${q.get("diff") || "normal"}: ${st.phase} after ${Math.round(st.time)} s, freighter ${pct}%, ${st.kills} kills, ${st.relaunches} spares left, raids ${st.raid}/7, ${pulses} pulses`;
