// Builds a single contact sheet of the generated tree PNGs for quick review.
import { spawn } from "node:child_process";
import { writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = dirname(fileURLToPath(import.meta.url));
const files = process.argv.slice(2);
const chrome = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const PORT = 9334;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const html = `<!doctype html><body style="margin:0;background:#fff;display:flex;align-items:flex-end;gap:8px">
${files.map((f) => `<img src="file://${f}" style="height:640px;border:1px solid #ccc">`).join("")}
</body>`;
if (!process.env.SHEET_HTML) writeFileSync("/tmp/sheet.html", html);
const proc = spawn(chrome, ["--headless=new", `--remote-debugging-port=${PORT}`, "--no-sandbox", "--disable-gpu", "--hide-scrollbars", "--window-size=1400,700", "about:blank"]);
proc.stderr.on("data", () => {});
let wsUrl = null;
for (let i = 0; i < 60 && !wsUrl; i++) { await sleep(400); try { wsUrl = (await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()).webSocketDebuggerUrl; } catch {} }
const ws = new WebSocket(wsUrl); await new Promise((r) => (ws.onopen = r));
let id = 0; const pend = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } };
const send = (method, params = {}, sessionId) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
await send("Page.enable", {}, sessionId);
await send("Emulation.setDeviceMetricsOverride", { width: 1400, height: 700, deviceScaleFactor: 1, mobile: false }, sessionId);
await send("Page.navigate", { url: "file://" + (process.env.SHEET_HTML || "/tmp/sheet.html") }, sessionId);
await sleep(2000);
const shot = await send("Page.captureScreenshot", { format: "png" }, sessionId);
writeFileSync(join(__dirname, "..", "..", "sheet.png"), Buffer.from(shot.data, "base64"));
ws.close(); proc.kill(); process.exit(0);
