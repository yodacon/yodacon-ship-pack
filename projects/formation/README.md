# Formation

Snake with the pack's ships. Fly the Yodacon round a minefield and pick up
stranded ships; each one falls in behind you and follows your exact path,
drawn on the frame for its own heading, so the line bends through the frames
as it turns. Every rescue lays another mine.

![Sixteen ships in a line curving through the minefield, the Citrus stranded ahead](screenshot.png)

| | |
| --- | --- |
| Technique | Canvas 2D, a fixed 60 Hz step; the leader's path is kept with its distance along, and each follower is placed at its spacing behind the leader by interpolating it |
| Frames | followers take the heading of the path where they are; a stranded ship tumbles through all 36 frames while it waits |
| Sizes | every hull is drawn 34 px long, scaled from its length on frame 0 read from the sprite's alpha (they run from 24 to 87 px) |
| Ships | the Yodacon leads; Gryphon, Trident, Citrus, Defender, Dart, Advisor, Necromancer, Callisto, Tomaquad, the Large Pin (the only Pin) and the 1998 Yodacon come in that order, then at random |

**Phase** (<kbd>Space</kbd> or <kbd>Shift</kbd> while flying, or the button):
the formation slips into hyperspace for 1.2 seconds, a flickering ghost that
passes through mines and its own line, though not the edge of the field. You
start with one charge and earn another every five rescues.

Two levels: **Minefield**, and **Drift**, where every mine wanders at 14–30
px a second and bounces off the edges. The best score is kept for each.

A rescue scores ten points for every ship in the line, triple for the Large
Pin and the 1998 Yodacon, and speeds you up. Hit a mine, the edge of the field
or your own line and it's over. The best score is kept in `localStorage`.

Controls: <kbd>←</kbd> <kbd>→</kbd> or <kbd>A</kbd> <kbd>D</kbd> steer;
on a touch screen hold the left or right half of the field; gamepad stick or
d-pad. <kbd>Enter</kbd> or <kbd>Space</kbd> starts.

Play-test: `node tools/drive_page.mjs "<url>/projects/formation/?games=3" projects/formation/playtest/fly.js`
tries five steering settings several times a second, flies each ahead in its
head, drops any that meet a mine, the edge or the line, and takes the one
that ends nearest the stranded ship; when nothing is safe it phases, if it
can. It builds lines of 26–28 ships on Minefield and 20–23 on Drift.

Ships from the Yodacon Ship Pack by Paul Richeson (ConEx, 1997; ConEx Override,
1998), GPL-2.0-or-later — https://github.com/yodacon/yodacon-ship-pack
