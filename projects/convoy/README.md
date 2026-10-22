# Convoy

See a Large Pin freighter across a pirate-held corridor to the station at the
far end. You fly one of three escorts; two wingmen fly the others and take your
orders, as escorts did in *Escape Velocity*. Six raids come from ahead, behind,
above and below.

![The second raid: a Trident in the target brackets, its 1997 targeting picture in the panel](screenshot.png)

| | |
| --- | --- |
| Technique | Canvas 2D over a 6000 × 1200 corridor with a following camera, a route radar, and the DOM for the target, wing and comms panels |
| Ships | Override's Callisto and konex's Advisor and Citrus as the escorts; the Large Pin as the freighter (the only Pin); the Gryphon, Trident, Defender, Dart, Necromancer, Tomaquad and Yodacon as raiders |
| Pictures | each ship's 1997 **targeting picture** (`target.png`) in the target panel, as in EV; **comm portraits** (`comm.png`) on every hail and in the wing panel |
| Stats | toughness 4·√(Shield + Armor), speed, thrust and turn from each `ship.json`; the freighter carries three times its hull |
| Sound | `lib/yodacon-sound.js` |

**Orders.** <kbd>1</kbd> attack my target, <kbd>2</kbd> guard the freighter
(the default), <kbd>3</kbd> form on me. **Targeting.** <kbd>Tab</kbd> cycles
raiders nearest first; the target gets EV's corner brackets. If you are shot
down, the freighter launches a spare (three per run). Pay at the station is
2,000 credits, plus 100 for each percent of the freighter's hull and 250 a kill;
your best pay per escort and difficulty is kept in `localStorage`.

Keys: <kbd>←</kbd> <kbd>→</kbd> turn, <kbd>↑</kbd> thrust, <kbd>↓</kbd> brake,
<kbd>Space</kbd> fire, <kbd>Tab</kbd> target, <kbd>1</kbd>–<kbd>3</kbd> orders,
<kbd>Enter</kbd> start. Gamepad: stick, A thrust, X or RB fire, Y target,
Start. On a touch screen, buttons appear under the view.

Play-test: `node tools/drive_page.mjs "<url>/projects/convoy/?diff=normal" projects/convoy/playtest/escort.js --timeout 3000000`
flies a run with key presses (Tab to the raider nearest the freighter, attack)
and reports whether the cargo arrived.

Ships from the Yodacon Ship Pack by Paul Richeson (ConEx, 1997; ConEx Override,
1998), GPL-2.0-or-later — https://github.com/yodacon/yodacon-ship-pack
