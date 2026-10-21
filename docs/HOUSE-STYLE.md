# House style: one family, three dialects

Paul Richeson's sites look different at a glance and are built the same way
underneath. This is the description they share, drawn from each one's own
stylesheet and notes; the dialects keep their own guides.

| Dialect | Where | Its own words | Its guide |
| --- | --- | --- | --- |
| **Yodacon**: a 1997 space console | yodacon.org, the Ship Pack, Konquest | CRT phosphor on void black, chrome rails, Courier readouts, scanlines; *Escape Velocity*'s console and target box, *2001*'s calm capitals and lamps, shaded spheres | [STYLE.md](STYLE.md), `lib/yodacon-style.css` |
| **treadcore**: a tank's instrument bezel | treadcore.org, the game's HUD | "brushed metal for the frame … black inset screens with phosphor text for what the HUD would show, and the battlefield itself behind every page"; WinBolo's grey bezel with "a lamp for every thing in the game" | `treadcore/assets/site.css`, `documentation/INTERFACE.md` §7–8 |
| **paulricheson.com**: sea and paper | the personal gallery | an animated sea behind paper panels; showcases "like a magazine spread", a glass slab that turns and catches a sheen; IEEE-paper tables | `paulricheson/static/css/site.css`, `docs/style-review.md` |

## What all three share

1. **Things you read sit behind glass, in a frame.** Yodacon's chrome bezel,
   treadcore's brushed-metal monitor, paulricheson.com's glass slab: content
   is a lit screen set into a solid object, never text floating on a colour.
2. **One light, from the upper left.** A bright rim on the top edge, a shade
   along the foot, a specular sheen that sweeps across on the diagonal. The
   1997 ship renders, the generated planets, treadcore's `.metal` plates and
   the gallery's glass are all lit this way.
3. **Phosphor for live data.** Numbers that change are green on black, in a
   monospace face: Yodacon `#5cff5c`, treadcore `#33f24d`. Amber means "attend
   to this" (both use near `#ffb340`/`#ffbf4d`), red means danger or the enemy.
4. **Lamps for state.** A thing's state is a small lit shape in its colour:
   treadcore's pillbox and depot lamps (hollow for neutral, crossed for dead),
   Yodacon's player and alarm lamps. Lamps replace badges, chips and fills.
5. **Every number is a number.** Readouts show real values from the game or
   the source, never decoration. treadcore's rule ("Every number is a
   number"), paulricheson.com's ("Facts about projects come from their own
   READMEs") and the Ship Pack's (every picture traced to a resource ID) are
   the same rule.
6. **Nothing to load.** No web fonts, no frameworks, no build step; system
   faces only (a monospace for data, a sans or serif for prose). External
   libraries appear only in examples that exist to show them, pinned to an
   exact version.
7. **Complete without the effects.** Every page reads in order in Lynx, works
   without JavaScript, stops moving under `prefers-reduced-motion`, and fits a
   390 px phone without sideways scrolling. Motion (scroll-driven turns, the
   sheen, a breathing lamp) is added on top, with the same shapes as a
   fallback.
8. **Calm motion, tied to the reader.** Things rise, turn and settle as the
   page scrolls; nothing bounces or loops for attention, except one slow
   ambient layer per page (the sea, the battlefield, the starfield).
9. **A world behind every page.** paulricheson.com's sea, treadcore's
   battlefield (`assets/field.js`), Yodacon's starfield: a living backdrop
   that sets the place, kept dim enough that the panels carry the reading.
10. **The plain, dated register.** Short factual sentences; headlines with
    their key words set bright; tables numbered like a paper; lab reports and
    logs dated. Writing says what was done and what was found.

## The tokens side by side

The same roles, in each dialect's own variables:

| Role | Yodacon (`--yc-…`) | treadcore | paulricheson.com |
| --- | --- | --- | --- |
| The world behind | `void` `#05070a` + stars | the battlefield field palette (`--f-…`) | the sea (`--sea-0…3`) |
| Frame metal | `chrome-hi / chrome / chrome-lo`, `bezel` | `--m0…m5` (plate), `--b0…b4` (buttons) | the glass slab and `--panel-light/-dark` |
| Engraved label | `.yc-panel > h2` | `--etch`, `--etch-shade` | small capitals in the panel's ink |
| Screen | `deck`, `crt` | `--scr`, `--scr-2` | `--tile` / `--paper` |
| Live data | `phos` `#5cff5c` | `--phos` `#33f24d` | `--mark` for bright headline words |
| Attention | `amber` `#ffb340` | `--amber` `#ffbf4d` | `--mark` `#a53f26` |
| Danger, enemy | `hal` `#ff2a1a` | `--red` `#f23326` | (not used) |
| Other data | `violet` `#c26bd8` | `--sky` `#73c7ff` | `--link` |
| Prose | `text` on void | `--ink` on metal | `--ink` on `--paper` |
| Faces | Courier for everything; Eurostile-style capitals for titles | `--sans`, `--mono` (system) | `--serif` (Iowan, Palatino), `--sans`, `--mono` (system) |
| Themes | dark only | day, night, auto | light, dark, auto |

## Which dialect for what

- **A game, or anything about the ConEx ships** → Yodacon.
- **treadcore's HUD, site and tools** → treadcore.
- **A page about Paul or his work as a whole** → paulricheson.com.
- **A new project** → start from the shared rules above, borrow the frame and
  lamps from whichever dialect is nearest, and give it its own world behind
  the panels.

When a page from one dialect shows another's work (paulricheson.com's
project pages, the Ship Pack in Gonex), it keeps its own frame and shows the
other's screenshots inside it, the way treadcore's site shows the game in a
metal monitor.
