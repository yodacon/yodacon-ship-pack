// Tests for rules.js: one or more per rule in
// docs/research/2026-10-21-05-konquest-source.md.  Run: node projects/konquest/test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULTS, AI_LEVELS, NEUTRAL, makeRng, planetName, distance, travelTurns, newGame,
  sendFleet, cancelFleet, addStandingOrder, endTurn, planetByName, isDead, aiPlay, boardOrder,
} from "./rules.js";

const twoHumans = { players: [{ name: "A", type: "human" }, { name: "B", type: "human" }] };

// A hand-made board: planets placed where the test wants them.
function board(planets, { players = 2, options = {}, types } = {}) {
  const state = newGame({ ...twoHumans, neutralPlanets: 0, seed: 1, options });
  state.players = Array.from({ length: players }, (_, i) => ({
    name: `P${i}`, type: types?.[i] ?? "human", color: "#fff",
    fleets: [], newFleets: [], standingOrders: [],
    stats: { shipsBuilt: 0, planetsConquered: 0, fleetsLaunched: 0, enemyFleetsDestroyed: 0, enemyShipsDestroyed: 0 },
  }));
  state.planets = planets.map((p, i) => ({ name: planetName(i), ships: 0, production: 10,
    kill: 0.4, justConquered: false, look: 0, ...p, originalProduction: p.production ?? 10 }));
  state.turn = 1; state.current = 0; state.over = false; state.winner = null;
  return state;
}

test("names run A…Z, then AA, AB … BA (map.cc UniquePlanetName)", () => {
  assert.equal(planetName(0), "A");
  assert.equal(planetName(25), "Z");
  assert.equal(planetName(26), "AA");
  assert.equal(planetName(27), "AB");
  assert.equal(planetName(52), "BA");
  assert.equal(planetName(26 + 676), "AAA");
});

test("distance is Euclidean in sectors, halved; travel rounds up (map.cc, game.cpp)", () => {
  assert.equal(distance({ row: 0, col: 0 }, { row: 0, col: 4 }), 2);
  assert.equal(distance({ row: 0, col: 0 }, { row: 3, col: 4 }), 2.5);
  assert.equal(travelTurns({ row: 0, col: 0 }, { row: 3, col: 4 }), 3);
  assert.equal(travelTurns({ row: 0, col: 0 }, { row: 0, col: 1 }), 1);  // 0.5 → 1
});

test("defaults: 10×10, 3 neutrals, the five options (newgamedlg.cc)", () => {
  assert.equal(DEFAULTS.rows, 10); assert.equal(DEFAULTS.cols, 10);
  assert.equal(DEFAULTS.neutralPlanets, 3);
  assert.deepEqual({ ...DEFAULTS.options }, { BlindMap: false, CumulativeProduction: false,
    ProductionAfterConquere: true, NeutralsShowShips: false, NeutralsShowStats: false, NeutralsProduction: 1 });
  assert.deepEqual(AI_LEVELS.weak, { minimumShips: 20, shipCountFactor: 2 });
  assert.deepEqual(AI_LEVELS.normal, { minimumShips: 10, shipCountFactor: 2 });
  assert.deepEqual(AI_LEVELS.hard, { minimumShips: 30, shipCountFactor: 3 });
});

test("a new game: home planets 10 / 0.4, neutrals 5–14 / 0.30–0.90, opening production done", () => {
  for (let seed = 1; seed <= 200; seed++) {
    const s = newGame({ ...twoHumans, seed, neutralPlanets: 8 });
    assert.equal(s.turn, 1);                       // the machine starts with the Neutral step
    assert.equal(s.current, 0);
    const homes = s.planets.filter((p) => p.owner !== NEUTRAL);
    assert.deepEqual(homes.map((p) => p.name), ["A", "B"]);   // players' planets first
    for (const p of homes) { assert.equal(p.production, 10); assert.equal(p.kill, 0.4); assert.equal(p.ships, 10); }
    for (const p of s.planets.filter((p) => p.owner === NEUTRAL)) {
      assert.ok(p.production >= 5 && p.production <= 14);
      assert.ok(p.kill >= 0.30 && p.kill < 0.90);
      assert.equal(p.ships, 1);                    // planets start empty; neutrals make 1 a turn
    }
    const sectors = new Set(s.planets.map((p) => `${p.row},${p.col}`));
    assert.equal(sectors.size, s.planets.length);  // one planet per sector
  }
});

test("the same seed makes the same game", () => {
  const a = newGame({ ...twoHumans, seed: 42 }), b = newGame({ ...twoHumans, seed: 42 });
  assert.deepEqual(a.planets, b.planets);
  assert.notDeepEqual(a.planets, newGame({ ...twoHumans, seed: 43 }).planets);
});

test("ships leave at once; the fleet arrives on turn + ceil(distance) (game.cpp attack)", () => {
  const s = board([{ row: 0, col: 0, owner: 0, ships: 30 }, { row: 0, col: 6, owner: 0, ships: 0 },
    { row: 9, col: 9, owner: 1, ships: 5 }]);
  const f = sendFleet(s, s.planets[0], s.planets[1], 12);
  assert.equal(s.planets[0].ships, 18);
  assert.equal(f.arrival, 1 + 3);
  assert.equal(sendFleet(s, s.planets[0], s.planets[1], 19), null);   // more than it has
  assert.equal(sendFleet(s, s.planets[2], s.planets[1], 1), null);    // not its planet
  assert.ok(cancelFleet(s, f.id));
  assert.equal(s.planets[0].ships, 30);
});

test("reinforcements join; production follows (neutralplayer.cpp, planet.cc)", () => {
  const s = board([{ row: 0, col: 0, owner: 0, ships: 20 }, { row: 0, col: 2, owner: 0, ships: 0 },
    { row: 9, col: 9, owner: 1, ships: 5 }]);
  sendFleet(s, s.planets[0], s.planets[1], 15);            // distance 1: arrives turn 2
  endTurn(s); endTurn(s);                                  // A, then B (and the Neutral step)
  assert.equal(s.turn, 2);
  assert.equal(s.planets[1].ships, 15 + 10);               // arrived, then produced
  assert.equal(s.planets[0].ships, 5 + 10);
});

test("battle: the defender's roll first, then the attacker's; kill % from the source planet", () => {
  // Attacker kill 1.0 always hits; defender kill 0 never does: the planet falls.
  const s = board([{ row: 0, col: 0, owner: 0, ships: 50, kill: 1.0 },
    { row: 0, col: 2, owner: 1, ships: 7, kill: 0 }, { row: 9, col: 9, owner: 1, ships: 1 }]);
  sendFleet(s, s.planets[0], s.planets[1], 10);
  endTurn(s); endTurn(s);
  const b = s.planets[1];
  assert.equal(b.owner, 0);
  assert.equal(b.ships, 10 + 10);                // all 10 survive, then production (after conquest: on)
  assert.equal(s.players[0].stats.planetsConquered, 1);
  assert.equal(s.players[0].stats.enemyShipsDestroyed, 7);
  assert.ok(s.news.some((n) => n.kind === "fell" && n.planet === "B"));
});

test("battle: a planet with kill 1.0 holds against an attacker that cannot hit", () => {
  const s = board([{ row: 0, col: 0, owner: 0, ships: 50, kill: 0 },
    { row: 0, col: 2, owner: 1, ships: 3, kill: 1.0 }]);
  sendFleet(s, s.planets[0], s.planets[1], 10);
  endTurn(s); endTurn(s);
  assert.equal(s.planets[1].owner, 1);
  assert.equal(s.planets[1].ships, 3 + 10);
  assert.equal(s.players[1].stats.enemyShipsDestroyed, 10);
  assert.equal(s.players[1].stats.enemyFleetsDestroyed, 1);
  assert.ok(s.news.some((n) => n.kind === "held"));
});

test("conquest resets production and cancels the old owner's standing orders (planet.cc conquer)", () => {
  const s = board([{ row: 0, col: 0, owner: 0, ships: 50, kill: 1.0 },
    { row: 0, col: 2, owner: 1, ships: 2, kill: 0, production: 7 }, { row: 5, col: 5, owner: 1, ships: 0 }]);
  s.planets[1].production = 12;                  // as if CumulativeProduction had raised it
  s.current = 1; addStandingOrder(s, s.planets[1], s.planets[2], 1000); s.current = 0;
  sendFleet(s, s.planets[0], s.planets[1], 10);
  endTurn(s); endTurn(s);
  assert.equal(s.planets[1].production, 7);
  assert.equal(s.players[1].standingOrders.length, 0);
});

test("ProductionAfterConquere off: no production on the turn a planet falls", () => {
  const s = board([{ row: 0, col: 0, owner: 0, ships: 50, kill: 1.0 },
    { row: 0, col: 2, owner: 1, ships: 1, kill: 0 }, { row: 9, col: 9, owner: 1, ships: 1 }],
  { options: { ProductionAfterConquere: false } });
  sendFleet(s, s.planets[0], s.planets[1], 10);
  endTurn(s); endTurn(s);
  assert.equal(s.planets[1].ships, 10);
});

test("CumulativeProduction raises production by one each turn", () => {
  const s = board([{ row: 0, col: 0, owner: 0, ships: 0 }, { row: 9, col: 9, owner: 1, ships: 0 }],
    { options: { CumulativeProduction: true } });
  endTurn(s); endTurn(s); endTurn(s); endTurn(s);   // two turns
  assert.equal(s.planets[0].ships, 10 + 11);
  assert.equal(s.planets[0].production, 12);
});

test("standing orders launch every turn the source can afford them (player.cpp onExit)", () => {
  const s = board([{ row: 0, col: 0, owner: 0, ships: 30 }, { row: 0, col: 2, owner: 0, ships: 0 },
    { row: 9, col: 9, owner: 1, ships: 0 }]);
  addStandingOrder(s, s.planets[0], s.planets[1], 10);
  endTurn(s); endTurn(s);                                   // turn 2: first lands
  assert.equal(s.planets[1].ships, 10 + 10);
  assert.equal(s.players[0].stats.fleetsLaunched, 1);
});

test("a player with no planets and no fleets is dead; the last one alive wins", () => {
  const s = board([{ row: 0, col: 0, owner: 0, ships: 50, kill: 1.0 },
    { row: 0, col: 2, owner: 1, ships: 1, kill: 0 }]);
  sendFleet(s, s.planets[0], s.planets[1], 10);
  endTurn(s); endTurn(s);
  assert.ok(isDead(s, 1));
  assert.equal(s.winner, 0);
  assert.ok(s.over);
  assert.ok(s.news.some((n) => n.kind === "won" && n.player === 0));
});

test("AI attacks the nearest weaker planet with 70% of its ships (default.cpp)", () => {
  const s = board([{ row: 5, col: 5, owner: 0, ships: 100 }, { row: 5, col: 7, owner: NEUTRAL, ships: 50 },
    { row: 5, col: 9, owner: NEUTRAL, ships: 5 }, { row: 0, col: 0, owner: 1, ships: 69 }], { types: ["normal", "human"] });
  aiPlay(s, 0);
  const f = s.players[0].newFleets;
  assert.equal(f.length, 1);
  assert.equal(f[0].ships, 70);
  assert.equal(f[0].destination, "B");            // nearest with fewer than 70 ships
});

test("AI below its minimum does nothing; Hard waits for 30", () => {
  const s = board([{ row: 5, col: 5, owner: 0, ships: 42 }, { row: 5, col: 7, owner: NEUTRAL, ships: 1 },
    { row: 0, col: 0, owner: 1, ships: 1 }], { types: ["hard", "human"] });
  aiPlay(s, 0);                                   // floor(42 × 0.7) = 29 < 30
  assert.equal(s.players[0].newFleets.length, 0);
  s.planets[0].ships = 43; aiPlay(s, 0);          // 30
  assert.equal(s.players[0].newFleets.length, 1);
});

test("AI reinforces its nearest weak planet when nothing is beatable", () => {
  const s = board([{ row: 5, col: 5, owner: 0, ships: 40 }, { row: 5, col: 7, owner: 0, ships: 2 },
    { row: 0, col: 0, owner: 1, ships: 500 }], { types: ["hard", "human"] });
  aiPlay(s, 0);                                   // 28 < 30: Hard does nothing
  assert.equal(s.players[0].newFleets.length, 0);
  s.players[0].type = "normal"; aiPlay(s, 0);     // 28 ≥ 10, enemy too strong → reinforce
  const f = s.players[0].newFleets[0];
  assert.equal(f.destination, "B");
  assert.equal(f.ships, Math.floor((40 - 2) / 2));
});

test("AI skips planets its earlier fleets are already heading for", () => {
  const s = board([{ row: 5, col: 5, owner: 0, ships: 100 }, { row: 5, col: 7, owner: NEUTRAL, ships: 5 },
    { row: 5, col: 9, owner: NEUTRAL, ships: 5 }, { row: 0, col: 0, owner: 1, ships: 500 }], { types: ["normal", "human"] });
  s.players[0].fleets.push({ id: 99, owner: 0, source: "A", destination: "B", ships: 1, launched: 0, arrival: 5 });
  aiPlay(s, 0);
  assert.equal(s.players[0].newFleets[0].destination, "C");
});

test("computer players move by themselves; a full AI game reaches a winner", () => {
  for (const seed of [1, 2, 3]) {
    const s = newGame({ players: [{ type: "weak" }, { type: "normal" }, { type: "hard" }], seed, neutralPlanets: 6 });
    let guard = 0;
    while (!s.over && guard++ < 2000) endTurn(s);
    assert.ok(s.over, `seed ${seed} ended`);
    assert.ok(s.winner >= 0);
    assert.equal(s.planets.filter((p) => p.owner !== NEUTRAL && p.owner !== s.winner).length, 0);
  }
});

test("rng: deterministic, in [0, 1)", () => {
  const r = makeRng(7), q = makeRng(7);
  for (let i = 0; i < 1000; i++) { const v = r.next(); assert.equal(v, q.next()); assert.ok(v >= 0 && v < 1); }
});

test("board order is row by row", () => {
  const s = board([{ row: 2, col: 0, owner: 0 }, { row: 0, col: 5, owner: 1 }, { row: 0, col: 1, owner: NEUTRAL }]);
  assert.deepEqual(boardOrder(s).map((p) => p.name), ["C", "B", "A"]);
  assert.equal(planetByName(s, "B").col, 5);
});

// --- Opponents ----------------------------------------------------------------------------

import { OPPONENTS, becaiPlay, computerPlay } from "./rules.js";

test("Easy, Medium and Hard are Konquest's Defensive, Normal and BecAI brains", () => {
  assert.deepEqual(Object.keys(OPPONENTS).slice(0, 3), ["easy", "medium", "hard"]);
  assert.equal(OPPONENTS.easy.level, "hard");     // the source calls Default/Hard "Defensive"
  assert.equal(OPPONENTS.medium.level, "normal");
  assert.equal(OPPONENTS.hard.brain, "becai");
});

test("BecAI sends just enough to win, counting production on the way and kill percentages", () => {
  // Home kill 0.4, target kill 0.4, neutral production 1, distance 1 → needs ceil((4 + 1·1)·1) = 5.
  const s = board([{ row: 5, col: 5, owner: 0, ships: 60, kill: 0.4, production: 10 },
    { row: 5, col: 7, owner: NEUTRAL, ships: 4, kill: 0.4, production: 8 },
    { row: 0, col: 0, owner: 1, ships: 30, kill: 0.4, production: 10 }], { types: ["hard", "human"] });
  becaiPlay(s, 0);
  const f = s.players[0].newFleets.find((x) => x.destination === "B");
  assert.ok(f, "attacks the cheap neutral");
  assert.ok(f.ships >= 5, `sends at least the 5 it needs (sent ${f.ships})`);
  assert.ok(s.planets[0].ships > 0, "keeps a defence at home");
});

test("BecAI never sends two fleets at one target, including this turn's", () => {
  const s = board([{ row: 5, col: 5, owner: 0, ships: 200 }, { row: 5, col: 9, owner: 0, ships: 200 },
    { row: 5, col: 7, owner: NEUTRAL, ships: 3 }, { row: 0, col: 0, owner: 1, ships: 5000 }], { types: ["hard", "human"] });
  becaiPlay(s, 0);
  const atC = s.players[0].newFleets.filter((x) => x.destination === "C");
  assert.equal(atC.length, 1);
});

test("computerPlay routes each type to its brain", () => {
  const s = board([{ row: 5, col: 5, owner: 0, ships: 100 }, { row: 5, col: 7, owner: NEUTRAL, ships: 5 },
    { row: 0, col: 0, owner: 1, ships: 500 }], { types: ["easy", "human"] });
  computerPlay(s, 0);                             // Defensive: 70 ≥ 30, attacks B with 70
  assert.equal(s.players[0].newFleets[0].ships, 70);
});

test("difficulty holds in play: Hard beats Medium beats Easy over 60 seeded duels", () => {
  const duel = (a, b) => {
    let winsA = 0, winsB = 0;
    for (let g = 0; g < 60; g++) {
      const seats = g % 2 ? [b, a] : [a, b];
      const s = newGame({ players: seats.map((type) => ({ type })), seed: 9000 + g });
      while (!s.over && s.turn < 300) endTurn(s);
      if (!s.over) continue;
      if (seats[s.winner] === a) winsA++; else winsB++;
    }
    return [winsA, winsB];
  };
  const [hard, medium] = duel("hard", "medium");
  assert.ok(hard > medium, `Hard ${hard} v Medium ${medium}`);
  const [medium2, easy] = duel("medium", "easy");
  assert.ok(medium2 > easy, `Medium ${medium2} v Easy ${easy}`);
});
