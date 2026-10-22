# Gauntlet

Pick any of the pack's thirteen designs and fight the others, one round each,
weakest first. The last round is the 1998 Yodacon from ConEx Override. One or
two players, on the keyboard, gamepads or the touch pad.

![Round seven: the Yodacon duelling the Callisto, the ladder of beaten hulls beside it](screenshot.png)

| | |
| --- | --- |
| Technique | Canvas 2D, a fixed 60 Hz step, the Gamepad API (standard mapping), Web Audio through `lib/yodacon-sound.js` |
| Ships | all thirteen designs: ConEx's ten, Override's Callisto, konex's Advisor and Citrus, and the Override Yodacon as the last opponent |
| Stats | from each `ship.json`: toughness 4·√(Shield + Armor), split between a regenerating shield and armour; speed, acceleration and turn rate from Speed, Accel and Maneuver; hulls 60 px and up carry two guns |
| Pictures | yard pictures on the pick screen, comm portraits for the opponent, thumbnails on the ladder |

The three Pins are one hull drawn at three sizes, so the pick screen shows them
as one card with a button per size, and only the Large Pin is fought. Advisor
and Citrus have no 1997 record; the game gives them numbers in the same ranges
(`KONEX_STATS` in `gauntlet.js`).

From the fourth round an escort joins the opponent (a beaten hull at 40%
strength), another every four rounds, and one more in two-player games. Opponents fight at 80% of their record. Shields
recharge three seconds after the last hit; repairs are free between rounds. A
lost round can be retried as often as you like, and each retry adds 15% to
your hull for that round; the best time for each hull is
kept in `localStorage`.

| | Player 1 | Player 2 | Gamepad |
| --- | --- | --- | --- |
| Turn | <kbd>←</kbd> <kbd>→</kbd> | <kbd>A</kbd> <kbd>D</kbd> | stick or d-pad |
| Thrust | <kbd>↑</kbd> | <kbd>W</kbd> | A or RT |
| Brake | <kbd>↓</kbd> | <kbd>S</kbd> | d-pad down or LT |
| Fire | <kbd>Space</kbd> | <kbd>F</kbd> | X, B or RB |
| Continue | <kbd>Enter</kbd> | | Start |

Pad 1 flies player 1 and pad 2 player 2, alongside the keys.

Play-test: `node tools/drive_page.mjs "<url>/projects/gauntlet/?hull=yodacon" projects/gauntlet/playtest/duel.js --timeout 650000`
picks the hull named in `?hull=` and flies player 1 with key presses, aiming
ahead of the nearest enemy, and reports how far it got.

Ships from the Yodacon Ship Pack by Paul Richeson (ConEx, 1997; ConEx Override,
1998), GPL-2.0-or-later — https://github.com/yodacon/yodacon-ship-pack
