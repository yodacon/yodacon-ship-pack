// Load pages of the pack in headless Chromium and fail on anything broken:
// console errors and warnings, uncaught exceptions, failed requests, HTTP
// responses >= 400, and horizontal page scroll. Optionally screenshots each.
// Node 22+ (global WebSocket), no packages; talks the DevTools protocol.
//
//   node tools/check_pages.mjs <base-url> [page ...] [--shots <dir>] [--width 1280] [--height 900]
//                              [--wait 4000] [--angle swiftshader|vulkan] [--full] [--scheme dark]
//
// --full screenshots the whole page height instead of the first screen;
// --scheme dark|light emulates prefers-color-scheme. Widths under 600 px also
// emulate a touch screen (pointer: coarse).
//
//   python3 -m http.server 8765 &        # in the pack root
//   node tools/check_pages.mjs http://127.0.0.1:8765/
//   node tools/check_pages.mjs http://127.0.0.1:8766/ship-pack/ --width 390 --shots /tmp/shots
//
// With no pages given it checks every page of the pack's web layer; pages given
// replace that list, and the word `all` among them stands for it, so
//   node tools/check_pages.mjs http://127.0.0.1:8765/ all playground/ projects/foo/
// checks the defaults plus two more. The base
// URL may be a sub-path: everything in the pack must work from any of them.
// Set CHROMIUM to pick the browser binary. WebGL (three.js, PixiJS) needs a
// software GL in headless mode: `--angle swiftshader` (default) uses Chrome's
// bundled SwiftShader; where the distribution's Chromium lacks it (Alpine),
// `--angle vulkan` uses the system Vulkan driver (Mesa lavapipe works). Exit status 1 if any page failed.
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const DEFAULT_PAGES = [
  "", "demo/", "demo/?edition=override&ship=dart",
  "examples/dom/", "examples/canvas/", "examples/web-component/",
  "examples/threejs/", "examples/threejs/?mode=billboard",
  "examples/phaser/", "examples/pixi/", "examples/svg/", "examples/css/",
];

const args = process.argv.slice(2);
const opt = { shots: null, width: 1280, height: 900, wait: 4000, angle: "swiftshader" };
const positional = [];
const FLAGS = new Set(["full"]); // options without a value
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (!a.startsWith("--")) positional.push(a);
  else if (a.includes("=")) { const [k, v] = a.slice(2).split(/=(.*)/s); opt[k] = v; }
  else if (FLAGS.has(a.slice(2))) opt[a.slice(2)] = true;
  else opt[a.slice(2)] = args[++i];
}
const [base, ...given] = positional;
if (!base) {
  console.error("usage: check_pages.mjs <base-url> [page ...] [--shots dir] [--width n] [--height n] [--wait ms]");
  process.exit(2);
}
const pages = given.length ? given.flatMap((p) => (p === "all" ? DEFAULT_PAGES : [p])) : DEFAULT_PAGES;
const width = Number(opt.width), height = Number(opt.height), wait = Number(opt.wait);
if (opt.shots) mkdirSync(opt.shots, { recursive: true });

const port = 9300 + Math.floor(Math.random() * 500);
const profile = mkdtempSync(join(tmpdir(), "check-pages-"));
const chrome = spawn(process.env.CHROMIUM || "chromium", [
  "--headless=new", "--no-sandbox", "--hide-scrollbars", "--mute-audio",
  `--use-angle=${opt.angle}`, "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", // WebGL without a GPU
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  `--window-size=${width},${height}`, "about:blank",
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function browserReady() {
  for (let i = 0; i < 75; i++) {
    try { return await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); }
    catch { await sleep(200); }
  }
  throw new Error("Chromium never opened its DevTools port");
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  const listeners = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    } else if (msg.method) for (const l of listeners) l(msg.method, msg.params);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    pending.set(++id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const on = (fn) => listeners.push(fn);
  return new Promise((resolve) => { ws.onopen = () => resolve({ send, on, ws }); });
}

async function check(url) {
  const tab = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
  const cdp = await connect(tab.webSocketDebuggerUrl);
  const problems = [];
  const urls = new Map(); // requestId → url
  let loaded;
  const loadedP = new Promise((r) => { loaded = r; });
  cdp.on((method, p) => {
    if (method === "Page.loadEventFired") loaded();
    else if (method === "Runtime.consoleAPICalled" && (p.type === "error" || p.type === "warning" || p.type === "assert")) {
      problems.push(`console.${p.type}: ${p.args.map((a) => a.value ?? a.description ?? a.type).join(" ")}`);
    } else if (method === "Runtime.exceptionThrown") {
      const d = p.exceptionDetails;
      problems.push(`exception: ${d.exception?.description ?? d.text} (${d.url ?? ""}:${d.lineNumber})`);
    } else if (method === "Log.entryAdded" && (p.entry.level === "error" || p.entry.level === "warning")) {
      if (!/favicon\.ico/.test(p.entry.url ?? "")) problems.push(`log.${p.entry.level}: ${p.entry.text} ${p.entry.url ?? ""}`);
    } else if (method === "Network.requestWillBeSent") urls.set(p.requestId, p.request.url);
    else if (method === "Network.responseReceived" && p.response.status >= 400) {
      if (!/favicon\.ico$/.test(p.response.url)) problems.push(`HTTP ${p.response.status}: ${p.response.url}`);
    } else if (method === "Network.loadingFailed" && !p.canceled && p.errorText !== "net::ERR_ABORTED") {
      problems.push(`failed: ${p.errorText} ${urls.get(p.requestId) ?? ""}`);
    }
  });
  await Promise.all(["Page.enable", "Runtime.enable", "Log.enable", "Network.enable"].map((m) => cdp.send(m)));
  await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 600 });
  // Headless tabs can turn "hidden" at random; keep them focused and visible
  // so pages that pause on blur (the demo game) keep running.
  await cdp.send("Emulation.setFocusEmulationEnabled", { enabled: true });
  if (width < 600) await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 }); // phone: pointer: coarse
  if (opt.scheme) await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: opt.scheme }] });
  await cdp.send("Page.navigate", { url });
  await Promise.race([loadedP, sleep(30000).then(() => problems.push("load event never fired"))]);
  await sleep(wait); // let modules, CDN libraries and animations run

  const { result } = await cdp.send("Runtime.evaluate", {
    returnByValue: true,
    expression: `({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
      title: document.title, h: document.documentElement.scrollHeight })`,
  });
  const m = result.value;
  if (m.sw > m.cw + 1) problems.push(`horizontal scroll: page is ${m.sw}px wide in a ${m.cw}px viewport`);

  let shot = null;
  if (opt.shots) {
    const name = (url.slice(base.length).replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "index") + `-${width}${opt.scheme ? "-" + opt.scheme : ""}`;
    shot = join(opt.shots, `${name}.png`);
    const clip = opt.full ? { x: 0, y: 0, width, height: Math.min(m.h, 16000), scale: 1 } : undefined;
    const { data } = await cdp.send("Page.captureScreenshot", { format: "png", clip, captureBeyondViewport: Boolean(opt.full) });
    writeFileSync(shot, Buffer.from(data, "base64"));
  }
  cdp.ws.close();
  await fetch(`http://127.0.0.1:${port}/json/close/${tab.id}`);
  return { problems, title: m.title, shot };
}

let failed = 0;
try {
  await browserReady();
  for (const page of pages) {
    const url = new URL(page, base.endsWith("/") ? base : base + "/").href;
    const { problems, title, shot } = await check(url);
    if (problems.length) failed++;
    console.log(`${problems.length ? "FAIL" : "ok  "} ${url}  "${title}"${shot ? `  → ${shot}` : ""}`);
    for (const p of problems) console.log(`       ${p}`);
  }
} finally {
  chrome.kill();
  await sleep(300);
  rmSync(profile, { recursive: true, force: true });
}
console.log(`\n${pages.length - failed}/${pages.length} pages clean at ${width}×${height}`);
process.exit(failed ? 1 : 0);
