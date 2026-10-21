// Yodacon Ship Pack — playground.
//
// A self-hosted code sandbox with no dependencies: a <textarea> editor, an
// <iframe srcdoc> preview, a console bridged over postMessage, shareable links
// (the code itself lives in the URL hash) and an "Open in CodePen" button.
//
// The preview gets a <base href> pointing at the pack root, so code in the
// editor can say "conex/ships/yodacon/sheet-alpha.png" or import
// "./lib/yodacon-ship-pack.js" exactly as a page at the pack root would.
//
// Ships by Paul Richeson (ConEx, 1997–1998). GPL-2.0-or-later.

/** The pack root (the folder holding catalog.json), absolute, ending in "/". */
const PACK_ROOT = new URL("../", location.href).href;

/** Where CodePen should load the pack from: a tagged release on jsDelivr (CORS-enabled). */
const CDN_ROOT = "https://cdn.jsdelivr.net/gh/yodacon/yodacon-ship-pack@v2.0.0/";

/** Starter snippets: complete HTML documents in ./snippets/. */
const SNIPPETS = [
  { key: "web-component", title: "Web component", file: "web-component.html" },
  { key: "dom-sprite", title: "DOM sprite", file: "dom-sprite.html" },
  { key: "canvas", title: "Canvas 2D flight", file: "canvas-flight.html" },
  { key: "threejs", title: "three.js", file: "threejs.html" },
  { key: "phaser", title: "Phaser", file: "phaser.html" },
  { key: "pixi", title: "PixiJS", file: "pixi.html" },
  { key: "raw-pixels", title: "Raw pixels", file: "raw-pixels.html" },
];

const $ = (id) => document.getElementById(id);
const code = $("code"), gutter = $("gutter"), preview = $("preview"), consoleList = $("console");
const select = $("snippet"), auto = $("auto"), statusEl = $("status");

// --- Storage (a per-browser convenience; everything works without it) -------
const store = {
  get(k) { try { return localStorage.getItem(`ship-pack-playground:${k}`); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(`ship-pack-playground:${k}`, v); } catch { /* private mode */ } },
};

// --- Sandbox ----------------------------------------------------------------
// A sandboxed srcdoc frame WITHOUT allow-same-origin has an opaque origin
// ("null"), so every module script and fetch() it makes to the pack is a
// cross-origin request and needs Access-Control-Allow-Origin. GitHub Pages
// (yodacon.org) and jsDelivr send it; `python3 -m http.server` (`make serve`)
// does not, and there every import of the library fails.
//
// So we ask the server. If it sends CORS headers, the preview gets
// sandbox="allow-scripts": an isolated origin that cannot touch this page.
// If not, the preview has to share this page's origin to load the pack. The
// textbook way is sandbox="allow-scripts allow-same-origin", but that pair
// lets the frame remove its own sandbox, so it protects nothing, and Chrome
// logs a warning on every run saying so. We therefore drop the attribute
// instead: the same real protection (none), and a clean console. That is
// acceptable for a visitor's own code on a static site with no accounts. It
// is also why a shared link never runs by itself in that mode.
let isolated = true;
async function chooseSandbox() {
  try {
    const r = await fetch(new URL("catalog.json", PACK_ROOT), { method: "HEAD", cache: "no-store" });
    isolated = r.headers.get("access-control-allow-origin") === "*";
  } catch {
    isolated = false;
  }
  if (isolated) preview.setAttribute("sandbox", "allow-scripts allow-pointer-lock");
  else preview.removeAttribute("sandbox");
  $("sandbox-mode").textContent = isolated ? "sandbox: isolated origin" : "same origin (this server sends no CORS headers)";
  $("sandbox-mode").title = isolated
    ? "The preview runs in an opaque origin and cannot touch this page."
    : "This server does not send CORS headers, so the preview shares this page's origin to load the pack.";
}

// --- The console bridge, injected first into every run -----------------------
// One line, so line numbers in error messages match the editor.
let runId = 0;
function bridge(id) {
  return `<script>(()=>{const id=${id},send=(level,args)=>{try{parent.postMessage({__playground:id,level,args:args.map(fmt)},"*")}catch(e){}};` +
    `function fmt(a){if(a instanceof Error)return a.stack&&a.stack.includes(a.message)?a.stack:a.name+": "+a.message;` +
    `if(typeof a==="string")return a;if(a===undefined)return"undefined";if(typeof a==="function")return"ƒ "+(a.name||"anonymous")+"()";` +
    `if(a instanceof Node)return"<"+(a.nodeName||"node").toLowerCase()+">";try{const s=JSON.stringify(a,(k,v)=>typeof v==="bigint"?v+"n":v);return s===undefined?String(a):s}catch(e){return String(a)}}` +
    `for(const level of ["log","info","warn","error","debug"]){const orig=console[level].bind(console);console[level]=(...args)=>{send(level,args);orig(...args)}}` +
    `addEventListener("error",(e)=>{const t=e.target;if(t&&t!==window){send("error",[t.src||t.href?"Failed to load "+(t.src||t.href):"A <"+t.localName+"> failed to load: check the URLs it imports"]);return}` +
    `send("error",[(e.error&&e.error.stack&&e.error.stack.includes(e.message.replace(/^Uncaught /,""))?e.error.stack:e.message)+(e.lineno?" (line "+e.lineno+")":"")])},true);` +
    `addEventListener("unhandledrejection",(e)=>send("error",["Unhandled rejection: ",e.reason]));})();<\/script>`;
}

/** Put <base> and the bridge at the top of <head>, without adding a line. */
function inject(html, id) {
  const top = `<base href="${PACK_ROOT}">` + bridge(id);
  if (/<head(\s[^>]*)?>/i.test(html)) return html.replace(/<head(\s[^>]*)?>/i, (m) => m + top);
  if (/<html(\s[^>]*)?>/i.test(html)) return html.replace(/<html(\s[^>]*)?>/i, (m) => m + `<head>${top}</head>`);
  if (/^\s*<!doctype[^>]*>/i.test(html)) return html.replace(/^\s*<!doctype[^>]*>/i, (m) => m + top);
  return top + html;
}

function run() {
  runId++;
  clearConsole();
  log("system", [`Run #${runId}`]);
  preview.srcdoc = inject(code.value, runId);
  statusEl.textContent = "";
}

addEventListener("message", (e) => {
  if (e.source !== preview.contentWindow || !e.data || e.data.__playground !== runId) return;
  log(e.data.level, e.data.args);
});

// --- Console panel -----------------------------------------------------------
let errorCount = 0;
function log(level, args) {
  const li = document.createElement("li");
  li.className = level === "log" || level === "debug" ? "" : level;
  li.textContent = (level === "error" ? "✖ " : level === "warn" ? "⚠ " : "") + args.join(" ");
  consoleList.append(li);
  consoleList.scrollTop = consoleList.scrollHeight;
  if (level === "error") document.body.dataset.errors = String(++errorCount);
}
function clearConsole() {
  consoleList.replaceChildren();
  errorCount = 0;
  document.body.dataset.errors = "0";
}
$("clear").onclick = clearConsole;

// --- Editor: line numbers, Tab, auto-indent ---------------------------------
let gutterLines = 0;
function updateGutter() {
  const n = code.value.split("\n").length;
  if (n !== gutterLines) {
    gutterLines = n;
    gutter.textContent = Array.from({ length: n }, (_, i) => i + 1).join("\n");
  }
  gutter.scrollTop = code.scrollTop;
}
code.addEventListener("scroll", () => { gutter.scrollTop = code.scrollTop; });

// Insert text through the browser's editing commands so Ctrl+Z still works.
function insert(text) {
  if (!document.execCommand?.("insertText", false, text)) {
    code.setRangeText(text, code.selectionStart, code.selectionEnd, "end");
    code.dispatchEvent(new Event("input"));
  }
}

let escaped = false; // Escape, then Tab, leaves the editor (no keyboard trap)
code.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); run(); return; }
  if (e.key === "Escape") { escaped = true; return; }
  if (e.key === "Tab" && !escaped && !e.altKey && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    const v = code.value, s = code.selectionStart, end = code.selectionEnd;
    const lineStart = v.lastIndexOf("\n", s - 1) + 1;
    if (s === end && !e.shiftKey) { insert("  "); return; }
    // Indent or outdent every line the selection touches.
    const block = v.slice(lineStart, end);
    const changed = e.shiftKey ? block.replace(/^ {1,2}/gm, "") : block.replace(/^/gm, "  ");
    code.setSelectionRange(lineStart, end);
    insert(changed);
    code.setSelectionRange(lineStart, lineStart + changed.length);
    return;
  }
  escaped = false;
  if (e.key === "Enter" && !e.shiftKey) {
    // Keep the current line's indentation.
    const v = code.value, s = code.selectionStart;
    const line = v.slice(v.lastIndexOf("\n", s - 1) + 1, s);
    const indent = line.match(/^\s*/)[0];
    if (indent) { e.preventDefault(); insert("\n" + indent); }
  }
});

let debounce = 0;
code.addEventListener("input", () => {
  updateGutter();
  store.set("code", code.value);
  statusEl.textContent = auto.checked ? "…" : "edited — Run to see it";
  if (auto.checked) {
    clearTimeout(debounce);
    debounce = setTimeout(run, 700);
  }
});
auto.addEventListener("change", () => { store.set("auto", auto.checked ? "1" : "0"); if (auto.checked) run(); });
$("run").onclick = run;
addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && e.target !== code) { e.preventDefault(); run(); }
});

// --- Snippets -----------------------------------------------------------------
async function loadSnippet(key) {
  const sn = SNIPPETS.find((s) => s.key === key) ?? SNIPPETS[0];
  const r = await fetch(new URL(`snippets/${sn.file}`, import.meta.url));
  if (!r.ok) throw new Error(`snippets/${sn.file}: HTTP ${r.status}`);
  return { sn, text: await r.text() };
}
function setCode(text) {
  code.value = text;
  code.scrollTop = 0;
  updateGutter();
  store.set("code", text);
}
async function choose(key, { runIt = true } = {}) {
  const { sn, text } = await loadSnippet(key);
  select.value = sn.key;
  store.set("snippet", sn.key);
  setCode(text);
  if (runIt) run();
}
for (const s of SNIPPETS) select.append(new Option(s.title, s.key));
select.append(new Option("(shared link)", "shared"));
select.querySelector('option[value="shared"]').hidden = true;
select.addEventListener("change", () => {
  if (select.value === "shared") return;
  const u = new URL(location.href);
  u.searchParams.set("snippet", select.value);
  u.hash = "";
  history.replaceState(null, "", u);
  choose(select.value);
});
$("reset").onclick = () => choose(select.value === "shared" ? SNIPPETS[0].key : select.value);

// --- Share: the code, deflated and base64url'd, in the hash ------------------
const b64url = (bytes) => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const unb64url = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
async function pipe(bytes, stream) {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
}
async function encode(text) {
  const bytes = new TextEncoder().encode(text);
  if ("CompressionStream" in globalThis) {
    try { return "z=" + b64url(await pipe(bytes, new CompressionStream("deflate-raw"))); } catch { /* fall through */ }
  }
  return "b=" + b64url(bytes);
}
async function decode(hash) {
  const m = hash.match(/^#?([zb])=(.+)$/);
  if (!m) return null;
  let bytes = unb64url(m[2]);
  if (m[1] === "z") bytes = await pipe(bytes, new DecompressionStream("deflate-raw"));
  return new TextDecoder().decode(bytes);
}
$("share").onclick = async () => {
  const u = new URL(location.href);
  u.search = "";
  u.hash = await encode(code.value);
  history.replaceState(null, "", u);
  try {
    await navigator.clipboard.writeText(u.href);
    statusEl.textContent = `Link copied (${u.href.length} characters)`;
  } catch {
    statusEl.textContent = "Link is in the address bar";
  }
};

// --- Open in CodePen ---------------------------------------------------------
// CodePen's prefill API: POST a form field "data" holding JSON to /pen/define.
// CodePen has none of the pack's files, so pack-relative URLs (lib/…, conex/…,
// override/…, catalog.json) become absolute jsDelivr URLs of a tagged release.
function toCdn(text) {
  return text.replace(/(["'`(]\s*)(?:\.\/)?((?:lib|conex|override)\/|catalog\.json\b|manifest\.json\b)/g, `$1${CDN_ROOT}$2`);
}
$("codepen").onclick = () => {
  const src = toCdn(code.value);
  const head = src.match(/<head[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? "";
  const body = src.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? src;
  const title = src.match(/<title>([^<]*)<\/title>/i)?.[1] ?? "Yodacon Ship Pack";
  $("codepen-data").value = JSON.stringify({
    title: `${title} · Yodacon Ship Pack`,
    description: "Ships from the Yodacon Ship Pack by Paul Richeson (ConEx, 1997), GPL-2.0-or-later — https://github.com/yodacon/yodacon-ship-pack",
    head: head.replace(/<meta[^>]*>\s*|<title>[^<]*<\/title>\s*/gi, "").trim(),
    html: body.trim(),
    css: "",
    js: "",
    editors: "100",
  });
  $("codepen-form").submit();
};

// --- Start --------------------------------------------------------------------
await chooseSandbox();
auto.checked = store.get("auto") === "1";
const params = new URLSearchParams(location.search);
let shared = null;
try { shared = await decode(location.hash); } catch (err) { log("error", [`Could not read the shared code: ${err.message}`]); }

if (shared != null) {
  select.value = "shared";
  setCode(shared);
  if (isolated) run();
  else {
    // Same-origin sandbox: never run someone else's code without a click.
    clearConsole();
    log("system", ["Shared code loaded. Read it, then press Run (Ctrl/Cmd + Enter)."]);
  }
} else if (params.has("snippet")) {
  await choose(params.get("snippet"));
} else {
  const draft = store.get("code"), key = store.get("snippet");
  if (draft) {
    select.value = SNIPPETS.some((s) => s.key === key) ? key : SNIPPETS[0].key;
    setCode(draft);
    run();
  } else await choose(SNIPPETS[0].key);
}
