// Hangar — one ship on a turntable, in three.js.
//
// The ship is a flat sprite drawn from above in 36 rotations. Here it stands on
// a pedestal as a billboard that always turns its face to the camera (about the
// vertical axis only), optionally leaning back. The pedestal really rotates;
// the sprite never does — instead, every frame we show the rotation frame that
// matches the turntable's angle as seen from where the camera stands. That is
// what makes a 2D sprite look like a solid model under an orbiting camera.
//
// Ships by Paul Richeson (ConEx, 1997–1998). GPL-2.0-or-later.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// The pack root, two folders above this file. In your own project use your
// copy, or https://cdn.jsdelivr.net/gh/yodacon/yodacon-ship-pack@v1.0.0/
const PACK = new URL("../../", import.meta.url);

const $ = (id) => document.getElementById(id);
const deg = THREE.MathUtils.radToDeg, toRad = THREE.MathUtils.degToRad;
const wrap360 = (d) => ((d % 360) + 360) % 360;

// --- Renderer, scene, camera ------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
$("view").append(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07090f);
scene.fog = new THREE.Fog(0x07090f, 900, 2400);             // the far end of the hangar fades out
const camera = new THREE.PerspectiveCamera(48, 1, 5, 5000);
camera.position.set(330, 300, 720);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 170, 0);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 260;
controls.maxDistance = 1150;
controls.minPolarAngle = toRad(25);
controls.maxPolarAngle = toRad(88);                          // stay above the floor
function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();

// A canvas → texture helper for the procedural bits (floor plates, labels).
function canvasTexture(w, h, draw, repeat) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}
// Pack pictures: pixel art, so nearest-neighbour and no mipmaps.
const loader = new THREE.TextureLoader();
async function pixelTexture(url) {
  const t = await loader.loadAsync(url);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  return t;
}

// --- The hangar --------------------------------------------------------------------------
const ROOM = { w: 1800, d: 1500, h: 640, z: -250 };          // centred on the pedestal in x, deeper behind it
const metal = new THREE.MeshStandardMaterial({ color: 0x343b52, roughness: 0.75, metalness: 0.35 });
const darkMetal = new THREE.MeshStandardMaterial({ color: 0x1b2032, roughness: 0.6, metalness: 0.6 });
{
  // Walls and ceiling: the inside of a box.
  const walls = new THREE.Mesh(new THREE.BoxGeometry(ROOM.w, ROOM.h, ROOM.d), metal.clone());
  walls.material.side = THREE.BackSide;
  walls.position.set(0, ROOM.h / 2, ROOM.z);
  scene.add(walls);

  // Floor: deck plates drawn on a canvas and tiled.
  const plates = canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = "#23283a"; g.fillRect(0, 0, w, h);
    g.strokeStyle = "#151926"; g.lineWidth = 6; g.strokeRect(0, 0, w, h);
    g.strokeStyle = "#2f3550"; g.lineWidth = 2; g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = "#3a415e";
    for (const [x, y] of [[20, 20], [w - 20, 20], [20, h - 20], [w - 20, h - 20]]) { g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); }
  }, [ROOM.w / 200, ROOM.d / 200]);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.d),
    new THREE.MeshStandardMaterial({ map: plates, roughness: 0.55, metalness: 0.4 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0.5, ROOM.z);
  scene.add(floor);

  // Hazard ring around the pedestal.
  const stripes = canvasTexture(512, 32, (g, w, h) => {
    g.fillStyle = "#1a1a1a"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#d9a520";
    for (let x = -h; x < w + h; x += 32) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 16, h); g.lineTo(x + 16 + h, 0); g.lineTo(x + h, 0); g.fill(); }
  }, [6, 1]);
  const ring = new THREE.Mesh(new THREE.RingGeometry(205, 228, 96, 1),
    new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.8 }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 1;
  scene.add(ring);

  // Structural ribs across the ceiling and up the walls.
  for (let z = ROOM.z - ROOM.d / 2 + 150; z < ROOM.z + ROOM.d / 2; z += 300) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(ROOM.w, 30, 40), darkMetal);
    rib.position.set(0, ROOM.h - 15, z);
    scene.add(rib);
    for (const x of [-ROOM.w / 2 + 15, ROOM.w / 2 - 15]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(30, ROOM.h, 40), darkMetal);
      post.position.set(x, ROOM.h / 2, z);
      scene.add(post);
    }
    // A strip light under each rib.
    const strip = new THREE.Mesh(new THREE.BoxGeometry(ROOM.w * 0.6, 4, 10),
      new THREE.MeshBasicMaterial({ color: 0xcfe0ff }));
    strip.position.set(0, ROOM.h - 32, z);
    scene.add(strip);
  }
}

// --- Lights -------------------------------------------------------------------------------
// decay: 0 keeps intensities simple (no inverse-square falloff) for a small scene.
scene.add(new THREE.HemisphereLight(0x9aa8d8, 0x1a1c24, 0.9));
const key = new THREE.SpotLight(0xfff1dc, 3.2, 0, toRad(26), 0.45, 0);
key.position.set(0, ROOM.h - 40, 120);
key.target.position.set(0, 0, 0);
scene.add(key, key.target);
const rim = new THREE.PointLight(0x6b8cff, 1.2, 0, 0);
rim.position.set(-500, 300, -500);
scene.add(rim);

// --- The turntable ----------------------------------------------------------------------------
const TOP = 56;                                              // height of the turntable's surface
const base = new THREE.Mesh(new THREE.CylinderGeometry(190, 200, 36, 64), darkMetal);
base.position.y = 18;
scene.add(base);
const turntable = new THREE.Group();
turntable.position.y = 36;
scene.add(turntable);
{
  const top = new THREE.Mesh(new THREE.CylinderGeometry(175, 175, 20, 64),
    new THREE.MeshStandardMaterial({ color: 0x4a5272, roughness: 0.35, metalness: 0.7 }));
  top.position.y = 10;
  turntable.add(top);
  const glow = new THREE.Mesh(new THREE.TorusGeometry(175, 3, 8, 96), new THREE.MeshBasicMaterial({ color: 0x7ef0a8 }));
  glow.rotation.x = Math.PI / 2;
  glow.position.y = 20;
  turntable.add(glow);
  // Rim studs, so the rotation is visible, and an arrow marking the ship's nose (−Z).
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const stud = new THREE.Mesh(new THREE.BoxGeometry(10, 6, 18), darkMetal);
    stud.position.set(Math.sin(a) * 160, 22, Math.cos(a) * 160);
    stud.rotation.y = a;
    turntable.add(stud);
  }
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(12, 30, 3), new THREE.MeshBasicMaterial({ color: 0xffcf6b }));
  arrow.rotation.x = -Math.PI / 2;
  arrow.position.set(0, 24, -150);
  turntable.add(arrow);
}

// --- The ship: a billboard showing one cell of the sheet ---------------------------------------
const shipPivot = new THREE.Group();
shipPivot.rotation.order = "YXZ";                            // yaw to face the camera, then lean back
scene.add(shipPivot);
const shipMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
  new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }));
shipPivot.add(shipMesh);
// A soft contact shadow under the ship, so it sits on the table.
const shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({
  color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false,
  alphaMap: canvasTexture(64, 64, (g) => {
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, "#fff"); r.addColorStop(1, "#000");
    g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  }),
}));
shadow.rotation.x = -Math.PI / 2;
shadow.position.y = TOP + 0.5;
scene.add(shadow);

// --- Monitors on the back wall: yard, target, comm ----------------------------------------------
const monitors = {};
function monitor(key, label, w, h, x) {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 28, h + 28, 16), darkMetal);
  const bezel = new THREE.Mesh(new THREE.PlaneGeometry(w + 10, h + 10), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  bezel.position.z = 8.5;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }));
  screen.position.z = 9;
  const tag = new THREE.Mesh(new THREE.PlaneGeometry(340, 34.5), new THREE.MeshBasicMaterial({   // same aspect as its canvas
    transparent: true, fog: false,
    map: canvasTexture(512, 52, (c, cw, ch) => {
      c.fillStyle = "#ffcf6b"; c.font = "bold 34px ui-monospace, Menlo, monospace"; c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText(label, cw / 2, ch / 2);
    }),
  }));
  tag.position.set(0, h / 2 + 38, 9);
  g.add(frame, bezel, screen, tag);
  g.position.set(x, 380, ROOM.z - ROOM.d / 2 + 12);
  scene.add(g);
  // The screens light the wall a little.
  const glow = new THREE.PointLight(0x9fd8ff, 0.35, 500, 0);
  glow.position.set(x, 380, ROOM.z - ROOM.d / 2 + 120);
  scene.add(glow);
  monitors[key] = screen;
}
monitor("yard", "SHIPYARD", 220, 220, -470);
monitor("target", "TARGET", 384, 192, 0);
monitor("comm", "COMM", 220, 220, 470);

// --- Ship loading -----------------------------------------------------------------------------------
let ships = [], current = null, loadId = 0;
const sheet = { tex: null, cols: 6, rows: 6, w: 1, h: 1 };

function setFrame(i) {
  sheet.tex.offset.set((i % sheet.cols) / sheet.cols, 1 - (Math.floor(i / sheet.cols) + 1) / sheet.rows);
}

async function showShip(id) {
  const ship = ships.find((s) => s.id === id) ?? ships.find((s) => s.id === "conex/yodacon") ?? ships[0];
  const my = ++loadId;
  current = ship;
  $("ship").value = ship.id;
  if (location.hash.slice(1) !== ship.id) history.replaceState(null, "", `#${ship.id}`);
  $("name").textContent = ship.name;
  $("edition").textContent = `${ship.editionTitle} · ${ship.frame_width}×${ship.frame_height} px sprite`;

  const pics = ["target", "yard", "comm"].filter((k) => ship.pictures?.[k]);
  const [metaRes, tex, ...picTex] = await Promise.all([
    fetch(new URL("ship.json", ship.dir)).then((r) => r.json()),
    pixelTexture(new URL("sheet-alpha.png", ship.dir).href),
    ...pics.map((k) => pixelTexture(new URL(ship.pictures[k], ship.dir).href)),
  ]);
  if (my !== loadId) { tex.dispose(); picTex.forEach((t) => t.dispose()); return; }   // a newer pick won

  // Sprite sheet → one-cell window.
  sheet.tex?.dispose();
  sheet.tex = tex;
  sheet.cols = metaRes.sprite.columns;
  sheet.rows = Math.ceil(metaRes.sprite.frames / sheet.cols);
  tex.repeat.set(1 / sheet.cols, 1 / sheet.rows);
  shipMesh.material.map = tex;
  shipMesh.material.needsUpdate = true;
  // Size: big ships stay bigger, but everything fits the table.
  const px = Math.max(metaRes.sprite.frame_width, metaRes.sprite.frame_height);
  const unitsPerPixel = Math.min(5, 270 / px);
  sheet.w = metaRes.sprite.frame_width * unitsPerPixel;
  sheet.h = metaRes.sprite.frame_height * unitsPerPixel;
  shipMesh.scale.set(sheet.w, sheet.h, 1);
  shadow.scale.setScalar(sheet.w * 0.42);

  // Monitors.
  for (const k of ["target", "yard", "comm"]) {
    const m = monitors[k].material;
    m.map?.dispose();
    const i = pics.indexOf(k);
    m.map = i >= 0 ? picTex[i] : null;
    m.color.set(i >= 0 ? 0xffffff : 0x0a0d18);              // no picture: a dark screen
    m.needsUpdate = true;
  }

  // Info panel.
  const s = metaRes.stats ?? {};
  const rows = [["Price", s.Cost ? `${s.Cost.toLocaleString("en-US")} cr` : "not sold"], ["Speed", s.Speed], ["Accel", s.Accel],
    ["Turn", s.Maneuver], ["Shield", s.Shield], ["Armour", s.Armor], ["Cargo", s.Holds != null ? `${s.Holds} t` : null], ["Crew", s.Crew]];
  $("stats").replaceChildren(...rows.filter(([, v]) => v != null).flatMap(([k, v]) => {
    const dt = document.createElement("dt"), dd = document.createElement("dd");
    dt.textContent = k; dd.textContent = String(v);
    return [dt, dd];
  }));
  $("desc").textContent = metaRes.description ?? "";
}

async function loadCatalog() {
  const r = await fetch(new URL("catalog.json", PACK));
  if (!r.ok) throw new Error(`catalog.json: HTTP ${r.status}`);
  const catalog = await r.json();
  const select = $("ship");
  for (const ed of catalog.editions) {
    const group = document.createElement("optgroup");
    group.label = `${ed.title} (${ed.year})`;
    for (const s of ed.ships) {
      const ship = { ...s, id: `${ed.key}/${s.slug}`, editionTitle: `${ed.title} (${ed.year})`, dir: new URL(s.path, PACK) };
      ships.push(ship);
      group.append(new Option(s.name, ship.id));
    }
    select.append(group);
  }
}

// --- Controls ---------------------------------------------------------------------------------------
const step = (d) => showShip(ships[(ships.indexOf(current) + d + ships.length) % ships.length].id);
$("prev").addEventListener("click", () => step(-1));
$("next").addEventListener("click", () => step(1));
$("ship").addEventListener("change", (e) => showShip(e.target.value));
addEventListener("hashchange", () => showShip(location.hash.slice(1)));
const speed = $("speed"), lean = $("lean");
speed.addEventListener("input", () => { $("speed-out").textContent = `${speed.value}°/s`; });
lean.addEventListener("input", () => { $("lean-out").textContent = `${lean.value}°`; });
if (matchMedia("(prefers-reduced-motion: reduce)").matches) { speed.value = 0; $("speed-out").textContent = "0°/s"; }

// --- Animation ----------------------------------------------------------------------------------------
const clock = new THREE.Clock();
function update() {
  const dt = Math.min(clock.getDelta(), 0.1);
  turntable.rotation.y += toRad(Number(speed.value)) * dt;
  controls.update();

  if (sheet.tex) {
    // The turntable turns counter-clockwise (seen from above) as rotation.y grows,
    // so the ship's heading — degrees clockwise from −Z — is −rotation.y.
    const heading = wrap360(-deg(turntable.rotation.y));
    // Camera bearing around the pedestal: 0 when the camera is on the +Z side.
    const phi = deg(Math.atan2(camera.position.x, camera.position.z));
    const frame = Math.floor(wrap360(heading + phi) / 10) % 36;
    setFrame(frame);

    // Billboard: face the camera about the vertical axis, lean back, sit on the table.
    const leanRad = toRad(Number(lean.value));
    shipPivot.rotation.set(-leanRad, toRad(phi), 0);
    shipPivot.position.set(0, TOP + (sheet.h / 2) * Math.cos(leanRad) + 2, 0);
    $("readout").textContent = `turntable ${heading.toFixed(0).padStart(3)}° · camera ${wrap360(phi).toFixed(0).padStart(3)}° · frame ${String(frame).padStart(2, "0")}`;
  }
  renderer.render(scene, camera);
}

// --- Start -----------------------------------------------------------------------------------------------
try {
  await loadCatalog();
  await showShip(location.hash.slice(1));
  renderer.setAnimationLoop(update);
} catch (err) {
  $("name").textContent = "The hangar could not open";
  $("desc").textContent = `${err.message}. Serve the pack over http(s), e.g. “make serve”.`;
  console.error(err);
}
