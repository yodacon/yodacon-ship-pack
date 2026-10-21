# 04 · KDE Applications, "Konquest"

| | |
| --- | --- |
| Source | https://apps.kde.org/konquest/ |
| Retrieved | 2026-10-21 22:39:06 UTC, HTTP 200, 48,453 bytes |
| SHA-256 | `aee87b3f4c2ff5f28b605545ff4720212361ae1a8288ee95f30ad72cd641979c` |
| Method | `tools/research_fetch.py kde-konquest-app <url>`; read as text |
| Licence stated | **GPL-2.0+**, the same licence family as this pack |

## What the page is

KDE's official page for Konquest, part of KDE Games: what it is, how to play,
downloads, and the licence. Konquest "is a version of Gnu-Lactic Konquest.
Players conquer other planets by sending ships to them. The goal is to build an
interstellar empire and ultimately conquer all other player's planets."

## The rules, as the page gives them

- **Setup.** Players' names, the number of planets and a turn limit; a map can
  be rejected for a new one.
- **Board.** A grid of squares. "Blank squares are empty space, while filled
  squares identify the existing planets." Planets are named "alphabetically
  with uppercase letters".
- **Start.** Each player owns one planet, shown in the player's colour.
- **A planet has** a name, an owner, a ship count, a **production** ("the
  number of ships the planet will produce each turn", fixed for that planet)
  and a **kill percent** ("a measure of the effectiveness of the ships produced
  at that planet").
- **Combat rule.** "Attack fleets take the kill percentage of their planet of
  departure, and defense fleets use the kill percentage of the planet they are
  defending."
- **Turn.** Pick a planet, type a number of ships, press Enter to send them;
  repeat; then **End Turn**. After all players move, news dialogs report what
  happened.
- **Win.** The game ends when one player "owns the entire galaxy" (or the turn
  limit runs out).
- **Display.** In each planet's square, the name sits top left and the ship
  count bottom right; hovering shows the details. Neutral planets show only
  their name.

## Why Konquest fits the pack

1. **It is already a planet-and-fleet game with no art requirements beyond
   planets and a board.** The pack adds what Konquest never had: real ships,
   with 36 headings, for the fleets in flight, and comm portraits for the
   news dialogs.
2. **GPL-2.0-or-later on both sides.** Reading Konquest's source to match its
   rules exactly is compatible with the pack's licence. Its code is C++/Qt, so
   a browser version is a reimplementation of the rules, credited to KDE.
3. **The rules are small and exact.** Production, kill percent, travel time
   and one combat rule. An accurate browser version is a weekend, not a
   project, if the numbers come from the source rather than from guessing.

## What the page does not say (the source must)

- How travel time follows from distance
- How a battle resolves turn by turn with the two kill percentages
- How neutral planets' ships, production and kill percent are chosen
- How production and kill percent are generated per planet, and how the
  start planets are balanced
- What the computer players do

Those come from the source code: see report 05.
