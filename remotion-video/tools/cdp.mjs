/**
 * Minimal Chrome DevTools Protocol harness shared by the verification tools.
 *
 * Images are handed to the page as data: URLs rather than file:// paths —
 * a file:// image taints the canvas and getImageData then throws, and data:
 * URLs are same-origin by construction.
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const CHROME_CANDIDATES = [
  "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  "/usr/bin/chromium",
  "/usr/bin/google-chrome",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const dataUrl = (file) =>
  `data:image/png;base64,${readFileSync(file).toString("base64")}`;

export async function openBrowser(port = 9340) {
  const chrome = CHROME_CANDIDATES.find((p) => existsSync(p));
  if (!chrome) throw new Error("No Chromium binary found");

  const proc = spawn(chrome, [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    "--no-sandbox",
    "--disable-gpu",
    "--disable-background-networking",
    "--no-first-run",
    "about:blank",
  ]);
  proc.stderr.on("data", () => {});

  let wsUrl = null;
  for (let i = 0; i < 60 && !wsUrl; i++) {
    await sleep(400);
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      wsUrl = (await res.json()).webSocketDebuggerUrl;
    } catch {
      /* not up yet */
    }
  }
  if (!wsUrl) throw new Error("Chromium did not expose a debugging endpoint");

  const ws = new WebSocket(wsUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0;
  const pending = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m);
      pending.delete(m.id);
    }
  };
  const send = (method, params = {}, sessionId) =>
    new Promise((res) => {
      const i = ++id;
      pending.set(i, res);
      ws.send(JSON.stringify({ id: i, method, params, sessionId }));
    });

  const { targetId } = (await send("Target.createTarget", { url: "about:blank" })).result;
  const { sessionId } = (await send("Target.attachToTarget", { targetId, flatten: true })).result;

  const evaluate = async (expression) => {
    const r = await send(
      "Runtime.evaluate",
      { expression, returnByValue: true, awaitPromise: true },
      sessionId,
    );
    if (r.result.exceptionDetails) {
      throw new Error(
        r.result.exceptionDetails.exception?.description ??
          JSON.stringify(r.result.exceptionDetails),
      );
    }
    return r.result.result.value;
  };

  const close = () => {
    ws.close();
    proc.kill();
  };

  return { evaluate, close };
}

/** Loads a PNG into the page and stashes its pixels as `window.__px[name]`. */
export const stashPixels = (name, file) => `(async () => {
  window.__px = window.__px || {};
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = ${JSON.stringify(dataUrl(file))}; });
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0);
  window.__px[${JSON.stringify(name)}] = {
    d: x.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height,
  };
  return true;
})()`;
