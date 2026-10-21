# PixiJS 8

[`index.html`](index.html) — PixiJS **8.6.6** as an ES module from jsDelivr,
ticker-driven flight with the arrow keys. Add `?edition=override&ship=yodacon`
to fly another ship.

## Walk-through

```js
import { Application, Assets, Rectangle, Sprite, Texture, TextureSource }
  from "https://cdn.jsdelivr.net/npm/pixi.js@8.6.6/dist/pixi.min.mjs";
```

1. **Nearest-neighbour everywhere**, set before anything loads:
   `TextureSource.defaultOptions.scaleMode = "nearest"`.
2. **One image, 36 textures.** `Assets.load(urls.sheet)` decodes
   `sheet-alpha.png` once; each frame is a `Texture` sharing that
   `source` with its own `frame` rectangle, taken from the library's
   `frameRect(ship, i)` (which reads the frame size from `ship.json`):

   ```js
   const r = frameRect(ship, i);
   new Texture({ source: sheet.source, frame: new Rectangle(r.x, r.y, r.w, r.h) });
   ```

3. **Swap textures, don't rotate.** In the ticker,
   `sprite.texture = frames[frameIndex(heading)]`. The art is pre-rotated in
   10° steps; rotating the sprite as well would double the turn and smear the
   pixels.
4. **Handling from `ship.json`**: top speed `Speed × 0.6`, thrust
   `Accel × 0.6`, turn rate `Maneuver × 40` °/s, all scaled by
   `ticker.deltaMS`.

On PixiJS 7 the same idea reads `BaseTexture.defaultOptions.scaleMode = SCALE_MODES.NEAREST`
and `new Texture(baseTexture, new Rectangle(…))`.

## Docs

- [PixiJS guides](https://pixijs.com/8.x/guides) and [API reference](https://pixijs.download/v8.6.6/docs/index.html)
- [Textures](https://pixijs.com/8.x/guides/components/textures) · [Assets](https://pixijs.com/8.x/guides/components/assets) · [Ticker](https://pixijs.com/8.x/guides/components/ticker)
