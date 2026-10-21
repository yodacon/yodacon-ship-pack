# Canvas 2D game loop

[`index.html`](index.html) — about 80 lines: load a ship with the pack's
library, fly it with the arrow keys, wrap at the edges.

## Walk-through

```js
import { loadShip, drawShip } from "../../lib/yodacon-ship-pack.js";
const ship = await loadShip("conex", "yodacon");   // ship.json + decoded sheet-alpha.png
drawShip(ctx, ship, heading, x, y, scale);          // centred, frame from heading, pixelated
```

- **Loading.** `loadShip(edition, slug)` returns `{name, meta, sprite, sheet, urls}`.
  `meta` is the ship's `ship.json`; `sprite` holds the frame size.
- **Drawing.** `drawShip` computes `frame = floor(heading / 10) mod 36`, finds
  that cell in the 6-column sheet (`frameRect`), turns off
  `imageSmoothingEnabled` and draws it centred at `(x, y)`.
- **Handling.** Top speed, thrust and turn rate come from `ship.json`'s
  `Speed`, `Accel` and `Maneuver` (× 0.6, × 0.6 and × 40°/s), the same mapping
  the [demo game](../../demo/) documents.
- **Thrust along the frame shown**, not the exact heading, so the ship goes
  where it visibly points — the way Escape Velocity felt.
- **Fixed timestep.** `update(1/60)` runs as many times as real time demands
  (capped at ¼ s after a stall); `draw()` runs once per animation frame.

Use `?edition=override&ship=dart` to fly another ship. For a CDN copy, import
from `https://cdn.jsdelivr.net/gh/yodacon/yodacon-ship-pack@v1.0.0/lib/yodacon-ship-pack.js`.

## Docs

- [Canvas API tutorial](https://developer.mozilla.org/docs/Web/API/Canvas_API/Tutorial) (MDN)
- [`drawImage()`](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/drawImage) and
  [`imageSmoothingEnabled`](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/imageSmoothingEnabled) (MDN)
- [Fix your timestep](https://gafferongames.com/post/fix_your_timestep/) (Glenn Fiedler)
- [The library's API](../../lib/README.md)
