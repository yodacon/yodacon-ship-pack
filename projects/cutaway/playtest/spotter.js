// A spotter for tools/drive_page.mjs: plays a full game, answering right on
// even rounds (by clicking the button for the right ship) and wrong on odd ones,
// and checks the choices are always four distinct names with the right one
// among them, and the score and ending.
const out = [];
let problems = 0;
for (let r = 1; r <= 10; r++) {
  for (let k = 0; k < 100 && cutaway.round !== r; k++) await sleep(100);
  await sleep(200);
  const buttons = [...document.querySelectorAll("#choices .choice")];
  const names = buttons.map((b) => b.querySelector("span").textContent);
  const right = buttons.find((b) => b.dataset.slug === cutaway.current.slug && b.dataset.edition === cutaway.current.edition);
  if (buttons.length !== 4 || new Set(names).size !== 4 || !right) { problems++; out.push(`round ${r}: BAD choices ${names.join(", ")}`); }
  const pick = r % 2 === 0 ? right : buttons.find((b) => b !== right);
  pick.click();
  out.push(`round ${r}: ${cutaway.current.name} (${cutaway.current.edition}) from ${names.join(" / ")} -> ${pick === right ? "right" : "wrong"}, score ${cutaway.score}`);
}
for (let k = 0; k < 50 && document.getElementById("again").hidden; k++) await sleep(100);
out.push(`ending: "${document.getElementById("prompt").textContent}", play again shown ${!document.getElementById("again").hidden}, bad rounds ${problems}`);
return out.join("\n");
