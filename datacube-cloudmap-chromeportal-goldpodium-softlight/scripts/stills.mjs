// Render several stills in one browser session. Usage: node scripts/stills.mjs Comp:frame:out.png ...
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition, openBrowser } from "@remotion/renderer";
import path from "node:path";
import fs from "node:fs";
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const exe = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const browserExecutable = fs.existsSync(exe) ? exe : null;
const chromiumOptions = { gl: process.env.GL ?? "angle" };
const scale = Number(process.env.SCALE ?? 0.3333333333333333);
for (const spec of process.argv.slice(2)) {
  const [id, frame, out] = spec.split(":");
  const composition = await selectComposition({ serveUrl, id, browserExecutable, chromiumOptions });
  await renderStill({ composition, serveUrl, output: out, frame: Number(frame), scale, browserExecutable, chromiumOptions, timeoutInMilliseconds: 900000,
    onBrowserLog: (l) => { if (l.type === "error") console.log("[browser error]", l.text.slice(0, 1500)); } });
  console.log("wrote", out);
}
