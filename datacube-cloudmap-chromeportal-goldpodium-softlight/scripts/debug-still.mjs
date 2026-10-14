// Usage: node scripts/debug-still.mjs <compId> <frame> <out.png> [scale]
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";
const [id, frame = "0", out = "out/debug.png", scale = "0.3333333333333333"] = process.argv.slice(2);
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const exe = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const chromiumOptions = { gl: process.env.GL ?? "angle" };
const comp = await selectComposition({ serveUrl, id, browserExecutable: exe, chromiumOptions });
const t0 = Date.now();
await renderStill({
  composition: comp, serveUrl, output: out, frame: Number(frame), scale: Number(scale),
  browserExecutable: exe, chromiumOptions,
  onBrowserLog: (l) => console.log(`[browser ${l.type}]`, l.text.slice(0, 4000)),
});
console.log("ms", Date.now() - t0);
