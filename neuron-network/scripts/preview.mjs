/**
 * Bundle once, then render stills for any set of compositions.
 *
 *   node scripts/preview.mjs --frames=0,300 --scale=0.5 HeroNeuronMatted ...
 *
 * Used during development to look at several looks at once without paying
 * the bundling cost each time.
 */
import { bundle } from "@remotion/bundler";
import { getCompositions, renderStill } from "@remotion/renderer";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=")[1] : dflt;
};
const ids = args.filter((a) => !a.startsWith("--"));
const frames = flag("frames", "0").split(",").map(Number);
const scale = Number(flag("scale", "0.5"));
const outDir = flag("out", "out/preview");
const concurrency = Number(flag("concurrency", "2"));

const shell = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const browserExecutable = existsSync(shell) ? shell : null;

mkdirSync(outDir, { recursive: true });

const t0 = Date.now();
const serveUrl = await bundle({
  entryPoint: path.resolve("src/index.ts"),
  onProgress: () => {},
});
console.log(`bundled in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

const comps = await getCompositions(serveUrl, { browserExecutable });
const targets = comps.filter((c) => ids.length === 0 || ids.includes(c.id));

const jobs = [];
for (const comp of targets) for (const frame of frames) jobs.push({ comp, frame });

let cursor = 0;
const timings = [];
const worker = async () => {
  while (cursor < jobs.length) {
    const { comp, frame } = jobs[cursor++];
    const start = Date.now();
    const output = path.join(outDir, `${comp.id}_f${frame}.png`);
    await renderStill({
      composition: comp,
      serveUrl,
      output,
      frame,
      scale,
      browserExecutable,
      chromiumOptions: { gl: "angle" },
      timeoutInMilliseconds: 300000,
      overwrite: true,
    });
    const ms = Date.now() - start;
    timings.push({ id: comp.id, frame, ms });
    console.log(`${comp.id} f${frame}  ${(ms / 1000).toFixed(1)}s  -> ${output}`);
  }
};

await Promise.all(Array.from({ length: concurrency }, worker));
const total = (Date.now() - t0) / 1000;
console.log(`\n${jobs.length} stills in ${total.toFixed(1)}s`);
