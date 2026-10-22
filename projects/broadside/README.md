# Broadside

Turn-based artillery across a field of planets. Two fleets of three face each
other; on its turn a ship turns on its frames to the angle you give it and
fires one shell, and every planet's gravity bends the shot.

![The Gap: the pirate Citrus's shell in flight across the gas giant toward the ConEx line](screenshot.png)

| | |
| --- | --- |
| Technique | Canvas 2D; one pure `simulate()` flies a shell under the planets' pull, draws the aim preview, and lets the computer try shots in its head |
| Frames | each ship turns to the frame for its aim as you drag or press the keys |
| Fleets | three maps, every design flying once between them: the Yodacon, Tomaquad and Defender against the Necromancer, Callisto and Citrus; the Dart, Gryphon and Large Pin (the only Pin) against the Trident, Advisor and 1998 Yodacon; the Yodacon, Advisor and Trident against the Callisto, Dart and Gryphon |
| Damage | hull 2·√(Shield + Armor); a direct hit does 18 + a quarter of the firing hull's sprite size, a near miss (within 46 px) half |

**Special**, once a battle per ship: a **heavy shell** (double damage) from a
hull 60 px or more, or a **spread of three** from a smaller one. Arm it with
<kbd>S</kbd> or the button before you fire.

The computer tries 60, 160 or 400 shots in its head (Easy, Normal, Hard),
refines the best, then misses by its level's margin. It saves its specials for
the end game.

Controls: drag back from your ship and let go, like a slingshot; or
<kbd>←</kbd> <kbd>→</kbd> angle, <kbd>↑</kbd> <kbd>↓</kbd> power,
<kbd>Space</kbd> fire.

Play-test: `node tools/drive_page.mjs "<url>/projects/broadside/?level=normal" projects/broadside/playtest/duel.js`
fires once by mouse drag, then plays six battles with your side aimed by a
simpler version of the computer's search, with shells flown four times as
fast. That side aims with the Normal margin of error, so it plays the Normal
computer about evenly (it won 5 and 4 of 6 in two runs) and loses to Hard (0
and 1 of 6).

Ships and planets from the Yodacon Ship Pack by Paul Richeson (ConEx, 1997;
ConEx Override, 1998), GPL-2.0-or-later — https://github.com/yodacon/yodacon-ship-pack
