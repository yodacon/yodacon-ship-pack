# Rockfall

Asteroids with the pack's ships. Turn on the sprite's frames, thrust along the
frame shown, and break up the rocks: big into two middling, middling into two
small. A Necromancer crosses now and then and fires at random; from wave 4 a
Dart does too, faster, and it aims. The screen wraps.

![Wave four: the Yodacon among the rocks, a raider coming in from the edge](screenshot.png)

| | |
| --- | --- |
| Technique | Canvas 2D, a fixed 60 Hz step, wrap-around space with wrap-aware collisions, procedural rocks (a jagged polygon each, lit from the upper left) |
| Your ship | Gryphon, Defender, Trident, Citrus, Advisor, Callisto or Yodacon; turn from `Maneuver`, thrust from `Accel`, top speed from `Speed`, rate of fire from `Maneuver`; Advisor and Citrus get numbers in the 1997 ranges |
| Sizes | every ship is drawn 30 px long, scaled from its length on frame 0, read from the sprite's alpha |
| Raiders | the Necromancer (two hits, 500 points) and the Dart (one hit, 1,000) |

**Hyperspace** (<kbd>H</kbd> or <kbd>Shift</kbd>, gamepad B, or JUMP on a
touch screen): three jumps a wave, somewhere at random and clear of rocks if it
can be. One jump in eight goes wrong and costs a life.

Rocks score 20, 50 and 100; an extra life every 10,000. The best score for each
hull is kept in `localStorage`.

Keys: <kbd>←</kbd> <kbd>→</kbd> turn, <kbd>↑</kbd> thrust, <kbd>Space</kbd>
fire, <kbd>H</kbd> hyperspace, <kbd>Enter</kbd> another game.

Play-test: `node tools/drive_page.mjs "<url>/projects/rockfall/?hull=0" projects/rockfall/playtest/pilot.js`
leads the nearest target and fires when lined up, turns away and thrusts from
a rock about to arrive, and jumps when one is about to hit, flying through
`state.auto` and stepping with `tick()`. It reaches wave 7 with the Gryphon and
the Yodacon.

Ships from the Yodacon Ship Pack by Paul Richeson (ConEx, 1997; ConEx Override,
1998), GPL-2.0-or-later — https://github.com/yodacon/yodacon-ship-pack
