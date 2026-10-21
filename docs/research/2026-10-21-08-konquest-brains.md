# 08 · Konquest's computer players, and Easy / Medium / Hard

| | |
| --- | --- |
| Sources | `src/players/ai/becai/becai.cpp` (23,269 bytes, SHA-256 `2e93e192dc24…`) and `becai.h` (582 bytes, `ffa9e2ca4bdf…`), fetched from KDE's GitHub mirror `KDE/konquest` at commit `3a90a7ed` (the same commit as report 05) · `default.cpp` from report 05 |
| Retrieved | 2026-10-21 23:00:03 UTC |
| Process note | invent.kde.org answered **502 Bad Gateway** at 22:59 UTC; the GitHub mirror was used, and its `master` was confirmed to be the same commit through the GitHub API |
| Then | both brains ported to `projects/konquest/rules.js` and played against each other by `tournament.mjs` |

## Konquest's two brains

**Default** (`default.cpp`) has three levels that differ only in two numbers:
the least ships worth moving (Weak 20, Normal 10, Hard 30) and a divisor for
reinforcements (2, 2, 3). Each turn, each of its planets with enough ships
sends 70% of them at the nearest planet that has fewer, or else reinforces
the nearest weak planet of its own. The source's comments label Normal
"Offensive" and Hard "Defensive".

**BecAI** (`becai.cpp`) plans. Each turn it:

1. measures the game: its own fleet, production and average kill percentage;
   the enemies' planets and defence; the average defence of every planet it
   doesn't own, trimming the top and bottom tenth;
2. sets a **defence** for each of its planets: half its fleet spread over its
   planets, shrinking as its share of the galaxy grows, capped by the
   universe's average defence and by what the enemy could send, and weighted
   up for planets that produce more and kill better;
3. works out, for every target, the **smallest fleet that wins**:
   `ceil((ships + ceil(distance) × production) × kill(target) / kill(home))`,
   the defenders it will meet including those built while the fleet travels;
4. **ranks** targets by that cost × distance, divided by their kill
   percentage and production (rich, deadly planets first), with a 10% penalty
   on neutrals ("Neutrals don't harm us, enemies do"); it tries the best three;
5. sends the fleet plus a garrison for the planet it is about to own;
6. sends what is left to support a planet below its defence, or **upstream**
   to its nearest planet with a better kill percentage.

Ported line by line, including one slip in the original: a home planet with a
kill percentage under 0.1 resets the *target's* value, not its own.

## Tournament

`node projects/konquest/tournament.mjs 200`: every pairing plays 200 seeded
games on the default map (10 × 10, 3 neutrals), seats swapped every other
game; then 200 four-player games on a 12 × 12 map with 8 neutrals, seats
rotated. Games still open at turn 300 count as undecided.

First, under Konquest's own names:

| Brain | Duel wins (600 games each) | Four-player wins (of 200) |
| --- | ---: | ---: |
| BecAI | 403 | 151 |
| Default, Normal | 344 | 19 |
| Default, Weak | 289 | 12 |
| Default, **Hard** | **112** | 17 |

**Konquest's "Hard" is the weakest player in practice.** It waits for 30 ships
before it does anything, which suits a beginner. So the pack names the
opponents by how they play:

| Opponent | Brain | Two-player results |
| --- | --- | --- |
| **Easy** | Default, Hard ("Defensive") | loses to Medium 39–146, to Hard 24–171 |
| **Medium** | Default, Normal ("Offensive") | beats Easy 146–39, loses to Hard 76–106 |
| **Hard** | BecAI | beats Easy 171–24 and Medium 106–76; wins 139 of 200 four-player games |
| *Konquest Weak* | Default, Weak | between Easy and Medium; kept under its own name |

The test suite replays 60 seeded duels and fails if Hard stops beating
Medium or Medium stops beating Easy.
