// Yodacon Ship Pack — the demo game.
//
// A small overhead space game in plain Canvas 2D, no framework: fly any ship
// of the pack (demo/?edition=conex&ship=yodacon), shoot missile-repeater
// rounds at drifting ships, wrap around a square arena shown on a minimap.
//
// Structure: load → state → update(dt) at a fixed 60 Hz → render() once per
// animation frame. Units are sprite pixels ("world px") and seconds.

import {
  loadCatalog, loadShip, loadWeapon, drawShip, frameIndex, frameRect,
} from "../lib/yodacon-ship-pack.js";

// --- Handling from ship.json ------------------------------------------------
// The plugins' own numbers (EV's shïp resource) drive the flight model:
//   top speed  = Speed    × 0.6  world px/s   (Defender 450 → 270, Tomaquad 150 → 90)
//   thrust     = Accel    × 0.6  world px/s²  (time to top speed ≈ Speed / Accel s)
//   turn rate  = Maneuver × 40   degrees/s    (2 → 80°/s, 6 → 240°/s)
// EV ran its own units at 30 fps; these factors keep the same ranking and a
// playable feel at any sprite size. Each value has a floor so nothing is stuck.
// The konex edition's ships carry konex's specs.xml instead:
//   top speed  = MaxVelocity  × 0.3  (1000 → 300, as fast as EV's quickest)
//   thrust     = Acceleration × 0.4  (900 → 360)
//   turn rate  = TurnSpeed, already degrees/s, capped at 240
const SPEED_K = 0.6, ACCEL_K = 0.6, TURN_K = 40;
const handlingOf = (stats = {}) => stats.MaxVelocity ? {
  maxSpeed: Math.max(60, stats.MaxVelocity * 0.3),
  accel: Math.max(60, (stats.Acceleration || 0) * 0.4),
  turn: Math.max(60, Math.min(240, stats.TurnSpeed || 0)),
} : {
  maxSpeed: Math.max(60, (stats.Speed || 0) * SPEED_K),
  accel: Math.max(60, (stats.Accel || 0) * ACCEL_K),
  turn: Math.max(60, (stats.Maneuver || 0) * TURN_K),
};

const STEP = 1 / 60;                 // fixed simulation step, seconds
const WORLD = 2400;                  // square arena, wraps at the edges
const TARGETS = 7;                   // drifting ships to shoot
const MISSILE = { speed: 520, life: 1.4, cooldown: 0.2, turn: 140 };

// Landing views (Bryce 2 renders) from both plugins, used in the side panel.
const LANDINGS = [
  ...[13514, 13515, 13516].map((id) => ["conex", id]),
  ...[6817, 8110, 8882, 10974, 11746, 12880, 13032, 15129, 16174, 17182, 19066,
    23688, 24144, 24575, 24685, 30606].map((id) => ["override", id]),
];

const $ = (id) => document.getElementById(id);
const canvas = $("game");
const ctx = canvas.getContext("2d");
const rand = (a, b) => a + Math.random() * (b - a);
const wrap = (v) => ((v % WORLD) + WORLD) % WORLD;
const wrapDelta = (d) => d - WORLD * Math.round(d / WORLD); // shortest signed distance
const rad = (deg) => (deg * Math.PI) / 180;
// Heading is clockwise from "up"; screen y grows downwards.
const dirX = (deg) => Math.sin(rad(deg));
const dirY = (deg) => -Math.cos(rad(deg));

let catalog = null;
let game = null;    // everything for the current ship; replaced on ship change
let loadId = 0;
let paused = false;

// --- Input ------------------------------------------------------------------
const keys = { left: false, right: false, up: false, down: false, fire: false };
const KEYMAP = {
  ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
  ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down", Space: "fire",
};
const typing = (el) => el && /^(INPUT|SELECT|TEXTAREA|BUTTON|A)$/.test(el.tagName);

addEventListener("keydown", (e) => {
  if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.code === "KeyP" || e.code === "Escape") { setPaused(!paused); return; }
  const k = KEYMAP[e.code];
  if (!k) return;
  e.preventDefault();               // no page scrolling while flying
  keys[k] = true;
  if (paused) setPaused(false);
});
addEventListener("keyup", (e) => { const k = KEYMAP[e.code]; if (k) keys[k] = false; });

// On-screen buttons for touch screens: hold to act, like a key.
for (const btn of document.querySelectorAll("#touch [data-key]")) {
  const k = btn.dataset.key;
  const set = (on) => (e) => {
    e.preventDefault();
    keys[k] = on;
    btn.classList.toggle("held", on);
    if (on) { btn.setPointerCapture?.(e.pointerId); if (paused) setPaused(false); }
  };
  btn.addEventListener("pointerdown", set(true));
  for (const ev of ["pointerup", "pointercancel", "lostpointercapture"]) btn.addEventListener(ev, set(false));
  btn.addEventListener("contextmenu", (e) => e.preventDefault());
}

// Pause whenever the page loses focus or is hidden.
function setPaused(on, text = "Paused") {
  paused = on;
  $("overlay").hidden = !on;
  $("overlay-text").textContent = text;
  if (!on) {
    for (const k in keys) keys[k] = false;
    canvas.focus({ preventScroll: true });
  }
}
// (Only once the player has touched the controls, so an unattended page that
// merely opens in a background tab still shows the scene.)
let engaged = false;
for (const ev of ["keydown", "pointerdown"]) addEventListener(ev, () => { engaged = true; }, true);
addEventListener("blur", () => { if (engaged) setPaused(true); });
document.addEventListener("visibilitychange", () => { if (document.hidden) setPaused(true); });
$("resume").addEventListener("click", () => setPaused(false));
canvas.addEventListener("pointerdown", () => canvas.focus({ preventScroll: true }));

// --- Loading ----------------------------------------------------------------
async function start(edition, slug) {
  const id = ++loadId;
  const ed = catalog.editions.find((e) => e.key === edition);
  const entry = ed?.ships.find((s) => s.slug === slug);
  if (!entry) return start("conex", "yodacon");

  // The player, the edition's missile sprite, and a few other ships as targets
  // (Defenders first: they were the plugin's fighters).
  // An edition with too few ships (konex has two) borrows ConEx 1.2's fleet as
  // targets. The missile is the pack's own, the same for every edition.
  const pool = (e) => e.ships.filter((s) => !(e === ed && s.slug === slug) && s.slug !== "quarter-defender");
  const conex = catalog.editions.find((e) => e.key === "conex");
  const targetEd = pool(ed).length >= 3 ? ed : conex;
  const others = pool(targetEd);
  others.sort((a, b) => (b.slug === "defender") - (a.slug === "defender"));
  const targetSlugs = others.slice(0, 4).map((s) => s.slug);
  const [player, missile, ...targetShips] = await Promise.all([
    loadShip(edition, slug, catalog.base),
    loadWeapon("missile-repeater", catalog.base),
    ...targetSlugs.map((t) => loadShip(targetEd.key, t, catalog.base)),
  ]);
  if (id !== loadId) return; // the user picked another ship meanwhile

  game = {
    player, missile, targetShips,
    handling: handlingOf(player.meta.stats),
    ship: { x: WORLD / 2, y: WORLD / 2, vx: 0, vy: 0, heading: 0, cooldown: 0, stopped: 0 },
    targets: [], missiles: [], blasts: [], sparks: [], score: 0,
  };
  // Two start in view so there is something to shoot at straight away.
  for (let i = 0; i < TARGETS; i++) game.targets.push(spawnTarget(targetShips[i % targetShips.length], i < 2));
  showPanel(ed, entry, player);
}

function spawnTarget(ship, near = false) {
  const s = game.ship;
  let x, y;
  if (near) {
    const a = rand(0, Math.PI * 2), d = rand(110, 150);
    x = wrap(s.x + Math.cos(a) * d); y = wrap(s.y + Math.sin(a) * d);
  } else {
    do { x = rand(0, WORLD); y = rand(0, WORLD); } // not on top of the player
    while (Math.hypot(wrapDelta(x - s.x), wrapDelta(y - s.y)) < 500);
  }
  const st = ship.meta.stats ?? {};
  return {
    ship, x, y, heading: rand(0, 360), spin: rand(-15, 15), speed: near ? rand(10, 20) : rand(30, 80),
    hp: Math.min(6, Math.max(2, Math.ceil(((st.Shield || 0) + (st.Armor || 0)) / 400))),
    hit: 0, radius: Math.min(ship.sprite.frame_width, ship.sprite.frame_height) * 0.36,
  };
}

// --- Simulation (fixed step) ------------------------------------------------
function update(dt) {
  const g = game, s = g.ship, h = g.handling;

  // Turning is continuous; the sprite (and the thrust vector) snap to the
  // 36 frames, which gives the 10°-step feel of Escape Velocity.
  s.heading = (s.heading + ((keys.right ? 1 : 0) - (keys.left ? 1 : 0)) * h.turn * dt + 360) % 360;
  const facing = frameIndex(s.heading) * 10;
  const speed = Math.hypot(s.vx, s.vy);

  if (keys.up) {
    s.vx += dirX(facing) * h.accel * dt;
    s.vy += dirY(facing) * h.accel * dt;
  }
  if (keys.down) {
    if (speed > 4 && s.stopped === 0) {               // brake along the velocity
      const k = Math.max(0, speed - h.accel * dt) / speed;
      s.vx *= k; s.vy *= k;
      if (speed * k <= 4) s.stopped = 0.0001;
    } else if ((s.stopped += dt) > 0.35) {            // held at a stop: reverse
      s.vx -= dirX(facing) * h.accel * 0.5 * dt;
      s.vy -= dirY(facing) * h.accel * 0.5 * dt;
    }
  } else s.stopped = 0;

  const v = Math.hypot(s.vx, s.vy);
  const cap = s.stopped > 0.35 ? h.maxSpeed / 3 : h.maxSpeed;
  if (v > cap) { s.vx *= cap / v; s.vy *= cap / v; }
  s.x = wrap(s.x + s.vx * dt);
  s.y = wrap(s.y + s.vy * dt);

  // Fire from the nose; the round inherits the ship's velocity.
  s.cooldown -= dt;
  if (keys.fire && s.cooldown <= 0) {
    s.cooldown = MISSILE.cooldown;
    const nose = g.player.sprite.frame_height / 2;
    g.missiles.push({
      x: wrap(s.x + dirX(facing) * nose), y: wrap(s.y + dirY(facing) * nose),
      vx: s.vx, vy: s.vy, heading: facing, life: MISSILE.life,
    });
  }

  // Missiles steer gently towards the nearest target ahead of them.
  for (const m of g.missiles) {
    let best = null, bestD = 450;
    for (const t of g.targets) {
      const dx = wrapDelta(t.x - m.x), dy = wrapDelta(t.y - m.y), d = Math.hypot(dx, dy);
      const off = ((Math.atan2(dx, -dy) * 180) / Math.PI - m.heading + 540) % 360 - 180;
      if (d < bestD && Math.abs(off) < 50) { best = off; bestD = d; }
    }
    if (best !== null) m.heading = (m.heading + Math.sign(best) * Math.min(Math.abs(best), MISSILE.turn * dt) + 360) % 360;
    m.x = wrap(m.x + (m.vx * 0.5 + dirX(m.heading) * MISSILE.speed) * dt);
    m.y = wrap(m.y + (m.vy * 0.5 + dirY(m.heading) * MISSILE.speed) * dt);
    m.life -= dt;
    for (const t of g.targets) {
      if (m.life > 0 && Math.hypot(wrapDelta(t.x - m.x), wrapDelta(t.y - m.y)) < t.radius) {
        m.life = 0; t.hit = 0.12;
        if (--t.hp <= 0) explode(t);
      }
    }
  }
  g.missiles = g.missiles.filter((m) => m.life > 0);

  for (const t of g.targets) {
    t.spin += rand(-20, 20) * dt;
    t.spin = Math.max(-25, Math.min(25, t.spin));
    t.heading = (t.heading + t.spin * dt + 360) % 360;
    const f = frameIndex(t.heading) * 10;
    t.x = wrap(t.x + dirX(f) * t.speed * dt);
    t.y = wrap(t.y + dirY(f) * t.speed * dt);
    t.hit = Math.max(0, t.hit - dt);
  }
  for (const b of g.blasts) b.t += dt;
  g.blasts = g.blasts.filter((b) => b.t < 0.6);
  for (const p of g.sparks) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
  g.sparks = g.sparks.filter((p) => p.life > 0);
}

function explode(t) {
  const g = game;
  g.score++;
  g.blasts.push({ x: t.x, y: t.y, r: t.radius * 2.2, t: 0 });
  for (let i = 0; i < 24; i++) {
    const a = rand(0, Math.PI * 2), v = rand(40, 220);
    g.sparks.push({ x: t.x, y: t.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(0.3, 0.8) });
  }
  Object.assign(t, spawnTarget(t.ship)); // a new one warps in elsewhere
}

// --- Rendering --------------------------------------------------------------
// Three parallax star layers, each a 512-px tile scrolled at its own depth.
const STAR_LAYERS = [
  { depth: 0.15, count: 70, size: 1, color: "#5b6386" },
  { depth: 0.4, count: 40, size: 1, color: "#a3abc9" },
  { depth: 0.8, count: 18, size: 2, color: "#ffffff" },
].map((l) => ({ ...l, stars: Array.from({ length: l.count }, () => [rand(0, 512), rand(0, 512)]) }));

let dpr = 1, px = 1; // device pixel ratio; device pixels per world pixel (whole number)

function resize() {
  dpr = Math.min(devicePixelRatio || 1, 3);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  // Make the player ship about a quarter of the short side, in whole steps.
  const fw = game ? game.player.sprite.frame_width : 70;
  const css = Math.max(1, Math.min(3, Math.floor(Math.min(w, h) / (4 * fw))));
  px = Math.max(1, Math.round(css * dpr));
}
new ResizeObserver(resize).observe($("screen"));

function render() {
  const W = canvas.width, H = canvas.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#05060b";
  ctx.fillRect(0, 0, W, H);
  if (!game) return;
  const g = game, s = g.ship;

  for (const l of STAR_LAYERS) {
    ctx.fillStyle = l.color;
    const tile = 512 * dpr, sz = Math.max(1, Math.round(l.size * dpr));
    const ox = (((-s.x * l.depth * dpr) % tile) + tile) % tile, oy = (((-s.y * l.depth * dpr) % tile) + tile) % tile;
    for (let tx = ox - tile; tx < W; tx += tile) {
      for (let ty = oy - tile; ty < H; ty += tile) {
        for (const [x, y] of l.stars) ctx.fillRect(Math.round(tx + x * dpr), Math.round(ty + y * dpr), sz, sz);
      }
    }
  }

  // World → device pixels, centred on the player.
  const sx = (x) => W / 2 + wrapDelta(x - s.x) * px;
  const sy = (y) => H / 2 + wrapDelta(y - s.y) * px;
  const onScreen = (x, y, m) => x > -m && x < W + m && y > -m && y < H + m;

  for (const t of g.targets) {
    const x = sx(t.x), y = sy(t.y);
    if (!onScreen(x, y, 120 * px)) continue;
    drawShip(ctx, t.ship, t.heading, x, y, px);
    if (t.hit > 0) { // brief white flash on a hit
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = t.hit / 0.12 * 0.6;
      drawShip(ctx, t.ship, t.heading, x, y, px);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }
  }
  for (const m of g.missiles) drawShip(ctx, g.missile, m.heading, sx(m.x), sy(m.y), px);
  drawShip(ctx, g.player, s.heading, W / 2, H / 2, px);

  for (const b of g.blasts) {
    const k = b.t / 0.6, x = sx(b.x), y = sy(b.y), r = b.r * px * (0.3 + k);
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(255,255,230,${1 - k})`);
    grad.addColorStop(0.4, `rgba(255,170,60,${0.8 * (1 - k)})`);
    grad.addColorStop(1, "rgba(255,60,20,0)");
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = "#ffd27a";
  for (const p of g.sparks) ctx.fillRect(Math.round(sx(p.x)), Math.round(sy(p.y)), px, px);

  drawMinimap(W, H);
  drawHud();
}

function drawMinimap(W) {
  const g = game, s = g.ship, size = Math.round(110 * dpr), pad = Math.round(10 * dpr);
  const x0 = W - size - pad, y0 = pad, k = size / WORLD;
  ctx.fillStyle = "rgba(10,14,28,0.75)";
  ctx.fillRect(x0, y0, size, size);
  ctx.strokeStyle = "#2f3a62";
  ctx.lineWidth = dpr;
  ctx.strokeRect(x0 + 0.5, y0 + 0.5, size - 1, size - 1);
  const dot = (x, y, c, r) => { ctx.fillStyle = c; ctx.fillRect(x0 + x * k - r, y0 + y * k - r, r * 2, r * 2); };
  for (const t of g.targets) dot(t.x, t.y, "#ff6b5b", 1.5 * dpr);
  for (const m of g.missiles) dot(m.x, m.y, "#ffe9a8", 0.75 * dpr);
  dot(s.x, s.y, "#7ef0a8", 2 * dpr);
  // The part of the arena on screen.
  const vw = (canvas.width / px) * k, vh = (canvas.height / px) * k;
  ctx.strokeStyle = "rgba(126,240,168,0.45)";
  ctx.strokeRect(x0 + s.x * k - vw / 2, y0 + s.y * k - vh / 2, vw, vh);
}

function drawHud() {
  const g = game, s = g.ship;
  // Speed in the ship's own units: EV's Speed, or konex's MaxVelocity.
  const st = g.player.meta.stats ?? {};
  const speed = Math.hypot(s.vx, s.vy) / (st.MaxVelocity ? 0.3 : SPEED_K);
  ctx.font = `${Math.round(12 * dpr)}px ui-monospace, Menlo, Consolas, monospace`;
  ctx.fillStyle = "#7ef0a8";
  ctx.textBaseline = "top";
  const lines = [
    g.player.name.toUpperCase(),
    `SPEED ${speed.toFixed(0).padStart(3)} / ${st.MaxVelocity ?? st.Speed ?? "?"}`,
    `HEADING ${String(Math.floor(s.heading)).padStart(3, "0")}°  FRAME ${String(frameIndex(s.heading)).padStart(2, "0")}`,
    `KILLS ${g.score}`,
  ];
  lines.forEach((t, i) => ctx.fillText(t, 10 * dpr, (10 + i * 16) * dpr));
}

// --- Fixed-timestep loop ----------------------------------------------------
let last = performance.now(), acc = 0;
function loop(now) {
  acc += Math.min(0.25, (now - last) / 1000); // never try to catch up more than ¼ s
  last = now;
  if (paused || !game) acc = 0;
  while (acc >= STEP) { update(STEP); acc -= STEP; }
  render();
  requestAnimationFrame(loop);
}

// --- The side panel ---------------------------------------------------------
const STATS = [
  ["Speed", "Speed"], ["Accel", "Acceleration"], ["Maneuver", "Maneuver"],
  ["Shield", "Shield"], ["Armor", "Armor"], ["Holds", "Cargo (tons)"],
  ["Cost", "Cost (credits)"], ["Crew", "Crew"], ["Mass", "Mass (tons)"], ["Length", "Length (m)"],
  // konex's specs.xml, for the konex edition
  ["MaxVelocity", "Max velocity (konex)"], ["Acceleration", "Acceleration (konex)"],
  ["TurnSpeed", "Turn speed (konex)"],
];

function showPanel(ed, entry, ship) {
  const name = ship.name;
  document.title = `${name} · Ship Pack Demo`;
  $("ship-name").textContent = name;
  $("ship-edition").textContent = `${ed.title} · ${ed.year} · ${ed.game}`;
  const pic = (id, url, alt) => {
    const img = $(id);
    img.closest("figure, .box").hidden = !url;
    if (url) { img.src = url; img.alt = alt; }
  };
  pic("pic-target", ship.urls.target, `${name} on the targeting display`);
  pic("pic-yard", ship.urls.yard, `${name} in the shipyard`);
  pic("pic-comm", ship.urls.comm, `${name} on the comm channel`);

  const dl = $("stats");
  dl.replaceChildren();
  const stats = ship.meta.stats ?? {};
  for (const [key, label] of STATS) {
    const v = stats[key];
    if (typeof v !== "number" || (v === 0 && key !== "Holds")) continue; // 0 = unset in the plugin
    dl.append(Object.assign(document.createElement("dt"), { textContent: label }),
      Object.assign(document.createElement("dd"), { textContent: v.toLocaleString("en-US") }));
  }
  const h = game.handling;
  $("handling").textContent = `In this demo: top speed ${Math.round(h.maxSpeed)} px/s, thrust ${Math.round(h.accel)} px/s², turn ${Math.round(h.turn)}°/s (${stats.MaxVelocity ? "MaxVelocity × 0.3, Acceleration × 0.4, TurnSpeed" : `Speed × ${SPEED_K}, Accel × ${ACCEL_K}, Maneuver × ${TURN_K}`}).`;
  const desc = ship.meta.description?.replace(/\s+/g, " ").trim() ?? "";
  $("ship-desc").textContent = desc;
  $("ship-desc").hidden = !desc;  // konex's ships have no 1990s description
  $("link-folder").href = `https://github.com/yodacon/yodacon-ship-pack/tree/main/${entry.path}`;
  resize();
}

let landing = Math.floor(Math.random() * LANDINGS.length);
function showLanding(step = 0) {
  landing = (landing + step) % LANDINGS.length;
  const [ed, id] = LANDINGS[landing];
  $("pic-landing").src = new URL(`${ed}/pictures/${id}.png`, catalog.base).href;
  $("landing-id").textContent = `#${id} (${ed === "conex" ? "ConEx 1.2" : "Override"})`;
}
$("next-landing").addEventListener("click", () => showLanding(1));

// --- Boot -------------------------------------------------------------------
async function boot() {
  catalog = await loadCatalog();
  const picker = $("ship-picker");
  picker.replaceChildren();
  for (const ed of catalog.editions) {
    const group = Object.assign(document.createElement("optgroup"), { label: `${ed.title} · ${ed.year}` });
    for (const s of ed.ships) group.append(new Option(s.name, `${ed.key}/${s.slug}`));
    picker.append(group);
  }
  const q = new URLSearchParams(location.search);
  let edition = q.get("edition") || "conex", slug = q.get("ship") || "yodacon";
  if (!catalog.editions.some((e) => e.key === edition && e.ships.some((s) => s.slug === slug))) {
    edition = "conex"; slug = "yodacon";
  }
  picker.value = `${edition}/${slug}`;
  picker.addEventListener("change", () => {
    const [e, s] = picker.value.split("/");
    const url = new URL(location.href);
    url.searchParams.set("edition", e);
    url.searchParams.set("ship", s);
    history.replaceState(null, "", url);
    start(e, s);
  });
  showLanding();
  await start(edition, slug);
  canvas.focus({ preventScroll: true });
  requestAnimationFrame(loop);
}

boot().catch((err) => {
  console.error(err);
  setPaused(true, "Could not load the pack");
  $("resume").hidden = true;
});
