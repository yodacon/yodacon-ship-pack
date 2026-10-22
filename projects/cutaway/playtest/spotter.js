// A spotter for tools/drive_page.mjs: plays a full game, answering right on
// even rounds (by clicking the button for the right ship) and wrong on odd ones,
// and checks the choices are always four distinct names with the right one
// among them, and the score and ending. It uses the 50/50 on round 3 (and
// answers it right). ?expert=1 plays the fifteen-round Expert game.
const out = [];
let problems = 0;
if (new URLSearchParams(location.search).get("expert")) { document.getElementById("expert").checked = true; document.getElementById("expert").dispatchEvent(new Event("change")); }
let struck = null;
for (let r = 1; r <= cutaway.rounds; r++) {
  for (let k = 0; k < 100 && cutaway.round !== r; k++) await sleep(100);
  await sleep(200);
  const buttons = [...document.querySelectorAll("#choices .choice")];
  const names = buttons.map((b) => b.querySelector("span").textContent);
  const right = buttons.find((b) => b.dataset.slug === cutaway.current.slug && b.dataset.edition === cutaway.current.edition);
  if (buttons.length !== 4 || new Set(names).size !== 4 || !right) { problems++; out.push(`round ${r}: BAD choices ${names.join(", ")}`); }
  if (r === 3) { cutaway.fiftyFifty(); struck = buttons.filter((b) => b.disabled).length + (cutaway.fiftyFifty() ? " (and a second!)" : ""); }
  const pick = r % 2 === 0 || r === 3 ? right : buttons.find((b) => b !== right && !b.disabled);
  pick.click();
  out.push(`round ${r}: ${cutaway.current.name} (${cutaway.current.edition}) from ${names.join(" / ")} -> ${pick === right ? "right" : "wrong"}, score ${cutaway.score}`);
}
for (let k = 0; k < 50 && document.getElementById("again").hidden; k++) await sleep(100);
out.push(`50/50 on round 3 struck ${struck}; silhouette on round 11: ${document.getElementById("scope").className}`);
out.push(`ending: "${document.getElementById("prompt").textContent}", play again shown ${!document.getElementById("again").hidden}, bad rounds ${problems}`);
return out.join("\n");
