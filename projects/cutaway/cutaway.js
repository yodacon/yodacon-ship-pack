// Cutaway: name the ship from its 1997 targeting cutaway.
// Plain DOM. The question is a ship's target picture; the answers are four
// comm portraits. Everything comes from catalog.json.
import { loadCatalog } from "../../lib/yodacon-ship-pack.js";
import { play, isMuted, setMuted } from "../../lib/yodacon-sound.js";

const $ = (id) => document.getElementById(id);
const ROUNDS = 10;
const isPin = (ship) => /Pin$/.test(ship.name);

let pool = [], round = 0, score = 0, streak = 0, current = null, timer = null, deadline = 0, answered = false;

// Some pictures are shared: the three 1997 Pins have one target picture, the
// 1998 Pins another, and the 1/4 Defender reuses the Defender's. So no two
// answers may share a name, a Pin never stands against another Pin, and the
// 1/4 Defender sits out.
async function buildPool() {
  const catalog = await loadCatalog();
  pool = catalog.editions.flatMap((ed) => ed.ships.map((s) => ({ ...s, edition: ed.title, year: ed.year })))
    .filter((s) => s.urls.target && s.slug !== "quarter-defender");
}

function pickChoices(answer) {
  const others = pool.filter((s) => s.name !== answer.name && !(isPin(answer) && isPin(s)));
  const picked = [];
  const names = new Set([answer.name]);
  while (picked.length < 3) {
    const s = others[Math.floor(Math.random() * others.length)];
    if (!names.has(s.name)) { names.add(s.name); picked.push(s); }
  }
  const choices = [answer, ...picked];
  for (let i = choices.length - 1; i > 0; i--) {     // shuffle
    const j = Math.floor(Math.random() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  return choices;
}

// Harder as it goes: full picture, then a scanning slice, then mirrored, then both.
function difficulty(r) {
  return { scan: r >= 4 && r !== 7 && r !== 8, mirror: r >= 7, seconds: r < 4 ? 10 : r < 7 ? 9 : 8 };
}

function nextRound() {
  if (round >= ROUNDS) return finish();
  round++;
  answered = false;
  current = pool[Math.floor(Math.random() * pool.length)];
  const d = difficulty(round);
  const scope = $("scope");
  scope.classList.toggle("mirror", d.mirror);
  scope.classList.toggle("scan", d.scan);
  $("target").src = current.urls.target;
  $("prompt").textContent = d.mirror ? "Mirrored: which ship?" : d.scan ? "Scanning: which ship?" : "Which ship is this?";
  $("choices").replaceChildren(...pickChoices(current).map((s, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "choice";
    b.dataset.slug = s.slug;
    b.dataset.edition = s.edition;
    b.innerHTML = `<img src="${s.urls.comm}" alt=""><span>${s.name}</span><kbd>${i + 1}</kbd>`;
    b.addEventListener("click", () => answer(s, b));
    return b;
  }));
  deadline = performance.now() + d.seconds * 1000;
  clearInterval(timer);
  timer = setInterval(tick, 50);
  hud();
}

function tick() {
  const d = difficulty(round);
  const left = Math.max(0, deadline - performance.now());
  const bar = $("timer");
  bar.style.width = `${100 * left / (d.seconds * 1000)}%`;
  bar.classList.toggle("low", left < 3000);
  if (d.scan) {                                      // the slice sweeps left to right and back
    const t = (performance.now() / 1600) % 2, x = (t < 1 ? t : 2 - t) * 70;
    $("scope").style.setProperty("--from", `${x}%`);
    $("scope").style.setProperty("--to", `${x + 30}%`);
  }
  if (left <= 0 && !answered) answer(null, null);
}

function answer(choice, button) {
  if (answered) return;
  answered = true;
  clearInterval(timer);
  const right = choice && choice.slug === current.slug && choice.edition === current.edition;
  const left = Math.max(0, deadline - performance.now());
  for (const b of $("choices").children) {
    b.disabled = true;
    if (b.dataset.slug === current.slug && b.dataset.edition === current.edition) b.classList.add("right");
  }
  if (right) {
    streak++;
    const points = Math.round((100 + 100 * left / (difficulty(round).seconds * 1000)) * (1 + 0.1 * (streak - 1)));
    score += points;
    play("conquered");
    reveal(`+${points}`);
  } else {
    streak = 0;
    if (button) button.classList.add("wrong");
    play(choice ? "error" : "lost");
    reveal(choice ? "Not quite." : "Out of time.");
  }
  $("scope").classList.remove("scan", "mirror");     // show the whole picture once answered
  hud();
  setTimeout(nextRound, 1900);
}

function reveal(verdict) {
  const s = current;
  $("info").innerHTML = `<img src="${s.urls.yard}" alt="${s.name} in the shipyard">
    <h3>${s.name}</h3><p>${s.edition} (${s.year}). ${verdict}</p><p>${s.description ?? ""}</p>`;
}

function finish() {
  clearInterval(timer);
  $("prompt").textContent = `Done: ${score} points`;
  $("choices").replaceChildren();
  $("again").hidden = false;
  $("again").focus();
  play(score >= 1200 ? "won" : "endTurn");
  hud();
}

function start() {
  round = 0; score = 0; streak = 0;
  $("again").hidden = true;
  $("info").innerHTML = "<p>Name the ship from its cutaway. Faster answers score more.</p>";
  nextRound();
}

function hud() {
  $("round").textContent = `${Math.min(round, ROUNDS)}/${ROUNDS}`;
  $("score").textContent = score;
  $("streak").textContent = streak;
}

document.addEventListener("keydown", (e) => {
  const n = Number(e.key);
  if (n >= 1 && n <= 4) $("choices").children[n - 1]?.click();
});
$("again").addEventListener("click", start);
const showMute = () => { $("mute").textContent = isMuted() ? "Sound: off" : "Sound: on"; $("mute").setAttribute("aria-pressed", String(isMuted())); };
$("mute").addEventListener("click", () => { setMuted(!isMuted()); showMute(); });
showMute();

// For play-test scripts (playtest/).
globalThis.cutaway = { get current() { return current; }, get round() { return round; }, get score() { return score; }, get pool() { return pool; } };

await buildPool();
start();
