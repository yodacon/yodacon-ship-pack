# ConEx Courier

*Escape Velocity* in miniature. Start in a Small Pin with 3,000 credits at
Express Yard, then trade, carry courier missions and fight pirates across
four linked systems until you can buy a Large Pin, the flagship of the Pin
line. Progress is saved in the browser each time you land.

![Leaving Express Yard in a Small Pin, the radar top right](screenshot.png)

| | |
| --- | --- |
| Technique | Canvas 2D with the library's `drawShip()`; the port is plain DOM |
| Flight | arrows or WASD turn and thrust, <kbd>↓</kbd> turns to reverse, <kbd>Space</kbd> fires, <kbd>L</kbd> lands, <kbd>J</kbd> jumps; touch buttons on phones |
| Systems | Consolidated (safe), Vela, Hollow and Ember (more pirates), in a ring; two planets each, from the pack's generated planet art |
| Trade | five goods; each planet sells each one low, middling or high (green and amber in the table) |
| Missions | three offers per port: carry so many tons to a planet, paid by distance and danger |
| Shipyard | the ten ConEx 1.2 hulls; your old ship trades in at half price |
| Pirates | the Override Gryphon, Trident, Defender and Necromancer; bounty when destroyed |

Ship numbers come from each hull's 1997 `shïp` record:

| Game | From the record |
| --- | --- |
| Hold (t) | `Holds / 8` |
| Shield, armour | `Shield / 4`, `Armor / 4`; shields recharge, armour is repaired in port |
| Top speed, thrust | `Speed × 0.8`, `Accel × 0.8` (pirates fly at `Speed × 0.7`) |
| Turn rate | `Maneuver × 45` degrees a second |
| Price | `√Cost × 20`, to the nearest hundred, so the 1997 order holds without the 133-million-credit Large Pin |

If your armour runs out you're towed to the last port you landed at: you
lose your cargo and 10% of your credits, but keep your ship and missions.

`playtest/route.js` flies a trade run through the page with key presses
alone: it buys Electronics at Express Yard, takes small missions, flies past
the jump ring, jumps to Vela, lands on Vela Prime, sells, delivers if it can,
and refuels.

Ships from the Yodacon Ship Pack by Paul Richeson (ConEx, 1997),
GPL-2.0-or-later — https://github.com/yodacon/yodacon-ship-pack
