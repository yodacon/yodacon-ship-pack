#!/usr/bin/env python3
"""Stack the parts tools/capture_page.mjs photographed into one dated picture.

Parts go top to bottom in the order given, with a torn-edge gap wherever the
page skipped something between them, and a footer naming the page and the
UTC time it was captured.

Usage: stamp_capture.py <capture-dir> <out.png> <part> [<part> ...]
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
INK, PAPER, GAP = (40, 44, 52), (255, 255, 255), (232, 234, 240)


def font(size):
    try:
        return ImageFont.truetype(FONT, size)
    except OSError:
        return ImageFont.load_default()


def main():
    cap_dir, out, names = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3:]
    record = json.loads((cap_dir / "capture.json").read_text())
    clips = {p["name"]: p["clip"] for p in record["parts"]}
    parts = [Image.open(cap_dir / f"{n}.png").convert("RGB") for n in names]
    width = max(p.width for p in parts)

    gap_h, foot_h = 22, 46
    gaps = [i for i in range(1, len(names))
            if abs(clips[names[i]]["y"] - (clips[names[i - 1]]["y"] + clips[names[i - 1]]["height"])) > 2]
    height = sum(p.height for p in parts) + gap_h * len(gaps) + foot_h
    sheet = Image.new("RGB", (width, height), PAPER)
    draw = ImageDraw.Draw(sheet)
    y = 0
    for i, part in enumerate(parts):
        if i in gaps:  # rows of the page left out here
            draw.rectangle((0, y, width, y + gap_h - 1), fill=GAP)
            for x in range(0, width, 16):
                draw.line((x, y + 6, x + 8, y + 2, x + 16, y + 6), fill=(190, 194, 204))
                draw.line((x, y + gap_h - 6, x + 8, y + gap_h - 2, x + 16, y + gap_h - 6),
                          fill=(190, 194, 204))
            draw.text((width // 2, y + gap_h // 2), "· · ·", fill=(120, 124, 134),
                      font=font(13), anchor="mm")
            y += gap_h
        sheet.paste(part, (0, y))
        y += part.height

    draw.rectangle((0, y, width, height), fill=INK)
    when = record["captured"].replace("T", " ").replace("Z", " UTC")
    draw.text((14, y + 9), record["url"], fill=(255, 255, 255), font=font(15))
    draw.text((14, y + 27), f"Captured {when} by the Yodacon Ship Pack (tools/capture_page.mjs)",
              fill=(180, 186, 200), font=font(12))
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out, optimize=True)
    print(f"{out}: {width}x{height}, captured {when}")


if __name__ == "__main__":
    main()
