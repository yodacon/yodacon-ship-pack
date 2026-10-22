// The whole game runs here, off the main thread: loading, simulation and
// drawing. The page only forwards keys and shows the counts this posts back.
import { loadShipMeta, drawShip, frameIndex } from "../../lib/yodacon-ship-pack.js";

let ctx, W, H, flagship, kinds = [], fleet = [], frames = 0;
const keys = {};
const s = { x: 0, y: 0, vx: 0, vy: 0, heading: 0 };

// A worker has no <img>, so the sheet is fetched and decoded into an
// ImageBitmap, which drawImage takes like an image.
async function loadShipBitmap(edition, slug) {
  const ship = await loadShipMeta(edition, slug);
  ship.sheet = await createImageBitmap(await (await fetch(ship.urls.sheet)).blob());
  return ship;
}

function setFleet(n) {
  fleet = Array.from({ length: n }, (_, i) => ({
    ship: kinds[i % kinds.length],
    x: Math.random() * W, y: Math.random() * H,
    heading: Math.random() * 360,
    speed: 30 + Math.random() * 60,
    turn: (Math.random() - 0.5) * 60,             // degrees a second, so each flies a slow circle
  }));
}

function update(dt) {
  for (const f of fleet) {
    f.heading = (f.heading + f.turn * dt + 360) % 360;
    const a = (frameIndex(f.heading) * 10 * Math.PI) / 180;   // move along the frame shown
    f.x = (f.x + Math.sin(a) * f.speed * dt + W) % W;
    f.y = (f.y - Math.cos(a) * f.speed * dt + H) % H;
  }
  const st = flagship.meta.stats ?? {};
  if (keys.ArrowLeft) s.heading -= (st.Maneuver || 3) * 40 * dt;
  if (keys.ArrowRight) s.heading += (st.Maneuver || 3) * 40 * dt;
  s.heading = (s.heading + 360) % 360;
  if (keys.ArrowUp) {
    const a = (frameIndex(s.heading) * 10 * Math.PI) / 180;
    s.vx += Math.sin(a) * (st.Accel || 300) * 0.6 * dt;
    s.vy -= Math.cos(a) * (st.Accel || 300) * 0.6 * dt;
  }
  const v = Math.hypot(s.vx, s.vy), max = (st.Speed || 300) * 0.6;
  if (v > max) { s.vx *= max / v; s.vy *= max / v; }
  s.x = (s.x + s.vx * dt + W) % W;
  s.y = (s.y + s.vy * dt + H) % H;
}

function draw() {
  ctx.fillStyle = "#05060b";
  ctx.fillRect(0, 0, W, H);
  for (const f of fleet) drawShip(ctx, f.ship, f.heading, f.x, f.y, 1);
  drawShip(ctx, flagship, s.heading, s.x, s.y, flagship.sprite.frame_width > 64 ? 1 : 2);
}

// requestAnimationFrame exists in dedicated workers that own an
// OffscreenCanvas; a timer stands in where it does not.
const nextFrame = self.requestAnimationFrame?.bind(self) ?? ((cb) => setTimeout(() => cb(performance.now()), 16));
const STEP = 1 / 60;
let last = 0, acc = 0, shown = 0, lastReport = 0;
function tick(now) {
  acc += Math.min(0.25, (now - last) / 1000);
  last = now;
  while (acc >= STEP) { update(STEP); acc -= STEP; }
  draw();
  frames++;
  if (now - lastReport >= 500) {                   // twice a second, tell the page how it is going
    postMessage({ type: "stats", fps: Math.round(((frames - shown) * 1000) / (now - lastReport)), frames, ships: fleet.length + 1 });
    shown = frames;
    lastReport = now;
  }
  nextFrame(tick);
}

onmessage = async ({ data: m }) => {
  if (m.type === "start") {
    ctx = m.canvas.getContext("2d");
    ({ width: W, height: H } = m.canvas);
    [flagship, ...kinds] = await Promise.all([
      loadShipBitmap(m.edition, m.ship),
      ...[["conex", "gryphon"], ["conex", "trident"], ["conex", "defender"], ["conex", "necromancer"], ["conex", "tomaquad"], ["conex", "dart"], ["override", "callisto"]].map(([ed, slug]) => loadShipBitmap(ed, slug)),
    ]);
    Object.assign(s, { x: W / 2, y: H / 2 });
    setFleet(m.fleet);
    postMessage({ type: "ready", name: flagship.name });
    last = lastReport = performance.now();
    nextFrame(tick);
  }
  if (m.type === "key") keys[m.key] = m.down;
  if (m.type === "fleet" && kinds.length) setFleet(m.n);
};
