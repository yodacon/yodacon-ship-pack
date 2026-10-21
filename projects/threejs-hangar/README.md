# Hangar — three.js

![The Callisto on the turntable, its shipyard and target pictures on the monitors](screenshot.png)

**[Open it](https://yodacon.org/ship-pack/projects/threejs-hangar/)** · [All projects](../)

One ship at a time, on a turntable in a hangar. The pedestal really turns;
the ship is a flat sprite that shows the right frame for the turntable's angle
as seen from the camera, so it reads as a solid model while you walk the
camera around it.

- **Billboard on a turntable.** The ship is a textured plane in a pivot that
  turns (about the vertical axis only) to face the camera, then leans back by
  the *Lean* angle: 0° stands it upright, 80° lays it nearly flat on the table.
  Its frame is:

  ```js
  const heading = -radToDeg(turntable.rotation.y);                  // clockwise from −Z
  const phi = radToDeg(Math.atan2(camera.position.x, camera.position.z));
  const frame = floor(wrap360(heading + phi) / 10) % 36;
  ```

  The amber arrow on the turntable marks the ship's nose.
- **Monitors.** The ship's shipyard, target and comm pictures are textures on
  framed screens on the back wall (`MeshBasicMaterial`, so they glow and ignore
  the fog), each with a small point light washing the wall.
- **The hangar.** A box seen from inside, deck plates and a hazard ring drawn
  on canvases, ceiling ribs and strip lights, a spotlight on the pedestal, a
  hemisphere fill, a blue rim light, and `THREE.Fog` so the far end fades out.
- **Picker.** ◀ ▶ or the menu pick any ship in the pack. The URL hash follows
  (`#override/callisto`) so links open on a ship. The panel shows the ship's
  stats and description from its `ship.json`.
- Turntable speed (including reverse and stop) and lean are sliders.
  `prefers-reduced-motion` starts the turntable stopped.
- Pixel-crisp: the pack's pictures use `NearestFilter`, no mipmaps,
  `SRGBColorSpace`.

## Versions

three.js **0.160.0** from jsDelivr through an import map, the same version as
the pack's `examples/threejs`. `OrbitControls` comes from the same release via
`three/addons/`.

## Files

| File | What it does |
| --- | --- |
| `index.html` | Import map, picker, info panel |
| `hangar.css` | Overlays |
| `hangar.js` | Hangar geometry and lights, turntable, billboard frame picking, monitors, ship loading |

## Copy it into your project

1. Copy this folder.
2. Vendor the pack (whole folder, with its `LICENSE`) or use jsDelivr, which
   sends the CORS headers WebGL textures need. Change `PACK` at the top of
   `hangar.js`:

   ```js
   const PACK = new URL("https://cdn.jsdelivr.net/gh/yodacon/yodacon-ship-pack@v2.0.0/");
   ```

3. Serve it over http(s).

## Credit and licence

```text
Ships from the Yodacon Ship Pack by Paul Richeson (ConEx, 1997),
GPL-2.0-or-later — https://github.com/yodacon/yodacon-ship-pack
```

The ships and their pictures are © 1997–1998 Paul Richeson
([paulricheson.com](https://paulricheson.com)), under the GNU GPL version 2 or
later. Show the credit where people can see it, pass the art on with the
pack's [LICENSE](../../LICENSE), and keep your changes to it GPL. three.js is
MIT-licensed. See the [pack README](../../README.md#the-licence-in-plain-words).
