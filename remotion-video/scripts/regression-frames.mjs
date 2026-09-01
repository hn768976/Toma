/**
 * Renders a fixed set of frames from the existing search bar compositions and
 * prints a hash of each, so a refactor can be proven not to have changed any
 * output. Bundles once and reuses it, which is far quicker than one
 * `remotion still` invocation per frame.
 *
 * Usage: node scripts/regression-frames.mjs [outputDir]
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(process.argv[2] ?? join(root, "regression-frames"));

const COMPOSITIONS = ["SearchBarCyan", "SearchBarGreen", "SearchBarLight"];
const FRAMES = [0, 90, 170, 250, 300, 420];

const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const browserExecutable = existsSync(playwrightHeadlessShell)
  ? playwrightHeadlessShell
  : null;

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const serveUrl = await bundle({ entryPoint: join(root, "src", "index.ts") });

for (const id of COMPOSITIONS) {
  const composition = await selectComposition({
    serveUrl,
    id,
    inputProps: {},
    browserExecutable,
  });
  for (const frame of FRAMES) {
    const output = join(outDir, `${id}-${String(frame).padStart(3, "0")}.png`);
    await renderStill({
      composition,
      serveUrl,
      output,
      frame,
      scale: 0.5,
      browserExecutable,
      inputProps: {},
    });
    const hash = createHash("sha256").update(readFileSync(output)).digest("hex");
    console.log(`${id} frame ${String(frame).padStart(3, " ")}  ${hash.slice(0, 16)}`);
  }
}
