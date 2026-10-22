// Play a page with a script: load it in headless Chromium, run a JavaScript
// file inside it, and report what the script returns, every console error and
// exception, and a screenshot. For play-testing the games end to end.
//
//   node tools/drive_page.mjs <url> <player.js> [screenshot.png] [--timeout ms] [--width px]
//
// player.js is the body of an async function run in the page; whatever it
// returns is printed. It can use `sleep(ms)` and `log(...)`, both provided.
// Exits 1 if the page logged an error or threw, or the script failed or ran
// out of time.
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const args = process.argv.slice(2);
const tIdx = args.indexOf("--timeout");
const timeout = tIdx >= 0 ? Number(args.splice(tIdx, 2)[1]) : 120000;
const wIdx = args.indexOf("--width");
const width = wIdx >= 0 ? Number(args.splice(wIdx, 2)[1]) : 1280;
const [url, scriptPath, shot] = args;
if (!url || !scriptPath) {
  console.error("usage: drive_page.mjs <url> <player.js> [screenshot.png] [--timeout ms] [--width px]");
  process.exit(2);
}

const port = 9400 + Math.floor(Math.random() * 400);
const profile = mkdtempSync(join(tmpdir(), "drive-"));   // removed on exit: profiles are ~30 MB
const chrome = spawn(process.env.CHROMIUM || "chromium", [
  "--headless=new", "--no-sandbox", "--hide-scrollbars", "--use-angle=vulkan", "--ignore-gpu-blocklist",
  "--autoplay-policy=no-user-gesture-required", `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`, "--window-size=1280,900", "about:blank",
], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const done = (code) => {
  chrome.kill();
  setTimeout(() => { rmSync(profile, { recursive: true, force: true }); process.exit(code); }, 300);
};
setTimeout(() => { console.error(`timed out after ${timeout} ms`); done(1); }, timeout).unref?.();

let ws;
for (let i = 0; i < 50 && !ws; i++) {
  try {
    const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    ws = tabs.find((t) => t.type === "page")?.webSocketDebuggerUrl;
  } catch { /* not up yet */ }
  if (!ws) await sleep(200);
}
const sock = new WebSocket(ws);
await new Promise((r) => { sock.onopen = r; });
let id = 0;
const pending = new Map();
const problems = [];
sock.onmessage = (event) => {
  const m = JSON.parse(event.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === "Runtime.exceptionThrown") {
    const d = m.params.exceptionDetails;
    problems.push(`exception: ${d.exception?.description ?? d.text}`);
  } else if (m.method === "Runtime.consoleAPICalled") {
    const text = m.params.args.map((a) => a.value ?? a.description).join(" ");
    if (m.params.type === "error") problems.push(`console.error: ${text}`);
    else if (m.params.type === "log" && text.startsWith("[player]")) console.log(text);
  } else if (m.method === "Log.entryAdded" && m.params.entry.level === "error") {
    problems.push(`log: ${m.params.entry.text} ${m.params.entry.url ?? ""}`);
  }
};
const send = (method, params = {}) => new Promise((resolve) => {
  pending.set(++id, resolve);
  sock.send(JSON.stringify({ id, method, params }));
});

await send("Runtime.enable");
await send("Log.enable");
await send("Page.enable");
await send("Emulation.setFocusEmulationEnabled", { enabled: true });
if (width !== 1280) await send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 });
await send("Page.navigate", { url });
await sleep(2500);

const body = readFileSync(scriptPath, "utf8");
const wrapped = `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const log = (...a) => console.log("[player]", ...a);
${body}
})()`;
const reply = await send("Runtime.evaluate", { expression: wrapped, awaitPromise: true, returnByValue: true });
if (reply.result?.exceptionDetails) {
  problems.push(`player script: ${reply.result.exceptionDetails.exception?.description ?? reply.result.exceptionDetails.text}`);
} else {
  console.log(typeof reply.result?.result?.value === "string" ? reply.result.result.value
    : JSON.stringify(reply.result?.result?.value, null, 2));
}
if (shot) {
  const s = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(shot, Buffer.from(s.result.data, "base64"));
}
console.log(problems.length ? `problems:\n  ${problems.join("\n  ")}` : "problems: none");
sock.close();
done(problems.length ? 1 : 0);
