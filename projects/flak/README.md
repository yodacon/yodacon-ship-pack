# Flak

Missile Command with the pack's ships. Raiders dive on a fleet at anchor,
each drawn on the sprite frame for its line of attack; three Defender
batteries turn on their own frames to aim where you point and throw flak
that bursts where you clicked.

![Wave nine: Gryphons and Tridents diving on their real headings, flak bursting, the right-hand Defender battery turned to aim](screenshot.png)

| | |
| --- | --- |
| Technique | Canvas 2D, a fixed 60 Hz step, pointer and keyboard aiming |
| Frames | raiders fly on the frame for their dive (between about frames 13 and 23); each battery is a Defender at 1.4× turned to the frame for its last shot |
| The fleet | Yodacon, Callisto, Large Pin (the only Pin), Tomaquad, Advisor, Citrus, nose up |
| Raiders | Tridents, fast Gryphons, Necromancers that split into three Tridents on the way down, Darts that take two bursts, and every fifth wave the 1998 Yodacon (four bursts) |

Ten rounds a battery a wave; the centre battery's shells are faster. A kill
leaves a small burst of its own, so kills can chain. Rounds left and ships
afloat score at the end of a wave, multiplied as the waves go on, and every
10,000 points a lost ship comes back. A battery that is hit is out until the
next wave. The best score is kept in `localStorage`.

Controls: click or tap where the flak should burst (the nearest battery with
rounds fires); <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> or <kbd>A</kbd>
<kbd>S</kbd> <kbd>D</kbd> fire a chosen battery at the crosshair,
<kbd>Space</kbd> the nearest; the arrow keys move the crosshair.

Play-test: `node tools/drive_page.mjs "<url>/projects/flak/?noise=10" projects/flak/playtest/defend.js`
starts with a click, then leads the most urgent raider nobody has a shell on
yet, aiming `noise` px off at random, and steps the game with `tick()`. With
noise 4 or 14 it holds until wave 10.

Ships from the Yodacon Ship Pack by Paul Richeson (ConEx, 1997; ConEx Override,
1998), GPL-2.0-or-later — https://github.com/yodacon/yodacon-ship-pack
