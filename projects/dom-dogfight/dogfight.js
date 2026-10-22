// DOM Dogfight — a whole arcade game in plain DOM.
//
// Every object on screen is a <div> inside #arena:
//   - ships and missiles show one frame of their sheet-alpha.png through
//     background-position (frame = floor(heading / 10) mod 36);
//   - they move with transform: translate(), which the browser composites
//     without re-laying-out the page;
//   - explosions are a CSS animation that removes itself.
// The game itself runs on a fixed timestep (60 updates a second, whatever the
// display's refresh rate) and collides objects as circles.
// Cloak (C or Shift): three seconds the Defenders lose you and fly at where
// you were, and their missiles pass through you; firing breaks it, and it
// takes ten seconds to come back. Every fifth wave a Tomaquad gunship leads
// the Defenders, firing three missiles at a time.
//
// Ships by Paul Richeson (ConEx, 1997–1998). GPL-2.0-or-later.

// The pack root: two folders up from this file. In your own project use your
// copy of the pack, or https://cdn.jsdelivr.net/gh/yodacon/yodacon-ship-pack@v2.0.0/
const PACK = new URL("../../", import.meta.url);

const q = new URLSearchParams(location.search);
const PLAYER_SHIP = (q.get("ship") || "conex/yodacon").split("/");   // ?ship=override/callisto
const STEP = 1 / 60;                       // seconds per simulation step
const CLOAK = 3, CLOAK_EVERY = 10;
const TAU = Math.PI * 2;
const rad = (deg) => (deg * Math.PI) / 180;
const wrapDeg = (d) => ((d % 360) + 360) % 360;

const arena = document.getElementById("arena");
const $ = (id) => document.getElementById(id);

// --- Sprites ---------------------------------------------------------------------
// Load an entry's JSON (ship.json or weapon.json) and its sheet, and return what
// a sprite needs: sheet URL, frame size and columns. Weapons belong to the pack
// as a whole (edition null): weapons/<slug>/.
async function loadSheet(edition, kind, slug) {
  const dir = new URL(edition ? `${edition}/${kind}/${slug}/` : `${kind}/${slug}/`, PACK);
  const r = await fetch(new URL(kind === "ships" ? "ship.json" : "weapon.json", dir));
  if (!r.ok) throw new Error(`${dir}: HTTP ${r.status}`);
  const meta = await r.json();
  const url = new URL("sheet-alpha.png", dir).href;
  const img = new Image();
  img.src = url;
  await img.decode();                      // start the game with every sheet in memory
  const { frame_width: w, frame_height: h, columns: cols } = meta.sprite;
  return { name: meta.name, stats: meta.stats ?? {}, url, w, h, cols, rows: Math.ceil(36 / cols) };
}

/** A sprite <div> showing `sheet` at a whole-number `scale`. */
function makeSprite(sheet, scale = 1, className = "") {
  const el = document.createElement("div");
  el.className = `sprite ${className}`;
  el.style.width = `${sheet.w * scale}px`;
  el.style.height = `${sheet.h * scale}px`;
  el.style.backgroundImage = `url("${sheet.url}")`;
  el.style.backgroundSize = `${sheet.cols * sheet.w * scale}px ${sheet.rows * sheet.h * scale}px`;
  arena.append(el);
  return el;
}

// Draw an entity: pick its frame and move its div. Only touch the style when
// the frame actually changes — background-position is the expensive part.
function draw(e) {
  const frame = Math.floor(wrapDeg(e.heading) / 10) % 36;
  if (frame !== e.frame) {
    e.frame = frame;
    const { w, h, cols } = e.sheet;
    e.el.style.backgroundPosition = `${-(frame % cols) * w * e.scale}px ${-Math.floor(frame / cols) * h * e.scale}px`;
  }
  const x = Math.round(e.x - (e.sheet.w * e.scale) / 2), y = Math.round(e.y - (e.sheet.h * e.scale) / 2);
  e.el.style.transform = `translate(${x}px, ${y}px)`;
}

function boom(x, y, size = 1) {
  const el = document.createElement("div");
  el.className = "boom";
  el.style.setProperty("--at", `translate(${x}px, ${y}px)`);
  if (size !== 1) { el.style.width = el.style.height = `${60 * size}px`; el.style.margin = `${-30 * size}px 0 0 ${-30 * size}px`; }
  el.addEventListener("animationend", () => el.remove());
  arena.append(el);
}

// --- Input: keyboard and the on-screen pad share one `keys` object --------------
const keys = { left: false, right: false, up: false, down: false, fire: false, cloak: false };

// Attract mode: until the visitor touches a control, the computer flies the
// player's ship (it turns toward the nearest Defender and fires).
let autopilot = true;
function takeControl() {
  if (!autopilot) return;
  autopilot = false;
  for (const k in keys) keys[k] = false;
  $("attract").hidden = true;
  if (sheets) restart();                     // a fresh game for the human pilot
}
const KEYMAP = {
  ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right",
  ArrowUp: "up", w: "up", W: "up", ArrowDown: "down", s: "down", S: "down", " ": "fire",
  c: "cloak", C: "cloak", Shift: "cloak",
};
addEventListener("keydown", (e) => {
  if (e.key === " " && e.target.closest?.("a, button")) return; // let Space press focused buttons
  const k = KEYMAP[e.key];
  if (k) { takeControl(); keys[k] = true; e.preventDefault(); }
  if (e.key === "p" || e.key === "P") togglePause();
  if (e.key === "r" || e.key === "R") restart();
});
addEventListener("keyup", (e) => { const k = KEYMAP[e.key]; if (k) keys[k] = false; });
addEventListener("blur", () => { for (const k in keys) keys[k] = false; });

for (const b of document.querySelectorAll(".pad button")) {
  const k = b.dataset.key;
  const on = (e) => { e.preventDefault(); takeControl(); keys[k] = true; b.classList.add("on"); b.setPointerCapture?.(e.pointerId); };
  const off = () => { keys[k] = false; b.classList.remove("on"); };
  b.addEventListener("pointerdown", on);
  b.addEventListener("pointerup", off);
  b.addEventListener("pointercancel", off);
  b.addEventListener("lostpointercapture", off);
  b.addEventListener("contextmenu", (e) => e.preventDefault());
}

// --- Game state -------------------------------------------------------------------
let sheets, world = { w: 800, h: 500 }, player, enemies, missiles, score, wave, paused = false, over = false;
let best = 0;
try { best = Number(localStorage.getItem("yodacon-ship-pack:dogfight-best")) || 0; } catch { /* no storage */ }

function measure() { world = { w: arena.clientWidth, h: arena.clientHeight }; }
new ResizeObserver(measure).observe(arena);

function wrap(e) {
  const m = e.r;                            // let things leave the screen fully before wrapping
  if (e.x < -m) e.x += world.w + 2 * m; else if (e.x > world.w + m) e.x -= world.w + 2 * m;
  if (e.y < -m) e.y += world.h + 2 * m; else if (e.y > world.h + m) e.y -= world.h + 2 * m;
}

function spawnEnemy() {
  // Enter from a random edge, pointed roughly at the player.
  const side = Math.floor(Math.random() * 4);
  const x = side === 0 ? -30 : side === 1 ? world.w + 30 : Math.random() * world.w;
  const y = side === 2 ? -30 : side === 3 ? world.h + 30 : Math.random() * world.h;
  const e = {
    sheet: sheets.enemy, scale: 1, el: makeSprite(sheets.enemy), x, y, vx: 0, vy: 0,
    heading: wrapDeg(Math.atan2(player.x - x, -(player.y - y)) * 180 / Math.PI), r: 15,
    hp: 2, cooldown: 1 + Math.random() * 2, frame: -1,
    speed: 150 + wave * 12, turn: 120 + wave * 6,
  };
  enemies.push(e);
}

// The gunship: a Tomaquad, slow and tough, firing a spread of three.
function spawnGunship() {
  const x = Math.random() < 0.5 ? -50 : world.w + 50, y = Math.random() * world.h;
  const hp = 8 + wave;
  enemies.push({
    sheet: sheets.gunship, scale: 1, el: makeSprite(sheets.gunship, 1, "gunship"), x, y, vx: 0, vy: 0,
    heading: wrapDeg(Math.atan2(player.x - x, -(player.y - y)) * 180 / Math.PI), r: 24,
    hp, maxHp: hp, cooldown: 2, frame: -1, speed: 70 + wave * 3, turn: 45, boss: true,
  });
}

function startWave() {
  $("wave").textContent = wave;
  const boss = wave % 5 === 0;
  for (let i = 0; i < Math.min(2 + wave, 9) - (boss ? 2 : 0); i++) spawnEnemy();
  if (boss) spawnGunship();
}

function restart() {
  arena.querySelectorAll(".sprite, .boom").forEach((el) => el.remove());
  measure();
  const ps = sheets.player;
  player = {
    sheet: ps, scale: 1, el: makeSprite(ps, 1, "player"), x: world.w / 2, y: world.h / 2, vx: 0, vy: 0,
    heading: 0, r: Math.max(12, ps.w * 0.34), shield: 100, cooldown: 0, hurt: 0, frame: -1,
    // Scaled from the ship's own 1997 stats, so a different ?ship= flies differently.
    accel: 140 + (ps.stats.Accel ?? 400) * 0.4, max: 120 + (ps.stats.Speed ?? 300) * 0.5,
    turn: 120 + (ps.stats.Maneuver ?? 3) * 30, cloak: 0, cloakReady: 0,
  };
  enemies = []; missiles = []; score = 0; wave = 1; over = false; paused = false;
  if (autopilot) player.shield = 1e9;        // the demo pilot can't lose
  $("score").textContent = 0;
  $("overlay").hidden = true;
  setShield();
  startWave();
  arena.focus({ preventScroll: true });
}

function setShield() {
  const bar = $("shield-bar");
  bar.style.width = `${Math.max(0, Math.min(100, player.shield))}%`;
  bar.classList.toggle("low", player.shield < 30);
}

function fire(from, enemy) {
  // Missiles leave along the frame the shooter shows, so they match the picture.
  const a = rad(Math.floor(wrapDeg(from.heading) / 10) * 10);
  const speed = enemy ? 300 : 430;
  const off = from.r + 6;
  const m = {
    sheet: sheets.missile, scale: 1, el: makeSprite(sheets.missile, 1, enemy ? "enemy-missile" : ""),
    x: from.x + Math.sin(a) * off, y: from.y - Math.cos(a) * off,
    vx: from.vx * 0.5 + Math.sin(a) * speed, vy: from.vy * 0.5 - Math.cos(a) * speed,
    heading: from.heading, r: 7, life: enemy ? 2 : 1.6, enemy, frame: -1,
  };
  missiles.push(m);
}

/** Turn `e.heading` toward `target` degrees by at most `rate * dt`. */
function steer(e, target, rate, dt) {
  const diff = ((target - e.heading + 540) % 360) - 180;
  e.heading = wrapDeg(e.heading + Math.max(-rate * dt, Math.min(rate * dt, diff)));
  return Math.abs(diff);
}
const bearing = (from, to) => wrapDeg(Math.atan2(to.x - from.x, -(to.y - from.y)) * 180 / Math.PI);
const hit = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 < (a.r + b.r) ** 2;
function remove(list, e) { e.el.remove(); list.splice(list.indexOf(e), 1); }

// --- One fixed simulation step ------------------------------------------------------
function update(dt) {
  const p = player;
  if (autopilot) fly(p);
  // Player.
  if (keys.left) p.heading = wrapDeg(p.heading - p.turn * dt);
  if (keys.right) p.heading = wrapDeg(p.heading + p.turn * dt);
  const a = rad(Math.floor(p.heading / 10) * 10);
  if (keys.up) { p.vx += Math.sin(a) * p.accel * dt; p.vy -= Math.cos(a) * p.accel * dt; }
  if (keys.down) { p.vx *= 1 - 2.5 * dt; p.vy *= 1 - 2.5 * dt; }
  const v = Math.hypot(p.vx, p.vy);
  if (v > p.max) { p.vx *= p.max / v; p.vy *= p.max / v; }
  p.x += p.vx * dt; p.y += p.vy * dt;
  wrap(p);
  p.cooldown -= dt;
  p.cloakReady -= dt;
  if (keys.cloak && p.cloak <= 0 && p.cloakReady <= 0) {          // cloak: the Defenders fly at where you were
    p.cloak = CLOAK; p.cloakReady = CLOAK + CLOAK_EVERY; p.ghost = { x: p.x, y: p.y, vx: 0, vy: 0 };
    p.el.classList.add("cloaked");
  }
  if (p.cloak > 0 && ((p.cloak -= dt) <= 0 || (keys.fire && p.cooldown <= 0))) { p.cloak = 0; p.el.classList.remove("cloaked"); }
  if (keys.fire && p.cooldown <= 0) { fire(p, false); p.cooldown = 0.22; }
  cloakHud(p);
  if (p.hurt > 0 && (p.hurt -= dt) <= 0) p.el.classList.remove("hurt");

  // Defenders: lead the player a little, turn toward that point, thrust when
  // roughly facing it, keep apart from each other, and shoot when lined up.
  const seen = p.cloak > 0 ? p.ghost : p;
  for (const e of enemies) {
    const lead = { x: seen.x + seen.vx * 0.4, y: seen.y + seen.vy * 0.4 };
    const off = steer(e, bearing(e, lead), e.turn, dt);
    const ea = rad(Math.floor(e.heading / 10) * 10);
    const thrust = (off < 50 ? 260 : 60) * (e.boss ? 0.4 : 1);
    e.vx += Math.sin(ea) * thrust * dt; e.vy -= Math.cos(ea) * thrust * dt;
    for (const o of enemies) {
      if (o === e) continue;
      const dx = e.x - o.x, dy = e.y - o.y, d2 = dx * dx + dy * dy;
      if (d2 < 2500 && d2 > 0.01) { e.vx += (dx / Math.sqrt(d2)) * 300 * dt; e.vy += (dy / Math.sqrt(d2)) * 300 * dt; }
    }
    const s = Math.hypot(e.vx, e.vy);
    if (s > e.speed) { e.vx *= e.speed / s; e.vy *= e.speed / s; }
    e.x += e.vx * dt; e.y += e.vy * dt;
    wrap(e);
    e.cooldown -= dt;
    if (e.cooldown <= 0 && off < (e.boss ? 25 : 12) && Math.hypot(seen.x - e.x, seen.y - e.y) < (e.boss ? 450 : 380)) {
      if (e.boss) {                                          // the gunship's spread of three
        for (const d of [-15, 0, 15]) fire({ ...e, heading: e.heading + d }, true);
        e.cooldown = 1.8;
      } else {
        fire(e, true);
        e.cooldown = Math.max(0.9, 2.6 - wave * 0.15) + Math.random();
      }
    }
  }

  // Missiles: fly straight (player missiles home in gently), expire, collide.
  for (const m of [...missiles]) {
    if (!m.enemy && enemies.length) {
      let near = null, nearest = Infinity;
      for (const e of enemies) { const d = (e.x - m.x) ** 2 + (e.y - m.y) ** 2; if (d < nearest) { nearest = d; near = e; } }
      const sp = Math.hypot(m.vx, m.vy);
      steer(m, bearing(m, near), 70, dt);
      m.vx = Math.sin(rad(m.heading)) * sp; m.vy = -Math.cos(rad(m.heading)) * sp;
    }
    m.x += m.vx * dt; m.y += m.vy * dt;
    wrap(m);
    if ((m.life -= dt) <= 0) { remove(missiles, m); continue; }
    if (m.enemy) {
      if (p.cloak <= 0 && hit(m, p)) { boom(m.x, m.y, 0.5); remove(missiles, m); damage(14); }
    } else {
      const e = enemies.find((en) => hit(m, en));
      if (e) {
        boom(m.x, m.y, 0.5);
        remove(missiles, m);
        if (--e.hp <= 0) { boom(e.x, e.y, e.boss ? 2.4 : 1.2); remove(enemies, e); addScore(e.boss ? 1000 + wave * 50 : 100 + wave * 10); }
      }
    }
  }

  // Ramming: both take damage; the Defender doesn't survive it.
  for (const e of [...enemies]) {
    if (p.cloak > 0 || !hit(e, p)) continue;
    if (e.boss) { damage(30); p.vx = -p.vx; p.vy = -p.vy; boom(p.x, p.y, 0.8); continue; }   // the gunship shrugs it off
    boom(e.x, e.y, 1.2); remove(enemies, e); addScore(25); damage(22);
  }

  if (!over && enemies.length === 0) { wave++; startWave(); }
}

/** The attract-mode pilot: sets `keys` the way a person would. */
function fly(p) {
  let target = null, d = Infinity;
  for (const e of enemies) { const dd = (e.x - p.x) ** 2 + (e.y - p.y) ** 2; if (dd < d) { d = dd; target = e; } }
  for (const k in keys) keys[k] = false;
  if (!target) return;
  const diff = ((bearing(p, target) - p.heading + 540) % 360) - 180;
  keys.left = diff < -6;
  keys.right = diff > 6;
  keys.up = Math.abs(diff) < 40 && d > 200 ** 2;
  keys.down = d < 120 ** 2;
  keys.fire = Math.abs(diff) < 20;
}

let cloakShown = "";
function cloakHud(p) {
  const text = p.cloak > 0 ? "cloaked" : p.cloakReady > 0 ? `${Math.ceil(p.cloakReady)} s` : "ready";
  if (text !== cloakShown) { cloakShown = text; $("cloak").textContent = text; }
}

function damage(n) {
  if (over) return;
  player.shield -= n;
  player.hurt = 0.12;
  player.el.classList.add("hurt");
  setShield();
  if (player.shield <= 0) gameOver();
}
function addScore(n) {
  score += n;
  $("score").textContent = score;
}

function gameOver() {
  over = true;
  boom(player.x, player.y, 2.2);
  player.el.remove();
  if (score > best && !autopilot) {
    best = score;
    try { localStorage.setItem("yodacon-ship-pack:dogfight-best", String(best)); } catch { /* fine */ }
  }
  $("best").textContent = best;
  showOverlay("GAME OVER", `Score ${score} · reached wave ${wave}`, "Play again");
}
function togglePause() {
  if (over) return;
  paused = !paused;
  if (paused) showOverlay("PAUSED", "Press P or the button to carry on.", "Resume");
  else $("overlay").hidden = true;
}
function showOverlay(title, text, button) {
  $("overlay-title").textContent = title;
  $("overlay-text").textContent = text;
  $("restart").textContent = button;
  $("overlay").hidden = false;
}
$("restart").addEventListener("click", () => (paused && !over ? togglePause() : restart()));
document.addEventListener("visibilitychange", () => { if (document.hidden && !paused && !over && !autopilot) togglePause(); });

// The star field: two tiles of random dots, drawn once as SVG data URLs, so the
// tiling doesn't look like a grid. They become the arena's background layers.
function starTile(size, n, maxR, alpha) {
  let dots = "";
  for (let i = 0; i < n; i++) {
    const r = (0.4 + Math.random() * maxR).toFixed(2), o = (alpha * (0.4 + Math.random() * 0.6)).toFixed(2);
    dots += `<circle cx="${(Math.random() * size).toFixed(1)}" cy="${(Math.random() * size).toFixed(1)}" r="${r}" fill="#dfe6ff" fill-opacity="${o}"/>`;
  }
  return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'>${dots}</svg>`)}")`;
}
arena.style.backgroundImage = `${starTile(397, 45, 0.9, 1)}, ${starTile(263, 40, 0.5, 0.6)}`;
arena.style.backgroundSize = "397px 397px, 263px 263px";

// --- The loop: render every display frame, simulate in fixed steps ---------------
let last = performance.now(), acc = 0, starX = 0, starY = 0;
function frame(now) {
  acc += Math.min(0.25, (now - last) / 1000);   // clamp: a background tab must not fast-forward
  last = now;
  if (!paused && !over) {
    while (acc >= STEP) { update(STEP); acc -= STEP; }
  } else acc = 0;
  // Draw.
  if (!over) draw(player);
  for (const e of enemies) draw(e);
  for (const m of missiles) draw(m);
  if (!paused && !over) {
    // Parallax stars: the two layers drift against the player's motion.
    starX -= player.vx * 0.004; starY -= player.vy * 0.004;
    arena.style.backgroundPosition = `${starX * 4}px ${starY * 4}px, ${starX * 2}px ${starY * 2}px`;
  }
  requestAnimationFrame(frame);
}

// For play-test scripts: a look at the game, and a jump to a wave.
globalThis.dogfight = {
  get player() { return player; }, get enemies() { return enemies; }, get wave() { return wave; },
  jump(n) { for (const e of enemies) e.el.remove(); enemies = []; wave = n; startWave(); },
};

// --- Start --------------------------------------------------------------------------
try {
  const [pe, ps] = PLAYER_SHIP;
  sheets = {
    player: await loadSheet(pe, "ships", ps),
    enemy: await loadSheet("conex", "ships", "defender"),
    missile: await loadSheet(null, "weapons", "missile-repeater"),
    gunship: await loadSheet("conex", "ships", "tomaquad"),
  };
  $("player-name").textContent = sheets.player.name;
  $("best").textContent = best;
  restart();
  requestAnimationFrame(frame);
} catch (err) {
  showOverlay("NO SHIPS", `${err.message}. Serve the pack over http(s), e.g. “make serve”.`, "Retry");
  $("restart").onclick = () => location.reload();
  console.error(err);
}
