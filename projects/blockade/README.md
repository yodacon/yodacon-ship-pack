# Blockade

A vertical scroller. Run a pirate blockade in three stages, each ending with
a capital ship: the Large Pin, the 1998 Yodacon from ConEx Override, and on
the Override Line, where konex's Citrus and Advisor fly with the pirates, the
Override Callisto.

![Stage one: Defenders swooping in on their real headings, a Dart diving, the gas giant drifting by](screenshot.png)

| | |
| --- | --- |
| Technique | Canvas 2D, portrait 480 × 640, a scrolling starfield and a planet drifting past, a fixed 60 Hz step |
| Frames | your ship flies nose up and **banks** through frames 35 and 34 (or 1 and 2) as it strafes; raiders come in on frame 18; swoopers and divers are drawn on the frame for their direction of travel; Necromancer turrets turn to aim at you |
| Your ships | Defender, Gryphon, Trident (ConEx), Citrus, Advisor (konex), Callisto (Override) |
| Raiders | Gryphon, Trident, Dart, Defender, Necromancer, Tomaquad, Yodacon, and on stage three Citrus and Advisor; the Large Pin (the only Pin), the 1998 Yodacon and the Override Callisto as bosses |
| Stats | strafe speed from `Speed`, responsiveness from `Accel`, shield from Shield + Armor, two gun streams for hulls 60 px and up; raiders' toughness from Shield + Armor |
| Sound | `lib/yodacon-sound.js` |

Patterns: lines, swoops, divers that drop in and then turn to come at you,
turrets that hold station for ten seconds and aim, and slow tanks with a spread.
**P** pickups give a spread shot, **S** shield. The **smart bomb**
(<kbd>B</kbd>, gamepad Y, or the button), once a stage, wipes every bomb on
screen and hits every raider six times, the boss too, with a shock ring and
a flash. Ramming hurts both of you. The
best score per ship is kept in `localStorage`.

Keys: <kbd>←</kbd> <kbd>→</kbd> <kbd>↑</kbd> <kbd>↓</kbd> or WASD fly,
<kbd>Space</kbd> fire (or tick *Fire on its own*), <kbd>B</kbd> smart bomb,
<kbd>Enter</kbd> another run. Touch: the ship follows your finger and fires on its own. Gamepad: stick,
A or RT.

Play-test: `node tools/drive_page.mjs "<url>/projects/blockade/?hull=gryphon" projects/blockade/playtest/run.js`
flies with the arrow keys, lines up under the lowest enemy, sidesteps bombs and
rams, uses the smart bomb when three bombs close in at once or a boss fills
the screen, and steps the game with `tick()`. The Gryphon gets through the
first two stages and falls in wave 11 of 14 on the Override Line; the
Callisto falls in stage two.

Ships from the Yodacon Ship Pack by Paul Richeson (ConEx, 1997; ConEx Override,
1998), GPL-2.0-or-later — https://github.com/yodacon/yodacon-ship-pack
