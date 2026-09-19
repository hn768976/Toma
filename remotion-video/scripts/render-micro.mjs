// Renders the six microbiology versions to 1080p H.264.
//
// Each one is the 3840x2160 master rendered at half scale, so the delivered
// file is the master rather than a separate 1080p build.
//
//   npm run render:micro            all six
//   npm run render:micro -- v3 v5   just those
//   npm run render:micro -- --4k    full 4K masters (roughly 4x the time)

import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";

const VERSIONS = [
  { id: "v1", composition: "Micro-V1-BlueCells-4K" },
  { id: "v2", composition: "Micro-V2-VirionAttack-4K" },
  { id: "v3", composition: "Micro-V3-CoronaFlythrough-4K" },
  { id: "v4", composition: "Micro-V4-ColourJourney-4K" },
  { id: "v5", composition: "Micro-V5-AmberField-4K" },
  { id: "v6", composition: "Micro-V6-GreenOnBlack-4K" },
];

const USAGE = `Renders the microbiology versions to MP4.

  npm run render:micro            all six, 1080p
  npm run render:micro -- v3 v5   just those
  npm run render:micro -- --4k    full 4K masters (roughly 4x the time)

Version ids: ${VERSIONS.map((v) => v.id).join(", ")}`;

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log(USAGE);
  process.exit(0);
}

// Reject anything unrecognised rather than quietly rendering the whole set:
// a typo in a flag should not cost an hour of GPU time.
const flags = args.filter((a) => a.startsWith("-"));
const unknownFlags = flags.filter((f) => f !== "--4k");
if (unknownFlags.length) {
  console.error(`Unknown option(s): ${unknownFlags.join(", ")}\n\n${USAGE}`);
  process.exit(1);
}

const wants4K = flags.includes("--4k");
const picked = args.filter((a) => !a.startsWith("-"));
const unknownIds = picked.filter((id) => !VERSIONS.some((v) => v.id === id));
if (unknownIds.length) {
  console.error(`Unknown version(s): ${unknownIds.join(", ")}\n\n${USAGE}`);
  process.exit(1);
}

const todo = picked.length
  ? VERSIONS.filter((v) => picked.includes(v.id))
  : VERSIONS;

mkdirSync("out", { recursive: true });

for (const version of todo) {
  const suffix = wants4K ? "4k" : "1080p";
  const output = `out/${version.composition.replace(/-4K$/, "")}_${suffix}.mp4`;

  const cliArgs = [
    "remotion", "render", version.composition, output,
    "--codec=h264", "--crf=16",
    // Without an ANGLE backend headless Chrome falls back to software GL and
    // the render slows to a crawl.
    "--gl=angle",
    "--concurrency=3",
  ];
  if (!wants4K) cliArgs.push("--scale=0.5");

  console.log(`\n=== ${version.composition} -> ${output}`);
  const result = spawnSync("npx", cliArgs, { stdio: "inherit" });
  if (result.status !== 0) {
    console.error(`Render failed for ${version.composition}`);
    process.exit(result.status ?? 1);
  }
}

console.log("\nAll renders complete.");
