/**
 * Renders every overlay plate at one of the two delivery tiers.
 *
 *   node scripts/render-plates.mjs 1080   # 1920x1080 deliverables
 *   node scripts/render-plates.mjs 4k     # 3840x2160 masters
 *
 * Flag choices are explained in PLATES.md - the short version is that these
 * plates sit almost entirely in the bottom of the value range, so the
 * intermediate frames are PNG and the CRF is well below Remotion's default.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";

const TIER = (process.argv[2] ?? "1080").toLowerCase();
if (TIER !== "1080" && TIER !== "4k") {
  console.error("Usage: node scripts/render-plates.mjs <1080|4k>");
  process.exit(1);
}

const SUFFIX = TIER === "4k" ? "4K" : "1080";
const RES = TIER === "4k" ? "3840x2160" : "1920x1080";

const PLATES = [
  ["DustMotes", "plate-01-dust-motes"],
  ["Rain", "plate-02-rain"],
  ["Smoke", "plate-03-smoke"],
  ["Snow", "plate-04-snow"],
];

const OUT_DIR = `out/deliver${TIER === "4k" ? "-4k" : ""}`;
mkdirSync(OUT_DIR, { recursive: true });

for (const [id, slug] of PLATES) {
  const out = `${OUT_DIR}/${slug}_${RES}_30fps.mp4`;
  console.log(`\n=== ${id}${SUFFIX} -> ${out}`);
  execFileSync(
    "npx",
    [
      "remotion", "render", `${id}${SUFFIX}`, out,
      "--codec=h264",
      "--crf=14",
      "--image-format=png",
      "--muted",
      "--color-space=bt709",
      "--concurrency=4",
    ],
    { stdio: "inherit" }
  );
}

console.log(`\nDone. ${PLATES.length} plates written to ${OUT_DIR}/`);
