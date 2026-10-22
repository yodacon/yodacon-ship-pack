# Rally

Three laps through a course of gates around the pack's planets, against five
computer racers on other hulls. Every hull handles by its 1997 record, so the
Defender corners like a dart and the Tomaquad like a barge.

![Ten seconds into the Consolidated Loop: the Defender leading the field](screenshot.png)

| | |
| --- | --- |
| Technique | Canvas 2D, a camera that follows you over a 2400 × 1600 world, a minimap, two layers of parallax stars, a fixed 60 Hz step |
| Ships | eleven designs: ConEx's Defender, Gryphon, Trident, Dart, Yodacon, Necromancer, Tomaquad and Large Pin, Override's Callisto, konex's Advisor and Citrus |
| Stats | top speed, thrust and turn rate from Speed, Accel and Maneuver in each `ship.json` (× 0.75); light "racing dampers" so corners are possible |
| Pictures | the yard picture of your hull, comm portraits in the standings, the pack's generated planets as obstacles |
| Sound | `lib/yodacon-sound.js` |

The three Pins are one hull at three sizes, so only the Large Pin races.
Advisor and Citrus have no 1997 record; the game gives them numbers in the same
ranges (`KONEX_STATS`). Planets push you off and cost you speed. Your best time
for each hull on each track is kept in `localStorage`.

Three tracks: **Consolidated Loop** (eight gates round a gas giant),
**Vela Slalom** (eleven, weaving between four planets) and **Ember
Figure-Eight** (ten, crossing between two large planets).

Keys: <kbd>←</kbd> <kbd>→</kbd> or <kbd>A</kbd> <kbd>D</kbd> turn,
<kbd>↑</kbd>/<kbd>W</kbd> thrust, <kbd>↓</kbd>/<kbd>S</kbd> brake,
<kbd>Enter</kbd> race again. A gamepad works too (stick or d-pad, A or RT, LT).

Play-test: `node tools/drive_page.mjs "<url>/projects/rally/?hull=gryphon" projects/rally/playtest/race.js --timeout 760000`
races all three tracks with key presses, steering by the computer racers' own
line, and reports each finishing place.

Ships from the Yodacon Ship Pack by Paul Richeson (ConEx, 1997; ConEx Override,
1998), GPL-2.0-or-later — https://github.com/yodacon/yodacon-ship-pack
