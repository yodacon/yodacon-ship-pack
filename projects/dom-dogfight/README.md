# DOM Dogfight — a game in plain DOM

![The Yodacon fighting a wave of Defenders](screenshot.png)

**[Play it](https://yodacon.org/ship-pack/projects/dom-dogfight/)** · [All projects](../)

A complete little arcade game in which every object on screen is a `<div>`.
No canvas, no WebGL, no game engine, no build step.

- You fly the 1997 **Yodacon**. Waves of ConEx **Defenders** come in from the
  edges, chase you, ram you and fire missiles (the pack's stand-in line sprite).
  Each wave is bigger and quicker. Two hits kill a Defender. Every fifth wave
  a **Tomaquad gunship** leads them: slow, tough (8 hits plus one a wave), and
  firing three missiles at a time. Ramming it hurts you, not it.
- **Cloak** (C or Shift, or the CLOAK button): for three seconds you fade to a
  ghost, the Defenders fly at where you were, and their missiles and rams pass
  through you. Firing breaks the cloak; it takes ten seconds to come back.
- Until you touch a control the computer flies your ship (attract mode), so
  the page is never still. Press any flight key or on-screen button to take
  over and start a fresh game.
- Controls: ← → or A D turn, ↑ or W thrust, ↓ or S brake, Space fire,
  C or Shift cloak, P pause, R restart. The on-screen pad (◀ ▲ ▶ FIRE CLOAK)
  works with touch and mouse; hold the buttons down.
- `?ship=override/callisto` (any `edition/slug`) puts you in another ship. Its
  1997/98 Speed, Accel and Maneuver stats change how it flies.
- The best score is kept in `localStorage` (if available).

## How it's built

| Piece | How |
| --- | --- |
| Sprites | A `<div>` per object, background `sheet-alpha.png`; the frame is `background-position` (`frame = floor(heading / 10) mod 36`), changed only when the frame changes |
| Movement | `transform: translate(x, y)`, which the browser composites without re-laying-out the page |
| Loop | `requestAnimationFrame` renders every display frame; the simulation runs in fixed 1/60 s steps from an accumulator, so the game plays the same at 60, 120 or 144 Hz |
| Physics | Thrust along the *shown* frame, so the motion matches the picture; speed caps; screen wrap |
| AI | Defenders lead the target, turn at a capped rate, thrust when roughly facing it, keep apart from each other, and fire when lined up |
| Collisions | Circles: `dx² + dy² < (r1 + r2)²` |
| Explosions | A `<div>` with a CSS keyframe animation that removes itself on `animationend` |
| Enemy missiles | The same weapon sprite with a CSS `filter: hue-rotate(…)` |
| Stars | Two tiles of random dots, generated once as SVG data URLs, shifted for parallax |

## Files

| File | What it does |
| --- | --- |
| `index.html` | HUD, arena, touch pad |
| `dogfight.css` | Arena, sprites, explosion animation, overlay |
| `dogfight.js` | Loading, input, the fixed-timestep loop, AI, collisions |

## Copy it into your project

1. Copy this folder.
2. Vendor the pack (whole folder, with its `LICENSE`) or use jsDelivr, and
   change `PACK` at the top of `dogfight.js`:

   ```js
   const PACK = new URL("./vendor/yodacon-ship-pack/", location.href);
   // or
   const PACK = new URL("https://cdn.jsdelivr.net/gh/yodacon/yodacon-ship-pack@v2.0.0/");
   ```

3. Serve it over http(s).

To use other enemies, change the `loadSheet("conex", "ships", "defender")` line;
every ship and weapon in the pack has the same sheet layout.

## Credit and licence

```text
Ships from the Yodacon Ship Pack by Paul Richeson (ConEx, 1997),
GPL-2.0-or-later — https://github.com/yodacon/yodacon-ship-pack
```

The ships are © 1997–1998 Paul Richeson
([paulricheson.com](https://paulricheson.com)), under the GNU GPL version 2 or
later. Show the credit where players can see it, ship the pack's
[LICENSE](../../LICENSE) with the art, and keep the game GPL-compatible. See
the [pack README](../../README.md#the-licence-in-plain-words).
