/**
 * Renders the twenty-four sphere-ripple stills (twelve compositions × two
 * palettes each) at 4K, then tiles them into a contact sheet.
 *
 *   npm run render:batch                 # everything
 *   npm run render:batch -- r01 r08      # only those compositions
 *   npm run render:batch -- --sheet-only # re-tile what is already rendered
 *
 * The project is bundled once and reused for all twenty-four renders, which
 * is the only difference from calling the CLI twenty-four times:
 *
 *   npx remotion still SphereRipple out/stills/ripple-r01-cobalt.png \
 *     --props='{"composition":"r01","palette":"cobalt"}'
 */
import { bundle } from "@remotion/bundler";
import { enableTailwind } from "@remotion/tailwind-v4";
import { renderStill, selectComposition } from "@remotion/renderer";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const STILLS_DIR = path.join(ROOT, "out", "stills");
const SHEET_PATH = path.join(ROOT, "out", "contact-sheet.png");

/**
 * Palette pairs, chosen so the finished set does not read as twelve blues.
 */
const PAIRS: Record<string, [string, string]> = {
  r01: ["cobalt", "violet"],
  r02: ["cyan", "emerald"],
  r03: ["violet", "amber"],
  r04: ["emerald", "cobalt"],
  r05: ["amber", "cyan"],
  r06: ["crimson", "cobalt"],
  r07: ["violet", "crimson"],
  r08: ["cobalt", "cyan"],
  r09: ["emerald", "violet"],
  r10: ["amber", "cobalt"],
  r11: ["crimson", "emerald"],
  r12: ["cyan", "amber"],
};

/**
 * The Node APIs do not read remotion.config.ts, so the sandbox-friendly
 * browser lookup from that file is repeated here: some environments block
 * Remotion's own Chrome download but ship a Playwright Chromium.
 */
const BROWSER_CANDIDATES = [
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell",
  "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  "/opt/pw-browsers/chromium",
];
const browserExecutable = BROWSER_CANDIDATES.find((p) => existsSync(p)) ?? null;

type Job = { composition: string; palette: string; name: string; file: string };

const buildJobs = (only: string[]): Job[] => {
  const ids = Object.keys(PAIRS).filter(
    (id) => only.length === 0 || only.includes(id),
  );
  return ids.flatMap((composition) =>
    PAIRS[composition].map((palette) => {
      const name = `ripple-${composition}-${palette}`;
      return {
        composition,
        palette,
        name,
        file: path.join(STILLS_DIR, `${name}.png`),
      };
    }),
  );
};

const renderAll = async (jobs: Job[]) => {
  mkdirSync(STILLS_DIR, { recursive: true });

  console.log("Bundling…");
  const serveUrl = await bundle({
    entryPoint: path.join(ROOT, "src", "index.ts"),
    // Persistent webpack caching has been observed serving a stale bundle
    // after edits to the composition data, which silently renders the
    // previous version of a still. Correctness beats a faster re-bundle.
    webpackOverride: (config) => ({ ...enableTailwind(config), cache: false }),
    onProgress: () => undefined,
  });

  let done = 0;
  for (const job of jobs) {
    const inputProps = {
      composition: job.composition,
      palette: job.palette,
    };
    const composition = await selectComposition({
      serveUrl,
      id: "SphereRipple",
      inputProps,
      browserExecutable,
    });
    const started = Date.now();
    await renderStill({
      serveUrl,
      composition,
      output: job.file,
      inputProps,
      imageFormat: "png",
      overwrite: true,
      timeoutInMilliseconds: 600000,
      browserExecutable,
    });
    done++;
    console.log(
      `  [${String(done).padStart(2, " ")}/${jobs.length}] ${job.name}.png ` +
        `(${((Date.now() - started) / 1000).toFixed(1)}s)`,
    );
  }
};

/** Four columns, so each composition's two palettes always sit side by side. */
const SHEET_WIDTH = 3840;
const COLS = 4;
const MARGIN = 32;
const GUTTER = 24;
const LABEL_H = 38;

const buildContactSheet = async (jobs: Job[]) => {
  const present = jobs.filter((j) => existsSync(j.file));
  if (present.length === 0) {
    console.log("No stills found — nothing to tile.");
    return;
  }

  const cellW = Math.floor(
    (SHEET_WIDTH - MARGIN * 2 - GUTTER * (COLS - 1)) / COLS,
  );
  const cellH = Math.round((cellW * 9) / 16);
  const rows = Math.ceil(present.length / COLS);
  const sheetH = MARGIN * 2 + rows * (cellH + LABEL_H) + (rows - 1) * GUTTER;

  const tiles = await Promise.all(
    present.map(async (job, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      return {
        input: await sharp(job.file).resize(cellW, cellH).png().toBuffer(),
        left: MARGIN + col * (cellW + GUTTER),
        top: MARGIN + row * (cellH + LABEL_H + GUTTER),
      };
    }),
  );

  const labels = present
    .map((job, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = MARGIN + col * (cellW + GUTTER);
      const y = MARGIN + row * (cellH + LABEL_H + GUTTER) + cellH + 27;
      return `<text x="${x}" y="${y}" font-family="monospace" font-size="21" fill="#8a93a8">${job.composition} · ${job.palette}</text>`;
    })
    .join("");

  const overlay = Buffer.from(
    `<svg width="${SHEET_WIDTH}" height="${sheetH}" xmlns="http://www.w3.org/2000/svg">${labels}</svg>`,
  );

  await sharp({
    create: {
      width: SHEET_WIDTH,
      height: sheetH,
      channels: 3,
      background: { r: 8, g: 9, b: 14 },
    },
  })
    .composite([...tiles, { input: overlay, left: 0, top: 0 }])
    .png()
    .toFile(SHEET_PATH);

  console.log(`Contact sheet → ${path.relative(ROOT, SHEET_PATH)}`);
};

const main = async () => {
  const args = process.argv.slice(2);
  const sheetOnly = args.includes("--sheet-only");
  const only = args.filter((a) => !a.startsWith("--"));
  const jobs = buildJobs(only);

  if (!sheetOnly) await renderAll(jobs);
  await buildContactSheet(buildJobs([]));
};

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
