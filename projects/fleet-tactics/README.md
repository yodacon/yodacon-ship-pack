# Fleet Tactics

A drafting card battle. You're offered eight ships from the pack and a budget
of 60; pick at least two you can afford and press Battle. The computer drafts
its own fleet from eight ships of its own (never one you took), with the same budget. Then every living ship acts once
a round, fastest first: on your ship's turn, click the enemy it should fire on.
Last fleet standing wins.

![Mid-battle: the opposing fleet above, the battle log, your Advisor to act](screenshot.png)

| | |
| --- | --- |
| Technique | plain DOM; each card is a `<button>` with the ship's comm portrait |
| Hull ♦ | `round(1.2 × √(Shield + Armor))` from the ship's 1997 `shïp` record |
| Firepower ✸ | `4 + 2 × guns carried + Maneuver`; each shot does 80–120% of it |
| Initiative » | `Speed`: who acts first in a round |
| Cost | `round((hull + 1.4 × firepower) / 4)`, at least 5 |
| Ships | every ship in `catalog.json` but the 1/4 Defender; konex's Advisor and Citrus carry konex stats, so they get hull 30 and firepower from `TurnSpeed` |

The computer drafts the most hull and firepower per credit it can afford (at
most five ships), and in battle finishes off any ship it can, otherwise firing
on your biggest gun. Playing the same way, `playtest/battle.js` wins about two
games in three; shooting the weakest ship instead loses nearly every time.

Ships from the Yodacon Ship Pack by Paul Richeson (ConEx, 1997),
GPL-2.0-or-later — https://github.com/yodacon/yodacon-ship-pack
