# Recall

A memory game with the pack's pictures. Every ship is a pair of cards showing
two of its pictures; turn two at a time and match them. A ship's name appears
only once its pair is matched, so you have to recognise it from the pictures.

![Normal level: three pairs matched, two targeting pictures turning](screenshot.png)

| Level | Pairs | Match |
| --- | --- | --- |
| Easy | 6 | the spinning sprite (`<yodacon-ship spin>`) to its shipyard picture |
| Normal | 8 | the shipyard picture to the 1997 targeting picture |
| Hard | 11 | the comm portrait to the targeting picture |
| Expert | 8 sets of three | the sprite, the shipyard picture and the targeting picture, all three turned together; a wrong card in a set turns them back |

**Sensor scan** (the button): once a deal, every face-down card shows for a
second. A perfect game is one with no misses and no scan.

| | |
| --- | --- |
| Technique | Pure DOM: buttons, `<img>`, the library's `<yodacon-ship>` element, CSS 3D card flips (`backface-visibility`), no canvas |
| Ships | eleven designs: ConEx's Yodacon, Dart, Necromancer, Tomaquad, Defender, Gryphon, Trident and Large Pin; Override's Callisto; konex's Advisor and Citrus. The three Pins are one hull at three sizes, so only the Large Pin is dealt |
| Pictures | `sheet-alpha.png` (via the element), `yard.png`, `comm.png`, `target.png` |
| Sound | `lib/yodacon-sound.js` |

Each card is a button with a spoken label (the ship and picture when face up),
and the flip respects `prefers-reduced-motion`. The fewest moves (then the
fastest time) per level are kept in `localStorage`.

Play-test: `node tools/drive_page.mjs <url>/projects/recall/ projects/recall/playtest/memory.js`
plays all four levels with perfect memory by clicking the cards, trying the
scan once on Expert. It takes 9, 13, 17 and 15–17 moves.

Ships from the Yodacon Ship Pack by Paul Richeson (ConEx, 1997; ConEx Override,
1998), GPL-2.0-or-later — https://github.com/yodacon/yodacon-ship-pack
