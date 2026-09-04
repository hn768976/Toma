/**
 * Verifies that a rendered clip loops seamlessly.
 *
 * A loop is seamless when the wrap (last frame -> first frame) is no more
 * abrupt than any ordinary frame-to-frame step. This extracts the first two
 * frames and the last frame and compares the wrap step against a normal step.
 *
 * Usage: node tools/check-loop.mjs out/V1_FoggyForestTeal.mp4
 */
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const video = resolve(process.argv[2] ?? "");
if (!process.argv[2]) throw new Error("usage: check-loop.mjs <video.mp4>");

const dir = mkdtempSync(join(tmpdir(), "loopcheck-"));
const ff = (args) =>
  execFileSync("npx", ["remotion", "ffmpeg", ...args], { stdio: "pipe" });

// The first two frames, and the last one. Seeking from the end avoids having
// to know the frame count, so this works on any clip.
ff(["-y", "-i", video, "-vf", "select=eq(n\\,0)", "-vframes", "1", join(dir, "a.png")]);
ff(["-y", "-i", video, "-vf", "select=eq(n\\,1)", "-vframes", "1", join(dir, "b.png")]);
ff(["-y", "-sseof", "-0.2", "-i", video, "-update", "1", "-q:v", "1", join(dir, "z.png")]);

// --- pixel diff, in a headless browser (no image libraries needed) ---
const chrome = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const PORT = 9336;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
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

const expr = `(async () => {
  const load = async (p) => {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'file://' + p; });
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, 0, 0);
    return x.getImageData(0, 0, c.width, c.height).data;
  };
  const diff = (p, q) => {
    let s = 0, n = 0;
    for (let i = 0; i < p.length; i += 4) {
      s += Math.abs(p[i] - q[i]) + Math.abs(p[i+1] - q[i+1]) + Math.abs(p[i+2] - q[i+2]);
      n += 3;
    }
    return s / n;
  };
  const a = await load('${join(dir, "a.png")}');
  const b = await load('${join(dir, "b.png")}');
  const z = await load('${join(dir, "z.png")}');
  return JSON.stringify({ step: diff(a, b), wrap: diff(z, a) });
})()`;
const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }, sessionId);
const { step, wrap } = JSON.parse(r.result.result.value);
ws.close(); proc.kill();
rmSync(dir, { recursive: true, force: true });

const ratio = wrap / step;
const ok = ratio <= 2.5;
console.log(
  `${ok ? "PASS" : "FAIL"}  ${video.split("/").pop()}  ` +
  `ordinary step=${step.toFixed(3)}  ` +
  `wrap step=${wrap.toFixed(3)}  ratio=${ratio.toFixed(2)}x (want <= 2.5x)`,
);
process.exit(ok ? 0 : 1);
