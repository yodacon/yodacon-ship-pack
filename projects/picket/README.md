# Picket

Tower defence with the pack's ships. Build a picket line of six hulls beside
the lane and hold the station against fifteen waves of raiders. Raiders fly
the lane on the frame for the way they are going; your ships turn to face what
they shoot.

![Wave six on the Long Way Round: a Callisto selected, its targeting picture in the panel](screenshot.png)

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

Two maps: **The Long Way Round** and **The Switchback (harder)**, whose shorter
lane is flown at 0.62 of the speed. The best score per map is kept in
`localStorage`.

Keys: <kbd>1</kbd>–<kbd>6</kbd> pick a ship, click to build, <kbd>Space</kbd>
launch the wave, <kbd>U</kbd> upgrade, <kbd>X</kbd> sell, <kbd>F</kbd> speed,
<kbd>Esc</kbd> cancel.

Play-test: `node tools/drive_page.mjs "<url>/projects/picket/?map=0" projects/picket/playtest/hold.js`
builds on the squares that cover the most lane, launches every wave and steps
the game with `tick()`. It holds the Long Way Round (station 15/20) and falls
on the Switchback around wave 10.

Ships from the Yodacon Ship Pack by Paul Richeson (ConEx, 1997; ConEx Override,
1998), GPL-2.0-or-later — https://github.com/yodacon/yodacon-ship-pack
