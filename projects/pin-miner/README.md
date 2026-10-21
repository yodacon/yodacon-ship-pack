# Pin Miner

An idle game in **plain DOM**: Consolidated Express Pins fly from ConEx to an
asteroid field, mine until their holds are full, haul the ore home and sell it.
Spend the credits on more ships and upgrades; the fleet keeps working, and
earns at half rate while you are away (up to eight hours).

![Seven Small Pins working the field, with the shipyard's 1997 yard pictures](screenshot.png)

| | |
| --- | --- |
| Technique | no canvas: every ship, asteroid and floating `+12` is a positioned `<div>`; a ship shows one frame of `sheet-alpha.png` through `background-position`, picked from its heading with the pack's `frameRect` / `frameIndex` |
| Ships | Small, Medium and Large Pin and the Dart (ConEx 1.2); cargo is `Holds / 10` tons, speed `Speed × 0.45` px/s, from each `ship.json` |
| Upgrades | mining lasers (+25% speed), ore contracts (+20% price), survey drones (more asteroids) |
| Save | `localStorage`, every two seconds; **Start over** clears it |
| Art | the pack's yard pictures in the shop; its rocky and garden planets as asteroids and ConEx |

Play-test: `playtest/grow.js` starts over and, for two minutes, buys whatever
is cheapest through the page's own buttons, then checks the fleet flies and
the save holds.

Ships from the Yodacon Ship Pack by Paul Richeson (ConEx, 1997),
GPL-2.0-or-later — https://github.com/yodacon/yodacon-ship-pack
