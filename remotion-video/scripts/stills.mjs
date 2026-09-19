/**
 * Contact-sheet helper: renders one still per requested composition off a
 * single bundle — much faster than `remotion still`, which re-bundles on every
 * invocation. Useful when dialling in a look.
 *
 *   node scripts/stills.mjs '[{"id":"V1-Obsidian","frame":60}]'
 */
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { enableTailwind } from "@remotion/tailwind-v4";
import path from "node:path";

import { existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = process.env.STILLS_OUT ?? path.join(root, "out", "stills");
mkdirSync(out, { recursive: true });
const jobs = JSON.parse(process.argv[2]); // [{id, frame, width?, height?, props?}]

const serveUrl = await bundle({
  entryPoint: path.join(root, "src/index.ts"),
  webpackOverride: enableTailwind,
  onProgress: () => {},
});

const playwright = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const browserExecutable = existsSync(playwright) ? playwright : null;

for (const job of jobs) {
  const composition = await selectComposition({
    serveUrl,
    id: job.id,
    inputProps: job.props ?? {},
    browserExecutable,
  });
  const started = Date.now();
  await renderStill({
    composition: {
      ...composition,
      width: job.width ?? composition.width,
      height: job.height ?? composition.height,
    },
    serveUrl,
    output: path.join(out, `${job.id}-${job.frame}.png`),
    frame: job.frame,
    inputProps: job.props ?? {},
    browserExecutable,
    overwrite: true,
  });
  console.log(job.id, job.frame, `${Date.now() - started}ms`);
}
