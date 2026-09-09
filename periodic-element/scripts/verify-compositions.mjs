/**
 * Renders one still per composition so every card can be checked before a 4K
 * batch is started. A composition nobody looked at fails silently after the
 * render time is already spent.
 *
 * Bundles once and reuses a single browser, which is why this is minutes
 * rather than an hour for 66 compositions.
 *
 *   node scripts/verify-compositions.mjs [--frame=150] [--scale=0.3] [--out=verify]
 */
import { bundle } from "@remotion/bundler";
import { getCompositions, renderStill } from "@remotion/renderer";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=")[1] : fallback;
};

const frame = Number(arg("frame", 150));
const scale = Number(arg("scale", 0.3));
const outDir = path.resolve(arg("out", "verify"));

// Same fallback as remotion.config.ts; the config file does not apply to the
// Node APIs, so it has to be repeated here.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const browserExecutable = existsSync(playwrightHeadlessShell)
  ? playwrightHeadlessShell
  : null;

mkdirSync(outDir, { recursive: true });

console.log("Bundling...");
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });

const comps = await getCompositions(serveUrl, { browserExecutable });
comps.sort((a, b) => a.id.localeCompare(b.id));
console.log(`${comps.length} compositions, frame ${frame}, scale ${scale}\n`);

const started = Date.now();
for (const [i, c] of comps.entries()) {
  const output = path.join(outDir, `${c.id}.png`);
  await renderStill({
    composition: c,
    serveUrl,
    output,
    frame,
    scale,
    browserExecutable,
    overwrite: true,
  });
  console.log(`${String(i + 1).padStart(2)}/${comps.length}  ${c.id}`);
}
console.log(
  `\nDone in ${((Date.now() - started) / 1000).toFixed(1)}s -> ${outDir}`,
);
