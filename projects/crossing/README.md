# Crossing

Frogger with the pack's ships. Hop a small fighter through five lanes of
traffic, cross the ion stream by riding the freighters that fly through it,
and settle into one of five bays. Fill all five to clear the level; the
traffic gets faster every level.

![Level one: the Gryphon riding the Large Pin across the ion stream, two bays filled, traffic below](screenshot.png)

| | |
| --- | --- |
| Technique | Canvas 2D, 624 × 624 on a 48 px grid, a fixed 60 Hz step, hops eased between cells |
| Frames | everything crossing flies on frame 9 (east) or 27 (west); your fighter turns to frame 0, 9, 18 or 27 to face its hop |
| Traffic | the 1998 Yodacon (at three quarters size), Citrus, Defenders, Necromancers and Advisors |
| Freighters | Tomaquads, Darts, the Large Pin (the only Pin, at 1.4×), Yodacons and Callistos |
| Your fighter | Gryphon, Defender or Trident; hop time from `Maneuver`, so the Defender hops quickest |
| Sizes | each hull's length when flying sideways is read from frame 9's alpha once at load, so riding and collisions match the sprite, not the frame box |

From **level 3** one group of Yodacons and one of Tomaquads in the stream jump
to hyperspace now and then: they flicker for a second, vanish for two, then
come back, and whoever was riding them is lost.

**Hyperjump** (<kbd>Space</kbd> or <kbd>J</kbd>, gamepad B, or the button):
once a crossing, leap two rows forward at once, over whatever is between. It
comes back with each new ship.

Forty seconds a crossing, four lives. Score for every new row, for each bay
and the time left; the best is kept in `localStorage`.

Keys: <kbd>↑</kbd> <kbd>↓</kbd> <kbd>←</kbd> <kbd>→</kbd> or WASD hop. On a
touch screen, tap above, below or beside your ship. Gamepad: d-pad or stick.

Play-test: `node tools/drive_page.mjs "<url>/projects/crossing/?pilot=0" projects/crossing/playtest/cross.js`
checks each landing cell against where every ship will be over the hop,
boards the top lane only upstream of an empty bay, and steps the game with
`tick()`. It won't board a freighter that is about to jump, and it never uses
the hyperjump. Since the warping freighters arrived it reaches level 3 with
both the Gryphon and the Defender, then runs out of time waiting for a safe
ride to the last bay, where a person would time the flicker.

Ships from the Yodacon Ship Pack by Paul Richeson (ConEx, 1997; ConEx Override,
1998), GPL-2.0-or-later — https://github.com/yodacon/yodacon-ship-pack
