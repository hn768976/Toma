// Fast still-preview harness.
//
// `remotion still` re-bundles on every invocation, which dominates the time
// when you are tuning shader constants. This bundles once and then renders any
// number of (composition, frame, props) stills from that single bundle.
//
// Usage:
//   node scripts/preview.mjs out/dir spec.json
// where spec.json is an array of { id, frame, props?, name? }.

import { bundle } from "@remotion/bundler";
import { enableTailwind } from "@remotion/tailwind-v4";
import { renderStill, selectComposition } from "@remotion/renderer";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

const [, , outDir, specPath] = process.argv;
if (!outDir || !specPath) {
  console.error("usage: node scripts/preview.mjs <outDir> <spec.json>");
  process.exit(1);
}

const spec = JSON.parse(readFileSync(specPath, "utf8"));
mkdirSync(outDir, { recursive: true });

const headlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const browserExecutable = existsSync(headlessShell) ? headlessShell : null;

console.log("bundling...");
const t0 = Date.now();
const serveUrl = await bundle({
  entryPoint: path.resolve("src/index.ts"),
  webpackOverride: enableTailwind,
});
console.log(`bundled in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

for (const item of spec) {
  const name = item.name ?? `${item.id}-f${item.frame}`;
  const output = path.join(outDir, `${name}.png`);
  const t = Date.now();
  const composition = await selectComposition({
    serveUrl,
    id: item.id,
    inputProps: item.props ?? {},
    browserExecutable,
  });
  await renderStill({
    composition,
    serveUrl,
    output,
    frame: item.frame ?? 0,
    inputProps: item.props ?? {},
    browserExecutable,
    scale: item.scale ?? 1,
    overwrite: true,
  });
  console.log(`${name}  ${((Date.now() - t) / 1000).toFixed(1)}s`);
}
console.log("done");
