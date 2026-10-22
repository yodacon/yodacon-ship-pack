#!/usr/bin/env python3
"""Write the tutorial note at the foot of each example page.

Each examples/<name>/index.html ends with a short paper, set like an IEEE
note, on how that page uses the pack's assets. Its listings are cut from the
page's own source and the library, with their real line numbers, so they are
found here by a text pattern rather than typed in: rerun this after changing
an example and the quotations and references follow.

The note goes after the page's last </script>, and the "How this page works"
link joins an existing line, so writing a note never moves a line it cites.

    python3 tools/example_notes.py          # write all six
    python3 tools/example_notes.py --check  # exit 1 if any page is out of date
"""
import html
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LIB = "lib/yodacon-ship-pack.js"
START, END = "<!-- tutorial note: written by tools/example_notes.py -->", "<!-- /tutorial note -->"
DATE = "October 2026"
_cache = {}


def lines(path):
    if path not in _cache:
        text = (ROOT / path).read_text()
        if START in text:                                   # quote the page as it is without its note
            text = text[:text.index(START)] + text[text.index(END) + len(END) + 1:]
        _cache[path] = text.split("\n")
    return _cache[path]


def ln(path, pattern, after=1):
    """1-based number of the first line at or after `after` containing pattern."""
    for i, line in enumerate(lines(path)[after - 1:], start=after):
        if pattern in line:
            return i
    raise SystemExit(f"{path}: no line contains {pattern!r}")


def ref(path, *patterns):
    """A clickable-looking citation: page.html:45 or :45–52."""
    nums = [ln(path, p) for p in patterns]
    span = str(nums[0]) if len(nums) == 1 else f"{nums[0]}–{nums[1]}"
    return f"<code>{html.escape(Path(path).name if path != LIB else path)}:{span}</code>"


def listing(n, caption, path, *ranges):
    """A numbered listing. Each range is (first-pattern, last-pattern), (first-pattern, n) or (pattern,)."""
    picked = []
    for r in ranges:
        a = ln(path, r[0])
        b = a + r[-1] if isinstance(r[-1], int) else ln(path, r[-1], a)   # an int: that many lines on
        if picked:
            picked.append(None)                             # an elision between ranges
        picked += list(range(a, b + 1))
    src = lines(path)
    body = [src[i - 1] for i in picked if i]
    indent = min((len(s) - len(s.lstrip())) for s in body if s.strip())
    out = []
    for i in picked:
        if i is None:
            out.append('<span class="l"><span class="n"></span>⋮</span>')
            continue
        text = html.escape(src[i - 1][indent:])
        text = re.sub(r"(//.*|/\*.*\*/)$", r'<span class="c">\1</span>', text)
        out.append(f'<span class="l"><span class="n">{i}</span>{text}</span>')
    nums = [i for i in picked if i]
    name = path if path == LIB else Path(path).name
    where = f"<code>{name}:{nums[0]}–{nums[-1]}</code>"
    return (f'<figure>\n<figcaption><b>Listing {n}.</b> {caption}, {where}</figcaption>\n'
            f'<pre class="wrap">{"".join(out)}</pre>\n</figure>')


def table(n, caption, head, rows):
    th = "".join(f"<th>{h}</th>" for h in head)
    tr = "".join("<tr>" + "".join(f"<td>{c}</td>" for c in r) + "</tr>\n" for r in rows)
    return (f'<figure>\n<figcaption><b>Table {n}.</b> {caption}</figcaption>\n'
            f'<table><thead><tr>{th}</tr></thead><tbody>\n{tr}</tbody></table>\n</figure>')


def eq(text, n):
    return f'<p class="eq"><span>{text}</span><span>({n})</span></p>'


def paper(number, title, abstract, terms, body, refs):
    items = "\n".join(f"  <li>{r}</li>" for r in refs)
    return f"""{START}
<link rel="stylesheet" href="../paper.css">
<article class="paper" id="note" aria-labelledby="note-title">
<header>
  <p class="kicker">Yodacon Ship Pack · Tutorial Note {number} · {DATE}</p>
  <h2 class="title" id="note-title">{title}</h2>
  <p class="byline">Yodacon Ship Pack project, yodacon.org/ship-pack</p>
</header>
<div class="cols">
<p class="abstract"><i>Abstract</i>—{abstract}</p>
<p class="terms"><i>Index Terms</i>—{terms}</p>
{body}
<h3>References</h3>
<ol class="refs">
{items}
</ol>
</div>
</article>
{END}"""


TN1 = 'Yodacon Ship Pack, “From sprite sheet to moving ship,” Tutorial Note 1, <i>examples/</i>, 2026. <a href="../#tutorial">examples/#tutorial</a>'
R_LIB = "Yodacon Ship Pack, <i>lib/yodacon-ship-pack.js</i>, v2.0.0, 2026."
R_JSON = "Yodacon Ship Pack, <i>ship.json</i> and <i>catalog.json</i>, v2.0.0, 2026."
R_DEMO = 'Yodacon Ship Pack, “Demo game,” <i>demo/</i>, 2026. <a href="../../demo/">demo/</a>'
P = "examples/{}/index.html"


# --- TN-2: DOM ----------------------------------------------------------------------------------------

def note_dom():
    f = P.format("dom")
    body = f"""
<h3>I. Introduction</h3>
<p>This page shows a ship with no canvas, no library and no framework: a single <code>&lt;div&gt;</code>
whose CSS background is the ship's sprite sheet. It is the smallest complete use of the pack, and every
rendering technique in the other examples is this one with a different drawing call [1]. The page is one
file, <code>examples/dom/index.html</code>; this note cites its lines.</p>

<h3>II. Assets Used</h3>
{table("I", "What the page takes from the pack", ["Asset", "Read at", "Used for"], [
  ["<code>ship.json</code>", ref(f, 'const meta = await'), "Frame size, columns, name"],
  ["<code>sheet-alpha.png</code>", ref(f, 'el.style.setProperty("--sheet"'), "The pixels, as a CSS background"],
])}
<p>The pack's location is one URL, <code>PACK</code> ({ref(f, "const PACK =")}); point it at your own copy
or at a pinned jsDelivr release and nothing else changes. The ship's folder follows from the edition and slug
({ref(f, "const dir =")}).</p>

<h3>III. Reading the Frame Grid</h3>
<p>Frame sizes vary from ship to ship, so the page reads them from <code>ship.json</code> rather than
assuming one (Listing 1). They become CSS custom properties on the element, together with a whole-number
scale: 1997 pixel art only stays square at integer scales.</p>
{listing(1, "Metadata to CSS properties", f, ("const meta = await", "el.setAttribute(\"aria-label\""))}

<h3>IV. The Sprite in CSS</h3>
<p>The element is exactly one frame in size. The background is the whole sheet, scaled by the same factor,
and shifted so that the wanted cell sits in the box (Listing 2). With column <i>c</i> and row <i>r</i> of
frame <i>f</i>, scale <i>s</i> and frame width <i>w</i> and height <i>h</i>:</p>
{eq("background-position = (−c · w · s, −r · h · s)", 1)}
<p>The size of the background must be scaled too, or the offsets in (1) would land in the wrong place;
<code>auto</code> height keeps the sheet's proportions. <code>image-rendering: pixelated</code>
({ref(f, "image-rendering: pixelated")}) keeps the enlarged pixels sharp.</p>
{listing(2, "The sprite rule", f, (".ship {", "image-rendering: pixelated"))}

<h3>V. Heading to Frame</h3>
<p>The frame for a heading <i>θ</i> (degrees clockwise from up) is</p>
{eq("f = ⌊θ / 10⌋ mod 36,&nbsp;&nbsp; c = f mod 6,&nbsp;&nbsp; r = ⌊f / 6⌋", 2)}
<p>and <code>show()</code> writes <i>c</i> and <i>r</i> to the element (Listing 3). Turning never rotates the
element; it only moves the background, so the 1997 pre-rendered lighting stays correct at every angle.</p>
{listing(3, "Turning", f, ("let heading = 0;", "const turn ="))}

<h3>VI. Accessibility</h3>
<p>The sprite is a picture, so it carries <code>role="img"</code> and the ship's name as its label
({ref(f, 'role="img"')}, {ref(f, 'el.setAttribute("aria-label"')}); the readout is a polite live region
({ref(f, 'aria-live="polite"')}) so screen readers hear each new heading.</p>

<h3>VII. Using It in Your Project</h3>
<ol class="steps">
  <li>Copy the pack (or use a pinned CDN URL) and set <code>PACK</code>.</li>
  <li>Copy the <code>.ship</code> rule and the script.</li>
  <li>Set the heading from your own game state and call <code>show()</code>.</li>
</ol>
<p>Many ships are many such elements. For dozens of moving ships prefer Canvas [2]; for a drop-in element that
does all of this for you, see <code>&lt;yodacon-ship&gt;</code> [3].</p>

<h3>VIII. Conclusion</h3>
<p>One fetched JSON file, one background image and Equations (1) and (2) are a complete sprite renderer. Every
other example replaces only the last step.</p>"""
    return paper(2, "A Ship in Plain HTML and CSS: How the DOM Example Uses the Pack",
        "The DOM example renders a pre-rotated pack ship with one <code>&lt;div&gt;</code> and CSS custom "
        "properties: <code>ship.json</code> supplies the frame grid, <code>sheet-alpha.png</code> becomes a "
        "background, and the heading moves <code>background-position</code>. This note walks through the "
        "page's own source to show each step and how to reuse it.",
        "CSS sprites, background-position, custom properties, pixel art.",
        body, [TN1, 'Yodacon Ship Pack, “Canvas 2D example,” Tutorial Note 3, <a href="../canvas/#note">examples/canvas/</a>.',
               'Yodacon Ship Pack, “The yodacon-ship element,” Tutorial Note 4, <a href="../web-component/#note">examples/web-component/</a>.',
               R_JSON])


# --- TN-3: Canvas -------------------------------------------------------------------------------------

def note_canvas():
    f = P.format("canvas")
    body = f"""
<h3>I. Introduction</h3>
<p>The Canvas example is a flyable ship in under 60 lines of script. It uses two functions from the pack's
library, <code>loadShip()</code> and <code>drawShip()</code> [1], and a fixed-timestep loop. This note
follows the page's source, <code>examples/canvas/index.html</code>, from loading to the drawn frame.</p>

<h3>II. Assets Used</h3>
{table("I", "What the page takes from the pack", ["Asset", "Read at", "Used for"], [
  ["<code>ship.json</code>", ref(f, "const ship = await loadShip"), "Frame size, stats, name"],
  ["<code>sheet-alpha.png</code>", ref(f, "const ship = await loadShip"), "Decoded once; drawn every frame"],
  ["<code>lib/yodacon-ship-pack.js</code>", ref(f, 'import { loadShip, drawShip }'), "Loading and drawing"],
])}

<h3>III. Loading</h3>
<p><code>loadShip(edition, slug)</code> fetches <code>ship.json</code>, then loads and decodes the sheet
(Listing 1). It resolves only when the image is ready, so the first frame never draws an empty sprite. The
query string picks the ship, so <code>?edition=override&amp;ship=callisto</code> needs no code change.</p>
{listing(1, "The library's loader", LIB, ("export async function loadShip(", 4))}

<h3>IV. Handling From the 1997 Record</h3>
<p>The ship's original <i>Escape Velocity</i> numbers live in <code>ship.meta.stats</code>. The page maps
three of them to its own units (Listing 2): <code>Speed</code> caps velocity, <code>Accel</code> is thrust
and <code>Maneuver</code> is turn rate, so a Dart and a Large Pin fly differently with no per-ship code.</p>
{listing(2, "Scale and stats", f, ("const SCALE =", "const MAX ="))}

<h3>V. Update: Thrust Along the Frame Shown</h3>
<p>Heading is continuous, but the picture changes only every 10°. The page thrusts along the heading of the
<em>frame on screen</em>, <i>a</i> = ⌊<i>θ</i>/10⌋·10°, so the ship always moves the way it appears to point
(Listing 3). With screen <i>y</i> pointing down, the unit vector is</p>
<p class="eq"><span>d(a) = (sin a, −cos a)</span><span>(1)</span></p>
{listing(3, "Update", f, ("function update(dt) {", "s.y = (s.y"))}

<h3>VI. Draw: One Library Call</h3>
<p><code>drawShip(ctx, ship, heading, x, y, scale)</code> ({ref(f, "drawShip(ctx, ship")}) selects the frame
with <i>f</i> = ⌊<i>θ</i>/10⌋ mod 36, finds its cell, and copies it centred on (<i>x</i>, <i>y</i>) with
smoothing off and rounded coordinates (Listing 4). The canvas itself is scaled by CSS to fit the page, so
the page also sets <code>image-rendering: pixelated</code> on it ({ref(f, "canvas { display: block")}).</p>
{listing(4, "The library's draw", LIB, ("export function drawShip(", 5))}

<h3>VII. The Loop</h3>
<p>Physics advances in fixed 1/60 s steps while drawing happens once per animation frame (Listing 5). The
accumulator is capped at 0.25 s so a background tab does not return to a burst of catch-up steps.</p>
{listing(5, "Fixed-timestep loop", f, ("const STEP = 1 / 60;", "requestAnimationFrame(frame);"))}

<h3>VIII. Using It in Your Project</h3>
<ol class="steps">
  <li>Import <code>loadShip</code> and <code>drawShip</code> from your copy of the library or a pinned CDN
    URL ({ref(f, "// Swap for")}).</li>
  <li>Await one <code>loadShip()</code> per ship type; reuse the result for every ship of that type.</li>
  <li>Keep each ship's <code>x</code>, <code>y</code> and <code>heading</code>; call <code>drawShip()</code>
    per ship per frame.</li>
</ol>
<p>The flying games in <code>projects/</code> (Orbital Defence, Slingshot, ConEx Courier) are this loop
grown into games [2].</p>

<h3>IX. Conclusion</h3>
<p>Two library calls carry the whole asset path from URL to pixels; everything else on the page is ordinary
game code, which is the point: the pack stays out of your game's way.</p>"""
    return paper(3, "A Game Loop on Canvas 2D: How the Canvas Example Uses the Pack",
        "The Canvas example flies a pack ship with the library's <code>loadShip()</code> and "
        "<code>drawShip()</code>, handling taken from the ship's 1997 statistics and a fixed-timestep loop. "
        "This note follows the page's source and the library code it calls.",
        "Canvas 2D, sprite sheets, fixed timestep, pixel art.",
        body, [TN1, 'Yodacon Ship Pack, “Sample projects,” <a href="../../projects/">projects/</a>.', R_LIB])


# --- TN-4: web component --------------------------------------------------------------------------------

def note_wc():
    f = P.format("web-component")
    body = f"""
<h3>I. Introduction</h3>
<p>Importing the pack's library registers a custom element, <code>&lt;yodacon-ship&gt;</code>, that shows any
ship at any heading from HTML alone. This page demonstrates it twice: a live element driven by a form, and
every ship in the catalogue spinning. This note covers how the page uses the element, then how the element
uses the assets inside the library [1].</p>

<h3>II. One Script Tag</h3>
<p>The page loads the library as a module ({ref(f, '<script type="module" src="../../lib')}). From then on,
markup such as {ref(f, '<yodacon-ship id="live"')} is a ship. The element shows its light-DOM children until
the ship loads, so a plain <code>&lt;img&gt;</code> of frame 00 inside it is a good fallback.</p>

<h3>III. Assets Used</h3>
{table("I", "What the page and the element take from the pack", ["Asset", "Read at", "Used for"], [
  ["<code>catalog.json</code>", ref(f, "const catalog = await loadCatalog"), "Every edition and ship, for the grid and the select"],
  ["<code>ship.json</code>", ref(LIB, "const ship = await loadShipMeta(this.edition"), "Frame grid and name, per element"],
  ["<code>sheet-alpha.png</code>", ref(LIB, "this.#sprite.style.backgroundImage"), "CSS background in the shadow DOM"],
])}

<h3>IV. Building From the Catalogue</h3>
<p>The page never lists ships itself. It walks <code>catalog.json</code> and creates one spinning element per
ship (Listing 1), so ships added to the pack appear here with no edit. Scale is chosen per ship to keep whole
numbers: 1 for frames wider than 64 pixels, else 2.</p>
{listing(1, "The grid", f, ("for (const ed of catalog.editions)", "document.getElementById(\"all\").append"))}

<h3>V. Attributes Are the Interface</h3>
<p>The form writes attributes; the element observes them and re-renders (Listing 2). Changing
<code>ship</code> or <code>edition</code> reloads, while <code>heading</code>, <code>scale</code> and
<code>spin</code> only redraw ({ref(LIB, "attributeChangedCallback(name")}).</p>
{listing(2, "Form to attributes", f, ("function apply() {", "live.toggleAttribute(\"spin\""))}

<h3>VI. Inside the Element</h3>
<p>The element's shadow root holds one <code>&lt;div&gt;</code> painted with the sheet, the DOM technique of
Tutorial Note 2 [2] packaged as a component. Loading fetches only <code>ship.json</code> in script; the sheet
is left to the browser as a CSS background (Listing 3). A load counter discards answers to superseded
requests when attributes change quickly.</p>
{listing(3, "Loading", LIB, ("async #load() {", "this.#render();"))}
<p>Rendering sizes the box to one frame times the scale and positions the scaled sheet (Listing 4), with the
rectangle from <code>frameRect()</code>:</p>
{eq("(x, y) = ((f mod 6) · w, ⌊f / 6⌋ · h)", 1)}
{listing(4, "Rendering", LIB, ("#render() {", "st.backgroundPosition"))}

<h3>VII. Spinning Responsibly</h3>
<p>A <code>spin</code> element advances one frame at about 12 fps, a full turn in three seconds. Two checks
keep a page of spinning ships cheap and polite: an <code>IntersectionObserver</code> pauses elements that are
off screen ({ref(LIB, "new IntersectionObserver")}), and <code>prefers-reduced-motion</code> stops spinning
altogether ({ref(LIB, "return this.spin && !reducedMotion")}).</p>

<h3>VIII. Using It in Your Project</h3>
<ol class="steps">
  <li>Add one module script tag pointing at the library.</li>
  <li>Write <code>&lt;yodacon-ship ship="dart" edition="conex" heading="90" scale="2"&gt;</code>.</li>
  <li>Set <code>heading</code> (attribute or property) from your code; listen for <code>load</code> and
    <code>error</code> events if you need them.</li>
</ol>
<p>The pack page itself uses the element for every ship card, which is the best demonstration of it at scale.</p>

<h3>IX. Conclusion</h3>
<p>The element turns the pack into HTML vocabulary: a catalogue read once, one JSON file per ship and one CSS
background, with the frame arithmetic hidden behind a <code>heading</code> attribute.</p>"""
    return paper(4, "Ships as HTML: How the <code>&lt;yodacon-ship&gt;</code> Example Uses the Pack",
        "The web-component example builds a playground and a full fleet from <code>catalog.json</code> using "
        "the library's <code>&lt;yodacon-ship&gt;</code> element. This note traces the page's source, then the "
        "element's own loading, rendering and spin logic in the library.",
        "Web components, custom elements, shadow DOM, CSS sprites.",
        body, [R_LIB, 'Yodacon Ship Pack, “A ship in plain HTML and CSS,” Tutorial Note 2, <a href="../dom/#note">examples/dom/</a>.', R_JSON])


# --- TN-5: three.js -------------------------------------------------------------------------------------

def note_three():
    f = P.format("threejs")
    body = f"""
<h3>I. Introduction</h3>
<p>The three.js example puts a pre-rotated 2-D sprite into a 3-D scene two ways: as a quad lying on a grid
(<code>?mode=plane</code>) and as a camera-facing billboard you orbit (<code>?mode=billboard</code>). Both use
one texture whose UV window is moved to the wanted frame. three.js 0.160.0 is pinned through an import map
({ref(f, '"three": "https://cdn')}).</p>

<h3>II. Assets Used</h3>
{table("I", "What the page takes from the pack", ["Asset", "Read at", "Used for"], [
  ["<code>ship.json</code>", ref(f, "const ship = await loadShipMeta"), "Frame size, grid, stats, name"],
  ["<code>sheet-alpha.png</code>", ref(f, "new THREE.TextureLoader().loadAsync"), "One texture for all 36 frames"],
  ["<code>frameIndex()</code>", ref(f, "import { loadShipMeta, frameIndex }"), "Heading to frame"],
])}

<h3>III. The Sheet as a Texture</h3>
<p>The texture is loaded once and set up for pixel art: nearest-neighbour filtering both ways and no mipmaps
(Listing 1). <code>repeat</code> shrinks the visible UV range to one cell; <code>offset</code> moves it.
three.js flips images vertically on upload, so <i>v</i> = 0 is the sheet's <em>bottom</em> row. For frame
<i>f</i> in a sheet of <i>C</i> columns and <i>R</i> rows:</p>
{eq("u₀ = (f mod C) / C,&nbsp;&nbsp; v₀ = 1 − (⌊f / C⌋ + 1) / R", 1)}
{listing(1, "Texture and frame window", f, ("const texture = await new THREE.TextureLoader()", "const material ="))}
<p><code>alphaTest: 0.5</code> discards transparent texels outright, which keeps edges crisp and avoids
transparency sorting entirely.</p>

<h3>IV. Mode 1: A Plane on the Grid</h3>
<p>A <code>PlaneGeometry</code> sized to the frame in world units is laid flat, its texture's top pointing to
−<i>Z</i>, “north” (Listing 2). Each tick picks the frame for the heading and thrusts along that frame's
direction, (sin <i>a</i>, 0, −cos <i>a</i>) in world space, so motion matches the picture
({ref(f, "const a = THREE.MathUtils.degToRad(frame * 10)")}).</p>
{listing(2, "The plane", f, ("const plane = new THREE.Mesh", "plane.position.y = 1;"), ("const frame = frameIndex(heading);",), ("setFrame(frame);",))}

<h3>V. Mode 2: A Billboard</h3>
<p>A <code>THREE.Sprite</code> always faces the camera, so it must show the ship as seen <em>from</em> the
camera. If the ship's true heading is <i>θ</i> and the camera's bearing around it is <i>φ</i>, the frame to
show is</p>
{eq("f = frameIndex(θ + φ)", 2)}
<p>which the loop computes from the camera position each frame (Listing 3). Orbit the camera with the ship
still and the sprite turns; the green arrow shows that the ship itself has not.</p>
{listing(3, "Frame for the camera", f, ("const phi = THREE.MathUtils.radToDeg", "setFrame(frameIndex(seen));"))}

<h3>VI. Using It in Your Project</h3>
<ol class="steps">
  <li>Load the sheet with <code>TextureLoader</code>; set <code>NearestFilter</code>, no mipmaps, sRGB.</li>
  <li>Set <code>repeat</code> to (1/<i>C</i>, 1/<i>R</i>) and move <code>offset</code> with (1).</li>
  <li>For many ships, clone the texture per ship (<code>texture.clone()</code> shares the image) so each has
    its own offset.</li>
  <li>For billboards, add the camera bearing as in (2).</li>
</ol>
<p>The Fleet Flyby and Hangar projects scale this up to every ship and to a turntable [2].</p>

<h3>VII. Conclusion</h3>
<p>In 3-D the pack's convention survives intact: one texture, a UV window chosen by Equation (1), and for
billboards one extra angle. The sprites keep their 1997 pixels while the scene around them is fully 3-D.</p>"""
    return paper(5, "Pre-Rotated Sprites in 3-D: How the three.js Example Uses the Pack",
        "The three.js example shows a pack ship as a textured plane and as a billboard. One texture of "
        "<code>sheet-alpha.png</code> serves all 36 frames by moving its UV window; for the billboard the "
        "frame also accounts for the camera's bearing. This note follows the page's source.",
        "three.js, WebGL, texture atlases, billboards, pixel art.",
        body, [TN1, 'Yodacon Ship Pack, “Sample projects,” <a href="../../projects/">projects/</a>.',
               "three.js authors, <i>three.js</i> r160 (0.160.0), 2023. [Online]. Available: threejs.org/docs"])


# --- TN-6: Phaser -------------------------------------------------------------------------------------

def note_phaser():
    f = P.format("phaser")
    body = f"""
<h3>I. Introduction</h3>
<p>The Phaser example is one scene, <code>Flight</code>, in which a pack ship flies under Arcade physics. It
is a useful model because Phaser has its own loader, its own frame numbering and its own angle convention,
and the page shows where each meets the pack's. Phaser 3.80.1 is pinned on jsDelivr
({ref(f, "phaser@3.80.1")}); the page is <code>examples/phaser/index.html</code> [1].</p>

<h3>II. Assets Used</h3>
{table("I", "What the scene takes from the pack", ["Asset", "Read at", "Used for"], [
  ["<code>ship.json</code>", ref(f, "const ship = await loadShipMeta"), "Frame size, stats, name"],
  ["<code>sheet-alpha.png</code>", ref(f, 'this.load.spritesheet("ship"'), "Phaser texture <code>\"ship\"</code>, frames 0–35"],
  ["<code>frameIndex()</code>", ref(f, "import { loadShipMeta, frameIndex }"), "Heading to frame"],
])}
<p>Nothing else is needed: not the opaque sheet, the mask, the single frames nor the pictures.</p>

<h3>III. Two-Stage Loading</h3>
<p>Phaser's <code>load.spritesheet</code> must be told the frame size up front, and frame sizes differ between
ships. So the page reads <code>ship.json</code> with the library's <code>loadShipMeta()</code>
<em>before</em> the game exists, using a module's top-level <code>await</code> (Listing 1). Only then is
<code>new Phaser.Game</code> created ({ref(f, "new Phaser.Game({")}).</p>
{listing(1, "Metadata before the game", f, ("const q = new URLSearchParams", "const SCALE ="))}
<p>Phaser's loader then fetches the image itself in <code>preload()</code> (Listing 2). Phaser numbers a
sheet's cells left to right, top to bottom, which is exactly the pack's order, so pack frame <i>f</i> is
Phaser frame <i>f</i>. <code>setCORS("anonymous")</code> lets WebGL use the image when the pack is served from
another origin, such as a CDN.</p>
{listing(2, "preload()", f, ("preload() {", 'this.load.spritesheet("ship"'))}

<h3>IV. Creating the Sprite</h3>
<p>The ship is an Arcade physics sprite on texture <code>"ship"</code>, frame 0 (nose up), scaled by a whole
number ({ref(f, 'this.ship = this.physics.add.sprite')}). The game config's <code>pixelArt: true</code>
({ref(f, "pixelArt: true")}) switches Phaser to nearest-neighbour sampling, without which the 1997 pixels
blur when scaled. The 1997 <code>Speed</code> becomes the body's maximum speed
({ref(f, "this.ship.body.setMaxSpeed")}).</p>

<h3>V. Each Update: Frame, Then Force</h3>
<p>Listing 3 is the whole asset logic of the scene. The heading turns continuously; the frame is</p>
{eq("f = ⌊θ / 10⌋ mod 36", 1)}
<p>and <code>setFrame(f)</code> shows it. The sprite's own <code>rotation</code> is never touched: the 36
frames already are the rotation, and rotating as well would turn the ship twice.</p>
{listing(3, "update()", f, ("update(time, delta) {", "body.setDrag("))}
<p>Phaser measures angles from +<i>x</i> (pointing right), while the pack's heading 0 points up, so thrust uses
the frame's heading minus 90°:</p>
{eq("α<sub>Phaser</sub> = 10 f − 90°", 2)}
<p>Using <i>f</i> rather than <i>θ</i> makes the ship accelerate exactly the way it appears to point.</p>

<h3>VI. Handling From the 1997 Record</h3>
<p>Speed, acceleration and turn rate come from <code>ship.meta.stats</code> ({ref(f, "const MAX = (stats.Speed")}):
<code>Speed</code> and <code>Accel</code> scaled by 0.6 and <code>Maneuver</code> by 40°/s. Swap the ship in
the query string and the handling changes with it.</p>

<h3>VII. Using It in Your Own Phaser Game</h3>
<ol class="steps">
  <li>Read <code>ship.json</code> (with <code>loadShipMeta</code> or a plain <code>fetch</code>) before
    creating the game, or in a boot scene.</li>
  <li><code>this.load.spritesheet(key, url, {{ frameWidth, frameHeight }})</code> on
    <code>sheet-alpha.png</code>.</li>
  <li>Set <code>pixelArt: true</code> and scale only by whole numbers.</li>
  <li>Each update, <code>sprite.setFrame(frameIndex(heading))</code>; move with (2).</li>
</ol>
<p>For a ship that simply spins, Phaser's animation system works on the same frames:</p>
<figure>
<figcaption><b>Listing 4.</b> A spin animation over the 36 frames</figcaption>
<pre>this.anims.create({{ key: "spin", frameRate: 12, repeat: -1,
  frames: this.anims.generateFrameNumbers("ship",
                              {{ start: 0, end: 35 }}) }});
sprite.play("spin");</pre>
</figure>

<h3>VIII. Conclusion</h3>
<p>The scene uses one image and one JSON file. The only adaptations Phaser needs are loading the metadata
first and the 90° offset in (2); frame numbering and pixel-art filtering line up with the pack directly.</p>"""
    return paper(6, "One Scene, Two Assets: How the Phaser 3 Example Uses the Pack",
        "The Phaser 3 example flies a pack ship in a single Arcade-physics scene. This note follows the "
        "scene's source: reading <code>ship.json</code> before the game starts, loading "
        "<code>sheet-alpha.png</code> as a Phaser spritesheet, selecting a frame from the heading each update, "
        "and converting between the pack's and Phaser's angle conventions.",
        "Phaser 3, sprite sheets, Arcade physics, pixel art, asset loading.",
        body, [TN1, R_LIB,
               "Phaser Studio, <i>Phaser 3 API Documentation</i>, v3.80.1, 2024. [Online]. Available: docs.phaser.io"])


# --- TN-7: PixiJS -------------------------------------------------------------------------------------

def note_pixi():
    f = P.format("pixi")
    body = f"""
<h3>I. Introduction</h3>
<p>PixiJS draws sprites from textures, and a texture can frame part of a shared image. The PixiJS example
uses that to turn the pack's sheet into 36 textures over one GPU upload, then flies a sprite by swapping its
texture. PixiJS 8.6.6 is imported from a pinned URL ({ref(f, "pixi.js@8.6.6")}).</p>

<h3>II. Assets Used</h3>
{table("I", "What the page takes from the pack", ["Asset", "Read at", "Used for"], [
  ["<code>ship.json</code>", ref(f, "const ship = await loadShipMeta"), "Frame grid, stats, name"],
  ["<code>sheet-alpha.png</code>", ref(f, "const sheet = await Assets.load"), "One texture source"],
  ["<code>frameRect()</code>, <code>frameIndex()</code>", ref(f, "import { loadShipMeta, frameIndex, frameRect }"), "Cells and frame choice"],
])}

<h3>III. Pixel Art First</h3>
<p>Before any texture exists, the default sampling is set to nearest-neighbour
({ref(f, "TextureSource.defaultOptions.scaleMode")}), and the application is created without antialiasing
({ref(f, "await app.init")}). Every texture made afterwards keeps the 1997 pixels square.</p>

<h3>IV. Thirty-Six Textures, One Source</h3>
<p><code>Assets.load</code> loads the sheet once. Each frame is then a <code>Texture</code> that shares the
sheet's <code>source</code> and frames one cell, with the rectangle from the library's
<code>frameRect()</code> (Listing 1):</p>
{eq("(x, y, w, h) = ((f mod 6) · w, ⌊f / 6⌋ · h, w, h)", 1)}
{listing(1, "Cutting the sheet", f, ("const sheet = await Assets.load", 4))}
<p>Because all 36 share one source, the GPU holds one image, and switching frames costs nothing but a
pointer.</p>

<h3>V. The Sprite</h3>
<p>The sprite starts on frame 0 with its anchor at the centre, so it turns about its middle, and a
whole-number scale ({ref(f, "const sprite = new Sprite(frames[0]);", "sprite.scale.set")}).</p>

<h3>VI. Each Tick</h3>
<p>The ticker turns the heading, picks <i>f</i> = <code>frameIndex(θ)</code> and assigns
<code>frames[f]</code> to the sprite (Listing 2). As in every example, <code>sprite.rotation</code> stays 0.
Thrust follows the frame shown, along (sin <i>a</i>, −cos <i>a</i>) with <i>a</i> = 10<i>f</i>°.</p>
{listing(2, "The ticker", f, ("app.ticker.add((ticker)", "if (keys.ArrowUp)"))}

<h3>VII. Using It in Your Project</h3>
<ol class="steps">
  <li>Set <code>scaleMode = "nearest"</code> before loading.</li>
  <li><code>Assets.load</code> the sheet; build the 36 frame textures once per ship type.</li>
  <li>Give every ship its own <code>Sprite</code> and assign <code>frames[frameIndex(heading)]</code>.</li>
</ol>
<p>Pixi's <code>AnimatedSprite</code> takes the same array if you want a ship that simply spins.</p>

<h3>VIII. Conclusion</h3>
<p>The sheet becomes an array of textures indexed by Equation (1)'s frame number; from there the pack ship is
an ordinary Pixi sprite.</p>"""
    return paper(7, "Thirty-Six Textures on One Image: How the PixiJS Example Uses the Pack",
        "The PixiJS example loads a pack ship's <code>sheet-alpha.png</code> once, cuts it into 36 textures that "
        "share one source using the library's <code>frameRect()</code>, and flies a sprite by swapping its texture "
        "each tick. This note follows the page's source.",
        "PixiJS, texture atlases, sprite sheets, pixel art.",
        body, [TN1, R_LIB, "PixiJS authors, <i>PixiJS</i> v8.6.6, 2024. [Online]. Available: pixijs.com"])


NOTES = {"dom": note_dom, "canvas": note_canvas, "web-component": note_wc,
         "threejs": note_three, "phaser": note_phaser, "pixi": note_pixi}
BACK = '<p><a href="../">← Examples</a> · <a href="../../">Ship Pack</a>'


def main():
    check = "--check" in sys.argv
    stale = []
    for name, make in NOTES.items():
        path = ROOT / P.format(name)
        text = path.read_text()
        if START in text:
            text = text[:text.index(START)] + text[text.index(END) + len(END) + 1:]
        before = len(text.split("\n"))
        # The link joins the existing navigation line, so no cited line moves.
        if BACK in text and "#note" not in text.split(BACK, 1)[1].split("\n", 1)[0]:
            text = text.replace(BACK, BACK + ' · <a href="#note">How this page works</a>', 1)
        i = text.rindex("</body>")
        new = text[:i] + make() + "\n" + text[i:]
        old_lines, new_lines = (ROOT / P.format(name)).read_text().split("\n"), new.split("\n")
        upto = new.count("\n", 0, new.index(START))
        assert len(text.split("\n")) == before and all(           # nothing above the note moved
            o.replace(' · <a href="#note">How this page works</a>', "") == n.replace(' · <a href="#note">How this page works</a>', "")
            for o, n in zip(old_lines[:upto], new_lines[:upto])), name
        if new != path.read_text():
            stale.append(name)
            if not check:
                path.write_text(new)
    print(("out of date: " if check else "wrote: ") + (", ".join(stale) or "nothing"))
    sys.exit(1 if check and stale else 0)


if __name__ == "__main__":
    main()
