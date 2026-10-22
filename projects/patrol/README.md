# Patrol

Pac-Man with the pack's ships. Sweep a maze of asteroid belts clear of cargo
pods while four pirates hunt you, each its own way. A fuel cell overcharges
your guns and the pirates run; catch them while they do. Ships fly on frames
0, 9, 18 and 27, the way they face down each lane.

![Belt Station: the Yodacon at the right, the four pirates running from it in their blue rings](screenshot.png)

| | |
| --- | --- |
| Technique | Canvas 2D, a 27 × 22 tile maze written as its left half and mirrored, movement by tile and progress so turns happen exactly at tile centres, the belts painted once per maze to an OffscreenCanvas |
| Your ship | Citrus, Advisor, Gryphon, Defender, Callisto or Yodacon |
| The pirates | the arcade's four rules: the **Dart** chases your tile; the **Necromancer** aims four tiles ahead of you; the **Trident** aims at the point beyond you that mirrors the Dart; the **Tomaquad** chases until within eight tiles, then heads for its corner. They scatter to their corners and hunt in turns (7 s and 20 s), and reverse when the mode changes. From level 4 the 1998 Yodacon leads in the Dart's place, a little faster |
| The freighter | the Large Pin calls below the hold a third and two thirds of the way through each level, turning slowly through its 36 frames; 500 points plus 250 a level |

Three mazes in turn: Belt Station, Twin Belts and The Spiral, each a little
faster than the last time round, the pirates leaving the hold sooner and
running for less time.

**Decoy** (<kbd>Space</kbd> or <kbd>E</kbd>, or tap the maze): once a level, a
beacon where you are. For six seconds every pirate that is not running from
you heads for it instead of you.

Pods 10, fuel cells 50, pirates 200, 400, 800 and 1,600 for each one caught on
the same cell. A ship every 10,000. The best score is kept in `localStorage`.

Keys: arrows or <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> to steer
(a turn is held until the lane opens), <kbd>Space</kbd> decoy, <kbd>Enter</kbd>
another game. On a touch screen, swipe to steer.

Play-test: `node tools/drive_page.mjs "<url>/projects/patrol/?hull=0" projects/patrol/playtest/sweeper.js`
searches the lanes breadth first for the nearest pod or running pirate, keeping
two tiles clear of every hunter, and drops the decoy when one is three tiles
off. In three runs it cleared Belt Station in about 50 seconds and lost its
last ship on Twin Belts.

Ships from the Yodacon Ship Pack by Paul Richeson (ConEx, 1997; ConEx Override,
1998), GPL-2.0-or-later — https://github.com/yodacon/yodacon-ship-pack
