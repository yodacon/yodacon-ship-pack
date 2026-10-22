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
most six ships), and in battle finishes off any ship it can, otherwise firing
on your biggest gun.

**Broadside**: once a battle, on one of your turns, press Broadside and pick a
target. Every ship you have left fires at it, each at half its firepower, and
that uses the turn.

**Admiral** (the Level menu): the computer drafts with 72 to your 60, from an
offer of ten.

Playing the same way as the computer, and firing its broadside early at the
toughest enemy, `playtest/battle.js` wins about two games in three on
Standard (4 of 6) and about half on Admiral (2 and 4 of 6 in two runs);
shooting the weakest ship instead loses nearly every time. `?level=admiral`
plays Admiral.

Ships from the Yodacon Ship Pack by Paul Richeson (ConEx, 1997),
GPL-2.0-or-later — https://github.com/yodacon/yodacon-ship-pack
