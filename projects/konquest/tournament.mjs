// Play the computer opponents against each other and print the results.
//   node projects/konquest/tournament.mjs [games per pairing]
// Every game is seeded, so the table is the same on every run.
import { newGame, endTurn, OPPONENTS } from "./rules.js";

const GAMES = Number(process.argv[2] ?? 200);
const TURN_LIMIT = 300;
const types = Object.keys(OPPONENTS);

function play(players, seed, map = {}) {
  const s = newGame({ players: players.map((type) => ({ type, name: type })), seed, ...map });
  while (!s.over && s.turn < TURN_LIMIT) endTurn(s);
  return { winner: s.over ? players[s.winner] : null, turns: s.turn };
}

console.log(`Two players, default map (10 × 10, 3 neutrals), ${GAMES} games per pairing, seats swapped half the time:\n`);
console.log("| Pairing | Wins | Wins | Undecided at turn 300 | Average turns |");
console.log("| --- | ---: | ---: | ---: | ---: |");
for (let i = 0; i < types.length; i++) {
  for (let j = i + 1; j < types.length; j++) {
    const a = types[i], b = types[j];
    const wins = { [a]: 0, [b]: 0 }; let open = 0, turns = 0;
    for (let g = 0; g < GAMES; g++) {
      const seats = g % 2 ? [b, a] : [a, b];
      const r = play(seats, 1000 + g);
      if (r.winner) wins[r.winner]++; else open++;
      turns += r.turns;
    }
    console.log(`| ${OPPONENTS[a].label} v ${OPPONENTS[b].label} | ${OPPONENTS[a].label} ${wins[a]} | ${OPPONENTS[b].label} ${wins[b]} | ${open} | ${(turns / GAMES).toFixed(1)} |`);
  }
}

console.log(`\nFour players, one of each, 12 × 12 with 8 neutrals, ${GAMES} games, seats rotated:\n`);
const ffa = Object.fromEntries(types.map((t) => [t, 0])); let open = 0;
for (let g = 0; g < GAMES; g++) {
  const seats = types.map((_, k) => types[(k + g) % types.length]);
  const r = play(seats, 5000 + g, { rows: 12, cols: 12, neutralPlanets: 8 });
  if (r.winner) ffa[r.winner]++; else open++;
}
console.log("| Opponent | Wins |");
console.log("| --- | ---: |");
for (const t of types) console.log(`| ${OPPONENTS[t].label} | ${ffa[t]} |`);
console.log(`| (undecided at turn ${TURN_LIMIT}) | ${open} |`);
