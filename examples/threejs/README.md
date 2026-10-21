# three.js

[`index.html`](index.html) — three.js **0.160.0** from jsDelivr through an
import map, no build step. Two modes:

- `?mode=plane` (default) — the ship as a textured quad lying on a grid under
  a perspective chase camera and a dome of stars; fly it with the arrow keys.
- `?mode=billboard` — a `THREE.Sprite` that always faces the camera, with
  `OrbitControls`; as you orbit, the frame is picked from the ship's heading
  *relative to the camera*, so the ship stays pointed the same way in the world
  (the green arrow).

Add `&edition=override&ship=dart` to load another ship.

## Loading three.js

```html
<script type="importmap">
{ "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"
} }
</script>
<script type="module">
  import * as THREE from "three";
  import { OrbitControls } from "three/addons/controls/OrbitControls.js";
</script>
```

Pin an exact version, and take the addons from the same one.

## The texture

```js
const texture = await new THREE.TextureLoader().loadAsync(ship.urls.sheet); // sheet-alpha.png
texture.colorSpace = THREE.SRGBColorSpace;                         // PNG colours are sRGB
texture.magFilter = texture.minFilter = THREE.NearestFilter;       // square pixels
texture.generateMipmaps = false;
const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: 0.5 });
```

`alphaTest` discards the transparent pixels outright, so the edges stay hard
and the quad never hides the grid behind it.

## UV math: one cell of a 6 × 6 sheet

Texture coordinates run 0–1 across the whole sheet. To show only frame `i`:

```
col = i mod 6                 row = floor(i / 6)        (row 0 = top of the PNG)
texture.repeat = (1/6, 1/6)                       — the quad spans one cell
texture.offset = (col / 6, 1 − (row + 1) / 6)     — which cell
```

`repeat` scales the UVs so the quad's 0–1 covers 1/6 of the sheet each way;
`offset` adds the cell's lower-left corner. The `1 − …` is there because
three.js uploads images with `flipY = true`: `v = 0` is the *bottom* of the
PNG, so the top row (frames 00–05) starts at `v = 5/6`. Frame 00 → offset
`(0, 0.8333)`; frame 35 → `(0.8333, 0)`. Sheets are 6 × 6 for every ship, but
the code reads `columns` and `frames` from `ship.json` anyway.

Each texture has one offset. To show several ships at different frames from
one image, use `texture.clone()` per ship (the image is shared) or shift UVs
in a shader.

## Laying the plane down

`PlaneGeometry` stands in the XY plane with the image's top at +Y.
`rotation.x = −π/2` lays it on the ground with the top pointing to −Z, which
this example calls north. Heading `h` (clockwise seen from above) is the
direction `(sin h, 0, −cos h)`.

## Billboard frames

A sprite's quad turns to the camera, but the art inside is a fixed top-down
view. Let `φ = atan2(camera.x − ship.x, camera.z − ship.z)` — the camera's
bearing around the ship, 0° when it sits south looking north. The ship's
heading as the camera sees it is `h + φ`, and the frame is
`frameIndex(h + φ)`. Seen from the east (φ = 90°), a north-facing ship points
right, frame 09. This holds best from above; from a low angle the top-down
art inevitably reads as a cut-out.

## Docs

- [three.js manual: Installation (import maps)](https://threejs.org/manual/#en/installation)
- [`Texture`](https://threejs.org/docs/#api/en/textures/Texture) — `repeat`, `offset`, `colorSpace`, filters
- [`Sprite`](https://threejs.org/docs/#api/en/objects/Sprite) and [`SpriteMaterial`](https://threejs.org/docs/#api/en/materials/SpriteMaterial)
- [`OrbitControls`](https://threejs.org/docs/#examples/en/controls/OrbitControls)
- [Color management](https://threejs.org/docs/#manual/en/introduction/Color-management)
