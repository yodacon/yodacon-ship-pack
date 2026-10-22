# Slingshot

Gravity golf with the 1997 ConEx Dart. Drag back from the ship and let go: it
leaves at the speed you pulled, and from then on only the planets steer it.
Thread the green gate in as few launches as you can, against par.

![Level six, the gauntlet: the aim preview bending under the lava planet's pull](screenshot.png)

| | |
| --- | --- |
| Technique | Canvas 2D; one pure `simulate()` that flies the ship, draws the aim preview and solves the levels |
| Physics | each planet pulls `520 × radius² / distance²` px/s²; fixed 1/120 s steps; touching a planet or leaving the screen ends the launch |
| Ship | the ConEx 1.2 Dart, turned to its heading along the path |
| Planets | the pack's generated set, in three sizes |
| Input | drag and release, or <kbd>←</kbd> <kbd>→</kbd> aim, <kbd>↑</kbd> <kbd>↓</kbd> power, <kbd>Space</kbd> launch; in flight, a click or <kbd>Space</kbd> burns |

Seven levels, each checked by `playtest/solve.js`: it searches angle × power
with the game's own `simulate()` and finds a single launch that makes every
level (the pars are 1, 1, 2, 2, 2, 3, 2), then flies those launches through the
page. The seventh, **Binary**, slips between two large planets almost
touching; 90 of the solver's 10,800 angle and power pairs make it in one.

**Burn**: once a launch, while the Dart is in flight, click where you want to
go (or press <kbd>Space</kbd> to burn along its heading). The Dart gets a
90 px/s kick, and the rest of the flight is worked out again from where it
was, with `simulate()` carrying on from that position and velocity. A burn is
not a launch, so it doesn't count against par.
A flight plays its precomputed path in real time, so it keeps time even when
frames are slow. Your best for each level is kept in `localStorage`.

Ships from the Yodacon Ship Pack by Paul Richeson (ConEx, 1997),
GPL-2.0-or-later — https://github.com/yodacon/yodacon-ship-pack
