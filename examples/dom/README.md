# Plain DOM + CSS sprite

[`index.html`](index.html) — no canvas, no library, no framework. One `<div>`
shows one frame of `sheet-alpha.png`.

## How it works

1. **Find the ship.** The pack root is `new URL("../../", location.href)`;
   the ship's folder is `<edition>/ships/<slug>/`, from `?edition=&ship=`.
2. **Read the grid.** `ship.json` → `sprite.frame_width`, `frame_height`,
   `columns` (always 6). Nothing is hard-coded.
3. **Size the box** to one frame × a whole-number scale, and scale the whole
   sheet by the same factor with `background-size`.
4. **Pick the frame**: `frame = floor(heading / 10) mod 36`, then
   `col = frame mod 6`, `row = floor(frame / 6)`, and shift the background by
   `(-col × w × scale, -row × h × scale)`. The CSS does that arithmetic with
   `calc()` from custom properties, so JS only sets `--col` and `--row`.
5. **Keep it crisp** with `image-rendering: pixelated`.

The element has `role="img"` and the ship's name as `aria-label`, since a
background image is invisible to screen readers.

To use the CDN instead of a local copy, set
`PACK = new URL("https://cdn.jsdelivr.net/gh/yodacon/yodacon-ship-pack@v2.0.0/")`.

## Docs

- [CSS `background-position`](https://developer.mozilla.org/docs/Web/CSS/background-position) and
  [`background-size`](https://developer.mozilla.org/docs/Web/CSS/background-size) (MDN)
- [`image-rendering`](https://developer.mozilla.org/docs/Web/CSS/image-rendering) (MDN)
- [Using CSS custom properties](https://developer.mozilla.org/docs/Web/CSS/Using_CSS_custom_properties) (MDN)
- [The `<yodacon-ship>` element](../web-component/) does all of this for you.
