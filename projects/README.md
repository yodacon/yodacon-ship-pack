# Sample projects

Small, finished projects built on the Yodacon Ship Pack. Copy any folder to
start your own. Each one is plain HTML, CSS and JavaScript with no build step
and no npm, and each has a README covering what it shows, how it's built and
how to copy it. For single-technique pages, see [`examples/`](../examples/).
To try code without copying anything, use the [playground](../playground/).

| Project | What it is |
| --- | --- |
| [**Shipyard**](dom-shipyard/) | **Pure DOM.** An *Escape Velocity*-style shipyard: every ship of every edition, with its pictures, stats and 1997/98 description, a sprite you can drag to turn, and a fleet you buy with credits (kept in `localStorage`). |
| [**DOM Dogfight**](dom-dogfight/) | **Pure DOM game.** Fly the Yodacon against waves of missile-firing Defenders. Every object is a `<div>`; the game runs on a fixed timestep with circle collisions and touch controls. |
| [**Fleet Flyby**](threejs-fleet/) | **three.js.** Every ship in formation along a spline, as billboards that turn correctly as you orbit, in front of a landing picture. Click a ship to see its pictures. |
| [**Hangar**](threejs-hangar/) | **three.js.** One ship on a turntable in a lit, fogged hangar. Its sprite frame follows the turntable, and its shipyard, target and comm pictures play on wall monitors. |

[![Shipyard](dom-shipyard/screenshot.png)](dom-shipyard/)

[![DOM Dogfight](dom-dogfight/screenshot.png)](dom-dogfight/)

[![Fleet Flyby](threejs-fleet/screenshot.png)](threejs-fleet/)

[![Hangar](threejs-hangar/screenshot.png)](threejs-hangar/)

## Versions

The three.js projects use **three@0.160.0** from jsDelivr through an import
map, the same version as `examples/threejs`. The DOM projects use no library.

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
