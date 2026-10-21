# `<yodacon-ship>` — the custom element

[`index.html`](index.html) — an attribute playground and every ship of both
editions spinning in a grid.

## Walk-through

```html
<script type="module" src="https://cdn.jsdelivr.net/gh/yodacon/yodacon-ship-pack@v1.0.0/lib/yodacon-ship-pack.js"></script>

<yodacon-ship ship="yodacon"></yodacon-ship>                         <!-- ConEx 1.2, nose up, ×2 -->
<yodacon-ship ship="dart" edition="override" heading="90"></yodacon-ship>
<yodacon-ship ship="gryphon" scale="4" spin></yodacon-ship>
```

- Importing the library defines the element once (it checks
  `customElements.get("yodacon-ship")` first, so loading it twice is harmless).
- It reads `ship.json` for the frame size, then paints `sheet-alpha.png` as
  a scaled CSS background inside its shadow DOM and moves
  `background-position` to the frame for `heading`.
- `spin` steps through the 36 frames at about 12 fps, pauses while the element
  is off-screen (`IntersectionObserver`) and holds still for visitors who ask
  for reduced motion.
- Change any attribute (or property: `el.heading = 270`) and it re-renders.
- Children are a fallback: `<yodacon-ship ship="dart"><img src="…/frames/00.png" alt="Dart"></yodacon-ship>`
  shows the image without JavaScript and until the sprite loads.
- Accessible by default: `role="img"`, `aria-label` = the ship's name.

Full attribute table: [`lib/README.md`](../../lib/README.md#yodacon-ship).

## Docs

- [Using custom elements](https://developer.mozilla.org/docs/Web/API/Web_components/Using_custom_elements) (MDN)
- [Using shadow DOM](https://developer.mozilla.org/docs/Web/API/Web_components/Using_shadow_DOM) (MDN)
- [`prefers-reduced-motion`](https://developer.mozilla.org/docs/Web/CSS/@media/prefers-reduced-motion) (MDN)
