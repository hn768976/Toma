// Verifies that a rendered still is genuinely neutral — no residual tint.
// Usage: node tools/check-neutral.mjs <png> [<png> ...]
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const chrome = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const PORT = 9335;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const files = process.argv.slice(2).map((f) => resolve(f));
if (!files.length) throw new Error("usage: check-neutral.mjs <png>...");
for (const f of files) if (!existsSync(f)) throw new Error(`missing ${f}`);

const proc = spawn(chrome, ["--headless=new", `--remote-debugging-port=${PORT}`, "--no-sandbox", "--disable-gpu", "about:blank"]);
proc.stderr.on("data", () => {});
let wsUrl = null;
for (let i = 0; i < 60 && !wsUrl; i++) {
  await sleep(400);
  try { wsUrl = (await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()).webSocketDebuggerUrl; } catch {}
}
const ws = new WebSocket(wsUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pend = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const send = (method, params = {}, sessionId) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
const { targetId } = await send("Target.createTarget", { url: "about:blank" }).then((r) => r.result);
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true }).then((r) => r.result);

let failed = false;
for (const file of files) {
  const expr = `(async () => {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = "file://${file}"; });
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let maxDev = 0, sumDev = 0, n = 0, sumR = 0, sumG = 0, sumB = 0;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i+1], b = d[i+2];
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      const dev = mx - mn;
      if (dev > maxDev) maxDev = dev;
      sumDev += dev; sumR += r; sumG += g; sumB += b; n++;
    }
    return JSON.stringify({ w: c.width, h: c.height, maxDev, meanDev: sumDev / n,
      meanR: sumR / n, meanG: sumG / n, meanB: sumB / n });
  })()`;
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }, sessionId);
  const v = JSON.parse(r.result.result.value);
  const name = file.split("/").pop();
  const chanSpread = Math.max(v.meanR, v.meanG, v.meanB) - Math.min(v.meanR, v.meanG, v.meanB);
  const ok = v.maxDev <= 2 && chanSpread <= 0.5;
  if (!ok) failed = true;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${name}  ${v.w}x${v.h}  ` +
    `max|Δchan|=${v.maxDev}  mean|Δchan|=${v.meanDev.toFixed(3)}  ` +
    `meanRGB=${v.meanR.toFixed(2)}/${v.meanG.toFixed(2)}/${v.meanB.toFixed(2)}`,
  );
}
ws.close(); proc.kill();
process.exit(failed ? 1 : 0);
