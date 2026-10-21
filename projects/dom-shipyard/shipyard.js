// Shipyard — an Escape Velocity-style shipyard in plain DOM.
//
// No canvas, no framework, no build step: catalog.json lists the ships, each
// ship.json has its stats and 1997/98 description, and the pictures are <img>s.
// The turning ship is a single <div> whose background is sheet-alpha.png,
// shifted with background-position (frame = floor(heading / 10) mod 36).
//
// Ships by Paul Richeson (ConEx, 1997–1998). GPL-2.0-or-later.

// Where the pack lives. This file sits in projects/dom-shipyard/, two folders
// below the pack root. In your own project, point this at your copy of the
// pack, or at https://cdn.jsdelivr.net/gh/yodacon/yodacon-ship-pack@v1.0.0/
const PACK = new URL("../../", import.meta.url);

const START_CREDITS = 25_000_000;
const SAVE_KEY = "yodacon-ship-pack:shipyard";
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const $ = (id) => document.getElementById(id);
const fmt = new Intl.NumberFormat("en-US");
const money = (n) => `${fmt.format(n)} cr`;

// --- Saved game (localStorage can be missing or throw: private mode, blocked
// storage, sandboxed previews — the yard still works, it just forgets) -------
function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (s && Number.isFinite(s.credits) && Array.isArray(s.fleet)) return s;
  } catch { /* fall through */ }
  return { credits: START_CREDITS, fleet: [] };
}
function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state.save)); } catch { /* not persisted */ }
}

// --- Data ------------------------------------------------------------------------
const state = {
  save: loadSave(),
  ships: [],          // flat list of catalog entries, each with .edition and .editionTitle
  selected: null,     // the catalog entry on show
  meta: null,         // its ship.json
  heading: 0,
  spinning: !reduceMotion,
};

const metaCache = new Map();
function shipMeta(ship) {
  if (!metaCache.has(ship.id)) {
    metaCache.set(ship.id, fetch(new URL("ship.json", ship.dir)).then((r) => {
      if (!r.ok) throw new Error(`ship.json: HTTP ${r.status}`);
      return r.json();
    }));
  }
  return metaCache.get(ship.id);
}

async function loadCatalog() {
  const r = await fetch(new URL("catalog.json", PACK));
  if (!r.ok) throw new Error(`catalog.json: HTTP ${r.status}`);
  const catalog = await r.json();
  for (const ed of catalog.editions) {
    for (const s of ed.ships) {
      state.ships.push({
        ...s,
        id: `${ed.key}/${s.slug}`,
        edition: ed.key,
        editionTitle: `${ed.title} (${ed.year})`,
        dir: new URL(s.path, PACK),
      });
    }
  }
  // Prices live in each ship.json; fetch them all up front for the list.
  await Promise.all(state.ships.map(async (s) => { s.cost = (await shipMeta(s)).stats?.Cost ?? 0; }));
}

// --- Ship list (a listbox: ↑ ↓ Home End move the selection) ----------------------
const list = $("ship-list");
function renderList() {
  list.replaceChildren();
  let lastEdition = null;
  for (const s of state.ships) {
    if (s.edition !== lastEdition) {
      lastEdition = s.edition;
      const g = document.createElement("div");
      g.className = "group";
      g.setAttribute("role", "presentation");
      g.textContent = s.editionTitle;
      list.append(g);
    }
    const opt = document.createElement("div");
    opt.className = "option";
    opt.id = `opt-${s.edition}-${s.slug}`;
    opt.setAttribute("role", "option");
    opt.dataset.id = s.id;
    const img = new Image(36, 36);
    img.className = "thumb";
    img.alt = "";
    // Not every ship has an icon (thumb); fall back to its first rotation frame.
    img.src = new URL(s.pictures?.thumb ?? "frames/09.png", s.dir);
    const name = document.createElement("span");
    name.textContent = s.name;
    const cost = document.createElement("span");
    cost.className = "cost";
    opt.append(img, name, cost);
    opt.addEventListener("click", () => select(s.id));
    list.append(opt);
  }
  refreshList();
}
function refreshList() {
  const owned = new Set(state.save.fleet.map((f) => f.id));
  for (const opt of list.querySelectorAll(".option")) {
    const s = state.ships.find((x) => x.id === opt.dataset.id);
    const sel = s === state.selected;
    opt.setAttribute("aria-selected", String(sel));
    if (sel) {
      list.setAttribute("aria-activedescendant", opt.id);
      // Keep the selection visible inside the list without scrolling the page.
      if (opt.offsetTop < list.scrollTop || opt.offsetTop + opt.offsetHeight > list.scrollTop + list.clientHeight) {
        list.scrollTop = opt.offsetTop - list.clientHeight / 2 + opt.offsetHeight / 2;
      }
    }
    opt.querySelector(".cost").innerHTML = owned.has(s.id) ? '<span class="owned-mark" title="In your fleet">✓</span>' : "";
    opt.querySelector(".cost").append(s.cost ? `${fmt.format(Math.round(s.cost / 1000))}k` : "—");
  }
}
list.addEventListener("keydown", (e) => {
  const i = state.ships.indexOf(state.selected);
  const to = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: state.ships.length - 1 }[e.key];
  if (to === undefined) {
    if (e.key === "Enter") $("buy").focus();
    return;
  }
  e.preventDefault();
  const s = state.ships[Math.max(0, Math.min(state.ships.length - 1, to))];
  select(s.id);
});

// --- Detail ------------------------------------------------------------------------
const STAT_ROWS = [
  ["Cost", "Price", (v) => (v ? money(v) : "not sold")],
  ["Speed", "Top speed"],
  ["Accel", "Acceleration"],
  ["Maneuver", "Turn rate"],
  ["Shield", "Shields"],
  ["ShieldRe", "Shield recharge"],
  ["Armor", "Armour"],
  ["Holds", "Cargo space", (v) => `${fmt.format(v)} tons`],
  ["Fuel", "Fuel", (v) => `${fmt.format(v)} (${Math.floor(v / 100)} jumps)`],
  ["FreeMass", "Free mass", (v) => `${fmt.format(v)} tons`],
  ["Mass", "Mass", (v) => `${fmt.format(v)} tons`],
  ["Length", "Length", (v) => `${fmt.format(v)} m`],
  ["Crew", "Crew"],
  ["MaxGun", "Gun mounts"],
  ["MaxTur", "Turret mounts"],
  ["TechLevel", "Tech level"],
];

async function select(id, { pushHash = true } = {}) {
  const ship = state.ships.find((s) => s.id === id) ?? state.ships[0];
  state.selected = ship;
  refreshList();
  if (pushHash && location.hash.slice(1) !== ship.id) history.replaceState(null, "", `#${ship.id}`);
  const detail = $("detail");
  detail.setAttribute("aria-busy", "true");
  const meta = await shipMeta(ship);
  if (state.selected !== ship) return; // a newer click won the race
  state.meta = meta;

  $("name").textContent = ship.name;
  $("edition").textContent = `${ship.editionTitle} · ${meta.sprite.frame_width}×${meta.sprite.frame_height} px sprite`;
  for (const k of ["yard", "comm", "target"]) {
    const img = $(k);
    const file = ship.pictures?.[k];
    img.hidden = !file;
    if (file) {
      img.src = new URL(file, ship.dir);
      img.alt = `${ship.name}, ${k === "target" ? "target display" : k + " picture"}`;
    }
  }
  $("description").textContent = meta.description ?? "";
  $("escort").textContent = meta.escort ? `Escort: “${meta.escort}”` : "";
  $("stats").replaceChildren(...STAT_ROWS.filter(([k]) => meta.stats?.[k] != null).map(([k, label, f]) => {
    const tr = document.createElement("tr");
    const th = document.createElement("th");
    th.scope = "row";
    th.textContent = label;
    const td = document.createElement("td");
    td.textContent = f ? f(meta.stats[k]) : fmt.format(meta.stats[k]);
    tr.append(th, td);
    return tr;
  }));
  setupSprite(ship, meta);
  $("buy-note").textContent = "";
  $("buy-note").className = "muted";
  refreshWallet();
  detail.setAttribute("aria-busy", "false");
}

// --- The turning sprite --------------------------------------------------------------
const sprite = $("sprite"), spinBox = $("spin-box");
let scale = 1;
function setupSprite(ship, meta) {
  const { frame_width: w, frame_height: h, columns: cols, frames } = meta.sprite;
  const box = Math.min(spinBox.clientWidth || 240, 280);
  scale = Math.max(1, Math.floor((box * 0.8) / Math.max(w, h)));    // whole numbers only
  sprite.style.width = `${w * scale}px`;
  sprite.style.height = `${h * scale}px`;
  sprite.style.backgroundImage = `url("${new URL("sheet-alpha.png", ship.dir)}")`;
  sprite.style.backgroundSize = `${cols * w * scale}px ${Math.ceil(frames / cols) * h * scale}px`;
  spinBox.setAttribute("aria-label", `${ship.name}, turning. Drag, or use the arrow keys, to turn it.`);
  drawFrame();
}
function drawFrame() {
  if (!state.meta) return;
  const { frame_width: w, frame_height: h, columns: cols } = state.meta.sprite;
  const heading = ((state.heading % 360) + 360) % 360;
  const frame = Math.floor(heading / 10) % 36;
  sprite.style.backgroundPosition = `${-(frame % cols) * w * scale}px ${-Math.floor(frame / cols) * h * scale}px`;
  $("heading").textContent = `${frame * 10}°`;
}

// requestAnimationFrame drives the spin: 45° a second, paused while dragging.
let last = performance.now(), dragging = null;
function tick(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (state.spinning && !dragging) {
    state.heading = (state.heading + 45 * dt) % 360;
    drawFrame();
  }
  requestAnimationFrame(tick);
}

// Drag like a dial: the ship follows the pointer's angle around the centre.
const angleAt = (e) => {
  const r = spinBox.getBoundingClientRect();
  return Math.atan2(e.clientX - (r.left + r.width / 2), -(e.clientY - (r.top + r.height / 2))) * 180 / Math.PI;
};
spinBox.addEventListener("pointerdown", (e) => {
  spinBox.setPointerCapture(e.pointerId);
  spinBox.classList.add("dragging");
  dragging = { from: angleAt(e), heading: state.heading };
});
spinBox.addEventListener("pointermove", (e) => {
  if (!dragging) return;
  state.heading = dragging.heading + angleAt(e) - dragging.from;
  drawFrame();
});
const endDrag = () => { dragging = null; spinBox.classList.remove("dragging"); };
spinBox.addEventListener("pointerup", endDrag);
spinBox.addEventListener("pointercancel", endDrag);
spinBox.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
    e.preventDefault();
    setSpinning(false);
    state.heading = Math.round(state.heading / 10) * 10 + (e.key === "ArrowLeft" ? -10 : 10);
    drawFrame();
  } else if (e.key === " " || e.key === "Enter") {
    e.preventDefault();
    setSpinning(!state.spinning);
  }
});
function setSpinning(on) {
  state.spinning = on;
  $("autospin").setAttribute("aria-pressed", String(on));
  $("autospin").textContent = on ? "Spinning" : "Spin";
}
$("autospin").addEventListener("click", () => setSpinning(!state.spinning));

// --- Buying and the fleet ----------------------------------------------------------
function refreshWallet() {
  $("credits").textContent = money(state.save.credits);
  const s = state.selected;
  if (!s) return;
  $("price").textContent = s.cost ? money(s.cost) : "not for sale";
  const buy = $("buy");
  buy.disabled = !s.cost || s.cost > state.save.credits;
  buy.textContent = !s.cost ? "Not sold" : s.cost > state.save.credits ? "Can’t afford" : `Buy ${s.name}`;
}

$("buy").addEventListener("click", () => {
  const s = state.selected;
  if (!s?.cost || s.cost > state.save.credits) return;
  state.save.credits -= s.cost;
  state.save.fleet.push({ id: s.id, name: s.name, edition: s.edition, cost: s.cost, bought: Date.now() });
  save();
  const note = $("buy-note");
  note.textContent = `The ${s.name} is yours. ${money(state.save.credits)} left.`;
  note.className = "ok";
  renderFleet();
  refreshWallet();
  refreshList();
});

function renderFleet() {
  const ul = $("fleet");
  ul.replaceChildren();
  $("fleet-empty").hidden = state.save.fleet.length > 0;
  state.save.fleet.forEach((f, i) => {
    const s = state.ships.find((x) => x.id === f.id);
    if (!s) return;
    const li = document.createElement("li");
    const img = new Image(36, 36);
    img.className = "thumb";
    img.alt = "";
    img.src = new URL(s.pictures?.thumb ?? "frames/09.png", s.dir);
    const label = document.createElement("span");
    label.innerHTML = `<button type="button" class="ghost small linkish"></button><small></small>`;
    label.querySelector("button").textContent = s.name;
    label.querySelector("button").addEventListener("click", () => select(s.id));
    label.querySelector("small").textContent = s.edition === "conex" ? "ConEx 1.2" : "Override 1.0";
    const sell = document.createElement("button");
    sell.type = "button";
    sell.className = "ghost small";
    sell.textContent = "Sell";
    sell.title = `Sell for ${money(Math.floor(f.cost / 2))} (half price)`;
    sell.setAttribute("aria-label", `Sell ${s.name} for ${money(Math.floor(f.cost / 2))}`);
    sell.addEventListener("click", () => {
      state.save.credits += Math.floor(f.cost / 2);
      state.save.fleet.splice(i, 1);
      save();
      renderFleet();
      refreshWallet();
      refreshList();
      $("buy-note").textContent = `Sold the ${s.name}.`;
      $("buy-note").className = "muted";
    });
    li.append(img, label, sell);
    ul.append(li);
  });
}

$("restart").addEventListener("click", () => {
  if (state.save.fleet.length && !confirm("Start over with a new pilot? Your fleet and credits are reset.")) return;
  state.save = { credits: START_CREDITS, fleet: [] };
  save();
  renderFleet();
  refreshWallet();
  refreshList();
});

addEventListener("hashchange", () => select(location.hash.slice(1), { pushHash: false }));

// --- Start ------------------------------------------------------------------------------
try {
  await loadCatalog();
  renderList();
  renderFleet();
  setSpinning(state.spinning);
  await select(location.hash.slice(1) || "conex/yodacon", { pushHash: false });
  requestAnimationFrame(tick);
} catch (err) {
  $("name").textContent = "The shipyard could not open";
  $("description").textContent = `${err.message}. Serve the pack over http(s) (for example "make serve") rather than opening the file directly.`;
  console.error(err);
}
