/**
 * Renders every tooth version in one go.
 *
 * Uses the Node APIs rather than twelve `remotion render` calls so the project
 * is bundled once instead of twelve times, which is most of the wall clock on a
 * machine without a GPU.
 *
 *   node scripts/render-all.mjs                  # all versions, 1080p
 *   node scripts/render-all.mjs --res=4k         # all versions, 3840x2160
 *   node scripts/render-all.mjs --only=01,07     # just those versions
 *   node scripts/render-all.mjs --out=some/dir
 *
 * Note that remotion.config.ts does NOT apply to the Node APIs, so everything
 * that matters (browser, image format, concurrency) is set explicitly below.
 */

import { bundle } from "@remotion/bundler";
import { getCompositions, renderMedia } from "@remotion/renderer";
import { enableTailwind } from "@remotion/tailwind-v4";
import { existsSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : fallback;
};

const resolution = arg("res", "1080p").toLowerCase();
const suffix = resolution === "4k" ? "4K" : "1080p";
const only = arg("only", "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const outDir = path.resolve(ROOT, arg("out", `out/${suffix}`));
const crf = Number(arg("crf", "16"));
const concurrency = Number(arg("concurrency", String(Math.max(1, os.cpus().length))));

/**
 * Some sandboxed environments block Remotion's own Chrome download but ship a
 * Playwright Chromium. Mirrors the fallback in remotion.config.ts.
 */
const playwrightShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const browserExecutable = existsSync(playwrightShell) ? playwrightShell : null;

const main = async () => {
  mkdirSync(outDir, { recursive: true });

  process.stdout.write("Bundling... ");
  const serveUrl = await bundle({
    entryPoint: path.join(ROOT, "src/index.ts"),
    webpackOverride: enableTailwind,
    onProgress: () => undefined,
  });
  process.stdout.write("done\n");

  const all = await getCompositions(serveUrl, { browserExecutable });
  const targets = all
    .filter((c) => c.id.startsWith("Tooth-") && c.id.endsWith(`-${suffix}`))
    .filter((c) => only.length === 0 || only.some((n) => c.id.startsWith(`Tooth-${n}`)))
    .sort((a, b) => a.id.localeCompare(b.id));

  if (targets.length === 0) {
    throw new Error(`No compositions matched (resolution ${suffix}, only=${only})`);
  }

  console.log(
    `Rendering ${targets.length} composition(s) at ${targets[0].width}x${targets[0].height}, ` +
      `concurrency ${concurrency}, crf ${crf}\n`,
  );

  const started = Date.now();
  for (const [index, composition] of targets.entries()) {
    const name = composition.id.replace(/^Tooth-/, "").replace(/-(1080p|4K)$/, "");
    const outputLocation = path.join(outDir, `${name}-${suffix}.mp4`);
    const label = `[${index + 1}/${targets.length}] ${name}`;
    const t0 = Date.now();
    let lastShown = -1;

    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation,
      crf,
      // These are visual loops with no sound design; without this Remotion
      // muxes a silent AAC track that only costs bitrate.
      muted: true,
      // PNG rather than the project default of JPEG: these scenes are mostly
      // wide, smooth gradients, where JPEG's intermediate artefacts survive
      // into the H.264 encode as blocking.
      imageFormat: "png",
      pixelFormat: "yuv420p",
      concurrency,
      browserExecutable,
      chromiumOptions: { gl: "angle" },
      onProgress: ({ progress }) => {
        const pct = Math.floor(progress * 100);
        if (pct >= lastShown + 5) {
          lastShown = pct;
          process.stdout.write(`\r${label} ${pct}%   `);
        }
      },
    });

    const seconds = ((Date.now() - t0) / 1000).toFixed(0);
    console.log(
      `\r${label} done in ${seconds}s -> ${path.relative(ROOT, outputLocation)}` +
        " ".repeat(10),
    );
  }

  console.log(
    `\nAll ${targets.length} rendered in ${((Date.now() - started) / 60000).toFixed(1)} min -> ${path.relative(ROOT, outDir)}`,
  );
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
