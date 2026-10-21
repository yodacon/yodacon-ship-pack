#!/usr/bin/env python3
"""Build the Yodacon Ship Pack from the original 1990s archives in sources/.

Nothing else is needed: each .sit.hqx is unwrapped, expanded and its resource
forks read by the tools beside this script, and every asset below is derived
from those bytes.

For each edition (ConEx 1.2 for Escape Velocity, 1997; ConEx Override 1.0
for EV Override, 1998):

  <edition>/ships/<slug>/sheet.png        spïn sprite sheet, as shipped
  <edition>/ships/<slug>/mask.png         its mask, as shipped (white = ship)
  <edition>/ships/<slug>/sheet-alpha.png  the sheet with the mask as alpha
  <edition>/ships/<slug>/frames/NN.png    36 RGBA rotations, 00 nose-up, 10° clockwise
  <edition>/ships/<slug>/target.png       targeting display  (PICT 3000 + id-128)
  <edition>/ships/<slug>/yard.png         shipyard picture   (PICT 5000 + id-128)
  <edition>/ships/<slug>/comm.png         comm portrait      (PICT 5300 + id-128)
  <edition>/ships/<slug>/thumb.png        icon               (PICT 5101 + id-128)
  <edition>/ships/<slug>/ship.json        record, geometry, texts, source IDs
  <edition>/weapons/<slug>/…              the plugin's own weapon sprites
  <edition>/pictures/<id>[_<name>].png    every picture in the plugin
  <edition>/readme/README.md + pictures/  the DOCMaker readme, as Markdown
  <edition>/contact-sheet.png, <edition>/README.md

plus catalog.json (every ship of every edition, for code to load) and
manifest.json (a SHA-256 for every file in the pack).

Usage: python3 tools/build_pack.py [--zip DIST]
"""
import argparse
import hashlib
import json
import re
import shutil
import sys
import zipfile
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw

TOOLS = Path(__file__).resolve().parent
sys.path.insert(0, str(TOOLS))
import extract  # noqa: E402
import pict  # noqa: E402
import rfork  # noqa: E402
import tmpl  # noqa: E402

PACK = TOOLS.parent
VERSION = (PACK / "VERSION").read_text().strip()

# picture kind -> PICT id base, added to (shïp id - 128)
PICTURES = (("target", 3000), ("yard", 5000), ("comm", 5300), ("thumb", 5101))


@dataclass
class Edition:
    key: str
    title: str
    year: int
    game: str
    archive: str
    plugin: str
    readme: str
    ships: dict      # shïp id -> (slug, konex folder, Gonex folder)
    weapons: dict    # spïn id -> (slug, display name, dësc id or None)
    names: dict      # shïp id -> display name, where the record's own is mangled
    withheld: dict   # PICT id -> why it is not in the pack


AMBROSIA_LOGO = "Ambrosia Software's logo, Ambrosia's trademark, not ConEx art"

EDITIONS = [
    Edition(
        key="conex", title="ConEx 1.2", year=1997, game="Escape Velocity",
        archive="sources/ev/792_ConEx12.sit.hqx",
        plugin="ConEx 1.2/ConEx1.2", readme="ConEx 1.2/ConEx Readme 1.2",
        ships={
            166: ("small-pin", "small pin", "small-pin97"),
            167: ("medium-pin", None, "medium-pin97"),
            168: ("large-pin", "large pin", "large-pin97"),
            169: ("dart", "dart", "dart97"),
            170: ("defender", "defender", "defender97"),
            171: ("gryphon", "gryphon", "gryphon97"),
            172: ("trident", "trident", "trident97"),
            173: ("necromancer", "necromancer", "necromancer97"),
            174: ("yodacon", "yodacon", "yodacon97"),
            175: ("tomaquad", "tomaquad", "tomaquad97"),
        },
        weapons={200: ("missile-repeater", "A-75 Missile Repeater", 2045)},
        names={}, withheld={8100: AMBROSIA_LOGO},
    ),
    Edition(
        key="override", title="ConEx Override 1.0", year=1998, game="Escape Velocity Override",
        archive="sources/evo/2437_ConExOverride.sit.hqx",
        plugin="ConEx Override1.0.0/ConEx Override 1.0",
        readme="ConEx Override1.0.0/ConEx Readme 1.0",
        ships={
            175: ("small-pin", "small pin", "small pin"),
            176: ("large-pin", "large pin", "large pin"),
            177: ("callisto", "callisto", "callisto"),
            178: ("dart", "dart", "dart"),
            179: ("defender", "defender", "defender"),
            180: ("gryphon", "gryphon", "gryphon"),
            181: ("trident", "trident", "trident"),
            182: ("necromancer", "necromancer", "necromancer"),
            183: ("yodacon", "yodacon", "yodacon"),
            184: ("tomaquad", "tomaquad", "tomaquad"),
            185: ("quarter-defender", None, None),
        },
        weapons={236: ("missile-repeater", "Missile Repeater", None)},
        names={185: "1/4 Defender"}, withheld={8100: AMBROSIA_LOGO},
    ),
]


class Plugin:
    """One plugin's resources, addressed by type and id."""

    def __init__(self, fork: bytes):
        self.fork = rfork.parse(fork)
        self.res = {(r.rtype, r.rid): r for r in self.fork.resources}
        self.tm = tmpl.templates_in(self.fork)  # each plugin carries its own TMPLs

    def get(self, rtype, rid):
        return self.res.get((rtype, rid))

    def record(self, rtype, rid):
        return dict(tmpl.decode(self.tm[rtype], self.res[(rtype, rid)].data))

    def picture(self, rid):
        r = self.get("PICT", rid)
        return pict.decode_pict(r.data) if r else None

    def text(self, rtype, rid):
        r = self.get(rtype, rid)
        if r is None:
            return None
        data = r.data[1:1 + r.data[0]] if rtype == "STR " else r.data.rstrip(b"\0")
        return data.decode("mac_roman").replace("\r", "\n").strip()


def save(image: Image.Image, path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, optimize=True)


def write_json(path: Path, doc):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def sprite_bank(plug: Plugin, spin: dict, folder: Path) -> Image.Image:
    sheet = plug.picture(spin["SpritesID"]).convert("RGB")
    mask = plug.picture(spin["MasksID"]).convert("L")
    save(sheet, folder / "sheet.png")
    save(mask, folder / "mask.png")
    alpha = sheet.convert("RGBA")
    alpha.putalpha(mask)  # EV masks, 1-bit or 8-bit, are white where the ship is
    save(alpha, folder / "sheet-alpha.png")
    w, h = spin["xSize"], spin["ySize"]
    for i in range(spin["xTiles"] * spin["yTiles"]):
        col, row = i % spin["xTiles"], i // spin["xTiles"]
        save(alpha.crop((col * w, row * h, (col + 1) * w, (row + 1) * h)),
             folder / "frames" / f"{i:02d}.png")
    return alpha


def sprite_json(spin):
    return {"frame_width": spin["xSize"], "frame_height": spin["ySize"],
            "columns": spin["xTiles"], "rows": spin["yTiles"],
            "frames": spin["xTiles"] * spin["yTiles"],
            "rotation": "frame 00 nose-up, 10 degrees clockwise per frame"}


def build_ship(ed: Edition, plug: Plugin, rid: int):
    slug, konex, gonex = ed.ships[rid]
    ship_res = plug.get("shïp", rid)
    name = ed.names.get(rid) or ship_res.name
    spin = plug.record("spïn", rid)
    folder = PACK / ed.key / "ships" / slug
    alpha = sprite_bank(plug, spin, folder)
    files = {"sheet": "sheet.png", "mask": "mask.png", "sheet_alpha": "sheet-alpha.png",
             "frames": "frames/{NN}.png"}
    sources = {"shïp": rid, "spïn": rid, "sheet": f"PICT {spin['SpritesID']}",
               "mask": f"PICT {spin['MasksID']}"}
    for kind, base in PICTURES:
        pid = base + rid - 128
        image = plug.picture(pid)
        if image is None:  # the 1/4 Defender has no icon of its own
            files[kind] = None
            continue
        save(image.convert("RGB"), folder / f"{kind}.png")
        files[kind] = f"{kind}.png"
        sources[kind] = f"PICT {pid}"
    meta = {
        "name": name, "slug": slug, "edition": ed.key,
        "description": plug.text("dësc", 2000 + rid - 128),
        "escort": plug.text("dësc", 2100 + rid - 128),
        "sprite": sprite_json(spin), "files": files,
        "stats": plug.record("shïp", rid), "sources": sources,
        "also_in": {"konex": f"dist/data/ships/{konex}/" if konex else None,
                    "gonex": f"assets/data/ships/{gonex}/" if gonex else None},
    }
    write_json(folder / "ship.json", meta)
    return meta, alpha


def build_weapon(ed: Edition, plug: Plugin, rid: int):
    slug, name, desc = ed.weapons[rid]
    spin = plug.record("spïn", rid)
    folder = PACK / ed.key / "weapons" / slug
    sprite_bank(plug, spin, folder)
    meta = {"name": name, "slug": slug, "edition": ed.key,
            "description": plug.text("dësc", desc) if desc else None,
            "sprite": sprite_json(spin),
            "sources": {"spïn": rid, "sheet": f"PICT {spin['SpritesID']}",
                        "mask": f"PICT {spin['MasksID']}"}}
    write_json(folder / "weapon.json", meta)
    return meta


def all_pictures(ed: Edition, plug: Plugin):
    """Every picture in the plugin, except any held back for a stated reason."""
    out, listed = PACK / ed.key / "pictures", []
    for res in sorted(plug.fork.resources, key=lambda r: r.rid):
        if res.rtype != "PICT" or res.rid in ed.withheld:
            continue
        name = extract.resource_file(res, ".png")
        save(pict.decode_pict(res.data), out / name)
        listed.append(name)
    return listed


def readme_doc(ed: Edition, doc: Plugin, members):
    """The DOCMaker readme as Markdown. Chapter k is TEXT 127+k titled by
    STR 2000+k; pInf c·100+n places a picture as the n-th of chapter c-1."""
    folder = PACK / ed.key / "readme"
    placed = {}
    for res in doc.fork.resources:
        if res.rtype == "pInf":
            chapter, nth = res.rid // 100 - 1, res.rid % 100
            placed.setdefault(chapter, []).append((nth, int.from_bytes(res.data[:2], "big")))
    member = next(m for m in members if m.path == ed.readme)
    lines = [f"# {ed.title} — the original readme",
             "",
             f"Paul Richeson's own documentation for {ed.title}, as it shipped inside the "
             f"archive (a DOCMaker document, `{ed.readme.split('/')[-1]}`, last saved "
             f"{member.modified:%-d %B %Y}). Text and pictures are converted as they are, "
             "1990s spelling included. Each chapter's pictures stand at its head; DOCMaker "
             "floated them beside the text.",
             ""]
    chapter = 1
    while doc.get("TEXT", 127 + chapter):
        title = doc.text("STR ", 2000 + chapter) or f"Chapter {chapter}"
        lines += [f"## {title}", ""]
        for _, pid in sorted(placed.get(chapter, [])):
            image = doc.picture(pid)
            save(image, folder / "pictures" / f"{pid}.png")
            lines += [f"![{title}, picture {pid}](pictures/{pid}.png)", ""]
        text = doc.text("TEXT", 127 + chapter)
        paragraphs = [p.strip() for p in re.split(r"\n\s*\n|\n", text) if p.strip()]
        lines += ["  \n".join(paragraphs), ""]
        chapter += 1
    (folder / "README.md").write_text("\n".join(lines), encoding="utf-8")
    return chapter - 1


def contact_sheet(ed: Edition, rows):
    """One row per ship: rotation frame 00, target, yard, comm, thumb."""
    cell, label, pad = 112, 18, 8
    width = 5 * (cell + pad) + pad
    sheet = Image.new("RGB", (width, label + len(rows) * (cell + label + pad) + pad),
                      (16, 18, 24))
    draw = ImageDraw.Draw(sheet)
    for c, heading in enumerate(["frame 00"] + [k for k, _ in PICTURES]):
        draw.text((pad + c * (cell + pad), pad), heading, fill=(140, 150, 170))
    for r, (meta, alpha) in enumerate(rows):
        folder = PACK / ed.key / "ships" / meta["slug"]
        w, h = meta["sprite"]["frame_width"], meta["sprite"]["frame_height"]
        tiles = [alpha.crop((0, 0, w, h))] + [
            Image.open(folder / meta["files"][k]) if meta["files"][k] else None
            for k, _ in PICTURES]
        y = label + pad + r * (cell + label + pad)
        draw.text((pad, y), meta["name"], fill=(220, 224, 232))
        for c, tile in enumerate(tiles):
            if tile is None:
                continue
            tile = tile.convert("RGBA")
            tile.thumbnail((cell, cell))
            x = pad + c * (cell + pad)
            sheet.paste(tile, (x + (cell - tile.width) // 2,
                               y + label + (cell - tile.height) // 2), tile)
    save(sheet, PACK / ed.key / "contact-sheet.png")


def edition_readme(ed: Edition, ships, weapons, pictures, chapters):
    rows = ["| Ship | Frame 00 | Sprite | Speed | Shield | Armor | Cargo | Price |",
            "| --- | :---: | ---: | ---: | ---: | ---: | ---: | ---: |"]
    for m in ships:
        s, sp = m["stats"], m["sprite"]
        rows.append(f"| [{m['name']}](ships/{m['slug']}/) "
                    f"| ![{m['name']}](ships/{m['slug']}/frames/00.png) "
                    f"| {sp['frame_width']}×{sp['frame_height']} | {s['Speed']} | "
                    f"{s['Shield']:,} | {s['Armor']:,} | {s['Holds']:,} | {s['Cost']:,} |")
    withheld = "".join(f"\n- PICT {pid}: {why}." for pid, why in ed.withheld.items())
    text = f"""# {ed.title} ({ed.year}) — {ed.game}

{len(ships)} ships, {len(weapons)} weapon sprite, {len(pictures)} pictures and the
original readme ({chapters} chapters), from `{ed.archive}`.

![Contact sheet](contact-sheet.png)

{chr(10).join(rows)}

The numbers are the plugin's own ship records (`shïp`); each `ship.json` has
every field, the shipyard description and the escort pitch.

- [`ships/`](ships/): one folder per ship, as described in the pack's README
- [`weapons/`](weapons/): {", ".join(w["name"] for w in weapons)}
- [`pictures/`](pictures/): every picture in the plugin, named by resource ID —
  sprite sheets and masks, targets, shipyards, comms, icons and landing views
- [`readme/`](readme/README.md): Paul Richeson's readme, converted to Markdown

Held back from `pictures/`:{withheld or " nothing."}
"""
    (PACK / ed.key / "README.md").write_text(text, encoding="utf-8")


def build_edition(ed: Edition):
    shutil.rmtree(PACK / ed.key, ignore_errors=True)
    members, _, _ = extract.read_archive(PACK / ed.archive)
    by_path = {m.path: m for m in members}
    plug = Plugin(by_path[ed.plugin].rsrc)
    doc = Plugin(by_path[ed.readme].rsrc)

    rows = [build_ship(ed, plug, rid) for rid in ed.ships]
    weapons = [build_weapon(ed, plug, rid) for rid in ed.weapons]
    pictures = all_pictures(ed, plug)
    chapters = readme_doc(ed, doc, members)
    contact_sheet(ed, rows)
    ships = [meta for meta, _ in rows]
    edition_readme(ed, ships, weapons, pictures, chapters)
    for m in ships:
        s = m["sprite"]
        print(f"  {m['name']:<14} {s['frame_width']}x{s['frame_height']} x{s['frames']}"
              f"  -> {ed.key}/ships/{m['slug']}/")
    print(f"  {len(pictures)} pictures, readme {chapters} chapters")
    return {
        "key": ed.key, "title": ed.title, "year": ed.year, "game": ed.game,
        "archive": ed.archive,
        "archive_sha256": hashlib.sha256((PACK / ed.archive).read_bytes()).hexdigest(),
        "plugin_modified": by_path[ed.plugin].modified.isoformat(),
        "path": f"{ed.key}/",
        "ships": [{"slug": m["slug"], "name": m["name"], "path": f"{ed.key}/ships/{m['slug']}/",
                   "frame_width": m["sprite"]["frame_width"],
                   "frame_height": m["sprite"]["frame_height"],
                   "columns": m["sprite"]["columns"], "frames": m["sprite"]["frames"],
                   "pictures": {k: v for k, v in m["files"].items() if k in dict(PICTURES) and v},
                   "description": m["description"]} for m in ships],
        "weapons": [{"slug": w["slug"], "name": w["name"],
                     "path": f"{ed.key}/weapons/{w['slug']}/",
                     "frame_width": w["sprite"]["frame_width"],
                     "frame_height": w["sprite"]["frame_height"],
                     "columns": w["sprite"]["columns"], "frames": w["sprite"]["frames"]}
                    for w in weapons],
    }


def shipped():
    """The files a release carries: not git, editor or CI files, nor dist/."""
    for path in sorted(p for p in PACK.rglob("*") if p.is_file()):
        rel = path.relative_to(PACK)
        if rel.parts[0] not in ("dist", "node_modules") and \
                not any(part.startswith(".") or part == "__pycache__" for part in rel.parts):
            yield path, rel


def write_manifest():
    files = {rel.as_posix(): hashlib.sha256(path.read_bytes()).hexdigest()
             for path, rel in shipped() if rel.as_posix() != "manifest.json"}
    write_json(PACK / "manifest.json", {"name": "Yodacon Ship Pack", "version": VERSION,
                                        "license": "GPL-2.0-or-later", "files": files})
    return len(files)


def release_zip(dist: Path) -> Path:
    dist.mkdir(parents=True, exist_ok=True)
    stem = f"yodacon-ship-pack-{VERSION}"
    target = dist / f"{stem}.zip"
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as z:
        for path, rel in shipped():
            # fixed timestamps: the same pack always zips to the same bytes
            info = zipfile.ZipInfo(f"{stem}/{rel.as_posix()}", (1997, 11, 9, 20, 5, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            z.writestr(info, path.read_bytes())
    return target


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--zip", type=Path, metavar="DIST", help="also write the release zip here")
    ap.add_argument("--manifest-only", action="store_true",
                    help="only rehash the pack (after editing pages or docs)")
    args = ap.parse_args()

    if not args.manifest_only:
        editions = []
        for ed in EDITIONS:
            print(f"{ed.title} ({ed.archive})")
            editions.append(build_edition(ed))
        write_json(PACK / "catalog.json", {
            "name": "Yodacon Ship Pack", "version": VERSION, "license": "GPL-2.0-or-later",
            "author": "Paul Richeson",
            "credit": "Ships from the Yodacon Ship Pack by Paul Richeson (ConEx, 1997), "
                      "GPL-2.0-or-later — https://github.com/yodacon/yodacon-ship-pack",
            "rotation": "frame 00 nose-up, 10 degrees clockwise per frame; "
                        "frame = floor(heading / 10) mod 36",
            "editions": editions,
        })
    print(f"manifest: {write_manifest()} files")
    if args.zip:
        print(f"release: {release_zip(args.zip)}")


if __name__ == "__main__":
    main()
