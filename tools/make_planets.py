#!/usr/bin/env python3
"""Generate the pack's first planets: five types, three sizes, drawn in code.

The plugins' planet sprites point at Escape Velocity's own pictures, which are
Ambrosia's, so the pack makes its own. These are a starting set: the same
faces in every size, lit from the upper left like the ships' renders, with
hard 1-bit masks like the ships' masks. Hand-rendered planets can replace any
of them later without changing the layout.

  planets/<type>/<size>/planet.png   RGBA, transparent outside the disc
  planets/<type>/<size>/opaque.png   RGB on black (the plugins' form)
  planets/<type>/<size>/mask.png     white where the planet is
  planets/<type>/<size>/planet.json  type, size, diameter, radius, light
  planets/contact-sheet.png, planets/README.md

Surface detail is 3D value noise sampled on the sphere itself, so there is no
seam, and everything is seeded: the same script always draws the same planets.
Pure Python and Pillow, like the rest of tools/.
"""
import json
import math
import shutil
from pathlib import Path

from PIL import Image, ImageDraw

PACK = Path(__file__).resolve().parents[1]
OUT = PACK / "planets"

SIZES = {"small": 32, "medium": 64, "large": 96}
LIGHT = (-0.55, -0.55, 0.63)   # from the upper left and in front, as the ships are lit
_l = math.sqrt(sum(c * c for c in LIGHT))
LIGHT = tuple(c / _l for c in LIGHT)

TYPES = {
    "rocky": "a cratered rocky world",
    "gas": "a banded gas giant",
    "ice": "a cracked ice world",
    "lava": "a dark crust over glowing lava",
    "garden": "oceans, land, ice caps and cloud",
}


# --- Noise ----------------------------------------------------------------------

def _hash(x, y, z, seed):
    h = (x * 374761393 + y * 668265263 + z * 2147483647 + seed * 144665) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((h ^ (h >> 16)) & 0xFFFF) / 65535.0


def _smooth(t):
    return t * t * (3 - 2 * t)


def value_noise(x, y, z, seed):
    xi, yi, zi = math.floor(x), math.floor(y), math.floor(z)
    xf, yf, zf = _smooth(x - xi), _smooth(y - yi), _smooth(z - zi)

    def lerp(a, b, t):
        return a + (b - a) * t
    c = [[[_hash(xi + dx, yi + dy, zi + dz, seed) for dz in (0, 1)] for dy in (0, 1)] for dx in (0, 1)]
    return lerp(lerp(lerp(c[0][0][0], c[0][0][1], zf), lerp(c[0][1][0], c[0][1][1], zf), yf),
                lerp(lerp(c[1][0][0], c[1][0][1], zf), lerp(c[1][1][0], c[1][1][1], zf), yf), xf)


def fbm(x, y, z, seed, octaves=4):
    total, amp, freq, norm = 0.0, 1.0, 1.0, 0.0
    for o in range(octaves):
        total += amp * value_noise(x * freq, y * freq, z * freq, seed + o * 101)
        norm += amp
        amp *= 0.5
        freq *= 2.03
    return total / norm


def ramp(stops, t):
    t = max(0.0, min(1.0, t))
    for (t0, c0), (t1, c1) in zip(stops, stops[1:]):
        if t <= t1:
            k = (t - t0) / (t1 - t0) if t1 > t0 else 0
            return tuple(a + (b - a) * k for a, b in zip(c0, c1))
    return stops[-1][1]


def mix(a, b, k):
    return tuple(x + (y - x) * k for x, y in zip(a, b))


# --- Surfaces: colour at a point on the unit sphere, plus glow (unlit) ---------------

def surface(kind, x, y, z):
    """(colour, emissive colour or None, atmosphere tint or None)"""
    if kind == "rocky":
        n = fbm(x * 2.2, y * 2.2, z * 2.2, 11)
        c = ramp([(0.0, (62, 52, 46)), (0.5, (128, 110, 93)), (1.0, (196, 182, 160))], n)
        crater = fbm(x * 6, y * 6, z * 6, 23, 2)
        if crater > 0.68:
            c = mix(c, (40, 34, 30), min(1, (crater - 0.68) * 6))
        elif crater > 0.62:
            c = mix(c, (220, 205, 180), 0.35)          # crater rims catch the light
        return c, None, None
    if kind == "gas":
        warp = fbm(x * 1.6, y * 1.6, z * 1.6, 37)
        band = 0.5 + 0.5 * math.sin(y * 11 + warp * 3.2)
        c = ramp([(0.0, (140, 86, 54)), (0.45, (214, 170, 120)), (0.8, (236, 218, 190)), (1.0, (190, 120, 80))], band)
        storm = (x + 0.35) ** 2 + (y - 0.3) ** 2 * 3
        if storm < 0.035:
            c = mix(c, (190, 70, 50), 0.7)
        return c, None, (230, 200, 160)
    if kind == "ice":
        n = fbm(x * 2.5, y * 2.5, z * 2.5, 41)
        c = ramp([(0.0, (150, 186, 214)), (0.6, (214, 232, 246)), (1.0, (250, 252, 255))], n)
        crack = abs(fbm(x * 4, y * 4, z * 4, 43, 3) - 0.5)
        if crack < 0.025:
            c = mix(c, (80, 120, 160), 0.8)
        return c, None, (190, 225, 255)
    if kind == "lava":
        n = fbm(x * 2.4, y * 2.4, z * 2.4, 53)
        c = ramp([(0.0, (22, 16, 14)), (1.0, (78, 50, 38))], n)
        crack = abs(fbm(x * 3.2, y * 3.2, z * 3.2, 59, 3) - 0.5)
        glow = None
        if crack < 0.05:
            heat = 1 - crack / 0.05
            glow = mix((200, 40, 10), (255, 190, 60), heat)
        return c, glow, None
    # garden
    h = fbm(x * 1.8, y * 1.8, z * 1.8, 71)
    if h < 0.5:
        c = ramp([(0.0, (18, 46, 110)), (0.5, (40, 100, 170))], h)
    else:
        c = ramp([(0.5, (190, 180, 120)), (0.56, (70, 130, 60)), (0.75, (40, 90, 40)), (1.0, (120, 100, 80))], h)
    if abs(y) > 0.82:
        c = mix(c, (240, 245, 250), min(1, (abs(y) - 0.82) * 12))
    cloud = fbm(x * 3, y * 3, z * 3, 79, 3)
    if cloud > 0.58:
        c = mix(c, (245, 248, 252), min(0.8, (cloud - 0.58) * 4))
    return c, None, (150, 200, 255)


def draw(kind, size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    px = img.load()
    radius = size / 2 - 0.5
    for py in range(size):
        for qx in range(size):
            x = (qx + 0.5 - size / 2) / radius
            y = (py + 0.5 - size / 2) / radius
            d2 = x * x + y * y
            if d2 > 1:
                continue
            z = math.sqrt(1 - d2)
            colour, glow, atmosphere = surface(kind, x, y, z)
            lit = max(0.0, x * LIGHT[0] + y * LIGHT[1] + z * LIGHT[2])
            shade = 0.12 + 0.88 * lit ** 0.9
            r, g, b = (c * shade for c in colour)
            if glow:                                   # lava glows on the night side too
                r, g, b = (max(a, gl * (0.55 + 0.45 * lit)) for a, gl in zip((r, g, b), glow))
            if atmosphere:                             # a thin bright limb on the lit side
                rim = (1 - z) ** 3 * (0.25 + 0.75 * lit)
                r, g, b = (a + (t - a) * min(0.7, rim) for a, t in zip((r, g, b), atmosphere))
            px[qx, py] = (int(min(255, r)), int(min(255, g)), int(min(255, b)), 255)
    return img


def build():
    shutil.rmtree(OUT, ignore_errors=True)
    entries = []
    for kind, words in TYPES.items():
        for size_name, size in SIZES.items():
            folder = OUT / kind / size_name
            folder.mkdir(parents=True, exist_ok=True)
            planet = draw(kind, size)
            mask = planet.getchannel("A")
            opaque = Image.new("RGB", planet.size, (0, 0, 0))
            opaque.paste(planet, (0, 0), planet)
            planet.save(folder / "planet.png", optimize=True)
            opaque.save(folder / "opaque.png", optimize=True)
            mask.save(folder / "mask.png", optimize=True)
            meta = {"type": kind, "size": size_name, "description": words,
                    "diameter": size, "radius": size / 2,
                    "light": "upper left, in front (as the ships are lit)",
                    "files": {"planet": "planet.png", "opaque": "opaque.png", "mask": "mask.png"},
                    "made_by": "tools/make_planets.py (Yodacon Ship Pack, 2026): generated, not rendered"}
            (folder / "planet.json").write_text(json.dumps(meta, indent=2) + "\n")
            entries.append({"type": kind, "size": size_name, "diameter": size,
                             "path": f"planets/{kind}/{size_name}/"})
    contact_sheet()
    readme()
    return entries


def contact_sheet():
    pad, label = 12, 16
    width = pad + sum(s + pad for s in SIZES.values()) + 90
    height = pad + len(TYPES) * (max(SIZES.values()) + label + pad)
    sheet = Image.new("RGB", (width, height), (8, 10, 18))
    d = ImageDraw.Draw(sheet)
    for r, kind in enumerate(TYPES):
        y = pad + r * (max(SIZES.values()) + label + pad)
        d.text((pad, y), kind, fill=(200, 205, 220))
        x = pad + 80
        for size_name, size in SIZES.items():
            p = Image.open(OUT / kind / size_name / "planet.png")
            sheet.paste(p, (x, y + label + (max(SIZES.values()) - size) // 2), p)
            x += size + pad
    sheet.save(OUT / "contact-sheet.png", optimize=True)


def readme():
    rows = "\n".join(f"| `{k}` | {w} |" for k, w in TYPES.items())
    (OUT / "README.md").write_text(f"""# Planets (generated)

A starting set of planets for games that need them: five types, three sizes
each ({", ".join(f"{n} {s} px" for n, s in SIZES.items())}), drawn by
`tools/make_planets.py`. They are generated, not rendered: the plugins'
own planet sprites belong to Escape Velocity, so the pack makes its own until
hand-rendered planets replace them.

![The planets](contact-sheet.png)

| Type | Look |
| --- | --- |
{rows}

Each `planets/<type>/<size>/` folder has `planet.png` (RGBA), `opaque.png`
(RGB on black), `mask.png` (white where the planet is) and `planet.json`
(diameter, radius, light direction), the same three forms the ships come in.
Light comes from the upper left, as on the ships; the larger sizes are the
same planet with more detail, not a different one.
""")


if __name__ == "__main__":
    for e in build():
        print(f"{e['type']:<7} {e['size']:<7} {e['diameter']} px -> {e['path']}")
