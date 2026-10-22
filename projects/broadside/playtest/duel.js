// A gunner for tools/drive_page.mjs: plays ?battles= battles (default 6) of
// Broadside with your side aimed by the computer's own method at ?mine=
// (default normal) against the computer at ?level= (default normal), on
// every map in turn, with shells flown four times as fast. ?stopTurns=n
// freezes a shell in flight after n turns (for screenshots). Fires once by a
// mouse drag first, to check the controls. Reports wins and turns.
while (!globalThis.broadside || globalThis.broadside.state.phase === "loading") await sleep(100);
const g = globalThis.broadside, st = g.state, q = new URLSearchParams(location.search);
const stopTurns = Number(q.get("stopTurns") ?? Infinity), battles = Number(q.get("battles") ?? 6), level = q.get("level") ?? "normal", mine = q.get("mine") ?? "normal";
const sel = document.getElementById("level"); sel.value = level; sel.dispatchEvent(new Event("change"));
// One shot by drag: pull back left of the first ship, let go.
const c = document.getElementById("screen"), b = c.getBoundingClientRect(), s = b.width / c.width, me = st.active;
const at = (x, y) => ({ bubbles: true, clientX: b.left + x * s, clientY: b.top + y * s, pointerId: 1 });
c.dispatchEvent(new PointerEvent("pointerdown", at(me.x, me.y)));
c.dispatchEvent(new PointerEvent("pointermove", at(me.x - 80, me.y + 20)));
c.dispatchEvent(new PointerEvent("pointerup", at(me.x - 80, me.y + 20)));
const dragged = st.phase === "flying";
st.auto = true; st.autoLevel = mine;
const out = [];
let wins = 0;
for (let n = 0; n < battles; n++) {
  if (n) g.newBattle(n % 3);
  let steps = 0, turns = 0, was = st.turn;
  while (st.phase !== "over" && steps < 60 * 60 * 15) {
    g.tick(1); steps++;
    if (st.turn !== was) { turns++; was = st.turn; }
    if (turns >= stopTurns && st.phase === "flying" && st.shells[0]?.t > 0.5) { st.phase = "frozen"; return `frozen on turn ${turns}`; }
    if (steps % 300 === 0) await sleep(0);
  }
  const won = g.alive("you").length > 0;
  if (won) wins++;
  out.push(`map ${st.map + 1}: ${st.phase === "over" ? (won ? "won" : "lost") : "unfinished"} in ${turns} turns, ${g.alive("you").length} v ${g.alive("them").length}`);
}
return `drag fired: ${dragged}; mine ${mine} v theirs ${level}: won ${wins}/${battles} — ${out.join("; ")}`;
