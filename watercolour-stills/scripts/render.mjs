// Renders the Still compositions to PNG.
//
//   node scripts/render.mjs                    all 35 at 6000x3375 -> out/stills
//   node scripts/render.mjs --only 1,6,WC-03-GradedSky-OceanBlues
//   node scripts/render.mjs --preview 1920     quick look, painted at 1920 wide -> out/preview
//   node scripts/render.mjs --out out/rerun    other output folder
//   node scripts/render.mjs --parallel 2       stills rendered at the same time
//   node scripts/render.mjs --paint-scale 1    paint at full output size instead of the data default
import { bundle } from "@remotion/bundler";
import { getCompositions, openBrowser, renderStill } from "@remotion/renderer";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const preview = Number(arg("preview", 0));
const outDir = path.resolve(root, arg("out", preview ? "out/preview" : "out/stills"));
const only = arg("only", "");
const parallel = Number(arg("parallel", 1));
const tuning = arg("tuning", "") ? JSON.parse(arg("tuning")) : undefined;
const paintScale = arg("paint-scale", "") ? Number(arg("paint-scale")) : undefined;
mkdirSync(outDir, { recursive: true });

const headless = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const browserExecutable = existsSync(headless) ? headless : null;
const chromiumOptions = { gl: "swangle" };

console.log("bundling…");
const serveUrl = await bundle({ entryPoint: path.join(root, "src/index.ts") });
const browser = await openBrowser("chrome", { browserExecutable, chromiumOptions });

const comps = await getCompositions(serveUrl, { browserExecutable, chromiumOptions, puppeteerInstance: browser });
const wanted = only ? only.split(",").map((s) => s.trim()) : null;
const matches = (c) =>
  !wanted ||
  wanted.some((w) => (/^\d+$/.test(w) ? c.id.startsWith(`WC-${w.padStart(2, "0")}-`) : c.id === w));
// test compositions (WC-00-*) and -native variants only render when asked for by id
const todo = wanted ? comps.filter(matches) : comps.filter((c) => !c.id.startsWith("WC-00-") && !c.id.endsWith("-native"));

const timingsFile = path.join(outDir, "timings.json");
const timings = existsSync(timingsFile) ? JSON.parse(readFileSync(timingsFile, "utf8")) : {};
const fileFor = (c) => c.id.replace(/-/g, "_") + ".png";

const renderOne = async (c) => {
  let composition = preview
    ? { ...c, width: preview, height: Math.round((preview * 9) / 16), props: { ...c.props, paintScale: 1 } }
    : c;
  if (tuning) composition = { ...composition, props: { ...composition.props, tuning } };
  if (paintScale) composition = { ...composition, props: { ...composition.props, paintScale } };
  const output = path.join(outDir, fileFor(c));
  let timing = null;
  const t0 = Date.now();
  await renderStill({
    composition,
    serveUrl,
    output,
    imageFormat: "png",
    inputProps: composition.props,
    browserExecutable,
    chromiumOptions,
    puppeteerInstance: browser,
    timeoutInMilliseconds: 1_800_000,
    overwrite: true,
    onBrowserLog: (log) => {
      const m = /wc-timing (.*)/.exec(log.text);
      if (m) timing = m[1];
      else if (log.text.includes("wc-prof")) console.log(`  ${log.text}`);
      else if (log.type === "error") console.log(`  [browser] ${log.text}`);
    },
  });
  const secs = (Date.now() - t0) / 1000;
  timings[path.basename(output)] = { totalSeconds: secs, detail: timing, size: `${composition.width}x${composition.height}` };
  writeFileSync(timingsFile, JSON.stringify(timings, null, 2));
  console.log(`${path.basename(output)}  ${secs.toFixed(1)}s  (${timing})`);
};

const queue = [...todo];
console.log(`rendering ${queue.length} still(s) -> ${path.relative(root, outDir)}`);
await Promise.all(
  Array.from({ length: Math.max(1, parallel) }, async () => {
    while (queue.length) await renderOne(queue.shift());
  }),
);
await browser.close({ silent: true });
