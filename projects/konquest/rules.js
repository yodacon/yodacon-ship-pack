// Konquest's rules, in plain JavaScript, with no DOM: the engine of
// projects/konquest/, testable under Node (test.mjs).
//
// A reimplementation of KDE Konquest (GPL-2.0-or-later,
// https://invent.kde.org/games/konquest, read at commit 3a90a7ed): the same
// map, planets, production, travel, battles, turn order and default computer
// players, with the source's numbers. Each rule names the file it comes from;
// docs/research/2026-10-21-05-konquest-source.md explains them.
//
// Not reproduced: Qt's random sequence. A seeded generator (mulberry32) makes
// every game replayable from its seed instead.

export const DEFAULTS = Object.freeze({
  rows: 10, cols: 10,               // map.cc: Map(10, 10); newgamedlg.cc: SizeWidth/Height 10
  neutralPlanets: 3,                // newgamedlg.cc: NrOfPlanets 3
  options: Object.freeze({          // newgamedlg.cc defaults
    BlindMap: false,
    CumulativeProduction: false,
    ProductionAfterConquere: true,  // (sic, as the source spells it)
    NeutralsShowShips: false,
    NeutralsShowStats: false,
    NeutralsProduction: 1,
  }),
});

// newgamedlg.cc: PlayerColors, in order
export const PLAYER_COLORS = ["#8282ff", "#ffff00", "#ff0000", "#00ff00", "#ffffff",
  "#00ffff", "#ff00ff", "#eb992e", "#6a9d68", "#839980"];

// default.cpp: per level, the least ships worth moving and the reinforcement divisor
export const AI_LEVELS = Object.freeze({
  weak: { minimumShips: 20, shipCountFactor: 2 },
  normal: { minimumShips: 10, shipCountFactor: 2 },
  hard: { minimumShips: 30, shipCountFactor: 3 },
});

export const NEUTRAL = -1;

// --- Random numbers ----------------------------------------------------------

/** mulberry32: a small, fast, seedable generator. State is one integer. */
export function makeRng(seed) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,                                    // [0, 1), like QRandomGenerator::bounded(1.0)
    bounded: (n) => Math.floor(next() * n),  // [0, n), like bounded(int n)
    get state() { return s; },
    set state(v) { s = v >>> 0; },
  };
}

// --- The map -----------------------------------------------------------------

/** map.cc UniquePlanetName: A … Z, then AA, AB …, the first name not taken. */
export function planetName(index) {
  let name = "";
  let n = index;
  // index 0 → A, 25 → Z, 26 → AA: one letter more each time the previous run is used up
  let length = 1, span = 26;
  while (n >= span) { n -= span; length++; span *= 26; }
  for (let i = 0; i < length; i++) {
    name = String.fromCharCode(65 + (n % 26)) + name;
    n = Math.floor(n / 26);
  }
  return name;
}

/** map.cc distance: Euclidean, in sectors, halved ("not a bug, it's a feature"). */
export function distance(a, b) {
  const dr = a.row - b.row, dc = a.col - b.col;
  return Math.sqrt(dr * dr + dc * dc) / 2;
}

/** game.cpp attack: a fleet ordered on turn t arrives on t + ceil(distance). */
export const travelTurns = (a, b) => Math.ceil(distance(a, b));

function freeSector(state, rng) {
  // map.cc findRandomFreeSector: random coordinates until one is empty
  if (state.planets.length >= state.rows * state.cols) return null;
  for (;;) {
    const row = rng.bounded(state.rows), col = rng.bounded(state.cols);
    if (!state.planets.some((p) => p.row === row && p.col === col)) return { row, col };
  }
}

function addPlanet(state, rng, owner, production, kill) {
  const sector = freeSector(state, rng);
  if (!sector) return null;
  const planet = {
    name: planetName(state.planets.length), ...sector, owner,
    ships: 0,                           // planet.cc: m_homeFleet(this, 0)
    production, originalProduction: production, kill,
    justConquered: false,
    look: rng.bounded(10),              // planet.cc: m_planetLook = bounded(10)
  };
  state.planets.push(planet);
  return planet;
}

// --- A new game ----------------------------------------------------------------

const newStats = () => ({ shipsBuilt: 0, planetsConquered: 0, fleetsLaunched: 0,
  enemyFleetsDestroyed: 0, enemyShipsDestroyed: 0 });

/**
 * players: [{name, type: "human" | "easy" | "medium" | "hard" | "weak"}], 2–10 of
 * them (see OPPONENTS).
 * Returns the state after the opening Neutral step (turn 1, first production
 * done), with player 0 to move, as Konquest's state machine does.
 */
export function newGame({ players, rows = DEFAULTS.rows, cols = DEFAULTS.cols,
  neutralPlanets = DEFAULTS.neutralPlanets, options = {}, seed = Date.now() }) {
  if (players.length < 2 || players.length > PLAYER_COLORS.length) {
    throw new Error(`Konquest needs 2–${PLAYER_COLORS.length} players`);
  }
  const rng = makeRng(seed);
  const state = {
    seed, rows, cols, turn: 0, current: 0, winner: null, over: false,
    options: { ...DEFAULTS.options, ...options },
    players: players.map((p, i) => ({
      name: p.name ?? `Player ${i}`, type: p.type ?? "human", color: PLAYER_COLORS[i],
      fleets: [], newFleets: [], standingOrders: [], stats: newStats(),
    })),
    neutralStats: newStats(),
    planets: [], news: [], nextFleetId: 1,
    rngState: 0,
  };
  // map.cc populateMap: one planet per player, then the neutrals
  state.players.forEach((_, i) => addPlanet(state, rng, i, 10, 0.4));  // planet.cc createPlayerPlanet
  for (let i = 0; i < neutralPlanets; i++) {
    const kill = 0.30 + rng.next() * 0.60;   // game.cpp generateKillPercentage: 0.30–0.90
    const production = 5 + rng.bounded(10); // game.cpp generatePlanetProduction: 5–14
    if (!addPlanet(state, rng, NEUTRAL, production, kill)) break;
  }
  state.rngState = rng.state;
  neutralStep(state);                       // localgame.cpp: the machine starts with Neutral
  return state;
}

const rngOf = (state) => { const r = makeRng(0); r.state = state.rngState; return r; };

// Board order: row by row, as map.cc planets() walks the grid.
export const boardOrder = (state) =>
  [...state.planets].sort((a, b) => a.row - b.row || a.col - b.col);

// --- Orders ----------------------------------------------------------------------

/**
 * game.cpp attack / fleet.cc spawnAttackFleet: launch `count` ships now.
 * They leave the planet at once; the fleet joins the player's flights when the
 * player ends the turn. Returns the fleet, or null if the order is invalid.
 */
export function sendFleet(state, from, to, count) {
  const p = state.current;
  if (state.over || from === to || from.owner !== p) return null;
  count = Math.floor(count);
  if (!(count >= 0) || from.ships < count) return null;  // spawnAttackFleet allows 0
  from.ships -= count;
  const fleet = { id: state.nextFleetId++, owner: p, source: from.name, destination: to.name,
    ships: count, launched: state.turn, arrival: state.turn + travelTurns(from, to) };
  state.players[p].newFleets.push(fleet);
  return fleet;
}

/** player.cpp cancelNewAttack: take back a fleet ordered this turn. */
export function cancelFleet(state, fleetId) {
  const player = state.players[state.current];
  const i = player.newFleets.findIndex((f) => f.id === fleetId);
  if (i < 0) return false;
  const [fleet] = player.newFleets.splice(i, 1);
  planetByName(state, fleet.source).ships += fleet.ships;
  return true;
}

/** game.cpp attack(…, standingOrder = true): re-send these ships every turn. */
export function addStandingOrder(state, from, to, count) {
  if (state.over || from === to || from.owner !== state.current) return null;
  const order = { id: state.nextFleetId++, owner: state.current, source: from.name,
    destination: to.name, ships: Math.floor(count), arrival: state.turn + travelTurns(from, to) };
  state.players[state.current].standingOrders.push(order);
  return order;
}

export const planetByName = (state, name) => state.planets.find((p) => p.name === name);

// --- Turns ---------------------------------------------------------------------

/**
 * player.cpp onExit, then the state machine's next transition: the current
 * player's new fleets and standing orders take off, and play passes to the
 * next player, or to the Neutral step after the last one. Computer players
 * move automatically until a human (or the end of the game) is reached.
 * Returns the news of any Neutral steps run.
 */
export function endTurn(state) {
  const news = [];
  if (state.over) return news;
  for (;;) {
    launch(state, state.current);
    if (state.current === state.players.length - 1) {
      news.push(...neutralStep(state));
      if (state.over) return news;
      state.current = 0;
      // With no human left alive, stop after each turn so the board can show it.
      const humans = state.players.some((pl, i) => pl.type === "human" && !isDead(state, i));
      if (!humans) {
        if (state.players[0].type !== "human" && !isDead(state, 0)) computerPlay(state, 0);
        return news;
      }
    } else {
      state.current++;
    }
    const player = state.players[state.current];
    if (isDead(state, state.current)) continue;           // player.cpp onEntry: the dead pass
    if (player.type !== "human") { computerPlay(state, state.current); continue; }
    return news;
  }
}

function launch(state, p) {
  const player = state.players[p];
  for (const order of player.standingOrders) {            // player.cpp onExit
    const source = planetByName(state, order.source);
    if (source.owner === p && source.ships >= order.ships) {
      source.ships -= order.ships;
      player.newFleets.push({ ...order, id: state.nextFleetId++, launched: state.turn });
    }
    order.arrival++;
  }
  player.stats.fleetsLaunched += player.newFleets.length;
  player.fleets.push(...player.newFleets);
  player.newFleets = [];
}

/** neutralplayer.cpp play, entered with a new turn: arrivals, production, winner. */
function neutralStep(state) {
  const rng = rngOf(state);
  state.turn++;                                           // player.cpp onEntry: newTurn()
  const news = [];
  state.players.forEach((player) => {
    const staying = [];
    for (const fleet of player.fleets) {
      if (fleet.arrival === state.turn) news.push(arrive(state, fleet, rng));
      else staying.push(fleet);
    }
    player.fleets = staying;
  });
  for (const planet of boardOrder(state)) produce(state, planet);
  state.rngState = rng.state;
  findWinner(state);
  if (state.over) news.push({ turn: state.turn, kind: "won", player: state.winner });
  state.news.push(...news);
  return news;
}

/** planet.cc turn */
function produce(state, planet) {
  const o = state.options;
  if (o.ProductionAfterConquere || !planet.justConquered) {
    const add = planet.owner === NEUTRAL ? o.NeutralsProduction : planet.production;
    planet.ships = Math.max(0, planet.ships + add);       // fleet.cc addShips: never below 0
    statsOf(state, planet.owner).shipsBuilt += add;
    if (o.CumulativeProduction) planet.production++;
  }
  planet.justConquered = false;
}

const statsOf = (state, owner) => owner === NEUTRAL ? state.neutralStats : state.players[owner].stats;

/** game.cpp doFleetArrival: reinforce a friendly planet, or fight for it. */
function arrive(state, fleet, rng) {
  const target = planetByName(state, fleet.destination);
  const source = planetByName(state, fleet.source);
  const base = { turn: state.turn, player: fleet.owner, planet: target.name, ships: fleet.ships };
  if (target.owner === fleet.owner) {
    target.ships += fleet.ships;
    return { ...base, kind: "reinforced" };
  }
  const defenderOwner = target.owner;
  let attackers = fleet.ships;
  const kills = (owner) => { statsOf(state, owner).enemyShipsDestroyed++; };
  // The battle: one ship at a time. The attacker fights with its SOURCE planet's
  // kill percentage, the defender with the defended planet's.
  let holds;
  for (;;) {
    const a = rng.next(), d = rng.next();
    // game.cpp makeKill credits the source planet's owner *now*, which can
    // differ from the fleet's owner if the source fell while it was in flight.
    if (target.kill === 0 && source.kill === 0) {         // both zero: the lower roll loses
      if (a < d) { target.ships--; kills(source.owner); }
      else { attackers--; kills(defenderOwner); }
    }
    if (d < target.kill) { attackers--; kills(defenderOwner); }
    if (attackers <= 0) { holds = true; break; }
    if (a < source.kill) { target.ships--; kills(source.owner); }
    if (target.ships <= 0) { holds = false; break; }
  }
  if (holds) {
    statsOf(state, defenderOwner).enemyFleetsDestroyed++;
    return { ...base, kind: "held", defender: defenderOwner };
  }
  state.players[fleet.owner].stats.enemyFleetsDestroyed++;
  // planet.cc conquer
  if (defenderOwner !== NEUTRAL) {
    const old = state.players[defenderOwner];
    old.standingOrders = old.standingOrders.filter((s) => s.source !== target.name);
  }
  target.owner = fleet.owner;
  target.ships = attackers;
  target.production = target.originalProduction;
  target.justConquered = true;
  state.players[fleet.owner].stats.planetsConquered++;
  return { ...base, kind: "fell", defender: defenderOwner, survivors: attackers };
}

/** player.cpp isDead: no planets and nothing in flight. */
export function isDead(state, p) {
  const player = state.players[p];
  return player.fleets.length === 0 && player.newFleets.length === 0 &&
    !state.planets.some((planet) => planet.owner === p);
}

/** game.cpp findWinner: one player left alive wins. */
function findWinner(state) {
  const alive = state.players.map((_, i) => i).filter((i) => !isDead(state, i));
  if (alive.length === 1) { state.winner = alive[0]; state.over = true; }
}

// --- Computer players ----------------------------------------------------------------
//
// Player types, and the Konquest brain behind each. The order follows how they
// actually play (tournament.mjs: 200-game round robins), not Konquest's names:
//   easy    Default brain at its "Hard" level, which the source itself calls
//           "Defensive": it waits for 30 ships. The weakest in play.
//   medium  Default brain, "Normal" level (offensive)
//   hard    BecAI (becai.cpp), Konquest's strongest by a wide margin
// "weak" (the Default brain's Weak level) is accepted too; it plays between
// easy and medium.
export const OPPONENTS = Object.freeze({
  easy: { brain: "default", level: "hard", label: "Easy", source: "Konquest Default, Hard (\"Defensive\")" },
  medium: { brain: "default", level: "normal", label: "Medium", source: "Konquest Default, Normal" },
  hard: { brain: "becai", label: "Hard", source: "Konquest BecAI" },
  weak: { brain: "default", level: "weak", label: "Konquest Weak", source: "Konquest Default, Weak" },
});

export function computerPlay(state, p) {
  const type = state.players[p].type;
  const o = OPPONENTS[type];
  if (o?.brain === "becai") return becaiPlay(state, p);
  return aiPlay(state, p, o?.level ?? type);
}

// --- The default computer player (default.cpp) ---------------------------------------

export function aiPlay(state, p, level = state.players[p].type) {
  const { minimumShips, shipCountFactor } = AI_LEVELS[level];
  const inFlight = state.players[p].fleets;  // attackList(): last turns' fleets, not this turn's
  const targeted = (planet) => inFlight.some((f) => f.destination === planet.name);
  const planets = boardOrder(state);
  for (const home of planets) {
    if (home.owner !== p) continue;
    const ships = Math.floor(home.ships * 0.7);
    if (ships < minimumShips) continue;
    // Attack the nearest planet it doesn't own that has fewer ships, within 100.
    let target = null, minDistance = 100;
    for (const other of planets) {
      if (other.owner === p) continue;
      const dist = distance(home, other);
      if (dist < minDistance && other.ships < ships && !targeted(other)) {
        target = other; minDistance = dist;
      }
    }
    if (target) { sendFleet(state, home, target, ships); continue; }
    // Otherwise reinforce the nearest own planet with under half this one's ships.
    minDistance = Infinity;
    let send = 0;
    for (const other of planets) {
      const dist = distance(home, other);
      const homeShips = Math.floor(home.ships * 0.5);
      if (dist < minDistance && other.owner === p && other.ships < homeShips && !targeted(other)) {
        send = Math.floor((home.ships - other.ships) / shipCountFactor);
        target = other; minDistance = dist;
      }
    }
    if (target) sendFleet(state, home, target, send);
  }
}

// --- BecAI (players/ai/becai/becai.cpp) -----------------------------------------------
//
// Konquest's strongest computer player. It sizes a defence for each planet
// from the state of the game, works out the smallest fleet that wins each
// possible battle (counting the target's production while the fleet travels
// and both kill percentages), ranks targets by cost × distance (preferring
// rich, deadly and non-neutral planets), and moves spare ships towards
// planets that need support or that kill better. Ported line by line,
// including one quirk of the original: a home planet with a kill percentage
// under 0.1 resets the *target's* value, not its own.

const defenceFor = (planet, base, avgKill, avgProd) =>
  Math.ceil(base * planet.kill / avgKill * planet.production / avgProd);

export function becaiPlay(state, p) {
  const player = state.players[p];
  const planets = boardOrder(state);
  let totalOwnProduction = 0, totalOwnPlanets = 0, totalOwnFleet = 0;
  let totalEnemyPlanets = 0, totalEnemyDefence = 0, totalKill = 0;
  for (const f of player.fleets) totalOwnFleet += f.ships;
  const nonOwnDefence = [];
  for (const planet of planets) {
    if (planet.owner === p) {
      totalOwnProduction += planet.production; totalOwnPlanets++;
      totalOwnFleet += planet.ships; totalKill += planet.kill;
    } else {
      if (planet.owner !== NEUTRAL) { totalEnemyPlanets++; totalEnemyDefence += planet.ships; }
      nonOwnDefence.push(planet.ships);
    }
  }
  // The average non-own defence, ignoring the top and bottom tenth.
  nonOwnDefence.sort((a, b) => a - b);
  for (let i = Math.floor(nonOwnDefence.length / 10); i > 0; i--) { nonOwnDefence.shift(); nonOwnDefence.pop(); }
  let averageNonOwnDefence = 0;
  if (nonOwnDefence.length) {
    averageNonOwnDefence = Math.ceil(nonOwnDefence.reduce((s, v) => s + v, 0) / nonOwnDefence.length);
  }
  if (totalOwnPlanets === 0) return;           // alive only through fleets in flight
  const avgKill = totalKill / totalOwnPlanets;
  const avgProd = totalOwnProduction / totalOwnPlanets;

  // Defence: half the fleet spread over the planets, less as the empire grows,
  // capped by the universe's average defence and by what the enemy can throw.
  let base = Math.ceil(((totalOwnFleet / 2) / totalOwnPlanets) *
    (1 - totalOwnPlanets / (totalOwnPlanets + totalEnemyPlanets)));
  const originalBase = base;
  const capped = Math.trunc(1.5 * averageNonOwnDefence);
  const enemyAttackPerOwnPlanet = Math.ceil(totalEnemyDefence / totalOwnPlanets);
  if (base > capped) base = capped;
  if (base > enemyAttackPerOwnPlanet) {
    base = enemyAttackPerOwnPlanet;
    if (base < avgProd) base = originalBase;   // end game: keep a real minimum
  }
  if (totalEnemyPlanets === 0) base = Math.trunc(totalOwnFleet / totalOwnPlanets);

  const ordered = () => [...player.fleets, ...player.newFleets];
  for (const home of planets) {
    if (home.owner !== p) continue;
    let surplus = home.ships - defenceFor(home, base, avgKill, avgProd);   // can be negative
    let upstream = home, upstreamDistance = Infinity;
    let support = home, supportDistance = Infinity;
    const targets = [];
    for (const other of planets) {
      if (other.owner === p) {
        if (other === home) continue;
        const dist = distance(home, other);
        if (dist <= upstreamDistance && other.kill > home.kill) { upstream = other; upstreamDistance = dist; }
        if (dist <= supportDistance && other.ships < defenceFor(other, base, avgKill, avgProd)) {
          support = other; supportDistance = dist;
        }
        continue;
      }
      if (ordered().some((f) => f.destination === other.name)) continue;  // already on its way
      const dist = distance(home, other);
      const isNeutral = other.owner === NEUTRAL;
      const production = isNeutral ? state.options.NeutralsProduction : other.production;
      let killOther = other.kill;
      const killHome = home.kill;
      if (killOther < 0.1) killOther = 0.1;
      if (killHome < 0.1) killOther = 0.1;     // (sic) the original's quirk
      let needed = Math.ceil((other.ships + Math.ceil(dist) * production) * killOther / killHome);
      if (needed === 0) needed++;
      let score = needed * dist;
      score *= 1 / (killOther / avgKill);
      score *= 1 / (other.production / avgProd);
      targets.push({ score: (isNeutral ? 1.1 : 1.0) * score, planet: other, needed, dist });
    }
    // QMultiMap order: by score, ties in insertion order (a stable sort).
    targets.sort((a, b) => a.score - b.score);
    let skip = 3;
    for (const t of targets) {
      if (skip <= 0) break;
      skip--;
      if (upstream !== home && t.dist > 2 * upstreamDistance) continue;
      if (surplus > 0 && surplus > t.needed) {
        const keep = defenceFor(t.planet, base, avgKill, avgProd);
        const size = surplus > t.needed + keep ? t.needed + keep : surplus;
        if (size > 0 && sendFleet(state, home, t.planet, size)) { surplus -= size; skip++; }
      }
    }
    if (support !== home && supportDistance < 2 * upstreamDistance) {
      const helping = ordered().some((f) => f.destination === support.name && f.owner === p);
      if (!helping && surplus > 0) { sendFleet(state, home, support, surplus); surplus = 0; }
    }
    if (upstream !== home && surplus > 3 * home.production) sendFleet(state, home, upstream, surplus);
  }
}
