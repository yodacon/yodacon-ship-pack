# Phaser 3

[`index.html`](index.html) — Phaser **3.80.1** from jsDelivr (classic script,
global `Phaser`), Arcade physics, `pixelArt: true`. Add
`?edition=override&ship=gryphon` to fly another ship.

## Walk-through

```html
<script src="https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js"></script>
```

1. **Frame size first.** `loadShipMeta(edition, slug)` from the pack's library
   reads `ship.json`, so the spritesheet call gets real numbers, not guesses:

   ```js
   this.load.setCORS("anonymous");
   this.load.spritesheet("ship", ship.urls.sheet, { frameWidth, frameHeight });
   ```

   Phaser numbers sheet cells left-to-right, top-to-bottom from 0 — exactly the
   pack's frame order, so frame `i` is heading `i × 10°`.

2. **Never rotate the sprite.** The art already contains the rotation. Keep a
   `heading` and call `setFrame(frameIndex(heading))` each update.

3. **Thrust along the visible frame.** Phaser's angle 0 points right, the
   pack's heading 0 points up, hence `frame × 10 − 90`:

   ```js
   this.physics.velocityFromAngle(frame * 10 - 90, ACCEL, body.acceleration);
   ```

4. **Handling from `ship.json`.** `setMaxSpeed(Speed × 0.6)`, acceleration
   `Accel × 0.6`, turning `Maneuver × 40` °/s; ↓ applies drag equal to the
   acceleration (Arcade drag only acts while not accelerating).

5. **Crisp pixels.** `pixelArt: true` in the game config switches every texture
   to nearest-neighbour; `setScale(2)` only with whole numbers.
   `this.physics.world.wrap()` wraps the ship around the screen edges.

## Docs

- [Phaser 3 API docs](https://docs.phaser.io/api-documentation/api-documentation)
- [`LoaderPlugin#spritesheet`](https://docs.phaser.io/api-documentation/class/loader-loaderplugin#spritesheet)
- [Arcade Physics](https://docs.phaser.io/phaser/concepts/physics/arcade)
- [Game config: `pixelArt`](https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig)
