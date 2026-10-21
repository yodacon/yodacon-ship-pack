// The human seat played by BecAI, through the page: each turn the human's
// orders come from rules.js's becaiPlay, then End turn is pressed as a person
// would. Checks the Victory ending.
const rules = await import(new URL("../projects/konquest/rules.js", document.baseURI.replace(/projects\/konquest\/.*$/, "")).href);
let turns = 0;
while (turns < 300 && document.getElementById("ending").hidden) {
  if (document.getElementById("end-turn").disabled) { await sleep(120); continue; }
  rules.becaiPlay(konquest.game, konquest.game.current);
  document.getElementById("end-turn").click();
  turns++;
  await sleep(20);
}
return [`after ${turns} turns`, `title: ${document.getElementById("ending-title").textContent}`,
  `class: ${document.getElementById("ending-title").className}`,
  `text: ${document.getElementById("ending-text").textContent}`].join("\n");
