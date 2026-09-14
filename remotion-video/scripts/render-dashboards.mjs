// Renders the four financial-dashboard versions with the delivery
// settings: H.264 in an MP4, 30fps, no audio track, and PNG frames on
// the way in so the output lands as true yuv420p / limited range.
//
//   node scripts/render-dashboards.mjs          -> 1080p
//   node scripts/render-dashboards.mjs --4k     -> 3840x2160
//   node scripts/render-dashboards.mjs --4k v3  -> just version 3, at 4K
//
// Remotion's own mjpeg frame pipeline tags the result yuvj420p (full
// range), which some editors read back washed out, so --image-format=png
// is deliberate rather than incidental.
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";

const args = process.argv.slice(2);
const fourK = args.includes("--4k");
const only = args
  .filter((a) => /^v[1-4]$/i.test(a))
  .map((a) => a.toLowerCase());

const VERSIONS = ["v1", "v2", "v3", "v4"];
const targets = only.length > 0 ? only : VERSIONS;

mkdirSync("out", { recursive: true });

for (const version of targets) {
  const n = version.slice(1);
  const composition = fourK ? `DashboardV${n}-4K` : `DashboardV${n}`;
  const output = `out/dashboard-${version}-${fourK ? "4k" : "1080p"}.mp4`;
  console.log(`\nRendering ${composition} -> ${output}`);
  const result = spawnSync(
    "npx",
    [
      "remotion",
      "render",
      composition,
      output,
      "--codec=h264",
      "--crf=17",
      "--muted",
      "--image-format=png",
      "--pixel-format=yuv420p",
    ],
    { stdio: "inherit" },
  );
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
