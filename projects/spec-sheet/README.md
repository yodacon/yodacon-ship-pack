# Spec Sheet

Top Trumps on the 1997 records. Twelve cards, six each. Whoever has the call
picks a line from their top card, and the higher number takes both cards; a
tie leaves them in the middle for the next winner. The winner calls next.

![A reveal: your Large Pin's Shield of 2160 against the Trident's 250](screenshot.png)

| | |
| --- | --- |
| Technique | pure DOM; each card an `<article>` of buttons, one per line, with a bar against the deck's best (price on a log scale) |
| The deck | Yodacon, Dart, Necromancer, Tomaquad, Defender, Gryphon, Trident, Large Pin (the only Pin), Callisto, the 1998 Yodacon, Advisor and Citrus |
| Lines | Speed, Acceleration, Maneuver, Shield, Armour, Cargo (`Holds`), Crew, Guns (the sum of `WeapCount`), Price (`Cost`), all from `ship.json`; konex's Advisor and Citrus have no record, so this game sets theirs |

**Scan** (<kbd>S</kbd> or the button): twice a game, see their card before you
call.

The computer calls the line its card ranks highest on in the deck. On
**Admiral** it reads your card and calls the line it wins by most. Thirty
rounds, or until one side has the lot; wins per level are kept in
`localStorage`. Keys: <kbd>1</kbd>–<kbd>9</kbd> call a line.

Play-test: `node tools/drive_page.mjs "<url>/projects/spec-sheet/?level=normal" projects/spec-sheet/playtest/trumps.js`
plays twenty games with the delays off, calling as the Normal computer does
and scanning when its best line is weak, and makes the first call by
clicking. It wins about half on either level.

Ships, pictures and records from the Yodacon Ship Pack by Paul Richeson
(ConEx, 1997; ConEx Override, 1998), GPL-2.0-or-later — https://github.com/yodacon/yodacon-ship-pack
