# Picket

Tower defence with the pack's ships. The raiders come down a hyperspace
stream, relay to relay, toward the station; build a picket of six hulls
beside it to interdict them, and hold out for fifteen waves. Raiders fly on
the frame for the way they are going; your ships turn to face what they
shoot.

![Wave nine on the Relay Chain: raiders dropping out of the hyperspace stream between warp relays, nebulae, asteroids and gas pockets around the picket](screenshot.png)

| | |
| --- | --- |
| Technique | Canvas 2D on a 40 px grid, a lane as a polyline, hitscan beams, a fixed 60 Hz step with a ×2 speed switch |
| Your ships | Gryphon, Defender, Yodacon (ConEx), Callisto (Override), Advisor and Citrus (konex) |
| Raiders | Trident, Dart, Necromancer, Tomaquad, and the Large Pin (the only Pin) as the heavy every fifth wave |
| Stats | price from the 1997 `Cost` on a log scale; range from `Speed`; rate of fire from `Maneuver`; damage from the sprite's size. Raiders: toughness 4·√(Shield + Armor), lane speed from `Speed` |
| Pictures | comm portraits in the build list, the **targeting picture** of the selected ship, the pack's ice planet as the station |
| Sound | `lib/yodacon-sound.js` |

Each hull has a role: the Defender's guns are quick but short; the Advisor
reaches furthest; the Citrus's tractor slows what it hits by 40%; the Callisto
carries twin heavy guns; the Yodacon's shots burst. Ships upgrade twice (+30%
damage, +12% range a level) and sell for 60% of what they cost. Advisor and
Citrus have no 1997 record, so the game sets their numbers (`KONEX_STATS`).

Seven maps. **The Long Way Round** and **The Switchback (harder)** are open
space. Five more have terrain, laid out in the source as twelve strings of
twenty cells:

| Map | Terrain |
| --- | --- |
| **Round the Nebula** | the stream loops round a nebula that fills the middle |
| **Through the Belt** | an asteroid belt, the stream zigzagging through its gaps |
| **The Gas Pockets** | gas pockets everywhere, entering from the top |
| **Between Two Nebulae** | the stream snakes between two clouds |
| **The Relay Chain** | a little of everything |

- **Asteroids** (`#`) and **gas pockets** (`g`) can't be built on.
- **Nebulae** (`n`) can't be built on either, and nothing fires through them:
  a line of fire is checked every 10 px against the cloud's cells.
- A raider shot down within 52 px of a gas pocket sets it off. The blast hurts
  every raider near it (40 × the wave's toughness), and the pockets next to it
  go up 0.15 s later, so a field of them can chain. They fill again each wave.

A shorter lane is flown slower, so every map gives the picket about as long to
shoot: the Switchback at 0.62, the terrain maps at their length over the Long
Way Round's times a per-map speed. The best score per map is kept in
`localStorage`.

**The stream.** The lane is drawn as a hyperspace stream, all on the canvas
each frame:

- a glowing channel in four layers;
- two dotted currents sliding toward the station at different speeds;
- 170 motes riding it like a river, each at its own speed and depth and
  weaving a little;
- a warp relay at every turn and every few cells between, with turning rings
  and a pulse that runs down the chain to the station;
- the tunnel's mouth swirling where the raiders come in. Each raider drops out
  of it with a flash and trails a short warp wake.

Nebulae and asteroids are painted once per map onto an offscreen canvas, from
a seeded random generator, so a map looks the same every time.

Keys: <kbd>1</kbd>–<kbd>6</kbd> pick a ship, click to build, <kbd>Space</kbd>
launch the wave, <kbd>U</kbd> upgrade, <kbd>X</kbd> sell, <kbd>F</kbd> speed,
<kbd>Esc</kbd> cancel.

Play-test: `node tools/drive_page.mjs "<url>/projects/picket/?map=0" projects/picket/playtest/hold.js`
builds on the squares that see the most lane (in range, not behind a nebula),
launches every wave and steps the game with `tick()`. It holds the Long Way
Round with the station at 15/20 and falls on the Switchback around wave 10.
On the terrain maps it holds every one, though narrowly: the station ends at
1–6/20.

Ships from the Yodacon Ship Pack by Paul Richeson (ConEx, 1997; ConEx Override,
1998), GPL-2.0-or-later — https://github.com/yodacon/yodacon-ship-pack
