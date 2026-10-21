// Photograph parts of a live web page with headless Chromium, over the
// DevTools protocol (Node 22+, no packages): load the page, measure each
// requested element, and capture exactly that rectangle, even far below the
// first screen.
//
//   node tools/capture_page.mjs <url> <out-dir> <name>=<css selector>[@<n>] ...
//
// `@n` widens a capture to n consecutive siblings (two adjacent table rows,
// say); a leading `^` captures from the top of the page down to the element;
// `top:<px>` captures the first <px> pixels of the page. Writes <out-dir>/<name>.png for each part and <out-dir>/capture.json
// with the URL, the UTC capture time and each part's rectangle.
// tools/stamp_capture.py stacks the parts and dates them.
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [url, outDir, ...parts] = process.argv.slice(2);
if (!url || !outDir || !parts.length) {
  console.error("usage: capture_page.mjs <url> <out-dir> <name>=<selector>[@n] ...");
  process.exit(2);
}
mkdirSync(outDir, { recursive: true });

const port = 9300 + Math.floor(Math.random() * 500);
const profile = mkdtempSync(join(tmpdir(), "capture-"));
const chrome = spawn(process.env.CHROMIUM || "chromium", [
  "--headless=new", "--no-sandbox", "--hide-scrollbars", `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`, "--window-size=1280,900", "about:blank",
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function devtools() {
  for (let i = 0; i < 50; i++) {
    try {
      const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = tabs.find((t) => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* not listening yet */ }
    await sleep(200);
  }
  throw new Error("Chromium never opened its DevTools port");
}

function session(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  const waiters = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    } else if (msg.method) {
      for (const w of waiters.splice(0)) if (w.method === msg.method) w.resolve(msg.params);
        else waiters.push(w);
    }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    pending.set(++id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const once = (method) => new Promise((resolve) => waiters.push({ method, resolve }));
  return new Promise((resolve) => { ws.onopen = () => resolve({ send, once, ws }); });
}

try {
  const cdp = await session(await devtools());
  await cdp.send("Page.enable");
  const loaded = cdp.once("Page.loadEventFired");
  await cdp.send("Page.navigate", { url });
  await loaded;
  // let fonts, late styles and script-loaded content settle (CAPTURE_WAIT ms)
  await sleep(Number(process.env.CAPTURE_WAIT) || 1500);

  const captured = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  const record = { url, captured, parts: [] };
  for (const part of parts) {
    const [name, spec] = part.split(/=(.*)/s);
    if (spec.startsWith("top:")) {
      const clip = { x: 0, y: 0, width: 1280, height: Number(spec.slice(4)), scale: 1 };
      const shot = await cdp.send("Page.captureScreenshot", { format: "png", clip, captureBeyondViewport: true });
      writeFileSync(join(outDir, `${name}.png`), Buffer.from(shot.data, "base64"));
      record.parts.push({ name, selector: spec, clip });
      console.log(`${name}: page top, ${clip.height}px`);
      continue;
    }
    const upTo = spec.startsWith("^");
    const [selector, count] = (upTo ? spec.slice(1) : spec).split(/@(?=\d+$)/);
    const expr = `(() => {
      const first = document.querySelector(${JSON.stringify(selector)});
      if (!first) return null;
      let el = first, r = first.getBoundingClientRect();
      let top = r.top, left = r.left, right = r.right, bottom = r.bottom;
      for (let i = 1; i < ${Number(count) || 1}; i++) {
        el = el.nextElementSibling; if (!el) break;
        const s = el.getBoundingClientRect();
        top = Math.min(top, s.top); left = Math.min(left, s.left);
        right = Math.max(right, s.right); bottom = Math.max(bottom, s.bottom);
      }
      if (${upTo}) return { x: 0, y: 0, width: document.documentElement.scrollWidth, height: top + scrollY };
      return { x: left + scrollX, y: top + scrollY, width: right - left, height: bottom - top };
    })()`;
    const { result } = await cdp.send("Runtime.evaluate", { expression: expr, returnByValue: true });
    if (!result.value) throw new Error(`nothing matches ${selector}`);
    const clip = { ...result.value, scale: 1 };
    const shot = await cdp.send("Page.captureScreenshot", {
      format: "png", clip, captureBeyondViewport: true,
    });
    writeFileSync(join(outDir, `${name}.png`), Buffer.from(shot.data, "base64"));
    record.parts.push({ name, selector, clip });
    console.log(`${name}: ${Math.round(clip.width)}x${Math.round(clip.height)} at y=${Math.round(clip.y)}`);
  }
  writeFileSync(join(outDir, "capture.json"), JSON.stringify(record, null, 2) + "\n");
  cdp.ws.close();
} finally {
  chrome.kill();
}
