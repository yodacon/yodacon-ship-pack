// Orbital Defence: hold a planet against waves of ConEx ships.
// Canvas 2D on a fixed 60 Hz step. Enemies are pack ships whose toughness and
// speed come from their 1997 records; the planet is the pack's generated
// garden world; shots are the pack's drawn missile.
import { loadShip, loadWeapon, drawShip, loadImage, PACK_BASE } from "../../lib/yodacon-ship-pack.js";
import { play, isMuted, setMuted } from "../../lib/yodacon-sound.js";

const $ = (id) => document.getElementById(id);
const canvas = $("screen"), ctx = canvas.getContext("2d");
const W = canvas.width, H = canvas.height, CX = W / 2, CY = H / 2;
const STEP = 1 / 60;
const DEFENDER_COST = 50, REPAIR_COST = 30, REPAIR_HP = 20, MAX_HP = 100, MAX_PATROLS = 6;

// The attackers, weakest first. hp from Shield + Armor, speed from Speed
// (ship.json stats), reward to match. A wave mixes the hulls unlocked so far.
const HULLS = [
  ["conex", "gryphon"], ["conex", "trident"], ["conex", "defender"], ["conex", "small-pin"],
  ["conex", "necromancer"], ["conex", "medium-pin"], ["conex", "dart"], ["conex", "tomaquad"],
  ["conex", "large-pin"], ["conex", "yodacon"],
];

const sprites = new Map();
let planetImg, missile, defenderShip;
let game;

const rand = (a, b) => a + Math.random() * (b - a);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const headingTo = (from, to) => (Math.atan2(to.x - from.x, -(to.y - from.y)) * 180 / Math.PI + 360) % 360;

function newGame() {
  game = { wave: 0, hp: MAX_HP, credits: 100, score: 0, phase: "build", enemies: [], shots: [],
    defenders: [], booms: [], cooldown: 0, toSpawn: [], spawnTimer: 0, over: false };
  $("banner").hidden = true;
  updateHud();
}

// --- Waves -----------------------------------------------------------------------------------

function enemyFrom(slug) {
  const ship = sprites.get(slug);
  const s = ship.meta.stats;
  // Tougher every wave: a fifth more health per wave after the first.
  const hp = Math.max(2, Math.round((s.Shield + s.Armor) / 120 * (1 + (game.wave - 1) * 0.2)));
  return { ship, slug, name: ship.name, hp, maxHp: hp, speed: 26 + s.Speed * 0.12,
    reward: 5 + hp * 2, damage: Math.min(30, 4 + Math.round(hp / 2)), radius: ship.sprite.frame_width / 2.6 };
}

function launchWave() {
  if (game.over || game.phase !== "build") return;
  game.wave++;
  game.phase = "wave";
  const unlocked = Math.min(HULLS.length, 2 + Math.floor(game.wave / 2));
  const count = 4 + game.wave * 2;
  game.toSpawn = Array.from({ length: count }, (_, i) =>
    HULLS[Math.min(unlocked - 1, Math.floor(Math.random() ** 1.6 * unlocked))][1]);
  if (game.wave % 5 === 0) game.toSpawn.push("yodacon");   // a boss every fifth wave
  game.spawnTimer = 0;
  play("endTurn");
  showRoster();
  updateHud();
}

function spawn(slug) {
  const e = enemyFrom(slug);
  const angle = rand(0, Math.PI * 2), r = Math.hypot(W, H) / 2 + 30;
  e.x = CX + Math.cos(angle) * r;
  e.y = CY + Math.sin(angle) * r;
  e.spin = Math.random() < 0.5 ? -1 : 1;            // which way it spirals in
  game.enemies.push(e);
}

// --- Player actions ------------------------------------------------------------------------------

function fireAt(x, y) {
  if (game.over || game.cooldown > 0) return;
  const angle = Math.atan2(y - CY, x - CX);
  shoot({ x: CX + Math.cos(angle) * 46, y: CY + Math.sin(angle) * 46 }, angle, 520, 1);
  game.cooldown = 0.22;
}

function shoot(from, angle, speed, power) {
  game.shots.push({ x: from.x, y: from.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
    life: 1.4, power, heading: (angle * 180 / Math.PI + 90 + 360) % 360 });
  play("shot");
}

function buyDefender() {
  if (game.over || game.credits < DEFENDER_COST || game.defenders.length >= MAX_PATROLS) { play("error"); return; }
  game.credits -= DEFENDER_COST;
  const n = game.defenders.length;
  game.defenders.push({ angle: n * 1.1, radius: 80 + (n % 3) * 26, rate: 0.85 - (n % 3) * 0.1, cooldown: 0, x: CX, y: CY });
  play("pickup");
  updateHud();
}

function repair() {
  if (game.over || game.credits < REPAIR_COST || game.hp >= MAX_HP) { play("error"); return; }
  game.credits -= REPAIR_COST;
  game.hp = Math.min(MAX_HP, game.hp + REPAIR_HP);
  play("send");
  updateHud();
}

// --- The simulation ---------------------------------------------------------------------------------

function update(dt) {
  if (game.over) return;
  game.cooldown = Math.max(0, game.cooldown - dt);
  if (game.phase === "wave") {
    game.spawnTimer -= dt;
    if (game.toSpawn.length && game.spawnTimer <= 0) {
      spawn(game.toSpawn.shift());
      game.spawnTimer = Math.max(0.25, 0.9 - game.wave * 0.07);
    }
  }
  // Enemies spiral in: mostly towards the planet, partly around it.
  for (const e of game.enemies) {
    const dx = CX - e.x, dy = CY - e.y, d = Math.hypot(dx, dy) || 1;
    const inward = 0.86, around = 0.5 * e.spin;
    e.vx = (dx / d * inward - dy / d * around) * e.speed;
    e.vy = (dy / d * inward + dx / d * around) * e.speed;
    e.x += e.vx * dt; e.y += e.vy * dt;
    e.heading = (Math.atan2(e.vx, -e.vy) * 180 / Math.PI + 360) % 360;
    if (d < 40 + e.radius * 0.5) {                     // reached the planet
      game.hp -= e.damage;
      e.dead = true;
      boom(e.x, e.y, 26);
      play("hit");
    }
  }
  // Defenders orbit and fire at the nearest enemy in range.
  for (const def of game.defenders) {
    def.angle += dt * (0.7 + 30 / def.radius);
    def.x = CX + Math.cos(def.angle) * def.radius;
    def.y = CY + Math.sin(def.angle) * def.radius;
    def.heading = ((def.angle + Math.PI / 2) * 180 / Math.PI + 90 + 360) % 360;
    def.cooldown -= dt;
    const target = game.enemies.filter((e) => !e.dead && dist(def, e) < 230).sort((a, b) => dist(def, a) - dist(def, b))[0];
    if (target && def.cooldown <= 0) {
      shoot(def, Math.atan2(target.y - def.y, target.x - def.x), 460, 1);
      def.cooldown = def.rate;
    }
  }
  // Shots fly, and hit.
  for (const s of game.shots) {
    s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
    for (const e of game.enemies) {
      if (!e.dead && !s.spent && Math.hypot(s.x - e.x, s.y - e.y) < e.radius) {
        s.spent = true;
        e.hp -= s.power;
        if (e.hp <= 0) {
          e.dead = true;
          game.credits += e.reward;
          game.score += e.reward * game.wave;
          boom(e.x, e.y, 18 + e.radius);
          play("boom");
        } else {
          boom(s.x, s.y, 6);
        }
      }
    }
  }
  game.shots = game.shots.filter((s) => !s.spent && s.life > 0);
  game.enemies = game.enemies.filter((e) => !e.dead);
  for (const b of game.booms) b.t += dt;
  game.booms = game.booms.filter((b) => b.t < b.life);

  if (game.hp <= 0) {
    game.hp = 0;
    game.over = true;
    play("lost");
    banner("Planet lost", `You held ${game.wave - 1} wave${game.wave === 2 ? "" : "s"}. Score ${game.score}. Click to try again.`, true);
  } else if (game.phase === "wave" && !game.toSpawn.length && !game.enemies.length) {
    game.phase = "build";
    game.credits += 20 + game.wave * 5;                 // wave bonus
    play("conquered");
    banner(`Wave ${game.wave} held`, "Spend your credits, then launch the next wave.", false, 1.6);
  }
  updateHud();
}

function boom(x, y, size) { game.booms.push({ x, y, size, t: 0, life: 0.45 }); }

// --- Drawing -----------------------------------------------------------------------------------------

const stars = Array.from({ length: 140 }, () => ({ x: Math.random() * W, y: Math.random() * H, b: Math.random() }));

function render() {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  for (const s of stars) {
    ctx.fillStyle = `rgba(255,255,255,${0.25 + s.b * 0.6})`;
    ctx.fillRect(s.x, s.y, 1, 1);
  }
  // orbit rings
  ctx.strokeStyle = "rgba(92,255,92,0.12)";
  for (const r of [80, 106, 132]) { ctx.beginPath(); ctx.arc(CX, CY, r, 0, Math.PI * 2); ctx.stroke(); }
  // the planet, with a health ring
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(planetImg, CX - 48, CY - 48, 96, 96);
  ctx.strokeStyle = game.hp > 50 ? "#5cff5c" : game.hp > 25 ? "#ffb340" : "#ff2a1a";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(CX, CY, 54, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (game.hp / MAX_HP));
  ctx.stroke();
  ctx.lineWidth = 1;
  for (const def of game.defenders) drawShip(ctx, defenderShip, def.heading, def.x, def.y, 1);
  for (const e of game.enemies) {
    drawShip(ctx, e.ship, e.heading, e.x, e.y, 1);
    if (e.hp < e.maxHp) {
      ctx.fillStyle = "#300"; ctx.fillRect(e.x - 12, e.y - e.radius - 8, 24, 3);
      ctx.fillStyle = "#ff2a1a"; ctx.fillRect(e.x - 12, e.y - e.radius - 8, 24 * e.hp / e.maxHp, 3);
    }
  }
  for (const s of game.shots) drawShip(ctx, missile, s.heading, s.x, s.y, 1);
  for (const b of game.booms) {
    const k = b.t / b.life;
    ctx.fillStyle = `rgba(255,${Math.round(200 - k * 150)},60,${1 - k})`;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.size * (0.4 + k), 0, Math.PI * 2); ctx.fill();
  }
}

// --- Page ----------------------------------------------------------------------------------------------

function updateHud() {
  $("wave").textContent = game.wave;
  $("hp").textContent = Math.max(0, Math.round(game.hp));
  $("credits").textContent = game.credits;
  $("score").textContent = game.score;
  $("launch").disabled = game.over || game.phase !== "build";
  $("buy").disabled = game.over || game.credits < DEFENDER_COST || game.defenders.length >= MAX_PATROLS;
  $("repair").disabled = game.over || game.credits < REPAIR_COST || game.hp >= MAX_HP;
  $("phase").lastChild.textContent = game.over ? "Planet lost" : game.phase === "build"
    ? `Between waves: build, then launch wave ${game.wave + 1}` : `Wave ${game.wave}: ${game.enemies.length + game.toSpawn.length} incoming`;
}

let bannerTimer = null;
function banner(title, text, lost, seconds) {
  $("banner-title").textContent = title;
  $("banner-title").className = lost ? "banner-title lost" : "banner-title";
  $("banner-text").textContent = text;
  $("banner").hidden = false;
  clearTimeout(bannerTimer);
  if (seconds) bannerTimer = setTimeout(() => { $("banner").hidden = true; }, seconds * 1000);
}

function showRoster() {
  const counts = {};
  for (const slug of game.toSpawn) counts[slug] = (counts[slug] ?? 0) + 1;
  $("roster").replaceChildren(...Object.entries(counts).map(([slug, n]) => {
    const li = document.createElement("li");
    const img = new Image(32, 32);
    img.src = sprites.get(slug).urls.thumb ?? sprites.get(slug).urls.frames(0);
    img.alt = "";
    li.append(img, sprites.get(slug).name, ` × ${n}`);
    return li;
  }));
}

function canvasPoint(event) {
  const r = canvas.getBoundingClientRect();
  return { x: (event.clientX - r.left) * (W / r.width), y: (event.clientY - r.top) * (H / r.height) };
}
canvas.addEventListener("pointerdown", (e) => {
  if (game.over) { newGame(); return; }
  const p = canvasPoint(e);
  fireAt(p.x, p.y);
});
$("launch").addEventListener("click", launchWave);
$("buy").addEventListener("click", buyDefender);
$("repair").addEventListener("click", repair);
document.addEventListener("keydown", (e) => {
  if (e.target.closest?.("input, textarea")) return;
  if (e.key === " ") { e.preventDefault(); launchWave(); }
  else if (e.key === "d" || e.key === "D") buyDefender();
  else if (e.key === "r" || e.key === "R") repair();
});
const showMute = () => { $("mute").textContent = isMuted() ? "Sound: off" : "Sound: on"; $("mute").setAttribute("aria-pressed", String(isMuted())); };
$("mute").addEventListener("click", () => { setMuted(!isMuted()); showMute(); });
showMute();

// Fixed-step loop; pauses when the tab is hidden.
let last = performance.now(), acc = 0;
function frame(now) {
  acc += Math.min(0.25, (now - last) / 1000);
  last = now;
  while (acc >= STEP) { update(STEP); acc -= STEP; }
  render();
  requestAnimationFrame(frame);
}

// For play-test scripts (playtest/): read-only access to the game.
globalThis.orbital = { get game() { return game; }, fireAt, launchWave, buyDefender, repair };

const [planet, weapon, defender] = await Promise.all([
  loadImage(new URL("planets/garden/large/planet.png", PACK_BASE).href),
  loadWeapon("missile-repeater", PACK_BASE),
  loadShip("konex", "advisor", PACK_BASE),   // your patrols: Advisors, so they never look like the enemy
  ...HULLS.map(async ([edition, slug]) => sprites.set(slug, await loadShip(edition, slug, PACK_BASE))),
]);
planetImg = planet; missile = weapon; defenderShip = defender;
newGame();
banner("Orbital Defence", "Buy a patrol or two, then launch the first wave.", false, 2.5);
requestAnimationFrame(frame);
