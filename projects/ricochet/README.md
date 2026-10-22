# Ricochet

Breakout with the pack's ships. The bricks are pirate formations, every ship
nose down on frame 18, and the tougher the hull, the more hits it takes. Your
paddle is a ship too.

![The chevron formation: Advisors and Defenders in a V, the Callisto as the paddle](screenshot.png)

| | |
| --- | --- |
| Technique | Canvas 2D, a fixed 60 Hz step with sub-stepped ball movement (no tunnelling), bounce off the side with the shallower overlap |
| Pirates | Trident, Gryphon and Citrus (1 hit), Advisor, Defender and Necromancer (2), Dart and Tomaquad (3), Yodacon (4), and the Large Pin (14, a 2 × 2 boss, the only Pin) |
| Your paddle | the Callisto (96 px, slow), the Yodacon (76) or the Defender (56, quick); speed from `Speed` |
| Sizes | each pirate scaled to fit a 60 × 38 cell from its length and beam, read from frame 0's alpha |

Five formations: the picket line, a chevron, a fortress, an escort, and the
Large Pin. Then round two, every ship a hit tougher. Where the ball meets your
hull sets the angle out, up to 60° either side. From the third formation the
front rank drops bombs that stun the paddle for a second.

Pickups (12% of kills, and always from the Large Pin): **W** escort wings, two
Gryphons flying alongside for a wider paddle; **M** two more balls; **L**
lasers; **S** a slower ball.

**Tractor** (<kbd>Shift</kbd> or <kbd>C</kbd>, gamepad B, or the button):
three a formation. The next time the ball meets the paddle it is caught; launch
it again with <kbd>Space</kbd> or a click, from where it sits.

Play-test: `node tools/drive_page.mjs "<url>/projects/ricochet/?paddle=0" projects/ricochet/playtest/break.js`
works out where the lowest falling ball will meet the paddle's line, moves
there a little off centre to send it toward the most ships, and uses the
tractor on its last life. With the Callisto it reaches formation 4; with the
Defender, the Large Pin.

Ships from the Yodacon Ship Pack by Paul Richeson (ConEx, 1997; ConEx Override,
1998), GPL-2.0-or-later — https://github.com/yodacon/yodacon-ship-pack
