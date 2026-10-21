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
Keys: <kbd>Space</kbd> launches, <kbd>D</kbd> buys a patrol, <kbd>R</kbd>
repairs.

Play-test: `node tools/drive_page.mjs <url>/projects/orbital-defence/ projects/orbital-defence/playtest/defend.js`
plays the waves with perfect aim and reports how far it got.

Ships from the Yodacon Ship Pack by Paul Richeson (ConEx, 1997),
GPL-2.0-or-later — https://github.com/yodacon/yodacon-ship-pack
