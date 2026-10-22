# Sample projects

Small, finished projects built on the Yodacon Ship Pack. Copy any folder to
start your own. Each one is plain HTML, CSS and JavaScript with no build step
and no npm, and each has a README covering what it shows, how it's built and
how to copy it. For single-technique pages, see [`examples/`](../examples/).
To try code without copying anything, use the [playground](../playground/).

| Project | What it is |
| --- | --- |
| [**Konquest**](konquest/) | **DOM + Canvas game.** KDE's Konquest with its exact rules, read from the source and tested rule by rule: send fleets between planets, production, kill percentages, three computer players. The fleets fly as pack ships. |
| [**ConEx Courier**](courier/) | **Canvas + DOM game.** *Escape Velocity* in miniature: fly between four systems, trade five goods, carry courier missions, fight Override pirates and buy any of the ten 1997 hulls, with numbers from their `shïp` records. Work up to a Large Pin. |
| [**Fleet Tactics**](fleet-tactics/) | **DOM card game.** Draft ships within a budget, then fight card by card against a computer that drafts for value and focuses fire. Hull, firepower and initiative come from each ship's 1997 record. |
| [**Orbital Defence**](orbital-defence/) | **Canvas game.** Hold a planet against waves of ConEx ships. Fire the planet's cannon, and between waves buy Advisor patrols that orbit and fire on their own, or repair. |
| [**Slingshot**](slingshot/) | **Canvas game.** Gravity golf with the 1997 Dart: drag back and let go, and only the planets steer it through the gate. Six levels against par. |
| [**Pin Miner**](pin-miner/) | **Pure DOM idle game.** An idle game: Consolidated Express Pins mine an asteroid field and haul the ore home. Buy more ships and upgrades; the fleet earns at half rate while you are away. |
| [**Cutaway**](cutaway/) | **DOM quiz.** Ship recognition: name the hull from its 1997 targeting cutaway, from four comm portraits, against the clock. Scanning and mirrored rounds later on. |
| [**Shipyard**](dom-shipyard/) | **Pure DOM.** An *Escape Velocity*-style shipyard: every ship of every edition, with its pictures, stats and 1997/98 description, a sprite you can drag to turn, and a fleet you buy with credits (kept in `localStorage`). |
| [**DOM Dogfight**](dom-dogfight/) | **Pure DOM game.** Fly the Yodacon against waves of missile-firing Defenders. Every object is a `<div>`; the game runs on a fixed timestep with circle collisions and touch controls. |
| [**Fleet Flyby**](threejs-fleet/) | **three.js.** Every ship in formation along a spline, as billboards that turn correctly as you orbit, in front of a landing picture. Click a ship to see its pictures. |
| [**Hangar**](threejs-hangar/) | **three.js.** One ship on a turntable in a lit, fogged hangar. Its sprite frame follows the turntable, and its shipyard, target and comm pictures play on wall monitors. |

[![Konquest](konquest/screenshot.png)](konquest/)

[![ConEx Courier](courier/screenshot.png)](courier/)

[![Fleet Tactics](fleet-tactics/screenshot.png)](fleet-tactics/)

[![Orbital Defence](orbital-defence/screenshot.png)](orbital-defence/)

[![Slingshot](slingshot/screenshot.png)](slingshot/)

[![Pin Miner](pin-miner/screenshot.png)](pin-miner/)

[![Cutaway](cutaway/screenshot.png)](cutaway/)

[![Shipyard](dom-shipyard/screenshot.png)](dom-shipyard/)

[![DOM Dogfight](dom-dogfight/screenshot.png)](dom-dogfight/)

[![Fleet Flyby](threejs-fleet/screenshot.png)](threejs-fleet/)

[![Hangar](threejs-hangar/screenshot.png)](threejs-hangar/)

## Versions

The three.js projects use **three@0.160.0** from jsDelivr through an import
map, the same version as `examples/threejs`. The DOM and Canvas projects use no library.

## Running them

They load the pack's files with `fetch()` and WebGL textures, so serve the
pack over http(s): `make serve` from the pack root, or any static server.
Then open `/projects/`. On yodacon.org they are at
<https://yodacon.org/ship-pack/projects/>.

## Credit and licence

```text
Ships from the Yodacon Ship Pack by Paul Richeson (ConEx, 1997),
GPL-2.0-or-later — https://github.com/yodacon/yodacon-ship-pack
```

The art is © 1997–1998 Paul Richeson ([paulricheson.com](https://paulricheson.com)),
under the GNU GPL version 2 or later, and so is the code in these samples.
Credit the art where people can see it, and pass it on with the pack's
[LICENSE](../LICENSE). See the
[pack README](../README.md#the-licence-in-plain-words).
