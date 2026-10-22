# Dock

Bring ten hulls home to a Large Pin carrier, one a level. There are no
lateral thrusters: only a main engine, a retro at half its thrust and the
ship's own turn rate. The carrier's tractor beam takes you in once you are in
the wedge behind its stern, under 30, and on the **carrier's own sprite
frame** (one either side will do).

![Level five: the Advisor in the approach wedge on frame 17, matching the turning Large Pin; the docking computer reads 9 and 17/17](screenshot.png)

| | |
| --- | --- |
| Technique | Canvas 2D, a fixed 60 Hz step, inertia, an ellipse round the carrier for collisions, the Gamepad API, touch buttons |
| Frames | the carrier turns **a frame at a time**, and the wedge, the bay and the beam all follow its drawn frame, not a hidden angle; you dock by matching frame numbers, which the docking computer shows side by side |
| Ships | the Large Pin is the carrier (the only Pin); Defender, Gryphon, Citrus, Trident, Advisor, Yodacon, Callisto, Necromancer, Tomaquad and the Dart come home to it, nimblest first |
| Stats | thrust from `Accel`, top speed from `Speed`, turn rate from `Maneuver`, seconds of burn from `Fuel`; Advisor and Citrus get numbers in the 1997 ranges (`KONEX_STATS`) |
| Pictures | the Large Pin's comm portrait hails you; each ship's shipyard picture shows as you fly it |

From level three the carrier turns, faster each level; from level five mines
orbit it. Three bumps and the ship is lost; ramming at 70 or more loses it at
once. Docking scores fuel left, time and bumps, up to three stars, and the
best for each level is kept in `localStorage`. Levels open as you dock.

Keys: <kbd>←</kbd> <kbd>→</kbd> turn, <kbd>↑</kbd> thrust, <kbd>↓</kbd>
retro, <kbd>R</kbd> start again, <kbd>Enter</kbd> next ship. Gamepad: stick,
A thrust, B retro. On a touch screen four buttons appear under the view.

Play-test: `node tools/drive_page.mjs "<url>/projects/dock/" projects/dock/playtest/approach.js`
flies all ten levels with the arrow keys. It steers by wanted velocity, aims
for where the stern will be by the time it arrives, goes round the carrier
rather than through it, and waits on the carrier's frame for the beam. It
docks all ten, though on the first two levels it burns most of its fuel
fussing round the wedge.

Ships from the Yodacon Ship Pack by Paul Richeson (ConEx, 1997; ConEx Override,
1998), GPL-2.0-or-later — https://github.com/yodacon/yodacon-ship-pack
