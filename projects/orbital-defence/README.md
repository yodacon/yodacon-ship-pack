# Orbital Defence

Hold a planet against waves of ConEx ships. Click or tap to fire the planet's
cannon; between waves, spend credits on **patrols** (Advisors that orbit and
fire on their own) and **repairs**, then launch the next wave.

![Wave four: Advisor patrols on their orbits, Gryphons and Tridents spiralling in](screenshot.png)

| | |
| --- | --- |
| Technique | Canvas 2D, a fixed 60 Hz simulation step, no library |
| Ships | ten ConEx 1.2 hulls as attackers, the konex Advisor as your patrols |
| Stats | each attacker's toughness comes from its 1997 Shield + Armor, its speed from Speed (`ship.json`), and grows 20% a wave |
| Art | the pack's generated garden planet and drawn missile |
| Sound | `lib/yodacon-sound.js` |

Waves add a new hull every second wave, and every fifth brings a Yodacon.

**Shockwave** (<kbd>S</kbd> or the button): once a wave, a ring rolls out
from the planet to 220 px. Every raider it passes takes two hits and is thrown
70 px back out.

Two levels:
- **Garden world**: open space.
- **Ice world, with a moon**: a rocky moon orbits close in. Raiders that fly
  into it are destroyed and pay nothing, but it stops your shots and your
  patrols' as well. Raiders come a third faster, and every fifth wave brings
  the 1998 Yodacon.
Keys: <kbd>Space</kbd> launches, <kbd>D</kbd> buys a patrol, <kbd>R</kbd>
repairs.

Play-test: `node tools/drive_page.mjs <url>/projects/orbital-defence/ projects/orbital-defence/playtest/defend.js`
plays the waves with perfect aim, looses the shockwave when four raiders are
within 200 px, and reports how far it got (`?level=ice` for the Ice world). In
its 150 s budget it holds 3–4 waves on either level without losing hull.

Ships from the Yodacon Ship Pack by Paul Richeson (ConEx, 1997),
GPL-2.0-or-later — https://github.com/yodacon/yodacon-ship-pack
