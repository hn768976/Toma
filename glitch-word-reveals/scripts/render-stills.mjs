// Renders PNG stills for every composition (all 24 words) with the same CLI
// the README documents, so stills match video frames pixel for pixel.
//   node scripts/render-stills.mjs              -> 1080p, frames 60 and 200
//   node scripts/render-stills.mjs --hires      -> 6000x3375, frame 200
//   node scripts/render-stills.mjs --only=DataRain-BIG-DATA
// Also writes layout-report.json (measured size, width share, 88% rule).
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getCompositions, openBrowser } from "@remotion/renderer";
import { browserExecutable, chromiumOptions, outputNameFromId, root } from "./common.mjs";

const hires = process.argv.includes("--hires");
const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7);
const scale = hires ? 6000 / 3840 : 0.5;
const frames = hires ? [200] : [60, 200];
const outDir = path.join(root, "out", hires ? "stills-6000x3375" : "stills-1080p");
mkdirSync(outDir, { recursive: true });

const bundleDir = path.join(root, "out", "bundle");
execFileSync("npx", ["remotion", "bundle", "--out-dir", bundleDir, "--log=error"], { cwd: root, stdio: "inherit" });

// Composition list + measured layouts (calculateMetadata runs here).
const browser = await openBrowser("chrome", { browserExecutable, chromiumOptions });
const comps = await getCompositions(bundleDir, { puppeteerInstance: browser, browserExecutable, chromiumOptions });
await browser.close({ silent: true });

const report = [];
for (const c of comps) {
  const L = c.props.layout;
  report.push({
    id: c.id,
    word: c.props.word,
    capHeight: +L.capHeight.toFixed(5),
    widthOfFrame: +((L.width * c.height) / c.width).toFixed(4),
    scaledDown: L.scaledDown,
    scale: +L.scale.toFixed(4),
  });
  if (only && c.id !== only) continue;
  for (const frame of frames) {
    const output = path.join(outDir, `${outputNameFromId(c.id)}_f${String(frame).padStart(3, "0")}.png`);
    execFileSync(
      "npx",
      ["remotion", "still", bundleDir, c.id, output, `--frame=${frame}`, `--scale=${scale}`, "--image-format=png", "--log=error"],
      { cwd: root, stdio: "inherit" },
    );
    console.log(`${c.id} f${frame} -> ${path.relative(root, output)}`);
  }
}
console.table(report);
writeFileSync(path.join(outDir, "layout-report.json"), JSON.stringify(report, null, 2));
