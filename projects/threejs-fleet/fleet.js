// Fleet Flyby — every ship in the pack, flying in formation, in three.js.
//
// The ships are 2D sprites drawn from above, 36 frames a turn. In 3D each one
// is a billboard (THREE.Sprite, always facing the camera), and every frame we
// pick the sprite frame that matches the ship's heading AS SEEN FROM THE
// CAMERA: its true heading plus the camera's bearing around it. Orbit the view
// and the ships turn the right way, like the "orbit" mode of examples/threejs.
//
// Ships by Paul Richeson (ConEx, 1997–1998). GPL-2.0-or-later.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// The pack root, two folders above this file. In your own project use your
// copy, or https://cdn.jsdelivr.net/gh/yodacon/yodacon-ship-pack@v2.0.0/
// (jsDelivr sends CORS headers, which WebGL textures need).
const PACK = new URL("../../", import.meta.url);

const UNITS_PER_PIXEL = 2.2;               // world size of one sprite pixel
const LAP_SECONDS = 70;                    // one lap of the route
const BACKDROPS = [
  ...["6817", "8882", "12880", "13032", "15129", "16174", "17182", "19066", "24144", "24575", "24685"]
    .map((id) => ({ id, label: `Override landing ${id} (Bryce, 1998)`, path: `override/pictures/${id}.png` })),
  ...["13514", "13515", "13516"].map((id) => ({ id, label: `ConEx landing ${id} (1997)`, path: `conex/pictures/${id}.png` })),
];

const $ = (id) => document.getElementById(id);
const view = $("view");

// --- Renderer, scene, camera ----------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
view.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x02030a);
const camera = new THREE.PerspectiveCamera(50, 1, 5, 20000);
camera.position.set(1500, 900, 1700);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minDistance = 150;
controls.maxDistance = 5000;
controls.autoRotateSpeed = 0.4;
controls.addEventListener("start", () => { zoomIn = false; });   // the visitor took the camera

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();

// Pixel art: sample the nearest texel, no mipmaps, colours in sRGB.
const loader = new THREE.TextureLoader();
async function pixelTexture(url) {
  const t = await loader.loadAsync(url);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  return t;
}

// --- Star field: a shell of points far out -----------------------------------------
{
  const n = 2500, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(7000 + Math.random() * 3000);
    pos.set([v.x, v.y, v.z], i * 3);
  }
  const g = new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xc8d2f0, size: 1.6, sizeAttenuation: false })));
}

// --- Backdrop: a landing picture as a huge, far-away panel ----------------------------
// It hangs ~6000 units out, facing the starting camera, with its edges faded
// into space by an alpha map, so it reads as a planet view behind the fleet.
function softEdges() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#000";
  g.fillRect(0, 0, 256, 256);
  g.filter = "blur(18px)";                    // a white rectangle, blurred: soft on all four sides
  g.fillStyle = "#fff";
  g.fillRect(36, 36, 184, 184);
  return new THREE.CanvasTexture(c);
}
const backdrop = new THREE.Mesh(
  new THREE.PlaneGeometry(1, 1),
  new THREE.MeshBasicMaterial({ color: 0xffffff, alphaMap: softEdges(), transparent: true, fog: false }),
);
backdrop.position.set(-4300, -700, -4700);
backdrop.lookAt(camera.position);
scene.add(backdrop);
async function setBackdrop(b) {
  const tex = await pixelTexture(new URL(b.path, PACK).href);
  const { width, height } = tex.image;
  backdrop.scale.set(width * 16, height * 16, 1);
  backdrop.material.map?.dispose();
  backdrop.material.map = tex;
  backdrop.material.needsUpdate = true;
}
const backdropSelect = $("backdrop");
for (const b of BACKDROPS) backdropSelect.append(new Option(b.label, b.id));
backdropSelect.addEventListener("change", () => setBackdrop(BACKDROPS.find((b) => b.id === backdropSelect.value)));

// --- The route: a closed spline, drawn faintly ------------------------------------------
const route = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, 200, -1300), new THREE.Vector3(1100, 350, -800), new THREE.Vector3(1400, 150, 300),
  new THREE.Vector3(700, 450, 1200), new THREE.Vector3(-600, 250, 1100), new THREE.Vector3(-1400, 100, 200),
  new THREE.Vector3(-1100, 400, -900),
], true, "centripetal");
scene.add(new THREE.Line(
  new THREE.BufferGeometry().setFromPoints(route.getSpacedPoints(400)),
  new THREE.LineBasicMaterial({ color: 0x2f3a62, transparent: true, opacity: 0.6 }),
));

// --- The ships ----------------------------------------------------------------------------
const ships = [];               // { sprite, tex, entry, edition, flight, slot, cols, rows }
let flightCount = 1;            // one flight per edition in catalog.json
const UP = new THREE.Vector3(0, 1, 0);

function setFrame(ship, i) {
  ship.tex.offset.set((i % ship.cols) / ship.cols, 1 - (Math.floor(i / ship.cols) + 1) / ship.rows);
}

async function loadFleet() {
  const r = await fetch(new URL("catalog.json", PACK));
  if (!r.ok) throw new Error(`catalog.json: HTTP ${r.status}`);
  const catalog = await r.json();
  flightCount = catalog.editions.length;
  const jobs = [];
  catalog.editions.forEach((ed, flight) => {
    // Biggest ships lead: sort each flight by sprite size.
    [...ed.ships].sort((a, b) => b.frame_width - a.frame_width).forEach((entry, slot) => {
      jobs.push((async () => {
        const dir = new URL(entry.path, PACK);
        const tex = await pixelTexture(new URL("sheet-alpha.png", dir).href);
        const cols = entry.columns ?? 6, rows = Math.ceil((entry.frames ?? 36) / cols);
        tex.repeat.set(1 / cols, 1 / rows);           // show one cell of the 6×6 sheet
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, alphaTest: 0.5 }));
        sprite.scale.set(entry.frame_width * UNITS_PER_PIXEL, entry.frame_height * UNITS_PER_PIXEL, 1);
        const ship = { sprite, tex, entry, edition: ed, dir, flight, slot, cols, rows, heading: 0 };
        sprite.userData.ship = ship;
        scene.add(sprite);
        ships.push(ship);
      })());
    });
  });
  await Promise.all(jobs);
}

// Formation slot → offset from the flight leader, in the leader's own frame:
// a V, widening and stepping up row by row.
function slotOffset(slot) {
  if (slot === 0) return { back: 0, side: 0, up: 0 };
  const row = Math.ceil(slot / 2), side = slot % 2 ? -1 : 1;
  return { back: row * 120, side: side * row * 95, up: row * 14 };
}

// --- Picking: click a ship to open its card ---------------------------------------------------
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let selected = null, downAt = null;
function shipAt(e) {
  const r = renderer.domElement.getBoundingClientRect();
  pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);           // also sets raycaster.camera, which Sprites need
  const hit = raycaster.intersectObjects(ships.map((s) => s.sprite), false)[0];
  return hit?.object.userData.ship ?? null;
}
renderer.domElement.addEventListener("pointerdown", (e) => { downAt = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener("pointerup", (e) => {
  // A click, not the end of an orbit drag.
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return;
  const ship = shipAt(e);
  if (ship) select(ship); else select(null);
});
renderer.domElement.addEventListener("pointermove", (e) => {
  if (e.buttons) return;
  view.classList.toggle("pointing", Boolean(shipAt(e)));
});
addEventListener("keydown", (e) => {
  if (e.key === "Escape") select(null);
  // Tab-free keyboard access: [ and ] step through the fleet.
  if ((e.key === "]" || e.key === "[") && ships.length) {
    const i = selected ? ships.indexOf(selected) : -1;
    select(ships[(i + (e.key === "]" ? 1 : ships.length - 1)) % ships.length]);
  }
});
$("close").addEventListener("click", () => select(null));

const metaCache = new Map();
let zoomIn = false;                          // ease the camera closer after a pick
async function select(ship) {
  selected = ship;
  zoomIn = Boolean(ship);
  $("card").hidden = !ship;
  $("brackets").hidden = !ship;
  if (!ship) return;
  const { entry, edition, dir } = ship;
  $("card-name").textContent = entry.name;
  $("card-edition").textContent = `${edition.title} (${edition.year}) · ${entry.frame_width}×${entry.frame_height} px`;
  for (const k of ["comm", "yard", "target"]) {
    const img = $(`card-${k}`), file = entry.pictures?.[k];
    img.closest("figure").hidden = !file;
    if (file) { img.src = new URL(file, dir).href; img.alt = `${entry.name}, ${k} picture`; }
  }
  $("card-desc").textContent = entry.description ?? "";
  // ship.json has the escort line too; fetch once.
  if (!metaCache.has(dir.href)) metaCache.set(dir.href, fetch(new URL("ship.json", dir)).then((r) => r.json()).catch(() => ({})));
  const meta = await metaCache.get(dir.href);
  if (selected === ship && meta.escort) $("card-desc").textContent = `${entry.description ?? ""} — “${meta.escort}”`;
}

// --- Animation ------------------------------------------------------------------------------
const clock = new THREE.Clock();
let t = 0;
const tangent = new THREE.Vector3(), right = new THREE.Vector3(), lead = new THREE.Vector3();
const brackets = $("brackets"), projected = new THREE.Vector3();

function update() {
  const dt = Math.min(clock.getDelta(), 0.1);
  if (!$("paused").checked) t += dt;
  controls.autoRotate = $("orbit").checked;

  for (const ship of ships) {
    // Each flight's leader runs the route; the flights are spaced evenly round the lap.
    const u = (t / LAP_SECONDS + ship.flight / flightCount) % 1;
    route.getPointAt(u, lead);
    route.getTangentAt(u, tangent);
    right.crossVectors(tangent, UP).normalize();
    const o = slotOffset(ship.slot);
    ship.sprite.position.copy(lead)
      .addScaledVector(tangent, -o.back)
      .addScaledVector(right, o.side)
      .addScaledVector(UP, o.up + Math.sin(t * 1.3 + ship.slot) * 6);  // a gentle bob

    // The ship's true heading on the XZ plane, degrees clockwise from −Z…
    ship.heading = THREE.MathUtils.radToDeg(Math.atan2(tangent.x, -tangent.z));
    // …and the camera's bearing around the ship (0 when the camera is to its +Z side).
    const p = ship.sprite.position;
    const phi = THREE.MathUtils.radToDeg(Math.atan2(camera.position.x - p.x, camera.position.z - p.z));
    const seen = ((Math.floor((ship.heading + phi) / 10) % 36) + 36) % 36;
    setFrame(ship, seen);
  }

  // Follow: ease the orbit target onto the selected ship, moving the camera with it.
  if (selected && $("follow").checked) {
    const goal = selected.sprite.position;
    const delta = goal.clone().sub(controls.target).multiplyScalar(Math.min(1, dt * 3));
    controls.target.add(delta);
    camera.position.add(delta);
    if (zoomIn) {
      // Close in to ~650 units once; after that, scrolling is the visitor's.
      const offset = camera.position.clone().sub(controls.target);
      if (offset.length() > 650) camera.position.copy(controls.target).add(offset.multiplyScalar(1 - Math.min(0.5, dt * 1.5)));
      else zoomIn = false;
    }
  }
  controls.update();

  // Brackets: project the selected sprite's corners to the screen.
  if (selected) {
    const s = selected.sprite;
    projected.copy(s.position).project(camera);
    const dist = camera.position.distanceTo(s.position);
    const px = (s.scale.x / (2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)))) * innerHeight;
    const size = Math.max(24, px * 0.9);
    const x = (projected.x * 0.5 + 0.5) * innerWidth - size / 2, y = (-projected.y * 0.5 + 0.5) * innerHeight - size / 2;
    brackets.style.width = brackets.style.height = `${size}px`;
    brackets.style.transform = `translate(${x}px, ${y}px)`;
    brackets.hidden = projected.z > 1;               // behind the camera
  }
  renderer.render(scene, camera);
}

// --- Start ------------------------------------------------------------------------------------
try {
  await Promise.all([loadFleet(), setBackdrop(BACKDROPS[0])]);
  $("status").textContent = `${ships.length} ships in ${flightCount} flights. Drag to orbit, scroll to zoom, click a ship (or press [ ]).`;
  renderer.setAnimationLoop(update);
} catch (err) {
  $("status").textContent = `Could not load the fleet: ${err.message}`;
  console.error(err);
}
