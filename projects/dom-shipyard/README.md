# Shipyard — plain DOM

![The shipyard showing the 1998 Dart](screenshot.png)

**[Open it](https://yodacon.org/ship-pack/projects/dom-shipyard/)** · [All projects](../)

An *Escape Velocity*-style shipyard built from nothing but HTML elements: no
canvas, no WebGL, no framework, no build step.

- Every ship of both editions, read from [`catalog.json`](../../catalog.json),
  is listed on the left with its icon and price.
- Pick one to see its shipyard, comm and target pictures, its stats from
  `ship.json`, and Paul Richeson's own 1997/98 description and escort line.
- The ship turns in the viewer. It is a single `<div>` whose background is the
  ship's `sheet-alpha.png`, moved with `background-position`; a
  `requestAnimationFrame` loop advances the heading. Drag it like a dial
  (pointer events, so mouse, pen and touch all work) or use ← → when it has
  focus; Space toggles the spin.
- **Buy** takes the price off a 25,000,000-credit balance and adds the ship to
  *Your fleet*. Sell it back for half. The balance and fleet are kept in
  `localStorage`, wrapped in `try`/`catch`, so the page still works where
  storage is blocked; it just forgets on reload.
- The ship list is a listbox: ↑ ↓ Home End move through it, Enter jumps to
  Buy. The selected ship is in the URL hash (`#override/dart`), so links work.
- Light and dark colour schemes; one column at phone width.

## Files

| File | What it does |
| --- | --- |
| `index.html` | The page structure |
| `shipyard.css` | Layout and both colour schemes |
| `shipyard.js` | Loads the catalogue, renders the list and detail, spins the sprite, runs the shop |

## The one trick

A 6×6 sheet of 36 frames, frame 00 nose-up, each next frame 10° clockwise:

```js
const frame = Math.floor(heading / 10) % 36;
sprite.style.backgroundPosition =
  `${-(frame % 6) * w * scale}px ${-Math.floor(frame / 6) * h * scale}px`;
```

with `background-size` set to the whole sheet times `scale` (a whole number)
and `image-rendering: pixelated`, so the 1997 pixels stay square.

## Copy it into your project

1. Copy this folder.
2. Put the pack somewhere your page can reach. Either vendor the whole pack
   folder, with its `LICENSE`, or use jsDelivr.
3. Change the `PACK` constant at the top of `shipyard.js`:

   ```js
   const PACK = new URL("./vendor/yodacon-ship-pack/", location.href);
   // or
   const PACK = new URL("https://cdn.jsdelivr.net/gh/yodacon/yodacon-ship-pack@v1.0.0/");
   ```

4. Serve it over http(s). `fetch()` does not work from `file://`.

## Credit and licence

```text
Ships from the Yodacon Ship Pack by Paul Richeson (ConEx, 1997),
GPL-2.0-or-later — https://github.com/yodacon/yodacon-ship-pack
```

The ships are © 1997–1998 Paul Richeson ([paulricheson.com](https://paulricheson.com)),
under the GNU GPL version 2 or later. Show the credit line where people can
see it. If you pass the art on, include the pack's [LICENSE](../../LICENSE),
and keep your changes to the art under the same licence. This sample's code
is part of the pack and under the same licence.
See the [pack README](../../README.md#the-licence-in-plain-words) for the plain-words version.
