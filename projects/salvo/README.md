# Salvo

Battleship by the salvo rule: each turn a side fires one shot for every ship
it still has afloat, so every loss costs firepower. Your ConEx fleet against
an Override and konex pirate fleet.

![Turn eight: three pirates sunk, four of yours afloat, three shots of the next salvo aimed; the Necromancer's targeting picture under Destroyed](screenshot.png)

| | |
| --- | --- |
| Technique | two Canvas 2D boards redrawn on events (no animation loop), keyboard aiming on a focusable canvas, a probability-map opponent |
| Your fleet | Dart (5), Tomaquad (4), Large Pin (3, the only Pin), Yodacon (3), Gryphon (2), Defender (2) |
| The pirates | Necromancer (5), Trident (4), the 1998 Yodacon (3), Citrus (3), Callisto (2), Advisor (2) |
| Frames | ships lie on frame 0 (bow north) or 9 (bow east), scaled to their berth from each hull's length and beam, measured from frame 0's alpha at load |
| Pictures | a sunk pirate shows its 1997 targeting picture; the 1998 Yodacon's comm portrait is the pirate captain |

Ships never touch, not even at the corners. Before your first shot you can
shuffle your fleet, or click a ship and then empty space to move it, and
click it again to turn it.

The computer counts every way each surviving ship could still lie, given the
misses, the sunk ships and the space round them. Placements through hits it
hasn't finished count far more, so it finishes what it starts, and a salvo
spreads out unless it is chasing a hit. Easy adds noise to the map; Hard
takes it straight. Fewest turns to win is kept per level in `localStorage`.

Keys: on the pirate board, arrows move, <kbd>Space</kbd> aims or un-aims,
<kbd>Enter</kbd> fires.

Play-test: `node tools/drive_page.mjs "<url>/projects/salvo/?level=normal&games=20" projects/salvo/playtest/battle.js`
plays twenty games with the reveal delays off, choosing its salvo from the
computer's own map, then plays one turn with mouse clicks. Playing the
computer's own strategy, it wins about half the time on Normal.

Ships from the Yodacon Ship Pack by Paul Richeson (ConEx, 1997; ConEx Override,
1998), GPL-2.0-or-later — https://github.com/yodacon/yodacon-ship-pack
