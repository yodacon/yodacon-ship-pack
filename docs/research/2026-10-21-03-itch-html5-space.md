# 03 · itch.io, "Top HTML5 games tagged Space"

| | |
| --- | --- |
| Source | https://itch.io/games/html5/tag-space |
| Retrieved | 2026-10-21 22:38:30 UTC, HTTP 200, 97,646 bytes |
| SHA-256 | `1e44f54bed4d01fa49729a8228e028e951acf5218aba6a6001366aa02655f061` |
| Method | `tools/research_fetch.py`; game cards parsed from the saved HTML |

## What the page is

The 36 most popular space games that run in the browser: the pack's own
platform. Simulation 8, Puzzle 7, Action 6, Platformer 4, Strategy 4, Visual
Novel 3, and a few singles.

## Small browser game shapes that fit the pack

| Shape | Games (pitch as listed) | How the pack's ships fit |
| --- | --- | --- |
| **Physics with planets** | *Void Golf* "Shoot an asteroid through the galaxy."; *Solar Sandbox*; *Stardust* "Grow from a speck of cosmic dust into a black hole"; *Tiny Colony* "Colonize alien planets by shooting your tiny creatures on them" | A ship slingshotting round planets: gravity golf with the Dart |
| **Mining and fleet upgrades** | *Mini Miner* "Mine Asteroids, Buy Ships and Upgrade your Fleet!"; *Astro Prospector* | Buying ships is the shipyard: yard pictures, prices from `ship.json` |
| **Planet destruction / clicker** | *Crack The Core* "Click, crit and laser your way to a planet's core then blow the whole thing up." | One planet, many ships orbiting and firing |
| **Engineer one ship** | *Sunlight In A Tin* "A tiny spaceship … You are its only engineer." | The target picture is a ship's cutaway: cockpit, cargo, engines, already labelled |
| **Arcade shooter** | *Warped Space Shooter*; *NIMRODS* "survival roguelite shooter" | Top-down sprites with 36 headings |
| **Word and trivia** | *Star Word: a Scrabble-like Adventure*; *Vast Trivia Of The Void* | Comm portraits as characters |

## Takeaways

1. **Gravity is the cheapest good mechanic.** Void Golf, Solar Sandbox,
   Stardust and Tiny Colony all run on "planets pull, you aim". A planet sprite
   plus a ship sprite is all the art such a game needs.
2. **The target pictures are a game.** Each ship's 1997 target picture is a
   labelled cutaway: *Cockpit, Cargo Space, Warp Drive, Living Quarters*. A
   "repair your ship" or engineer puzzle could use them as the board.
3. **Templates sell.** *Warped Space Shooter* is "A Godot Game Template made
   in Pixel Art", a game sold as a starting point. The pack's examples and
   sample projects are the same thing, given away.

## Assets this points to

- Planets with a clear edge and a radius in metadata (for gravity and
  collisions)
- Asteroids in a few sizes, with rotation frames like the ships'
- An explosion sequence
- A projectile set beyond the one drawn line (a bolt, a beam, a mine)
