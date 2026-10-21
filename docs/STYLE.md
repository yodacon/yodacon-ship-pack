# Yodacon style guide

How Yodacon's pages, games and tools look: a 1990s Macintosh space console,
seen through a film-set future. Three sources, one look:

| Source | What we take | What we leave |
| --- | --- | --- |
| **Yodacon** (yodacon.org, the 1997 splash) | Green CRT phosphor on void black; Courier readouts; scanlines; **chrome rails** and bevelled frames; violet telemetry | Nothing: this is the base |
| ***Escape Velocity*** (Ambrosia, 1996) | The **console**: bevelled grey metal panels around a dark viewport; the green wireframe **target box** ("COLOR PICTURE ACQUIRED"); dense status readouts; everything a pilot needs on one screen | Ambrosia's own art, logos and interface graphics: we draw our own |
| ***2001: A Space Odyssey*** (1968) | **Calm, clinical order**: wide, spaced capitals; large plain numerals; glowing **indicator lamps** (HAL's red eye); generous black space around instruments | Anything that copies the film's own graphics or HAL's face |
| **Retro-futurist spheres** | **Shaded 3D**: glossy orbs for buttons, planets lit from one side, chrome with a highlight and a shadow, a specular glint | Flat design, glassmorphism, neon everywhere |

The result should read as **an instrument you fly with**: dark, quiet, precise,
lit from inside, and solid enough to touch.

Yodacon is one dialect of a family: treadcore.org and paulricheson.com share
its rules (a frame around every screen, one light from the upper left,
phosphor for live data, lamps for state, nothing to load, complete without
the effects). The family description is [HOUSE-STYLE.md](HOUSE-STYLE.md).

## Principles

1. **Space is black.** Pages sit on void black (`--yc-void`) with a sparse,
   still starfield. Colour is light coming *out* of instruments, never paint
   on the background.
2. **Instruments are framed.** Anything you read or press sits in a chrome
   bezel: highlight on the top-left edge, shadow on the bottom-right, as if lit
   from the upper left.
3. **One light, upper left.** Bevels, orbs, planets and ships (the 1997
   renders) are all lit from the upper left. Never mix light directions on one
   screen.
4. **Readouts are phosphor.** Numbers, labels and status are green on a dark
   CRT panel, in a monospace face, with a faint glow. Warnings are amber; alarms
   are HAL red; data that is "other" (telemetry, metadata) is violet.
5. **Calm motion.** Things glide, glow and sweep; they do not bounce. Every
   animation stops under `prefers-reduced-motion`.
6. **Pixels stay pixels.** Ships and 1990s pictures scale by whole numbers with
   nearest-neighbour filtering. Only the chrome and type are smooth.
7. **It works without the effects.** Every page reads without JavaScript, in a
   text browser, and with scanlines and glows off; contrast holds at WCAG AA.

## Colour

Defined as CSS custom properties in [`lib/yodacon-style.css`](../lib/yodacon-style.css):

| Token | Value | Use |
| --- | --- | --- |
| `--yc-void` | `#05070a` | the page: space |
| `--yc-deck` | `#0b0f14` | recessed areas, viewports |
| `--yc-crt` | `#0d3d12` | CRT panel fill |
| `--yc-crt-lit` | `#1d7a24` | CRT panel, active or hovered |
| `--yc-phos` | `#5cff5c` | phosphor: primary readouts |
| `--yc-phos-dim` | `#2f9b34` | secondary readouts, labels |
| `--yc-text` | `#8fe98f` | body text on black |
| `--yc-chrome-hi` | `#dfe4e6` | chrome highlight edge |
| `--yc-chrome` | `#9aa3a7` | chrome face |
| `--yc-chrome-lo` | `#4c5457` | chrome shadow edge |
| `--yc-bezel` | `#2b3134` | the console's dark metal |
| `--yc-violet` | `#c26bd8` | telemetry, metadata |
| `--yc-cyan` | `#7fe9ff` | links |
| `--yc-amber` | `#ffb340` | warnings, "your turn" |
| `--yc-hal` | `#ff2a1a` | alarms, the indicator lamp |
| `--yc-ice` | `#e8f4ff` | *2001*-white: titles in the clinical register |

Player colours in games stay the game's own (Konquest's are KDE's), shown as
lit lamps, not as fills.

## Type

No web fonts: every face is already on the machine.

| Role | Stack | Treatment |
| --- | --- | --- |
| **Readout** (numbers, labels, buttons) | `"Courier New", Courier, ui-monospace, monospace` | bold, `letter-spacing: .06em`, phosphor glow |
| **Title** (the *2001* register) | `"Eurostile", "Microgramma", "Bank Gothic", "Arial Black", ui-sans-serif, sans-serif` | capitals, `letter-spacing: .32em`, `--yc-ice`, thin glow |
| **Prose** (long reading) | the readout stack at weight 400, line-height 1.8 | `--yc-text`, at most 80 characters wide |

Titles are short and spaced: `KONQUEST`, `SEND FLEET`, `TURN 12`. Prose is
plain sentences.

## Components

Each is a class in `lib/yodacon-style.css`; the
[specimen page](../styleguide/) shows them all.

| Component | Class | Looks like |
| --- | --- | --- |
| **Console** | `.yc-console` | dark metal plate with a chrome bezel, holding panels; *Escape Velocity*'s frame |
| **Panel** | `.yc-panel` | recessed deck with a chrome rim and an engraved title strip (`.yc-panel > h2`) |
| **CRT** | `.yc-crt` | green checkered phosphor screen with scanlines, for readouts and lists |
| **Readout** | `.yc-readout` | a label above a large glowing number |
| **Orb button** | `.yc-orb` | a glossy shaded sphere with a specular glint, lit upper left; pressed, it sinks |
| **Plate button** | `.yc-plate` | a bevelled chrome key with an engraved label |
| **Lamp** | `.yc-lamp` | a small glowing sphere in a chrome ring; `--lamp` sets its colour (HAL red by default) |
| **Target box** | `.yc-target` | *Escape Velocity*'s green wireframe frame with corner brackets, for the selected thing |
| **Telemetry** | `.yc-telemetry` | a row of small violet readings in capitals |
| **Viewport** | `.yc-viewport` | the black space a game is drawn in, with a thin chrome edge and stars |
| **Scanlines** | `.yc-scanlines` | an overlay on any element; off under reduced motion and forced colours |

## Spheres and shading

The shaded 3D look, done in CSS without images:

- **Orb**: `radial-gradient` lit at 30% 25% (highlight → face → shadow → rim
  light), an inner shadow at the bottom right, and a small white glint. Hover
  brightens; active presses 1–2 px down and darkens.
- **Lamp**: the same orb, small, in the lamp colour, with an outer glow of
  that colour. An "on" lamp breathes slowly (off under reduced motion).
- **Planets**: the pack's [`planets/`](../planets/) are lit the same way
  (upper left, night side, a thin atmosphere limb).
- **Chrome**: two-tone linear gradients (highlight, face, shadow) on edges;
  1 px black outline outside, 1 px highlight inside the top edge.

## Sound

Short sine-wave confirmations, made in code (`lib/yodacon-sound.js`, shared by the games):
higher notes for "yes", lower for "no", a rising arpeggio for success. Quiet
(gain ≤ 0.2), under 0.5 s, and always behind a mute switch that remembers.

## Do and don't

- **Do** put every control in a bezel or on an orb. **Don't** leave bare text
  buttons on the void.
- **Do** keep readouts green and titles ice-white. **Don't** colour body text
  violet or cyan.
- **Do** use the lamp for "whose turn" and "alert". **Don't** use red for
  anything that isn't an alarm or a red player.
- **Do** scale ships and 1990s pictures by whole numbers, pixelated. **Don't**
  smooth them.
- **Do** check every page at 390 px wide, in Lynx, and with reduced motion.
