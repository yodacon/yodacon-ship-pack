# Game ideas: what to build with the ships

A brainstorm from the [research](research/README.md): games and examples that
suit 23 top-down ships with 36 headings, their target, shipyard and comm
pictures, and the plugins' landing views. Each idea names the technique it
would show, so the examples cover the web platform rather than repeating one
approach.

## The games

| # | Idea | What you do | Technique | Why it fits | Research |
| --- | --- | --- | --- | --- | --- |
| 1 | **Konquest** | Send fleets between planets on a grid; production, kill percentages, battles, three AI levels | DOM board + Canvas fleets; rules as a tested pure module | KDE's rules, exactly; the pack adds real ships in flight and comm portraits in the news | 04, 05 |
| 2 | **Orbital Defence** | One planet in the middle, waves of pack ships coming in; build defences between waves | Canvas 2D, a landing view as the backdrop | Orbital tower defence is a proven browser shape; every hull becomes an attacker | 02 |
| 3 | **Slingshot** | Fly the Dart round planets on gravity alone; reach the gate in the fewest burns | Canvas 2D physics, or a fixed-step simulation in WebAssembly | "Planets pull, you aim" carries four of the top browser space games | 03 |
| 4 | **ConEx Courier** | Escape Velocity in a tab: take cargo, fly between planets, land, get paid | DOM shipyard and trade screens + Canvas flight | It is what ConEx was: Consolidated Express is a shipping company | 01, 02 |
| 5 | **Fleet Tactics** | Turn-based battles on a grid; each ship a card with its comm portrait | DOM cards + SVG board | The comm pictures are card art no other free set has | 02 |
| 6 | **Pin Miner** | An idle game: Pins haul ore from asteroids, buy more ships, upgrade | DOM only, `requestAnimationFrame`, `localStorage` | Idle and incremental games chart on itch.io and need almost no art | 01, 03 |
| 7 | **Cutaway** | Repair a ship by its 1997 target picture: cockpit, cargo, engines | DOM + SVG hit areas over the PNG | The target pictures are labelled cutaways already | 03 |
| 8 | **Ten Thousand** | A whole sky of ships, each turning and flying | **WebGPU**: instanced quads, frame chosen in the vertex shader; WebGL fallback | Shows the GPU earning its place, with a feature test and fallback | 06 |
| 9 | **Gonex in a tab** | The full Gonex game in the browser | **Go → WebAssembly** (Ebitengine supports it) | Biggest compiled example possible; already flies the ships | 06 |
| 10 | **Konquest engine in Zig** | The battle and turn rules compiled to WebAssembly, checked turn for turn against the JavaScript rules | **Zig → WebAssembly**, no installs needed | Teaches the technique with a real, testable engine | 05, 06 |
| 11 | **Macroquad flight** | The Canvas example, in Rust | **Rust → WebAssembly** (macroquad) | The Rust counterpart of `examples/canvas/` | 06 |
| 12 | **treadcore with the ships** | Paul's Bevy tank game on crates.io flies pack craft as drones; a Bevy example and a `yodacon-ship-pack` crate come first | **Rust + Bevy**, crates.io; Bevy → WebAssembly later | An overhead Rust game already published, with the world kept apart from the window | 07 |

## Examples to add (small, one technique each)

Beside the six in `examples/`:

- **SVG**: a ship as an SVG `<image>` with `viewBox` cropping per frame; scales
  crisply with `image-rendering`
- **CSS only**: a spinning ship with `@keyframes` and `steps(36)`, no JavaScript
- **Canvas `OffscreenCanvas` in a worker**: the flight loop off the main thread
- **Web Audio**: engine hum that follows thrust, a shot sound, made in code
- **Gamepad API**: fly any example with a controller
- **WebGPU**: one ship, one quad, the frame picked in WGSL (with fallback)
- **WebAssembly from Zig and Go**: the frame-from-heading function, called from
  JavaScript, then the Konquest battle loop
- **Rust (macroquad)**: built once the `wasm32` target is installed
- **Babylon.js** and **Kaboom/KAPLAY**: two more engines, pinned like the rest

## Assets the ideas need

The pack has ships. Most games above also need these:

| Asset | Needed by | Form | Who makes it |
| --- | --- | --- | --- |
| **Planets**: rocky, gas, ice, lava, garden; 3 sizes | 1, 2, 3, 4 | sprite + mask, optional 36-frame rotation; a radius in metadata | Paul's renders, to match the ships (Bryce or Blender); a generated set in code meanwhile |
| **Asteroids**, 3 sizes | 3, 6 | 36-frame rotation, like the ships | renders, or generated |
| **Explosions** | 1, 2, 5, 8 | a frame sequence, 8–16 frames | renders or generated; konex's explosion frames need their author checked before use |
| **Projectiles**: bolt, beam, missile, mine | 2, 5, 8 | 36-frame sheets, like the drawn line | generated (as the line missile is) |
| **Starfields** | all | two or three tileable parallax layers | generated |
| **UI frame**: a 1990s-style panel, buttons, a target box | 4, 5 | 9-slice PNG or CSS | CSS first |
| **Sounds**: engine, shot, hit, explosion, landing | all | short OGG/WAV, or Web Audio code | generated in code first |
| **Planet surfaces** | 4 | landing views | already in the pack: the Bryce renders |

**The planets matter most.** Five of the eleven ideas need them, and the pack
has none of its own: the plugins' planet sprites point at Escape Velocity's
pictures, which are Ambrosia's. Konquest will draw its planets in code first,
which also gives a reference look for planet renders made later.
