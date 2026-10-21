# Changelog

Versions follow the files: a new or corrected picture is a minor release, a
moved or renamed file a major one. A tag's files never change.

## 1.0.0 — 2026-10-21

First release: Paul Richeson's two Escape Velocity plugins, every ship picture
recovered byte for byte and released under GPL-2.0-or-later.

**Assets**

- `conex/`: ConEx 1.2 (1997, *Escape Velocity*), ten ships (shïp/spïn 166–175)
- `override/`: ConEx Override 1.0 (1998, *EV Override*), eleven ships
  (shïp/spïn 175–185), Callisto included
- per ship: sprite sheet, mask, sheet with alpha, 36 RGBA rotation frames,
  target, shipyard, comm and icon pictures, and `ship.json` (the ship record,
  frame geometry, description, escort line, source resource IDs, and the
  matching konex and Gonex folders)
- per edition: the Missile Repeater weapon sprite, every plugin picture as PNG
  (the landing views included; the Ambrosia logo left out), the original
  DOCMaker readme as Markdown with its pictures, a contact sheet
- `catalog.json` (every ship, for code) and `manifest.json` (SHA-256 of every file)

**Use**

- `lib/yodacon-ship-pack.js`: catalogue loading, frame maths, Canvas drawing,
  and the `<yodacon-ship>` web component, with no dependencies
- `demo/`: a small overhead game to fly any ship
- `examples/`: DOM and CSS, Canvas 2D, web component, three.js, Phaser, PixiJS
- `index.html`: the showcase page, static and self-hostable

**Sources and tools**

- `sources/`: the original `.sit.hqx` archives and their expanded `.sit`
  files, rehosted; the catalogue rows and dated screenshots of the pages that
  listed them; links back to Cythera Guides and Ambrosia Software
- `tools/`: a pure-Python extractor for BinHex 4.0, StuffIt 5 (Arsenic) and
  classic StuffIt (method 13), Mac resource forks and QuickDraw PICTs, and the
  pack builder; `make test` checks it against the original bytes

**Pictures decoded correctly for the first time**

- the Small, Medium and Large Pin shipyard and comm portraits, the Trident's
  shipyard and comm, and the Tomaquad's shipyard picture (ConEx 1.2). They use
  a QuickDraw *device* colour table, which earlier extractions misread as
  solid black
- the Dart and Defender sprites (ConEx 1.2), whose 8-bit masks earlier
  extractions applied inverted
