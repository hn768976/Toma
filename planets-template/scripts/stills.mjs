#!/usr/bin/env node
// Render the hero-frame still (Spin 300 / Crescent 400) of compositions to
// PNG at a given scale, reusing one bundle and one browser.
// Usage: node scripts/stills.mjs --out=out/stills [--scale=0.3333333333333333] [--only=Planet-Mars-Spin,...]
import { bundle } from "@remotion/bundler";
import { getCompositions, renderStill, openBrowser } from "@remotion/renderer";
import fs from "node:fs";
import path from "node:path";

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")));
const out = args.out ?? "out/stills";
const scale = Number(args.scale ?? 1 / 3);
const only = args.only ? args.only.split(",") : null;
const frameOverride = args.frame !== undefined ? Number(args.frame) : null;
fs.mkdirSync(out, { recursive: true });

const serveUrl = args.bundle ?? (await bundle({ entryPoint: path.resolve("src/index.ts") }));
const gl = process.env.REMOTION_GL ?? "angle";
const browserExecutable = fs.existsSync("/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell")
  ? "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell" : null;
const browser = await openBrowser("chrome", { browserExecutable, chromiumOptions: { gl } });
const comps = await getCompositions(serveUrl, { puppeteerInstance: browser, browserExecutable, chromiumOptions: { gl } });
const index = [];
for (const c of comps) {
  if (only && !only.includes(c.id)) continue;
  const frame = frameOverride ?? (c.id.endsWith("-Spin") ? 300 : 400);
  const file = path.join(out, `${c.id}_f${frame}.png`);
  const t0 = Date.now();
  await renderStill({
    composition: c, serveUrl, output: file, frame, scale, imageFormat: "png",
    puppeteerInstance: browser, browserExecutable, chromiumOptions: { gl },
    timeoutInMilliseconds: 300000, overwrite: true,
  });
  console.log(`${c.id} frame ${frame} -> ${file} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  index.push({ n: comps.indexOf(c) + 1, id: c.id, name: c.id.replace(/-/g, "_"), frame, file: path.basename(file) });
}
if (!only) fs.writeFileSync(path.join(out, "index.json"), JSON.stringify(index, null, 2));
await browser.close({ silent: true });
