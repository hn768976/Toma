// Batch stills via the Remotion Node API (bundles once, reuses one browser).
// Usage: node scripts/stills.mjs --scale=0.5 --frames=180,235,450 --out=out/stills [WORD ...]
import { bundle } from "@remotion/bundler";
import { ensureBrowser, getCompositions, openBrowser, renderStill, selectComposition } from "@remotion/renderer";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const args = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.startsWith("--")).map((a) => a.slice(2).split("=")),
);
const words = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const scale = Number(args.scale ?? 0.5);
const frames = (args.frames ?? "180,235,450").split(",").map(Number);
const outDir = args.out ?? "out/stills";
mkdirSync(outDir, { recursive: true });

const shell = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const browserExecutable = existsSync(shell) ? shell : null;
if (!browserExecutable) await ensureBrowser();
const chromiumOptions = { gl: "angle" };

const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const browser = await openBrowser("chrome", { browserExecutable, chromiumOptions });
// Default: every Reveal-* composition defined in src/acronyms.ts.
const list = words.length
  ? words
  : (await getCompositions(serveUrl, { puppeteerInstance: browser, chromiumOptions, browserExecutable }))
      .map((c) => c.id)
      .filter((id) => id.startsWith("Reveal-"))
      .map((id) => id.slice("Reveal-".length));
for (const word of list) {
  const id = `Reveal-${word}`;
  const composition = await selectComposition({ serveUrl, id, puppeteerInstance: browser, chromiumOptions, browserExecutable });
  for (const frame of frames) {
    const output = path.join(outDir, `Reveal_${word}_f${String(frame).padStart(3, "0")}.png`);
    const t = Date.now();
    await renderStill({ serveUrl, composition, frame, output, scale, imageFormat: "png", puppeteerInstance: browser, chromiumOptions, browserExecutable, overwrite: true });
    console.log(`${output}  ${Date.now() - t}ms`);
  }
}
await browser.close({ silent: true });
