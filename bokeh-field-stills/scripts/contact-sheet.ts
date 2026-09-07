/**
 * Tiles all 36 stills into out/contact-sheet.png for review at a glance.
 *
 *   npm run contact-sheet          (after npm run batch)
 *
 * The tiles are true downscales of the delivered 4K PNGs rather than fresh
 * renders at a smaller size, so what you review is what ships. Downscaling is
 * done here in Node (scripts/lib/png.ts, no image dependency); the tiles are
 * dropped into public/ just long enough for the ContactSheet composition to
 * pick them up, then removed again.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { existsSync } from "node:fs";
import { decodePng, downsample, encodePng } from "./lib/png.ts";
import { buildMatrix } from "./lib/matrix.ts";
import { findRoot } from "./lib/root.ts";
import { SHEET, TILE_DIR } from "../src/contact/layout.ts";

const ROOT = findRoot();
const STILLS_DIR = path.join(ROOT, "out", "stills");
const TILE_OUT = path.join(ROOT, "public", TILE_DIR);
const OUTPUT = path.join(ROOT, "out", "contact-sheet.png");

const PLAYWRIGHT_SHELL =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const browserExecutable = existsSync(PLAYWRIGHT_SHELL) ? PLAYWRIGHT_SHELL : null;

const main = async () => {
  const variants = buildMatrix();
  const missing = variants.filter((variant) => !existsSync(path.join(STILLS_DIR, variant.file)));
  if (missing.length > 0) {
    console.error(
      `Missing ${missing.length} still(s) in ${STILLS_DIR}. Run \`npm run batch\` first.`,
    );
    console.error(missing.map((variant) => `  ${variant.file}`).join("\n"));
    process.exit(1);
  }

  rmSync(TILE_OUT, { recursive: true, force: true });
  mkdirSync(TILE_OUT, { recursive: true });

  variants.forEach((variant, index) => {
    const source = decodePng(readFileSync(path.join(STILLS_DIR, variant.file)));
    const tile = downsample(source, SHEET.tileWidth, SHEET.tileHeight);
    writeFileSync(path.join(TILE_OUT, variant.file), encodePng(tile));
    process.stdout.write(`\rThumbnailing ${index + 1}/${variants.length}`);
  });
  process.stdout.write("\n");

  const tiles = variants.map((variant) => ({
    file: variant.file,
    // Filenames carry the parameters already; the sheet only needs the
    // distinguishing part.
    label: variant.name.replace(/^bokeh-/, ""),
  }));

  try {
    const serveUrl = await bundle({
      entryPoint: path.join(ROOT, "src", "index.ts"),
      onProgress: () => undefined,
    });

    const composition = await selectComposition({
      serveUrl,
      id: "ContactSheet",
      inputProps: { tiles },
      browserExecutable,
    });

    await renderStill({
      composition,
      serveUrl,
      output: OUTPUT,
      inputProps: { tiles },
      imageFormat: "png",
      overwrite: true,
      browserExecutable,
      chromiumOptions: { gl: "angle" },
      timeoutInMilliseconds: 180_000,
    });

    console.log(`Wrote ${OUTPUT} (${composition.width}x${composition.height})`);
  } finally {
    // The tiles are derived files; leaving them in public/ would bloat the
    // packaged project. Re-run this script to regenerate them.
    rmSync(TILE_OUT, { recursive: true, force: true });
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
