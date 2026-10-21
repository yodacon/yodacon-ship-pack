# Cutaway

Ship recognition, like a spotter's card deck: the target box shows a ship's
1997 targeting cutaway (the green wireframe *Escape Velocity* drew when you
locked on), and you name the hull from four comm portraits before the timer
runs out. Ten rounds; faster answers and streaks score more.

![A round: the Trident's cutaway, four comm portraits to choose from](screenshot.png)

| | |
| --- | --- |
| Technique | plain DOM; a CSS gradient for the scanning slice, `scaleX(-1)` for mirrored rounds |
| Pictures | three kinds per ship from the pack: target (the question), comm (the answers), yard (the reveal) |
| Ships | every ship in `catalog.json` with a target picture, all three editions |
| Rounds | 1–3 the whole picture; then a scanning slice; then mirrored; then both |
| Keys | <kbd>1</kbd>–<kbd>4</kbd> answer |

Some pictures are shared in the originals: the three 1997 Pins have one target
picture, as do the 1998 Pins, and the 1/4 Defender has the Defender's. So no
two answers share a name, a Pin never stands against another Pin, and the 1/4
Defender sits out. `playtest/spotter.js` plays a full game and checks that
every round offers four distinct names with the right one among them.

Ships from the Yodacon Ship Pack by Paul Richeson (ConEx, 1997),
GPL-2.0-or-later — https://github.com/yodacon/yodacon-ship-pack
