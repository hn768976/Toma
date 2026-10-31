/**
 * Renders the 4K (3840x2160) master of each composition with Remotion, then makes
 * the 1080p H.264 delivery file from it (Lanczos downscale) with Remotion's bundled ffmpeg.
 *
 *   node scripts/render.mjs                 -> both versions
 *   node scripts/render.mjs HudLoader-V1   -> one composition
 *
 * Outputs: out/4k/<id>_3840x2160.mp4 and out/1080p/<id>_1920x1080.mp4
 */
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";

const ids = process.argv.slice(2);
const comps = ids.length > 0 ? ids : ["HudLoader-V1", "HudLoader-V2"];

const run = (args) => {
  console.log(`\n> npx ${args.join(" ")}`);
  const r = spawnSync("npx", args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

mkdirSync("out/4k", { recursive: true });
mkdirSync("out/1080p", { recursive: true });

for (const id of comps) {
  const master = `out/4k/${id}_3840x2160.mp4`;
  const delivery = `out/1080p/${id}_1920x1080.mp4`;
  run([
    "remotion",
    "render",
    id,
    master,
    "--codec=h264",
    "--crf=12",
    "--x264-preset=medium",
    "--pixel-format=yuv420p",
  ]);
  run([
    "remotion",
    "ffmpeg",
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    master,
    "-vf",
    "scale=1920:1080:flags=lanczos",
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-crf",
    "15",
    "-profile:v",
    "high",
    "-pix_fmt",
    "yuv420p",
    "-r",
    "30",
    "-color_primaries",
    "bt709",
    "-color_trc",
    "bt709",
    "-colorspace",
    "bt709",
    "-movflags",
    "+faststart",
    "-an",
    delivery,
  ]);
  console.log(`Done: ${delivery}`);
}
