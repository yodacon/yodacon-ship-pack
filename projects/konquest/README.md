# Konquest

KDE's [Konquest](https://apps.kde.org/konquest/) in the browser: conquer a
galaxy by sending fleets between planets, with **Konquest's exact rules**, and
the pack's ships flying the fleets. Each seat flies its own hull, from the
Yodacon to Citrus; the news shows the comm portrait of whoever acted.

![Three computer players mid-game](screenshot.png)

## How to play

Each player starts with one planet. Pick one of yours, pick a destination,
choose how many ships, **Send**; repeat, then **End turn**. Ships arrive after
`ceil(distance / 2)` turns: hover a planet to see the distance from the one
you picked. A fleet landing on your own planet reinforces it; on anyone
else's, it fights. The last player with planets or fleets wins.

- **Standing order**: tick it to send the same ships every turn the planet
  can afford them.
- **Hot seat**: add several human players; the board is hidden between turns.
- **Opponents**: Easy, Medium and Hard, named by how they play, not by
  Konquest's labels. Easy is Konquest's "Hard" brain, which the source calls
  Defensive (it waits for 30 ships); Medium is its Normal brain; Hard is
  BecAI, Konquest's planner. A 200-game tournament set the order
  ([research 08](../../docs/research/2026-10-21-08-konquest-brains.md)).
- **Watch**: `?watch` sets Easy, Medium and Hard against each other.
  `?seed=N` replays a galaxy; **Rematch** at the end replays the same one.
- **How to play** opens beside the board; **Sound** toggles the confirmation
  beeps (made in Web Audio, remembered between visits).

## The rules, and where they come from

Everything is in [`rules.js`](rules.js), a module with no DOM, read from
Konquest's source at commit `3a90a7ed`
([research report 05](../../docs/research/2026-10-21-05-konquest-source.md)).
Each rule names the C++ file it comes from:

| Rule | Konquest | Here |
| --- | --- | --- |
| Map | 10 × 10, 3 neutral planets | the same defaults, up to 20 × 20 |
| Home planet | production 10, kill 0.400 | the same |
| Neutral planet | production 5–14, kill 0.30–0.90, makes 1 ship a turn | the same |
| Travel | `ceil(√(dx² + dy²) / 2)` turns | the same |
| Battle | one ship at a time; defender's roll, then attacker's; attacker uses its **source** planet's kill % | the same, credits included |
| Turn order | Neutral (arrivals, production, winner) → players | the same |
| Computer players | Weak / Normal / Hard: 70 % of a planet's ships at the nearest weaker planet, else reinforce | the same, minimums 20 / 10 / 30 |
| Options | blind map, cumulative production, production after conquest, neutrals show ships / stats, neutral production | all five, plus neutral production |

What differs: the random numbers (a seeded generator, so a game can be
replayed, instead of Qt's), the planets (the pack's generated set, sized by
production), and the fleets (drawn as ships on their way, which Konquest does
not show). The look follows [docs/STYLE.md](../../docs/STYLE.md).

```sh
node --test projects/konquest/test.mjs           # 26 tests, one or more per rule
node projects/konquest/tournament.mjs 200        # the opponents, played against each other
make serve &                                     # then play whole games through the page:
node tools/drive_page.mjs 'http://localhost:8000/projects/konquest/?seed=7' projects/konquest/playtest/greedy.js
```

`playtest/` holds scripted players that drive the real page (clicks, Send,
End turn) to the end of a game: `greedy.js` throws everything at the nearest
planet, `careful.js` keeps a home guard and checks the ending and Rematch,
and `hard-human.js` plays the human seat with BecAI to reach a victory.

## Copying it

`rules.js` works anywhere JavaScript runs: import it, call `newGame`, then
`sendFleet` and `endTurn`. `konquest.js` shows one way to draw it; the ship
drawing is the pack's `drawShip`.

## Credit

Rules: Konquest by KDE (GPL-2.0-or-later), reimplemented from its source.
Ships from the Yodacon Ship Pack by Paul Richeson (ConEx, 1997),
GPL-2.0-or-later — https://github.com/yodacon/yodacon-ship-pack
