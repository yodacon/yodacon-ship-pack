# Refit

A match-3 with the pack's ships. Swap two neighbours to line up three or more
of a kind, and reach each level's target within 25 moves.

![Level two: the yard of coloured berths, a Callisto picked and turning, the target meter beside](screenshot.png)

| | |
| --- | --- |
| Technique | Canvas 2D, a fixed 60 Hz step, a small state machine (swap, clear, fall, settle) so cascades play out in order; click, drag or keys |
| Frames | every ship turns on its frames, the short way round, to face the way it moves: sideways when swapped, nose down as it falls, nose up when it settles; a picked ship spins, and specials slowly turn |
| Ships | Gryphon, Trident, Defender, Dart, Necromancer, Citrus, then Tomaquad, Callisto and Advisor join as the levels go (six kinds to start, nine by level seven) |
| Specials | four in a row leaves a **Yodacon**, which clears the 3 × 3 round it when it is swapped or caught in a blast; five in a row, an L or a T leaves a **Large Pin** (the only Pin), which clears its row and column; specials set each other off |
| Sizes | each hull is scaled so its longer side fills most of a cell, measured from frame 0's alpha |

The grey hulls look alike at a glance, so each kind sits on its own colour.
Cascades multiply the score. A swap that makes nothing swaps back for free.
After six quiet seconds a possible move lights up, and a board with no moves
is reshuffled. The best score is kept in `localStorage`.

Play-test: `node tools/drive_page.mjs "<url>/projects/refit/?games=3" projects/refit/playtest/match.js`
tries every swap, scores what it would clear at once, and plays the best (the
first move by mouse drag). Playing greedily like this it reaches level 3;
setting up combos gets further.

Ships from the Yodacon Ship Pack by Paul Richeson (ConEx, 1997; ConEx Override,
1998), GPL-2.0-or-later — https://github.com/yodacon/yodacon-ship-pack
