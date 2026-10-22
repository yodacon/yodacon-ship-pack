# Wake

Light cycles with the pack's ships. Four ships cross a grid, each leaving an
ion wake behind it; fly into a wake, a rock or the edge and you are out. Be the
last one flying to clear the arena. Ships turn only at right angles, so each
flies on frame 0, 9, 18 or 27 of its sprite.

![Arena three: four wakes winding between the planets](screenshot.png)

| | |
| --- | --- |
| Technique | Canvas 2D, a 64 × 44 grid in a `Uint8Array`, simultaneous moves resolved together (head-on crashes take both ships), the head drawn sliding into its cell between steps |
| Your ship | Yodacon, Gryphon, Citrus, Defender, Advisor or Callisto |
| Rivals | three an arena, so every design flies somewhere: the Dart, Trident and Citrus; Necromancer, Defender and Advisor; Tomaquad, Gryphon and Large Pin; Callisto, Dart and Necromancer; the 1998 Yodacon, Callisto and Tomaquad |
| Rivals' reckoning | each step a rival counts the open cells beyond each of its three moves (a flood fill, up to a limit that grows by arena) and takes the roomiest, keeping straight on a tie; early rivals also turn on a whim, later ones cut across your bow |

The five arenas, each faster: Open Grid, Asteroid Field (clumps of rock),
Four Planets, Closing Ring (the outermost open ring turns to wall every few
seconds) and Override Run. Three lives.

**Jump** (<kbd>Space</kbd>, or tap the grid): once a round, three cells
straight ahead over whatever is in between. The landing must be clear. It
leaves a gap in your wake that any ship can fly through. From the Closing Ring
on the rivals have a jump too, and use it when boxed in.

Keys: arrows or <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> to turn
(two turns can be queued, for a tight U-turn), <kbd>Space</kbd> jump,
<kbd>Enter</kbd> another game. On a touch screen, swipe the grid to turn.
The best score is kept in `localStorage`.

Play-test: `node tools/drive_page.mjs "<url>/projects/wake/?games=4" projects/wake/playtest/rider.js`
flies your ship with the rivals' own reckoning at full depth through
`state.auto`, stepping with `tick()`. In four games it ended in arenas 2, 3 and
4 and once cleared all five.

Ships from the Yodacon Ship Pack by Paul Richeson (ConEx, 1997; ConEx Override,
1998), GPL-2.0-or-later — https://github.com/yodacon/yodacon-ship-pack
