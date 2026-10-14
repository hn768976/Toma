// node scripts/debug-still.mjs <compId> <frame> <out.png> [scale]
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { existsSync } from "node:fs";
import path from "node:path";

const [id, frame = "0", out = "out/debug.png", scale = String(1 / 3)] = process.argv.slice(2);
const exe = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const chromiumOptions = { gl: "angle" };
const browserExecutable = existsSync(exe) ? exe : undefined;
const composition = await selectComposition({ serveUrl, id, chromiumOptions, browserExecutable });
const t0 = Date.now();
await renderStill({
  serveUrl, composition, frame: Number(frame), output: out, scale: Number(scale), chromiumOptions, browserExecutable,
  overwrite: true, imageFormat: "png", timeoutInMilliseconds: 240000,
  onBrowserLog: (l) => { if (/Shader Error|ERROR:/.test(l.text)) process.exitCode = 3; if (!/GPU stall|GroupMarker/.test(l.text)) console.log("[browser]", l.type, l.text.slice(0, 500)); },
});
console.log("still done in", Date.now() - t0, "ms");
