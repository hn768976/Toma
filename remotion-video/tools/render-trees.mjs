// Renders the procedural tree silhouettes to PNG using headless Chromium
// over the DevTools Protocol. Run: node tools/render-trees.mjs
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public", "trees");
const PAGE = "file://" + join(__dirname, "tree-gen.html");
const PORT = 9333;

const CHROME_CANDIDATES = [
  "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  "/usr/bin/chromium",
  "/usr/bin/google-chrome",
];
const chrome = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!chrome) throw new Error("No Chromium binary found");

const TARGETS = [
  { preset: "dense", file: "tree-dense-oak.png", size: 3072 },
  { preset: "wide", file: "tree-wide-dead.png", size: 3072 },
  { preset: "slim", file: "tree-slim-sparse.png", size: 3072 },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const proc = spawn(chrome, [
  "--headless=new",
  `--remote-debugging-port=${PORT}`,
  "--no-sandbox",
  "--disable-gpu",
  "--hide-scrollbars",
  "--window-size=3072,3072",
  "about:blank",
]);
proc.stderr.on("data", () => {});

let wsUrl = null;
for (let i = 0; i < 60 && !wsUrl; i++) {
  await sleep(500);
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
    wsUrl = (await res.json()).webSocketDebuggerUrl;
  } catch {}
}
if (!wsUrl) throw new Error("Chromium did not expose a debugging endpoint");

const ws = new WebSocket(wsUrl);
await new Promise((r) => (ws.onopen = r));

let msgId = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
  }
};
const send = (method, params = {}, sessionId) =>
  new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });

const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
await send("Page.enable", {}, sessionId);

const evaluate = async (expression) => {
  const r = await send(
    "Runtime.evaluate",
    { expression, returnByValue: true, awaitPromise: true },
    sessionId,
  );
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
};

await send("Page.navigate", { url: PAGE }, sessionId);
await sleep(1200);

mkdirSync(OUT_DIR, { recursive: true });
const manifest = {};
for (const t of TARGETS) {
  const dims = await evaluate(`JSON.stringify(window.renderTree(${JSON.stringify(t.preset)}, ${t.size}))`);
  const dataUrl = await evaluate(`document.getElementById('c').toDataURL('image/png')`);
  const b64 = dataUrl.split(",")[1];
  const buf = Buffer.from(b64, "base64");
  writeFileSync(join(OUT_DIR, t.file), buf);
  manifest[t.preset] = { file: t.file, ...JSON.parse(dims), bytes: buf.length };
  console.log(`${t.file}  ${dims}  ${(buf.length / 1024).toFixed(0)} KB`);
}
writeFileSync(join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

ws.close();
proc.kill();
process.exit(0);
