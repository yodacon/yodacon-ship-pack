# 05 · Konquest's source code: the exact rules

| | |
| --- | --- |
| Source | https://invent.kde.org/games/konquest, branch `master` at commit `3a90a7ed795db7245681e0b9e35472f67a3dd28d` (2026-10-10) |
| Retrieved | 2026-10-21 22:40:42–22:40:53 UTC: the `src/` tree listing, then 16 files raw |
| Method | GitLab API for the tree (`/api/v4/projects/games%2Fkonquest/repository/tree?path=src`), then `-/raw/master/src/<file>` for each, all through `tools/research_fetch.py` |
| Licence | GPL-2.0-or-later (KDE Games) |
| Process note | The first batch was fetched with a cache that named files by the second; files fetched in the same second overwrote one another. The tool now adds a hash prefix; everything was re-fetched, and every file read before the fix was confirmed byte-identical by SHA-256 |

| File | Bytes | SHA-256 (first 12) |
| --- | ---: | --- |
| `game.cpp` | 5,730 | `352e77d9ba7a` |
| `game.h` | 2,670 | `48cb35d68fd0` |
| `localgame.cpp` | 2,346 | `5acaf5b2233e` |
| `planet.cc` | 2,951 | `9d1dea363089` |
| `fleet.cc` | 1,868 | `bb669b03e11d` |
| `map/map.cc` | 5,496 | `e5c9a19e865f` |
| `players/player.cpp` | 3,034 | `051d4ba6df82` |
| `players/neutralplayer.cpp` | 1,355 | `0d19bf71f5e1` |
| `players/ai/default/default.cpp` | 4,042 | `4f31a430e34d` |
| `dialogs/newgamedlg.cc` | 21,672 | `27e3ca588ece` |

## The rules, from the code

### Board and planets

- The map is a grid of sectors, **10 × 10 by default** (`Map(10, 10)`, dialog
  defaults `SizeWidth`/`SizeHeight` = 10). Each sector holds at most one planet.
- Planets are placed in **random free sectors**: one per player, then the
  neutrals (dialog default **3 neutral planets**).
- Names run **A, B, … Z, AA, AB, …**: the first name not yet taken.
- A **player's home planet**: production **10**, kill percentage **0.400**.
- A **neutral planet**: production `5 + random(0..9)` = **5–14**, kill percentage
  `0.30 + random[0, 0.60)` = **0.30–0.90**.
- Every planet starts with **0 ships**; the first turn's production fills them.
- A planet also gets a random look, 0–9, for its picture.

### Distance and travel

- `distance = sqrt(dx² + dy²) / 2`, in sectors. The source's own comment: "Yes,
  we're dividing by two. It's not a bug, it's a feature."
- A fleet sent on turn *t* arrives on turn `t + ceil(distance)`.
- A fleet can only be as large as the planet's current ships; they leave at once.

### Turn order

The game is a state machine: **Neutral → Player 1 → … → Player n → Neutral …**,
starting with Neutral. The Neutral step is the "turn" itself:

1. The turn counter goes up by one.
2. For every player, every fleet whose arrival turn is now **arrives** (in the
   order the fleets were launched).
3. Every planet **produces**: owned planets add their production; neutral
   planets add `NeutralsProduction` (default **1**). With the option
   *ProductionAfterConquere* (default **on**) a planet produces even on the
   turn it was taken. With *CumulativeProduction* (default **off**), a
   planet's production rises by 1 each turn.
4. **Win check**: if exactly one non-neutral player is still alive, the game
   ends. A player is dead with no planets and no fleets in flight.

Each player then orders fleets; new fleets join the player's in-flight list
when that player ends the turn. **Standing orders** (a fleet re-sent every turn)
are launched at that point too, if the source planet has the ships.

### Arrival and battle

- Fleet owner = planet owner: the ships **join** the planet's fleet
  ("Reinforcements have arrived").
- Otherwise a **battle**, fought one ship at a time until one side is empty.
  Each round draws two random numbers in [0, 1), *a* for the attacker and *d*
  for the defender:
  1. If **both** kill percentages are 0: the lower roll loses a ship
     (`a < d` → the defender loses one, else the attacker loses one).
  2. If `d < defender's kill %` → the attacker loses a ship.
  3. If the attacker has 0 ships → **the planet holds**.
  4. If `a < attacker's kill %` → the defender loses a ship.
  5. If the defender has 0 ships → **the planet falls**.
- **Kill percentages:** the attacker uses its **source** planet's; the
  defender uses the **defended** planet's.
- **Conquest:** the planet's owner changes, its fleet becomes the surviving
  attackers, its production resets to its original value, and the old owner's
  standing orders from it are cancelled.

### The default computer player (Weak / Normal / Hard)

For each planet it owns, in board order:

- `ships = floor(0.7 × ships on the planet)`; act only if `ships ≥ minimum`
  (Weak **20**, Normal **10**, Hard **30**).
- **Attack:** among planets it doesn't own with fewer ships than `ships`,
  closer than distance 100, and not already the target of one of its
  in-flight fleets, pick the **nearest**; send `ships`.
- **Otherwise reinforce:** among its own planets with fewer ships than half
  this planet's, not already targeted, pick the nearest; send
  `floor((this planet's ships − that planet's ships) / factor)` (factor: Weak
  **2**, Normal **2**, Hard **3**).

### Players and colours

Up to 10 players. Colours in order: `#8282ff`, yellow, red, green, white, cyan,
magenta, `#eb992e`, `#6a9d68`, `#839980`.

## What this means for a browser Konquest

- **Every rule above fits in a few hundred lines of plain JavaScript** with no
  dependencies: a map, planets, fleets, a battle loop, and a turn machine in
  the order Neutral → players.
- **Accuracy target**: the same rules, defaults and AI, written so each rule
  above has a test. The random numbers will differ (Qt's generator is not
  reproduced), so a seeded generator makes a browser game replayable instead.
- **What the pack adds**: fleets in flight drawn as real ships from the pack
  (each player a different hull), comm portraits in the news, planets drawn
  in code until the pack has planet sprites.
