# Examples

Each folder is one runnable page that loads one ship (`?edition=conex&ship=yodacon`
by default; any ship of `catalog.json` works) and lets you turn or fly it.
Every framework is pinned to an exact version on jsDelivr; nothing needs
installing or building. Serve the pack root (`python3 -m http.server`) and
open `examples/`.

## Tutorial notes

`index.html` ends with **Tutorial Note 1**, an IEEE-style paper on starting a
project with the sprites. Each example page ends with its own note (2–7) on how
that page uses the assets, quoting its source with line numbers. The page notes
are generated: `tools/example_notes.py` cuts the listings from the live source by
text pattern, so after editing an example run

    python3 tools/example_notes.py

`make test` runs it with `--check` and fails if a note is out of date.

| Example | What it shows |
| --- | --- |
| [`dom/`](dom/) | Plain DOM + CSS sprite: `background-position` on `sheet-alpha.png`, no canvas, no library |
| [`canvas/`](canvas/) | A ~80-line Canvas 2D game loop using the library's `drawShip()` |
| [`web-component/`](web-component/) | `<yodacon-ship>`: attribute playground and every ship spinning |
| [`threejs/`](threejs/) | three.js 0.160.0: a textured quad flown over a grid, and a billboard `Sprite` with `OrbitControls` (UV math explained) |
| [`phaser/`](phaser/) | Phaser 3.80.1: `load.spritesheet`, Arcade physics, `pixelArt: true`, `setFrame` from heading |
| [`pixi/`](pixi/) | PixiJS 8.6.6: 36 textures sharing one source, ticker-driven flight, nearest scaling |

The [demo game](../demo/) is the full version: targets, missiles, minimap,
touch controls and the EV-style info panel. The [library reference](../lib/README.md)
documents `loadShip`, `drawShip`, `frameRect` and the element.

All of them follow the pack's sprite rules: frame 00 points up, each frame is
10° clockwise, `frame = floor(heading / 10) mod 36`, six frames per row, and
the art is scaled by whole numbers with nearest-neighbour sampling.
