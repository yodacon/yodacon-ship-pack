// Gauntlet: pick any of the pack's thirteen designs and fight the others, one
// round each, weakest first, with the 1998 Yodacon waiting at the end. Every
// hull flies and fights by its 1997 record. One or two players, on keyboard,
// gamepads or touch.
import { loadShip, drawShip, frameIndex } from "../../lib/yodacon-ship-pack.js";
import { play, isMuted, setMuted } from "../../lib/yodacon-sound.js";

const $ = (id) => document.getElementById(id);
const canvas = $("screen"), ctx = canvas.getContext("2d");
const W = canvas.width, H = canvas.height;
const BOLT_SPEED = 520, BOLT_LIFE = 0.9, RANGE = BOLT_SPEED * BOLT_LIFE;
const SAVE = "gauntlet-v1";
const rad = (d) => (d * Math.PI) / 180, deg = (r) => (r * 180) / Math.PI;

// --- The ships -----------------------------------------------------------------------------------

// The thirteen designs: ConEx's ten, Override's Callisto, konex's Advisor and Citrus.
const ROSTER = [
  ["conex", "yodacon"], ["conex", "dart"], ["conex", "necromancer"], ["conex", "tomaquad"],
  ["conex", "defender"], ["conex", "gryphon"], ["conex", "trident"], ["conex", "small-pin"],
  ["conex", "medium-pin"], ["conex", "large-pin"], ["override", "callisto"], ["konex", "advisor"], ["konex", "citrus"],
];
const CHAMPION = ["override", "yodacon"];              // the 1998 re-render, fought last
// Advisor and Citrus come from konex, which has no 1997 record for them; these
// numbers sit in the same ranges.
const KONEX_STATS = {
  advisor: { Speed: 380, Accel: 600, Maneuver: 4, Shield: 350, Armor: 150 },
  citrus: { Speed: 420, Accel: 650, Maneuver: 5, Shield: 180, Armor: 120 },
};
// The three Pins are one hull drawn at three sizes, so only the Large Pin is fought.
const NOT_FOUGHT = new Set(["small-pin", "medium-pin"]);

// A hull's numbers from its record. Toughness grows with the square root of
// Shield + Armor, so a Large Pin is tough but not ten times a Gryphon.
function hullOf(ship) {
  const st = { ...(ship.meta.stats ?? {}), ...(KONEX_STATS[ship.slug] ?? {}) };
  const total = 4 * Math.sqrt(st.Shield + st.Armor), size = ship.sprite.frame_width;
  return {
    ship, slug: ship.slug, edition: ship.edition, name: ship.name, record: st,
    shieldMax: Math.round((total * st.Shield) / (st.Shield + st.Armor)),
    armourMax: Math.round((total * st.Armor) / (st.Shield + st.Armor)),
    speed: st.Speed * 0.6, accel: st.Accel * 0.6, turn: st.Maneuver * 45,
    damage: Math.round(4 + size / 12), twin: size >= 60,  // big hulls carry two guns
    radius: size * 0.32,
  };
}
const threat = (h) => (h.shieldMax + h.armourMax) * (1 + h.speed / 300) * (h.twin ? 1.6 : 1);

// --- State ---------------------------------------------------------------------------------------

const state = {
  phase: "loading", players: 1, picks: [], ladder: [], round: 0, retries: 0, time: 0,
  ships: [], bolts: [], sparks: [],
};
let hulls = [], champion = null;
const stars = Array.from({ length: 140 }, () => [Math.random() * W, Math.random() * H, Math.random()]);

function load() {
  try { return JSON.parse(localStorage.getItem(SAVE)) ?? {}; } catch { return {}; }
}
function save(data) {
  try { localStorage.setItem(SAVE, JSON.stringify(data)); } catch { /* private mode: nothing kept */ }
}

function spawn(hull, x, y, heading, side, extra = {}) {
  return { hull, x, y, vx: 0, vy: 0, heading, side, shield: hull.shieldMax, armour: hull.armourMax,
    cool: 0.5, regenWait: 0, alive: true, ...extra };
}

// A weaker copy of a beaten hull, to escort the round's opponent.
// Opponents fight at 80% of their record, escorts at 40%.
const weaker = (h, f) => ({ ...h, shieldMax: Math.round(h.shieldMax * f), armourMax: Math.round(h.armourMax * f) });
const escortOf = (h) => weaker(h, 0.4);

function buildLadder() {
  const taken = new Set(state.picks.map((h) => h.slug));
  state.ladder = hulls.filter((h) => !taken.has(h.slug) && !NOT_FOUGHT.has(h.slug)).sort((a, b) => threat(a) - threat(b));
  state.ladder.push(champion);
  state.round = 0; state.retries = 0; state.tries = 0; state.time = 0;
}

function startRound() {
  const r = state.round, foe = state.ladder[r];
  state.ships = []; state.bolts = []; state.sparks = [];
  state.picks.forEach((h, i) => {
    const y = state.picks.length === 1 ? H / 2 : H * (0.35 + 0.3 * i);
    // Each retry of a round adds 15% to your hull for that round.
    state.ships.push(spawn(weaker(h, 1 + 0.15 * state.tries), W * 0.15, y, 90, "you", { player: i }));
  });
  const fireEvery = Math.max(0.5, 0.8 - 0.03 * r);
  state.ships.push(spawn(weaker(foe, 0.8), W * 0.85, H / 2, 270, "them", { fireEvery, skill: Math.min(0.85, 0.6 + 0.03 * r), boss: true }));
  const escorts = Math.floor(r / 4) + (state.players - 1);
  for (let i = 0; i < escorts; i++) {
    const h = escortOf(state.ladder[Math.max(0, r - 1 - (i % Math.max(1, r)))]);
    const y = H * (0.2 + (0.6 * (i + 1)) / (escorts + 1));
    state.ships.push(spawn(h, W * 0.92, y, 270, "them", { fireEvery: fireEvery * 1.4, skill: 0.5 }));
  }
  state.phase = "fight";
  hideBanner();
  renderLadder();
}

// --- Input: keyboard, gamepads, touch ---------------------------------------------------------------

const KEYS = [
  { left: "ArrowLeft", right: "ArrowRight", thrust: "ArrowUp", brake: "ArrowDown", fire: " " },
  { left: "a", right: "d", thrust: "w", brake: "s", fire: "f" },
];
const held = new Set(), touch = new Set();
addEventListener("keydown", (e) => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (state.phase === "fight" && (k.startsWith("Arrow") || k === " ")) e.preventDefault();
  if (!e.repeat && (k === "Enter" || (k === " " && state.phase !== "fight"))) { e.preventDefault(); advance(); }
  held.add(k);
});
addEventListener("keyup", (e) => held.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key));
addEventListener("blur", () => held.clear());
for (const b of document.querySelectorAll("#pad [data-key]")) {
  b.addEventListener("pointerdown", (e) => { e.preventDefault(); touch.add(b.dataset.key); b.classList.add("down"); });
  for (const ev of ["pointerup", "pointerleave", "pointercancel"]) {
    b.addEventListener(ev, () => { touch.delete(b.dataset.key); b.classList.remove("down"); });
  }
}

// Player i reads keyboard set i, gamepad i (standard mapping) and, for player
// one, the touch pad.
function controls(i) {
  const k = KEYS[i];
  const c = Object.fromEntries(Object.entries(k).map(([what, key]) => [what, held.has(key)]));
  if (i === 0) for (const what of touch) c[what] = true;
  const pad = navigator.getGamepads?.()[i];
  if (pad) {
    const x = pad.axes[0] ?? 0, b = (n) => pad.buttons[n]?.pressed;
    c.left ||= x < -0.4 || b(14);
    c.right ||= x > 0.4 || b(15);
    c.thrust ||= b(0) || b(12) || (pad.buttons[7]?.value ?? 0) > 0.3;
    c.brake ||= b(13) || (pad.buttons[6]?.value ?? 0) > 0.3;
    c.fire ||= b(1) || b(2) || b(5);
  }
  return c;
}

// Start (or A) on any gamepad works the banners, like Enter.
let padStartWas = false;
function pollPadStart() {
  const pressed = [...(navigator.getGamepads?.() ?? [])].some((p) => p && (p.buttons[9]?.pressed || (state.phase !== "fight" && p.buttons[0]?.pressed)));
  if (pressed && !padStartWas) advance();
  padStartWas = pressed;
}

// --- Simulation ----------------------------------------------------------------------------------

function steer(s, c, dt) {
  const h = s.hull;
  if (c.left) s.heading -= h.turn * dt;
  if (c.right) s.heading += h.turn * dt;
  s.heading = (s.heading + 360) % 360;
  if (c.thrust) {
    const a = rad(frameIndex(s.heading) * 10);         // thrust along the frame shown
    s.vx += Math.sin(a) * h.accel * dt;
    s.vy -= Math.cos(a) * h.accel * dt;
  }
  if (c.brake) { s.vx *= 1 - 2 * dt; s.vy *= 1 - 2 * dt; }
  const v = Math.hypot(s.vx, s.vy);
  if (v > h.speed) { s.vx *= h.speed / v; s.vy *= h.speed / v; }
  if (c.fire && s.cool <= 0) fire(s);
}

function fire(s) {
  s.cool = s.side === "you" ? 0.22 : s.fireEvery;
  // Bolts leave along the true heading, not the 10° frame, so aim is not
  // rounded to the nearest frame.
  const a = rad(s.heading), dx = Math.sin(a), dy = -Math.cos(a), r = s.hull.radius;
  for (const o of s.hull.twin ? [-0.4, 0.4] : [0]) {
    state.bolts.push({ x: s.x + dx * r - dy * o * r, y: s.y + dy * r + dx * o * r,
      vx: s.vx + dx * BOLT_SPEED, vy: s.vy + dy * BOLT_SPEED, life: BOLT_LIFE, side: s.side,
      damage: s.side === "you" ? s.hull.damage : s.hull.damage * 0.7 });   // the computer's guns hit softer
  }
  if (s.side === "you") play("shot");
}

// The computer flies at a led aim point, breaks away when too close, and
// fires when lined up.
function think(e) {
  let best = null, bestD = Infinity;
  for (const s of state.ships) {
    if (!s.alive || s.side === e.side) continue;
    const d = Math.hypot(s.x - e.x, s.y - e.y);
    if (d < bestD) { best = s; bestD = d; }
  }
  if (!best) return {};
  const lead = (bestD / BOLT_SPEED) * e.skill;
  const ax = best.x + (best.vx - e.vx) * lead, ay = best.y + (best.vy - e.vy) * lead;
  let want = deg(Math.atan2(ax - e.x, -(ay - e.y)));
  const close = bestD < e.hull.radius + best.hull.radius + 70;
  if (close) want += 150;
  const diff = ((want - e.heading + 540) % 360) - 180;
  return { left: diff < -4, right: diff > 4, thrust: Math.abs(diff) < 50 && (bestD > 170 || close),
    fire: !close && Math.abs(diff) < 10 && bestD < RANGE * 0.9 };
}

function move(s, dt) {
  s.x += s.vx * dt; s.y += s.vy * dt;
  const r = s.hull.radius;                             // the arena's walls bounce, softly
  if (s.x < r) { s.x = r; s.vx = Math.abs(s.vx) * 0.5; }
  if (s.x > W - r) { s.x = W - r; s.vx = -Math.abs(s.vx) * 0.5; }
  if (s.y < r) { s.y = r; s.vy = Math.abs(s.vy) * 0.5; }
  if (s.y > H - r) { s.y = H - r; s.vy = -Math.abs(s.vy) * 0.5; }
  s.cool -= dt;
  s.regenWait -= dt;
  if (s.regenWait <= 0) s.shield = Math.min(s.hull.shieldMax, s.shield + s.hull.shieldMax * 0.05 * dt);
}

function damage(s, d) {
  const toShield = Math.min(s.shield, d);
  s.shield -= toShield;
  s.armour -= d - toShield;
  s.regenWait = 3;
  burst(s.x, s.y, 4, toShield > 0 ? "#8fd8ff" : "#ffb347", 60);
  if (s.armour <= 0) {
    s.alive = false;
    burst(s.x, s.y, 40, "#ffcf6b", 160);
    burst(s.x, s.y, 20, "#ff5a3c", 90);
    state.sparks.push({ ring: true, x: s.x, y: s.y, r: s.hull.radius, life: 0.5, max: 0.5 });
    play("boom");
  } else if (s.side === "you" || Math.random() < 0.5) play("hit");
}

function burst(x, y, n, color, speed) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = speed * (0.3 + Math.random());
    state.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.3 + Math.random() * 0.5, max: 0.8, color });
  }
}

function update(dt) {
  for (const s of state.sparks) { s.life -= dt; if (!s.ring) { s.x += s.vx * dt; s.y += s.vy * dt; } }
  state.sparks = state.sparks.filter((s) => s.life > 0);
  if (state.phase !== "fight") return;
  state.time += dt;
  for (const s of state.ships) {
    if (!s.alive) continue;
    steer(s, s.side === "you" ? controls(s.player) : think(s), dt);
    move(s, dt);
  }
  for (const b of state.bolts) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    for (const s of state.ships) {
      if (!s.alive || s.side === b.side || b.life <= 0) continue;
      if (Math.hypot(s.x - b.x, s.y - b.y) < s.hull.radius + 6) { b.life = 0; damage(s, b.damage); }
    }
  }
  state.bolts = state.bolts.filter((b) => b.life > 0 && b.x > -20 && b.x < W + 20 && b.y > -20 && b.y < H + 20);

  const left = (side) => state.ships.some((s) => s.alive && s.side === side);
  if (!left("them")) endRound(true);
  else if (!left("you")) endRound(false);
}

function endRound(won) {
  const r = state.round, foe = state.ladder[r];
  if (!won) {
    state.retries++;
    state.tries++;
    state.phase = "lost";
    play("lost");
    banner("Shot down", `The ${foe.name} wins this one. Press Enter, Space or Start to try again.`, "Retry");
    return;
  }
  if (r === state.ladder.length - 1) {
    state.phase = "champion";
    play("won");
    const best = load(), key = state.picks.map((h) => h.slug).join("+");
    const time = Math.round(state.time);
    const record = !best[key] || time < best[key].time;
    if (record) save({ ...best, [key]: { time, retries: state.retries } });
    banner("Champion", `${state.picks.map((h) => h.name).join(" and ")} beat all ${state.ladder.length} in ${time} s` +
      ` with ${state.retries} ${state.retries === 1 ? "retry" : "retries"}${record ? " — a new best" : ""}.`, "Pick again");
    renderPick();
    return;
  }
  state.phase = "between";
  play("conquered");
  banner(`${foe.name} down`, `Next: ${roundTitle(r + 1)}. Repairs are free between rounds.`, "Next round");
}

// --- Rounds, banners and panels ---------------------------------------------------------------------

function roundTitle(r) {
  const n = Math.floor(r / 4) + (state.players - 1);
  return `round ${r + 1} of ${state.ladder.length}, the ${state.ladder[r].name}` +
    (n ? ` with ${n} escort${n > 1 ? "s" : ""}` : "") + (r === state.ladder.length - 1 ? " (1998)" : "");
}

function banner(title, text, button) {
  $("banner-title").textContent = title;
  $("banner-text").textContent = text;
  $("banner-go").textContent = button;
  $("banner").hidden = false;
}
const hideBanner = () => { $("banner").hidden = true; };

// Enter, Space, Start or the banner's button.
function advance() {
  if (state.phase === "intro" || state.phase === "lost") startRound();
  else if (state.phase === "between") { state.round++; state.tries = 0; intro(); }
  else if (state.phase === "champion") showPick();
}

function intro() {
  state.phase = "intro";
  renderLadder();
  const foe = state.ladder[state.round];
  banner(`Round ${state.round + 1}`, `${roundTitle(state.round)[0].toUpperCase()}${roundTitle(state.round).slice(1)}. ${foe.ship.meta.description ?? ""}`.trim(), "Fight");
  play("select");
}

function statLine(h) {
  const st = h.record, src = KONEX_STATS[h.slug] ? "konex (numbers set by this game)" : h.edition === "override" ? "ConEx Override, 1998" : "ConEx, 1997";
  return `${src} · Shield ${st.Shield} · Armor ${st.Armor} · Speed ${st.Speed} · Turn ${st.Maneuver}`;
}

function renderLadder() {
  const list = $("ladder");
  list.replaceChildren(...state.ladder.map((h, i) => {
    const li = document.createElement("li");
    li.className = i < state.round ? "beaten" : i === state.round ? "current" : "";
    const img = Object.assign(document.createElement("img"), { src: h.ship.urls.thumb ?? h.ship.urls.frames(9), alt: "", width: 32, height: 32 });
    li.append(img, `${i + 1}. ${h.name}${h === champion ? " (1998)" : ""}`);
    return li;
  }));
  const foe = state.ladder[state.round];
  if (foe) {
    $("foe-comm").src = foe.ship.urls.comm;
    $("foe-name").textContent = foe.name + (foe === champion ? " (1998)" : "");
    $("foe-stats").textContent = statLine(foe);
  }
}

// The pick screen: every design, its yard picture and its numbers.
let picking = [];
function renderPick() {
  const best = load();
  $("pick-who").textContent = state.players === 2 ? `Player ${picking.length + 1}, choose your hull` : "Choose your hull";
  const specs = (h) => `Hull ${h.shieldMax + h.armourMax} · Speed ${Math.round(h.speed)} · Turn ${h.turn}°/s · ${h.twin ? "twin guns" : "one gun"}`;
  const champ = (slug) => (best[slug] ? `<span class="best">Champion in ${best[slug].time} s</span>` : "");
  const pins = hulls.filter((h) => h.slug.endsWith("-pin"));
  $("hulls").replaceChildren(...hulls.filter((h) => !h.slug.endsWith("-pin") || h.slug === "large-pin").map((h) => {
    if (h.slug === "large-pin") {
      // The Pins are one hull at three sizes: one card, a button per size.
      const card = document.createElement("div");
      card.className = "hull pin";
      card.innerHTML = `<img src="${h.ship.urls.yard}" alt=""><span class="name">Pin</span><span class="specs">One hull, three sizes</span>`;
      for (const p of pins) {
        const b = Object.assign(document.createElement("button"), { type: "button", className: "size", disabled: picking.includes(p), title: statLine(p) });
        b.innerHTML = `<b>${p.name.split(" ")[0]}</b> ${specs(p)}${champ(p.slug)}`;
        b.addEventListener("click", () => choose(p));
        card.append(b);
      }
      return card;
    }
    const b = Object.assign(document.createElement("button"), { type: "button", className: "hull", disabled: picking.includes(h), title: statLine(h) });
    b.innerHTML = `<img src="${h.ship.urls.yard}" alt=""><span class="name">${h.name}</span><span class="specs">${specs(h)}</span>${champ(h.slug)}`;
    b.addEventListener("click", () => choose(h));
    return b;
  }));
}

function showPick() {
  state.phase = "pick";
  picking = [];
  hideBanner();
  $("pick").hidden = false;
  renderPick();
}

function choose(h) {
  picking.push(h);
  play("select");
  if (picking.length < state.players) { renderPick(); return; }
  state.picks = picking;
  $("pick").hidden = true;
  buildLadder();
  intro();
}

for (const b of document.querySelectorAll("[data-players]")) {
  b.addEventListener("click", () => {
    state.players = Number(b.dataset.players);
    for (const o of document.querySelectorAll("[data-players]")) o.setAttribute("aria-pressed", String(o === b));
    picking = [];
    renderPick();
  });
}
$("banner-go").addEventListener("click", advance);
$("new").addEventListener("click", showPick);
$("mute").addEventListener("click", () => {
  setMuted(!isMuted());
  $("mute").textContent = `Sound: ${isMuted() ? "off" : "on"}`;
  $("mute").setAttribute("aria-pressed", String(isMuted()));
});
$("mute").textContent = `Sound: ${isMuted() ? "off" : "on"}`;
addEventListener("gamepadconnected", (e) => { $("pads").textContent = `Gamepad ${e.gamepad.index + 1} connected.`; });

// --- Drawing -------------------------------------------------------------------------------------

function bars(x, y, w, s) {
  const h = s.hull;
  ctx.fillStyle = "rgb(255 255 255 / 0.12)";
  ctx.fillRect(x, y, w, 3); ctx.fillRect(x, y + 4, w, 3);
  ctx.fillStyle = "#8fd8ff"; ctx.fillRect(x, y, (w * s.shield) / h.shieldMax, 3);
  ctx.fillStyle = "#ffb347"; ctx.fillRect(x, y + 4, (w * Math.max(0, s.armour)) / h.armourMax, 3);
}

function draw() {
  ctx.fillStyle = "#04050a";
  ctx.fillRect(0, 0, W, H);
  for (const [x, y, b] of stars) {
    ctx.fillStyle = `rgb(160 170 210 / ${0.25 + b * 0.6})`;
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.strokeStyle = "rgb(126 240 168 / 0.25)";
  ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

  for (const b of state.bolts) {
    ctx.strokeStyle = b.side === "you" ? "#7ef0a8" : "#ff7a59";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
    ctx.stroke();
  }
  for (const s of state.ships) {
    if (!s.alive) continue;
    drawShip(ctx, s.hull.ship, s.heading, s.x, s.y, 1);
    if (s.side === "them") bars(s.x - 20, s.y - s.hull.radius - 14, 40, s);
    else {
      ctx.fillStyle = "#7ef0a8";
      ctx.font = "700 11px ui-monospace, monospace";
      ctx.fillText(`P${s.player + 1}`, s.x - 7, s.y - s.hull.radius - 6);
    }
  }
  for (const p of state.sparks) {
    const t = p.life / p.max;
    if (p.ring) {
      ctx.strokeStyle = `rgb(255 220 150 / ${t})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * (3 - 2 * t), 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.globalAlpha = Math.min(1, t * 1.5);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
      ctx.globalAlpha = 1;
    }
  }
  // Each player's shield and armour, top left and top right.
  state.ships.filter((s) => s.side === "you").forEach((s) => {
    const x = s.player === 0 ? 10 : W - 130;
    ctx.fillStyle = "#c9d1ea";
    ctx.font = "700 11px ui-monospace, monospace";
    ctx.fillText(`P${s.player + 1} ${s.hull.name}${s.alive ? "" : " (down)"}`, x, 16);
    bars(x, 22, 120, s);
  });
  if (state.phase === "fight") {
    ctx.fillStyle = "#7ef0a8";
    ctx.font = "700 11px ui-monospace, monospace";
    ctx.fillText(`Round ${state.round + 1}/${state.ladder.length} · ${Math.floor(state.time)} s`, W / 2 - 60, 16);
  }
}

// --- Start ---------------------------------------------------------------------------------------

const STEP = 1 / 60;
let last = performance.now(), acc = 0;
requestAnimationFrame(function frame(now) {
  acc += Math.min(0.25, (now - last) / 1000);
  last = now;
  pollPadStart();
  while (acc >= STEP) { update(STEP); acc -= STEP; }
  draw();
  requestAnimationFrame(frame);
});

const ships = await Promise.all([...ROSTER, CHAMPION].map(([ed, slug]) => loadShip(ed, slug)));
hulls = ships.slice(0, ROSTER.length).map(hullOf);
champion = hullOf(ships.at(-1));
// tick(n) runs n simulation steps at once, for play-tests on slow machines.
globalThis.gauntlet = { state, W, H, BOLT_SPEED, choose: (slug) => choose(hulls.find((h) => h.slug === slug)), advance,
  tick: (n = 1) => { for (let i = 0; i < n; i++) update(STEP); } };
showPick();
