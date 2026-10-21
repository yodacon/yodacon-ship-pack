// Yodacon Ship Pack — the browser library.
//
// Zero dependencies, plain ES2020 module, no build step. Import it from
// wherever the pack is served and it finds the pack's files by itself:
//
//   import { loadShip, drawShip } from "https://yodacon.org/ship-pack/lib/yodacon-ship-pack.js";
//   import { loadShip, drawShip } from "https://cdn.jsdelivr.net/gh/yodacon/yodacon-ship-pack@v1.0.0/lib/yodacon-ship-pack.js";
//   import { loadShip, drawShip } from "./vendor/yodacon-ship-pack/lib/yodacon-ship-pack.js";
//
// Importing it also registers the <yodacon-ship> custom element.
//
// Sprite conventions (every ship and weapon in the pack):
//   - 36 frames, frame 00 points nose-up, each next frame is 10° clockwise;
//   - frame = floor(heading / 10) mod 36, heading in degrees clockwise from up;
//   - sheet-alpha.png lays the frames out 6 per row, left-to-right then
//     top-to-bottom, with a transparent background;
//   - the art is 1997 pixel art: scale by whole numbers, nearest-neighbour.
//
// Ships by Paul Richeson (ConEx, 1997–1998). GPL-2.0-or-later.

export const VERSION = "1.0.0";

/** Absolute URL of the pack root (the folder holding catalog.json), with a trailing slash. */
export const PACK_BASE = new URL("..", import.meta.url).href;

/** The credit line to show wherever the ships appear. */
export const CREDIT =
  "Ships from the Yodacon Ship Pack by Paul Richeson (ConEx, 1997), GPL-2.0-or-later — https://github.com/yodacon/yodacon-ship-pack";

const FRAMES = 36;

// A `base` may be relative ("../../"); resolve it against the page, and make
// sure it ends in "/" so that new URL("catalog.json", base) stays inside it.
function rootOf(base = PACK_BASE) {
  const href = new URL(base, globalThis.document?.baseURI ?? PACK_BASE).href;
  return href.endsWith("/") ? href : href + "/";
}

// fetch() + JSON, cached per absolute URL so twenty elements share one request.
const jsonCache = new Map();
function fetchJSON(url) {
  if (!jsonCache.has(url)) {
    const p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
      return r.json();
    });
    p.catch(() => jsonCache.delete(url)); // let a later call retry
    jsonCache.set(url, p);
  }
  return jsonCache.get(url);
}

// Load an image. crossOrigin = "anonymous" lets WebGL and canvas readback use
// images served from a CDN (jsDelivr sends Access-Control-Allow-Origin: *).
const imageCache = new Map();
export function loadImage(url) {
  if (!imageCache.has(url)) {
    const p = new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.decoding = "async";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`could not load ${url}`));
      img.src = url;
    });
    p.catch(() => imageCache.delete(url));
    imageCache.set(url, p);
  }
  return imageCache.get(url);
}

/**
 * Load catalog.json. Every edition, ship and weapon gains `url` (its folder,
 * absolute) and `urls` (absolute URLs of its pictures; `thumb` is null when the
 * ship has none, and `frames(i)` gives frame i's PNG).
 */
export async function loadCatalog(base = PACK_BASE) {
  const root = rootOf(base);
  const raw = await fetchJSON(new URL("catalog.json", root).href);
  const catalog = structuredClone(raw);
  catalog.base = root;
  for (const ed of catalog.editions) {
    ed.url = new URL(ed.path, root).href;
    for (const item of [...ed.ships, ...(ed.weapons ?? [])]) {
      item.edition = ed.key;
      item.url = new URL(item.path, root).href;
      item.urls = urlsFor(item.url, item.pictures ?? {});
    }
  }
  return catalog;
}

// URLs of one ship or weapon folder. `pictures` maps target/yard/comm/thumb to
// file names (null or missing = the ship has no such picture).
function urlsFor(dir, pictures) {
  const at = (name) => (name ? new URL(name, dir).href : null);
  return {
    dir,
    sheet: at("sheet-alpha.png"),
    sheetOpaque: at("sheet.png"),
    mask: at("mask.png"),
    target: at(pictures.target),
    yard: at(pictures.yard),
    comm: at(pictures.comm),
    thumb: at(pictures.thumb),
    frames: (i) => at(`frames/${String(((i % FRAMES) + FRAMES) % FRAMES).padStart(2, "0")}.png`),
  };
}

/** The 36-frame index for a heading in degrees (clockwise from nose-up). */
export function frameIndex(headingDeg) {
  const i = Math.floor(headingDeg / 10) % FRAMES;
  return i < 0 ? i + FRAMES : i;
}

/** The heading (degrees) that frame i shows: 0, 10, 20 … 350. */
export const frameHeading = (i) => frameIndex(i * 10) * 10;

// Accept a catalog entry ({frame_width, columns}), a ship.json ({sprite:{…}})
// or a loaded ship ({sprite}) — they all describe the same grid.
function spriteOf(ship) {
  const s = ship.sprite ?? ship.meta?.sprite ?? ship;
  return { w: s.frame_width, h: s.frame_height, columns: s.columns ?? 6, frames: s.frames ?? FRAMES };
}

/** Where frame i sits in sheet-alpha.png, in pixels: {x, y, w, h}. */
export function frameRect(ship, i) {
  const { w, h, columns } = spriteOf(ship);
  const f = frameIndex(i * 10);
  return { x: (f % columns) * w, y: Math.floor(f / columns) * h, w, h };
}

/**
 * Fetch one ship's ship.json (no images). Returns
 * {edition, slug, name, meta, sprite, urls} — enough for a game framework that
 * loads its own textures (three.js, Phaser, PixiJS).
 */
export async function loadShipMeta(edition = "conex", slug = "yodacon", base = PACK_BASE, kind = "ships") {
  const dir = new URL(`${edition}/${kind}/${slug}/`, rootOf(base)).href;
  const meta = await fetchJSON(new URL(kind === "ships" ? "ship.json" : "weapon.json", dir).href);
  const f = meta.files ?? {};
  const pictures = kind === "ships"
    ? { target: f.target, yard: f.yard, comm: f.comm, thumb: f.thumb }
    : {};
  return { edition, slug, name: meta.name, meta, sprite: meta.sprite, urls: urlsFor(dir, pictures) };
}

/**
 * Load one ship: its ship.json plus the decoded sprite sheet (sheet-alpha.png).
 * Returns {edition, slug, name, meta, sprite, sheet: HTMLImageElement, urls}.
 */
export async function loadShip(edition = "conex", slug = "yodacon", base = PACK_BASE) {
  const ship = await loadShipMeta(edition, slug, base, "ships");
  ship.sheet = await loadImage(ship.urls.sheet);
  return ship;
}

/** Load a weapon sprite (the pack has one: "missile-repeater"), same shape as loadShip. */
export async function loadWeapon(edition = "conex", slug = "missile-repeater", base = PACK_BASE) {
  const weapon = await loadShipMeta(edition, slug, base, "weapons");
  weapon.sheet = await loadImage(weapon.urls.sheet);
  return weapon;
}

/**
 * Draw a loaded ship (or weapon) on a Canvas 2D context, centred on (x, y),
 * facing headingDeg, scaled by a whole number with nearest-neighbour sampling.
 */
export function drawShip(ctx, ship, headingDeg, x, y, scale = 1) {
  const r = frameRect(ship, frameIndex(headingDeg));
  const w = r.w * scale, h = r.h * scale;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(ship.sheet, r.x, r.y, r.w, r.h, Math.round(x - w / 2), Math.round(y - h / 2), w, h);
}

// ---------------------------------------------------------------------------
// <yodacon-ship ship="yodacon" edition="conex" heading="90" scale="2" spin>
//
// Draws one frame as a CSS sprite: the sheet is the element's background,
// scaled by `scale` and shifted with background-position. Light-DOM children
// (say a fallback <img>) show until the sprite is ready, and stay visible
// for visitors without JavaScript.

const reducedMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)");

if (globalThis.customElements && globalThis.HTMLElement && !customElements.get("yodacon-ship")) {
  class YodaconShip extends HTMLElement {
    static observedAttributes = ["ship", "edition", "heading", "spin", "scale", "base"];

    #ship = null;      // result of loadShipMeta
    #sprite;           // the <div> painted with the sheet
    #frame = 0;        // frame on screen
    #timer = 0;
    #visible = true;
    #observer = null;
    #loadId = 0;

    constructor() {
      super();
      const root = this.attachShadow({ mode: "open" });
      root.innerHTML = `<style>
        :host { display: inline-block; vertical-align: middle; line-height: 0; }
        :host([hidden]) { display: none; }
        .sprite { image-rendering: pixelated; image-rendering: crisp-edges; background-repeat: no-repeat; }
        .sprite[hidden] { display: none; }
      </style><slot></slot><div class="sprite" part="sprite" hidden></div>`;
      this.#sprite = root.querySelector(".sprite");
    }

    connectedCallback() {
      if (!this.hasAttribute("role")) this.setAttribute("role", "img");
      if ("IntersectionObserver" in globalThis) {
        // Spinning twenty ships off-screen wastes battery: pause when hidden.
        this.#observer = new IntersectionObserver(([e]) => { this.#visible = e.isIntersecting; this.#tick(); });
        this.#observer.observe(this);
      }
      reducedMotion?.addEventListener?.("change", this.#onMotion);
      this.#load();
    }

    disconnectedCallback() {
      this.#observer?.disconnect();
      reducedMotion?.removeEventListener?.("change", this.#onMotion);
      this.#stop();
    }

    attributeChangedCallback(name, oldValue, value) {
      if (oldValue === value || !this.isConnected) return;
      if (name === "ship" || name === "edition" || name === "base") this.#load();
      else this.#render();
    }

    // Properties mirror the attributes.
    get ship() { return this.getAttribute("ship") ?? "yodacon"; }
    set ship(v) { this.setAttribute("ship", v); }
    get edition() { return this.getAttribute("edition") ?? "conex"; }
    set edition(v) { this.setAttribute("edition", v); }
    get heading() { return Number(this.getAttribute("heading")) || 0; }
    set heading(v) { this.setAttribute("heading", String(v)); }
    get spin() { return this.hasAttribute("spin"); }
    set spin(v) { this.toggleAttribute("spin", Boolean(v)); }
    get scale() { return Math.max(1, Math.round(Number(this.getAttribute("scale")) || 2)); }
    set scale(v) { this.setAttribute("scale", String(v)); }
    /** The loaded {name, meta, sprite, urls}, or null before it loads. */
    get data() { return this.#ship; }

    #onMotion = () => this.#render();

    async #load() {
      const id = ++this.#loadId;
      const base = this.getAttribute("base") ?? PACK_BASE;
      try {
        const ship = await loadShipMeta(this.edition, this.ship, base);
        if (id !== this.#loadId) return; // a newer attribute change won
        this.#ship = ship;
        this.#frame = frameIndex(this.heading);
        this.#sprite.style.backgroundImage = `url("${ship.urls.sheet}")`;
        this.setAttribute("aria-label", ship.name);
        this.#sprite.hidden = false;
        this.shadowRoot.querySelector("slot").hidden = true;
        this.#render();
        this.dispatchEvent(new CustomEvent("load", { detail: ship }));
      } catch (err) {
        if (id !== this.#loadId) return;
        this.setAttribute("aria-label", this.ship);
        this.dispatchEvent(new CustomEvent("error", { detail: err }));
      }
    }

    #render() {
      if (!this.#ship) return;
      const { w, h, columns, frames } = spriteOf(this.#ship);
      const s = this.scale;
      if (!this.#spinning()) this.#frame = frameIndex(this.heading);
      const r = frameRect(this.#ship, this.#frame);
      const st = this.#sprite.style;
      st.width = `${w * s}px`;
      st.height = `${h * s}px`;
      st.backgroundSize = `${columns * w * s}px ${Math.ceil(frames / columns) * h * s}px`;
      st.backgroundPosition = `${-r.x * s}px ${-r.y * s}px`;
      this.#tick();
    }

    #spinning() {
      return this.spin && !reducedMotion?.matches;
    }

    // Start or stop the ~12 fps spin timer to match the current state.
    #tick() {
      const run = this.#ship && this.#spinning() && this.#visible;
      if (run && !this.#timer) {
        this.#timer = setInterval(() => {
          this.#frame = (this.#frame + 1) % FRAMES;
          const r = frameRect(this.#ship, this.#frame);
          this.#sprite.style.backgroundPosition = `${-r.x * this.scale}px ${-r.y * this.scale}px`;
        }, 1000 / 12);
      } else if (!run) this.#stop();
    }

    #stop() {
      clearInterval(this.#timer);
      this.#timer = 0;
    }
  }
  customElements.define("yodacon-ship", YodaconShip);
}
