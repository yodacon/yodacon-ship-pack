#!/usr/bin/env python3
"""Extract a 1990s Mac archive with nothing but Python: BinHex 4.0 (.hqx),
StuffIt (.sit, classic and 5), and the resource forks inside.

  extract.py <file.sit.hqx | file.sit> <out-dir> [--resources] [--pictures]

Writes, for every member of the archive:

  <out-dir>/<member>.data         the data fork (when it has one)
  <out-dir>/<member>.rsrc         the resource fork, byte for byte
  <out-dir>/<member>/<type>/<id>[_<name>].bin   each resource  (--resources)
  <out-dir>/<member>/pictures/<id>[_<name>].png  each PICT    (--pictures)

and <out-dir>/members.json with Finder types, creators, dates and SHA-256s.
A .hqx input also leaves the .sit it wraps beside the outputs.

Every layer is checked: BinHex CRC-16s, StuffIt fork CRC-16s, and Arsenic's
CRC-32. Nothing is written from a stream that failed its check.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path

import binhex
import rfork
import stuffit


def safe(name: str) -> str:
    """A resource or member name as a file name: no slashes, no control bytes."""
    return re.sub(r'[\x00-\x1f/\\:*?"<>|]', "_", name).strip() or "_"


def resource_dir(rtype: str) -> str:
    # 'STR ' and 'snd ' end in a space; 'Dk@P' is DOCMaker's owner resource
    return safe(rtype.strip().replace("@", "_"))


def resource_file(res, suffix: str) -> str:
    return f"{res.rid}_{safe(res.name)}{suffix}" if res.name else f"{res.rid}{suffix}"


def read_archive(path: Path):
    """(members, the .sit bytes and its name) for a .hqx or a .sit."""
    raw = path.read_bytes()
    if b"(This file must be converted with BinHex" in raw[:200]:
        wrapped = binhex.decode(raw)
        return stuffit.read(wrapped.data), wrapped.data, wrapped.name
    return stuffit.read(raw), raw, path.name


def pictures(fork, out: Path):
    import pict  # needs Pillow; only imported when pictures are asked for
    failures = []
    for res in fork.resources:
        if res.rtype != "PICT":
            continue
        try:
            image = pict.decode_pict(res.data)
        except Exception as e:  # report and carry on: one odd picture shouldn't stop the rest
            failures.append((res.rid, str(e)))
            continue
        out.mkdir(parents=True, exist_ok=True)
        image.save(out / resource_file(res, ".png"), optimize=True)
    return failures


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("archive", type=Path)
    ap.add_argument("out", type=Path)
    ap.add_argument("--resources", action="store_true", help="split each resource fork")
    ap.add_argument("--pictures", action="store_true", help="decode every PICT to PNG")
    args = ap.parse_args()

    members, sit, sit_name = read_archive(args.archive)
    args.out.mkdir(parents=True, exist_ok=True)
    listing = {"archive": args.archive.name, "sit": sit_name,
               "sit_sha256": hashlib.sha256(sit).hexdigest(), "members": []}
    if sit_name != args.archive.name:
        (args.out / safe(sit_name)).write_bytes(sit)

    for m in members:
        stem = "/".join(safe(p) for p in m.path.split("/"))
        base = args.out / stem
        base.parent.mkdir(parents=True, exist_ok=True)
        entry = {"path": m.path, "type": m.type.decode("mac_roman"),
                 "creator": m.creator.decode("mac_roman"),
                 "created": m.created.isoformat(), "modified": m.modified.isoformat(),
                 "methods": m.methods}
        for fork, data in (("data", m.data), ("rsrc", m.rsrc)):
            if data:
                Path(f"{base}.{fork}").write_bytes(data)
                entry[fork] = {"bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
        if m.rsrc and (args.resources or args.pictures):
            fork = rfork.parse(m.rsrc)
            entry["resources"] = len(fork.resources)
            if args.resources:
                for res in fork.resources:
                    d = base / resource_dir(res.rtype)
                    d.mkdir(parents=True, exist_ok=True)
                    (d / resource_file(res, ".bin")).write_bytes(res.data)
            if args.pictures:
                failed = pictures(fork, base / "pictures")
                if failed:
                    entry["picture_failures"] = failed
        listing["members"].append(entry)
        print(f"{m.path}  {entry['type']}/{entry['creator']}  rsrc {len(m.rsrc):,} B  "
              f"data {len(m.data):,} B  modified {m.modified:%Y-%m-%d %H:%M}")

    (args.out / "members.json").write_text(json.dumps(listing, indent=2, ensure_ascii=False) + "\n",
                                          encoding="utf-8")


if __name__ == "__main__":
    main()
