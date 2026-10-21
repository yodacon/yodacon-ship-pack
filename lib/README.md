# `lib/` — the browser library

[`yodacon-ship-pack.js`](yodacon-ship-pack.js) is one ES module with no
dependencies and no build step. It finds the pack's files relative to its own
URL (`new URL("..", import.meta.url)`), so it works from any address the pack
is served from: yodacon.org, jsDelivr, GitHub Pages, or a folder in your own
site. Importing it also registers the `<yodacon-ship>` element.

Works in current evergreen browsers (it uses ES modules, private class fields
and custom elements).

## Three ways to load it

**From yodacon.org** (always the newest release):

```html
<script type="module" src="https://yodacon.org/ship-pack/lib/yodacon-ship-pack.js"></script>
<yodacon-ship ship="yodacon" spin></yodacon-ship>
```

**From jsDelivr, pinned to a release** (recommended for production — the tag
never changes, and jsDelivr sends CORS headers, so WebGL can use the images):

```html
<script type="module" src="https://cdn.jsdelivr.net/gh/yodacon/yodacon-ship-pack@v2.0.0/lib/yodacon-ship-pack.js"></script>
<yodacon-ship ship="dart" edition="override" scale="1" spin></yodacon-ship>
```

**From your own copy** (clone, submodule or plain copy of the whole pack folder,
with its `LICENSE`):

```sh
git submodule add https://github.com/yodacon/yodacon-ship-pack vendor/yodacon-ship-pack
```

```html
<script type="module">
  import { loadShip, drawShip } from "./vendor/yodacon-ship-pack/lib/yodacon-ship-pack.js";
</script>
```

Keep the folder layout intact: the library expects `catalog.json`, `conex/` and
`override/` one level above `lib/`. If you move the library elsewhere, pass the
pack root explicitly as `base` (an absolute or page-relative URL).

## `<yodacon-ship>`

```html
<yodacon-ship ship="yodacon" edition="conex" heading="90" scale="3"></yodacon-ship>
<yodacon-ship ship="callisto" edition="override" spin>
  <img src="override/ships/callisto/frames/00.png" alt="Callisto"> <!-- shown until loaded / without JS -->
</yodacon-ship>
```

| Attribute | Default | Meaning |
| --- | --- | --- |
| `ship` | `yodacon` | Ship slug — a folder name under `<edition>/ships/` |
| `edition` | `conex` | `conex` (ConEx 1.2, 1997) or `override` (ConEx Override 1.0, 1998) |
| `heading` | `0` | Degrees clockwise from nose-up; snaps to the 36 frames |
| `spin` | off | Boolean: turn through all 36 frames at ~12 fps. Holds still under `prefers-reduced-motion: reduce` and while scrolled off-screen |
| `scale` | `2` | Whole-number zoom, nearest-neighbour |
| `base` | the library's pack root | Pack root override |

All attributes are live (change them and the sprite updates) and mirrored as
properties (`el.heading = 270`). The element has `role="img"` and an
`aria-label` of the ship's name. It fires `load` (`event.detail` = the ship)
and `error`. Style the sprite from outside with `yodacon-ship::part(sprite)`.

## JavaScript API

```js
import {
  PACK_BASE, VERSION, CREDIT,
  loadCatalog, loadShip, loadShipMeta, loadWeapon, loadImage,
  frameIndex, frameHeading, frameRect, drawShip,
} from "https://cdn.jsdelivr.net/gh/yodacon/yodacon-ship-pack@v2.0.0/lib/yodacon-ship-pack.js";
```

| Export | Returns |
| --- | --- |
| `PACK_BASE` | Absolute URL of the pack root, ending in `/` |
| `VERSION`, `CREDIT` | `"2.0.0"`; the credit line to display |
| `loadCatalog(base?)` | `catalog.json`, with `url` and `urls` (absolute) added to every ship and weapon, and `edition` (key) on each |
| `loadShipMeta(edition, slug, base?)` | `{edition, slug, name, meta, sprite, urls}` — `meta` is `ship.json`; no images loaded |
| `loadShip(edition, slug, base?)` | The same plus `sheet`, the decoded `sheet-alpha.png` (`HTMLImageElement`) |
| `loadWeapon(slug = "missile-repeater", base?)` | Same shape, from the pack's `weapons/` folder (one stand-in missile, a line drawn by the builder). The 1.0 form `loadWeapon(edition, slug, base)` still works |
| `loadImage(url)` | A decoded, CORS-enabled `HTMLImageElement` (cached) |
| `frameIndex(heading)` | `floor(heading / 10) mod 36`, always 0–35 |
| `frameHeading(i)` | The heading frame `i` shows: `i × 10` |
| `frameRect(ship, i)` | `{x, y, w, h}` of frame `i` in `sheet-alpha.png` |
| `drawShip(ctx, ship, heading, x, y, scale = 1)` | Draws centred on `(x, y)`, pixelated |

`urls` holds `dir`, `sheet` (`sheet-alpha.png`), `sheetOpaque` (`sheet.png`),
`mask`, `target`, `yard`, `comm`, `thumb` (`null` when a ship has none — the
Override 1/4 Defender) and `frames(i)` → URL of `frames/NN.png`.

### Canvas 2D

```js
const ship = await loadShip("conex", "yodacon");
const ctx = canvas.getContext("2d");
let heading = 0;
(function frame() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawShip(ctx, ship, heading, canvas.width / 2, canvas.height / 2, 2);
  heading = (heading + 1) % 360;
  requestAnimationFrame(frame);
})();
```

### A framework that loads its own textures

```js
const { sprite, urls } = await loadShipMeta("override", "callisto");
// Phaser:   this.load.spritesheet("ship", urls.sheet, { frameWidth: sprite.frame_width, frameHeight: sprite.frame_height });
// three.js: new THREE.TextureLoader().load(urls.sheet) and set repeat/offset per frame
// PixiJS:   await Assets.load(urls.sheet), then a Texture per frameRect
```

See [`../examples/`](../examples/) for complete, runnable versions.

## The sprite grid

```
frame:   00  01  02  03  04  05      heading 0° (up), 10°, 20° … clockwise
         06  07  08  09  10  11
         …
         30  31  32  33  34  35      heading 300° … 350°

x = (i mod 6) × frame_width        y = floor(i / 6) × frame_height
```

## Credit

Show this wherever the ships appear (it is `CREDIT` in the module):

> Ships from the Yodacon Ship Pack by Paul Richeson (ConEx, 1997), GPL-2.0-or-later — https://github.com/yodacon/yodacon-ship-pack
