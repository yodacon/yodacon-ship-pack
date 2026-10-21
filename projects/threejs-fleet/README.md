# Fleet Flyby — three.js

![Both flights flying their route in front of a Bryce landing picture](screenshot.png)

**[Open it](https://yodacon.org/ship-pack/projects/threejs-fleet/)** · [All projects](../)

All twenty-one ships of the pack fly in two V formations along a looping
spline, over a star field, with one of the plugins' landing pictures hanging
in the distance. Orbit around them and they turn the right way.

- **Billboards that turn.** Each ship is a `THREE.Sprite`, which always faces
  the camera. Every frame, the code works out the ship's true heading (from the
  spline's tangent) and the camera's bearing around the ship, and shows the
  sprite frame for their sum:

  ```js
  const heading = radToDeg(Math.atan2(tangent.x, -tangent.z));          // clockwise from −Z
  const phi = radToDeg(Math.atan2(cam.x - ship.x, cam.z - ship.z));    // camera bearing
  const frame = floor((heading + phi) / 10) mod 36;
  ```

- **One texture per ship, one cell at a time.** `texture.repeat` is set to
  1/6 × 1/6 and `texture.offset` picks the cell. With `flipY`, row `r` starts
  at `v = 1 − (r + 1) / rows`.
- **Pixel-crisp.** `NearestFilter` for both filters, no mipmaps,
  `SRGBColorSpace`, and `alphaTest: 0.5` instead of blending, so the edges
  stay hard and there is no transparency sorting to manage.
- **Formation.** Each flight's leader runs the `CatmullRomCurve3`; the others
  hold V-shaped slots behind it in the leader's frame (tangent, right, up),
  with a slight bob. The 1997 and 1998 flights are half a lap apart.
- **Backdrop.** A large plane about 6000 units out, its edges faded into
  space with an alpha map drawn on a canvas. Choose from the eleven ConEx
  Override landing pictures (Bryce renders, 1998) and three ConEx 1.2 ones.
- **Picking.** Click a ship (or press `[` `]`) to open its card: comm,
  shipyard and target pictures, its description and escort line. Targeting
  brackets follow it on screen, and the camera eases over to follow it.
  Escape closes the card.
- `OrbitControls` comes from the same pinned three.js release, through the
  `three/addons/` import-map entry.

## Versions

three.js **0.160.0**, from jsDelivr through an import map. This is the same
version the pack's `examples/threejs` uses. Keep `three` and `three/addons/`
on the same version.

## Files

| File | What it does |
| --- | --- |
| `index.html` | Import map, HUD, ship card |
| `fleet.css` | Overlays |
| `fleet.js` | Scene, route, formation, frame picking, raycast picking |

## Copy it into your project

1. Copy this folder.
2. Vendor the pack (whole folder, with its `LICENSE`) or use jsDelivr. jsDelivr
   sends CORS headers, which WebGL textures need. Change `PACK` at the top of
   `fleet.js`:

   ```js
   const PACK = new URL("https://cdn.jsdelivr.net/gh/yodacon/yodacon-ship-pack@v1.0.0/");
   ```

3. Serve it over http(s).

## Credit and licence

```text
Ships from the Yodacon Ship Pack by Paul Richeson (ConEx, 1997),
GPL-2.0-or-later — https://github.com/yodacon/yodacon-ship-pack
```

The ships and landing pictures are © 1997–1998 Paul Richeson
([paulricheson.com](https://paulricheson.com)), under the GNU GPL version 2 or
later. Show the credit where people can see it, pass the art on with the
pack's [LICENSE](../../LICENSE), and keep your changes to it GPL. three.js is
MIT-licensed. See the [pack README](../../README.md#the-licence-in-plain-words).
