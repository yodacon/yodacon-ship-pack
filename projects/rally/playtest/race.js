// A driver for tools/drive_page.mjs: races every track once with the hull in
// ?hull= (default gryphon), steering with key presses. It asks the game's own
// computer-racer logic where to go, so the result says whether a race can be
// finished through the page and how a computer line places against the field.
// It lights the afterburner where the computer racers do.
while (!globalThis.rally) await sleep(100);
const g = globalThis.rally, st = g.state;
const hull = new URLSearchParams(location.search).get("hull") || "gryphon";
const press = (key, on) => dispatchEvent(new KeyboardEvent(on ? "keydown" : "keyup", { key }));
const down = new Set();
const set = (key, on) => { if (on !== down.has(key)) { press(key, on); on ? down.add(key) : down.delete(key); } };
const KEY = { left: "ArrowLeft", right: "ArrowRight", thrust: "ArrowUp", brake: "ArrowDown", boost: "Shift" };
const out = [];
let steps = 0;
document.getElementById("hull").value = hull;
for (let t = 0; t < g.TRACKS.length; t++) {
  const sel = document.getElementById("track");
  sel.value = String(t);
  sel.dispatchEvent(new Event("change"));
  while (st.phase !== "results" && (st.phase !== "race" || st.time < 400)) {   // game seconds, not wall time
    const me = st.racers.find((r) => r.you);
    if (st.phase === "race") {
      const c = g.drive(me);
      for (const [what, key] of Object.entries(KEY)) set(key, !!c[what]);
    }
    g.tick(2);                                   // two 1/60 s steps per decision
    if (++steps % 40 === 0) await sleep(0);
  }
  for (const k of [...down]) set(k, false);
  const me = st.racers.find((r) => r.you);
  out.push(`${g.TRACKS[t].name}: ${st.phase === "results" ? `${g.order().indexOf(me) + 1} of 6 in ${me.done.toFixed(1)} s` : `unfinished, lap ${me.lap} gate ${me.gate}`}`);
  log(out.at(-1));
}
return `${hull}: ${out.join(" | ")}`;
