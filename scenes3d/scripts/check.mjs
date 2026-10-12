// Verification helper. Bundles once, keeps one browser open.
//
//   node scripts/check.mjs stills <outDir> <scale> <frames,csv> [ids...]
//   node scripts/check.mjs loop <outDir> <scale> [ids...]
//   node scripts/check.mjs determinism <outDir> <scale> [ids...]
//   node scripts/check.mjs timing <outDir> <scale> <nFrames> [ids...]
//
// ids default to every non-dev composition.
import { bundle } from "@remotion/bundler";
import {
  getCompositions,
  openBrowser,
  renderFrames,
  renderStill,
  selectComposition,
} from "@remotion/renderer";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";

const [mode, outDir, scaleArg, ...rest] = process.argv.slice(2);
const scale = Number(scaleArg);
mkdirSync(outDir, { recursive: true });

const HS = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const browserExecutable = existsSync(HS) ? HS : null;
const chromiumOptions = { gl: "angle" };

const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const newBrowser = () => openBrowser("chrome", { browserExecutable, chromiumOptions });
let browser = await newBrowser();

const all = (await getCompositions(serveUrl, { puppeteerInstance: browser, browserExecutable, chromiumOptions }))
  .map((c) => c.id)
  .filter((id) => !id.startsWith("Dev-"));

const pick = (args) => (args.length ? args : all);

const still = async (id, frame, file, inputProps = {}, b = browser) => {
  const composition = await selectComposition({
    serveUrl,
    id,
    inputProps,
    puppeteerInstance: b,
    browserExecutable,
    chromiumOptions,
  });
  const t0 = performance.now();
  await renderStill({
    serveUrl,
    composition,
    frame,
    output: file,
    imageFormat: "png",
    scale,
    inputProps,
    puppeteerInstance: b,
    browserExecutable,
    chromiumOptions,
    overwrite: true,
  });
  return performance.now() - t0;
};

const same = (a, b) => readFileSync(a).equals(readFileSync(b));

if (mode === "stills") {
  const frames = rest[0].split(",").map(Number);
  for (const id of pick(rest.slice(1))) {
    for (const f of frames) {
      const ms = await still(id, f, path.join(outDir, `${id}_f${f}.png`));
      console.log(`${id} frame ${f}: ${ms.toFixed(0)} ms`);
    }
  }
} else if (mode === "loop") {
  for (const id of pick(rest)) {
    const a = path.join(outDir, `${id}_loop0.png`);
    const b = path.join(outDir, `${id}_loop600.png`);
    await still(id, 0, a, { rowId: id, loopCheck: true });
    await still(id, 600, b, { rowId: id, loopCheck: true });
    console.log(`LOOP ${id}: ${same(a, b) ? "IDENTICAL" : "DIFFERENT"}`);
  }
} else if (mode === "determinism") {
  for (const id of pick(rest)) {
    // Frame 300 as part of a sequence (frames 290-300 in one page) ...
    const seqDir = path.join(outDir, `${id}_seq`);
    rmSync(seqDir, { recursive: true, force: true });
    const composition = await selectComposition({ serveUrl, id, puppeteerInstance: browser, browserExecutable, chromiumOptions });
    await renderFrames({
      serveUrl,
      composition,
      frameRange: [290, 300],
      imageFormat: "png",
      outputDir: seqDir,
      scale,
      inputProps: {},
      puppeteerInstance: browser,
      browserExecutable,
      chromiumOptions,
      concurrency: 2,
      onStart: () => {},
      onFrameUpdate: () => {},
    });
    const seqFile = path.join(
      seqDir,
      readdirSync(seqDir).filter((f) => f.endsWith(".png")).sort().pop(),
    );
    // ... versus frame 300 alone, from a cold browser.
    const cold = await newBrowser();
    const coldFile = path.join(outDir, `${id}_cold300.png`);
    await still(id, 300, coldFile, {}, cold);
    await cold.close({ silent: true });
    console.log(`DETERMINISM ${id}: ${same(seqFile, coldFile) ? "BYTE-IDENTICAL" : "DIFFERENT"} (${path.basename(seqFile)})`);
  }
} else if (mode === "timing") {
  const n = Number(rest[0]);
  for (const id of pick(rest.slice(1))) {
    const dir = path.join(outDir, `${id}_timing`);
    rmSync(dir, { recursive: true, force: true });
    const composition = await selectComposition({ serveUrl, id, puppeteerInstance: browser, browserExecutable, chromiumOptions });
    const t0 = performance.now();
    await renderFrames({
      serveUrl,
      composition,
      frameRange: [300 - Math.floor(n / 2), 300 - Math.floor(n / 2) + n - 1],
      imageFormat: "png",
      outputDir: dir,
      scale,
      inputProps: {},
      puppeteerInstance: browser,
      browserExecutable,
      chromiumOptions,
      concurrency: 1,
      onStart: () => {},
      onFrameUpdate: () => {},
    });
    const ms = (performance.now() - t0) / n;
    console.log(`TIMING ${id} @scale ${scale}: ${ms.toFixed(0)} ms/frame (concurrency 1, ${n} frames, incl. page setup)`);
  }
}
await browser.close({ silent: true });
