// Render stills of several compositions from one bundle and time each.
//   node scripts/stills.mjs --comps CellField-Blue,HeroCell-Blue --frames 0,300 \
//        --scale 0.3333333333333333 --out out/stills [--props '{"durationOverride":601}']
import { bundle } from "@remotion/bundler";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith("--")) acc.push([a.slice(2), arr[i + 1]]);
    return acc;
  }, []),
);
const comps = (args.comps ?? "").split(",").filter(Boolean);
const frames = (args.frames ?? "0").split(",").map(Number);
const scale = Number(args.scale ?? 1 / 3);
const out = args.out ?? "out/stills";
const props = args.props ? JSON.parse(args.props) : {};
const repeat = Number(args.repeat ?? 1);
mkdirSync(out, { recursive: true });

const shell = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const browserExecutable = existsSync(shell) ? shell : null;
const chromiumOptions = { gl: "angle" };

const serveUrl = args.bundle ?? (await bundle({ entryPoint: path.resolve("src/index.ts") }));
const browser = await openBrowser("chrome", { browserExecutable, chromiumOptions });
for (const id of comps) {
  const comp = await selectComposition({ serveUrl, id, inputProps: { rowId: id, ...props }, puppeteerInstance: browser, chromiumOptions });
  for (const f of frames) {
    for (let r = 0; r < repeat; r++) {
      const t0 = performance.now();
      const file = path.join(out, `${id}_f${String(f).padStart(4, "0")}${repeat > 1 ? `_r${r}` : ""}.png`);
      await renderStill({ composition: comp, serveUrl, output: file, frame: f, scale, inputProps: { rowId: id, ...props }, puppeteerInstance: browser, chromiumOptions, overwrite: true, onBrowserLog: (l) => { if (l.text.startsWith("PROF")) console.log(l.text); } });
      console.log(`${id} frame ${f}: ${((performance.now() - t0) / 1000).toFixed(2)}s -> ${file}`);
    }
  }
}
await browser.close({ silent: true });
