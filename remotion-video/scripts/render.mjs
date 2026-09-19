/**
 * Batch renderer for the bloodstream versions.
 *
 * Bundles once and reuses a single browser across every composition, which is
 * substantially faster than invoking `remotion render` per version, and pins
 * the delivery settings in one place so all six files match.
 *
 *   node scripts/render.mjs                 # all six, 1080p
 *   node scripts/render.mjs V2 V5           # just those, 1080p
 *   node scripts/render.mjs --uhd           # all six, 4K
 *   node scripts/render.mjs --matte         # include the V5 matte pass
 *   node scripts/render.mjs --concurrency=8
 */
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { enableTailwind } from "@remotion/tailwind-v4";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const VERSIONS = [
  "V1-Obsidian",
  "V2-VesselCore",
  "V3-CrimsonGold",
  "V4-Luminous",
  "V5-DeepField",
  "V6-EmberBokeh",
];

/** The one reference that ships a matte pass; mirrored here. */
const MATTE = "V5-DeepField-Matte";

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const picked = args.filter((a) => !a.startsWith("--"));
const concurrency = Number(
  args.find((a) => a.startsWith("--concurrency="))?.split("=")[1] ?? 4,
);

const uhd = flags.has("--uhd");
const suffix = uhd ? "-4K" : "";
const label = uhd ? "2160p" : "1080p";

const selected = picked.length
  ? VERSIONS.filter((id) => picked.some((p) => id.toLowerCase().startsWith(p.toLowerCase())))
  : VERSIONS;
const ids = [...selected, ...(flags.has("--matte") ? [MATTE] : [])].map((id) => `${id}${suffix}`);

if (!ids.length) {
  console.error(`No compositions matched. Known versions:\n  ${VERSIONS.join("\n  ")}`);
  process.exit(1);
}

const outDir = path.join(root, "out", "deliverables");
mkdirSync(outDir, { recursive: true });

// Some sandboxed environments block Remotion's own browser download but ship a
// Playwright Chromium; on a normal machine this path is absent and Remotion
// uses its managed browser.
const playwright = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const browserExecutable = existsSync(playwright) ? playwright : null;

console.log(`Bundling…`);
const serveUrl = await bundle({
  entryPoint: path.join(root, "src/index.ts"),
  webpackOverride: enableTailwind,
  onProgress: () => {},
});

for (const id of ids) {
  const composition = await selectComposition({ serveUrl, id, browserExecutable });
  const output = path.join(outDir, `${id.replace(/-4K$/, "")}_${label}.mp4`);
  const started = Date.now();
  let lastLogged = -1;

  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation: output,
    browserExecutable,
    concurrency,
    // Quality settings, fixed across all versions so the set is consistent:
    crf: 16,
    x264Preset: "slow",
    imageFormat: "jpeg",
    jpegQuality: 95,
    // yuv420p + BT.709, rather than the full-range yuvj420p a JPEG pipeline
    // defaults to — otherwise levels shift when the file lands in an NLE.
    pixelFormat: "yuv420p",
    colorSpace: "bt709",
    // The references carry no audio and neither should these; without this an
    // empty AAC track is muxed in.
    muted: true,
    onProgress: ({ progress, renderedFrames, encodedFrames }) => {
      const percent = Math.floor(progress * 100);
      if (percent >= lastLogged + 5) {
        lastLogged = percent;
        const elapsed = ((Date.now() - started) / 1000).toFixed(0);
        process.stdout.write(
          `  ${id} ${percent}% — rendered ${renderedFrames}/${composition.durationInFrames}, encoded ${encodedFrames}, ${elapsed}s\n`,
        );
      }
    },
  });

  const seconds = ((Date.now() - started) / 1000).toFixed(0);
  console.log(
    `✔ ${id} → ${path.relative(root, output)} (${composition.durationInFrames} frames, ${seconds}s)`,
  );
}

console.log(`\nDone: ${ids.length} file(s) in ${path.relative(root, outDir)}`);
