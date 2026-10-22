// Fleet Tactics: draft a fleet within a budget, then fight card by card.
// Plain DOM. Each card's numbers come from the ship's 1997 record:
//   hull       round(1.2 × √(Shield + Armor))
//   firepower  4 + 2 × guns carried + Maneuver
//   initiative Speed (who acts first each round)
// konex's two ships, which have konex stats instead, use their own.
// Once a battle, a broadside: on your turn every ship you have left fires at
// one target, each at half its firepower. On Admiral the computer drafts
// with 72 to your 60, from a bigger offer.
import { loadCatalog, loadShipMeta } from "../../lib/yodacon-ship-pack.js";
import { play, isMuted, setMuted } from "../../lib/yodacon-sound.js";

const $ = (id) => document.getElementById(id);
const BUDGET = 60, OFFER = 8, AI_DELAY = 700;

let pool = [], phase = "draft", offer = [], picked = new Set(), mine = [], theirs = [];
let queue = [], active = null, busy = false, broadside = "ready", level = "standard";
const LEVELS = { standard: { budget: BUDGET, offer: OFFER }, admiral: { budget: 72, offer: 10 } };

function cardStats(meta) {
  const s = meta.stats;
  if (s.Shield === undefined) {                          // konex: MaxVelocity, TurnSpeed, Damage
    return { hp: 30, atk: 8 + Math.round(s.TurnSpeed / 20), speed: s.MaxVelocity * 0.35 };
  }
  const guns = (s.WeapCount ?? []).reduce((a, b) => a + Math.max(0, b), 0);
  return { hp: Math.round(1.2 * Math.sqrt(s.Shield + s.Armor)), atk: 4 + 2 * guns + s.Maneuver, speed: s.Speed };
}
const costOf = (c) => Math.max(5, Math.round((c.maxHp + c.atk * 1.4) / 4));

async function buildPool() {
  const catalog = await loadCatalog();
  const entries = catalog.editions.flatMap((ed) => ed.ships.map((s) => ({ ...s, edTitle: ed.title, edKey: ed.key })))
    .filter((s) => s.slug !== "quarter-defender");
  pool = await Promise.all(entries.map(async (e) => {
    const meta = await loadShipMeta(e.edKey, e.slug);
    const st = cardStats(meta.meta);
    return { id: `${e.edKey}/${e.slug}`, name: e.name, edition: e.edTitle, comm: e.urls.comm ?? e.urls.frames(0),
      maxHp: st.hp, atk: st.atk, speed: st.speed };
  }));
  for (const c of pool) c.cost = costOf(c);
}

const sample = (n, exclude = new Set()) => {
  const left = pool.filter((c) => !exclude.has(c.id));
  for (let i = left.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [left[i], left[j]] = [left[j], left[i]]; }
  return left.slice(0, n);
};
const spent = () => offer.filter((c) => picked.has(c.id)).reduce((s, c) => s + c.cost, 0);

// --- Draft ------------------------------------------------------------------------------------

function newDraft() {
  phase = "draft";
  offer = sample(OFFER);
  picked = new Set();
  mine = []; theirs = []; queue = []; active = null; broadside = "ready";
  $("log").replaceChildren();
  $("again").hidden = true;
  $("go").hidden = false;
  render();
}

function togglePick(card) {
  if (picked.has(card.id)) { picked.delete(card.id); play("cancel"); }
  else if (spent() + card.cost <= BUDGET) { picked.add(card.id); play("select"); }
  else { play("error"); return; }
  render();
}

/** The computer's draft: the best hull + firepower for the money, from its own offer. */
function aiDraft() {
  const lv = LEVELS[level];
  const choices = sample(lv.offer, new Set(picked)).sort((a, b) => (b.maxHp + b.atk * 1.4) / b.cost - (a.maxHp + a.atk * 1.4) / a.cost);
  const fleet = [];
  let budget = lv.budget;
  for (const c of choices) if (c.cost <= budget && fleet.length < 6) { fleet.push(c); budget -= c.cost; }
  return fleet;
}

// --- Battle ------------------------------------------------------------------------------------

const unit = (c, side) => ({ ...c, hp: c.maxHp, side, uid: `${side}-${c.id}-${Math.random().toString(36).slice(2, 6)}` });
const alive = (list) => list.filter((u) => u.hp > 0);

function startBattle() {
  if (phase !== "draft" || picked.size < 2) { play("error"); return; }
  mine = offer.filter((c) => picked.has(c.id)).map((c) => unit(c, "mine"));
  theirs = aiDraft().map((c) => unit(c, "theirs"));
  phase = "battle";
  $("go").hidden = true;
  logLine(`Your ${mine.length} ships against their ${theirs.length}.`);
  play("endTurn");
  nextRound();
}

function nextRound() {
  // Everyone alive, fastest first; ties broken at random.
  queue = [...alive(mine), ...alive(theirs)].sort((a, b) => b.speed - a.speed || Math.random() - 0.5);
  nextTurn();
}

function nextTurn() {
  if (!alive(mine).length || !alive(theirs).length) return finish();
  active = queue.shift();
  while (active && active.hp <= 0) active = queue.shift();
  if (!active) return nextRound();
  render();
  if (active.side === "theirs") setTimeout(aiTurn, AI_DELAY);
}

function aiTurn() {
  if (phase !== "battle") return;
  const targets = alive(mine);
  // Finish off whatever it can; otherwise hit the hardest hitter.
  const killable = targets.filter((t) => t.hp <= active.atk).sort((a, b) => b.atk - a.atk);
  const target = killable[0] ?? [...targets].sort((a, b) => b.atk - a.atk || a.hp - b.hp)[0];
  attack(active, target);
}

function attack(attacker, target) {
  if (busy || phase !== "battle") return;
  const dmg = Math.max(1, Math.round(attacker.atk * (0.8 + Math.random() * 0.4)));
  target.hp = Math.max(0, target.hp - dmg);
  logLine(`${attacker.side === "mine" ? "Your" : "Their"} ${attacker.name} hits ${target.side === "mine" ? "your" : "their"} ${target.name} for ${dmg}` +
    (target.hp === 0 ? `: destroyed.` : "."));
  play(target.hp === 0 ? "boom" : "hit");
  busy = true;
  render(target.uid, dmg);
  setTimeout(() => { busy = false; nextTurn(); }, 450);
}

// The broadside: your active ship's turn, spent with every survivor firing
// at one target at half firepower. Once a battle.
function fireBroadside(target) {
  if (busy || phase !== "battle" || active?.side !== "mine" || broadside !== "armed") return false;
  broadside = "used";
  let total = 0;
  for (const u of alive(mine)) total += Math.max(1, Math.round(u.atk * 0.5 * (0.8 + Math.random() * 0.4)));
  target.hp = Math.max(0, target.hp - total);
  logLine(`Broadside: all ${alive(mine).length} of your ships fire on their ${target.name} for ${total}` + (target.hp === 0 ? ": destroyed." : "."));
  play(target.hp === 0 ? "boom" : "hit");
  busy = true;
  render(target.uid, total);
  setTimeout(() => { busy = false; nextTurn(); }, 600);
  return true;
}

function finish() {
  phase = "over";
  active = null;
  const won = alive(mine).length > 0;
  logLine(won ? "Victory: the opposing fleet is gone." : "Defeat: your fleet is gone.");
  play(won ? "won" : "lost");
  $("again").hidden = false;
  $("again").focus();
  render();
}

// --- Drawing ---------------------------------------------------------------------------------------

function cardEl(c, { onClick, cls = [], showCost = false, hitDmg = 0 } = {}) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = ["card", ...cls].join(" ");
  const hp = c.hp ?? c.maxHp;
  b.innerHTML = `<img src="${c.comm}" alt=""><span class="name">${c.name}</span><span class="ed">${c.edition}</span>
    <span class="stats"><span title="Hull">♦ ${hp}/${c.maxHp}</span><span title="Firepower">✸ ${c.atk}</span><span title="Initiative">» ${Math.round(c.speed)}</span></span>
    <span class="hp"><i style="width:${100 * hp / c.maxHp}%"></i></span>${showCost ? `<span class="cost">${c.cost}</span>` : ""}`;
  b.setAttribute("aria-label", `${c.name}, ${c.edition}: hull ${hp} of ${c.maxHp}, firepower ${c.atk}` + (showCost ? `, costs ${c.cost}` : ""));
  if (hitDmg) b.insertAdjacentHTML("beforeend", `<span class="dmg">−${hitDmg}</span>`);
  if (onClick) b.addEventListener("click", onClick); else b.tabIndex = -1;
  return b;
}

function render(hitUid, dmg) {
  if (phase === "draft") {
    $("phase").textContent = "Draft";
    const note = document.createElement("p");
    note.className = "hint";
    note.textContent = "The computer drafts its own fleet, with the same budget, when you press Battle.";
    $("enemy").replaceChildren(note);
    $("mine").replaceChildren(...offer.map((c) => cardEl(c, {
      onClick: () => togglePick(c), showCost: true,
      cls: [picked.has(c.id) && "picked", !picked.has(c.id) && spent() + c.cost > BUDGET && "unaffordable"].filter(Boolean),
    })));
    $("budget").textContent = `${spent()} / ${BUDGET}`;
    $("hint").textContent = `Pick ships worth up to ${BUDGET} (at least two), then Battle.`;
    $("go").disabled = picked.size < 2;
    return;
  }
  $("budget").textContent = "";
  $("phase").textContent = phase === "over" ? (alive(mine).length ? "Victory" : "Defeat") : `${alive(mine).length} v ${alive(theirs).length}`;
  const myTurn = phase === "battle" && active?.side === "mine" && !busy;
  const draw = (u) => cardEl(u, {
    cls: [u.hp <= 0 && "dead", u === active && "active", myTurn && u.side === "theirs" && u.hp > 0 && "targetable", u.uid === hitUid && "hit"].filter(Boolean),
    onClick: myTurn && u.side === "theirs" && u.hp > 0 ? () => (broadside === "armed" ? fireBroadside(u) : attack(active, u)) : null,
    hitDmg: u.uid === hitUid ? dmg : 0,
  });
  $("enemy").replaceChildren(...theirs.map(draw));
  $("mine").replaceChildren(...mine.map(draw));
  $("hint").textContent = phase === "over" ? "Draft again?" : myTurn ? (broadside === "armed" ? "Broadside: pick the target for your whole fleet." : `Your ${active.name} acts: pick a target.`) : "Their move…";
  $("broadside").hidden = phase !== "battle";
  $("broadside").disabled = broadside === "used" || !myTurn;
  $("broadside").textContent = broadside === "used" ? "Broadside fired" : broadside === "armed" ? "Broadside: pick a target" : "Broadside";
  $("broadside").setAttribute("aria-pressed", String(broadside === "armed"));
}

function logLine(text) {
  const li = document.createElement("li");
  li.textContent = text;
  $("log").prepend(li);
}

$("go").addEventListener("click", startBattle);
$("again").addEventListener("click", newDraft);
$("broadside").addEventListener("click", () => { if (broadside !== "used") { broadside = broadside === "armed" ? "ready" : "armed"; play("select"); render(); } });
$("level").addEventListener("change", () => { level = $("level").value; if (phase !== "battle") newDraft(); });
const showMute = () => { $("mute").textContent = isMuted() ? "Sound: off" : "Sound: on"; $("mute").setAttribute("aria-pressed", String(isMuted())); };
$("mute").addEventListener("click", () => { setMuted(!isMuted()); showMute(); });
showMute();

// For play-test scripts (playtest/).
globalThis.tactics = { get broadside() { return broadside; }, get phase() { return phase; }, get offer() { return offer; }, get mine() { return mine; },
  get theirs() { return theirs; }, get active() { return active; }, get pool() { return pool; } };

await buildPool();
newDraft();
