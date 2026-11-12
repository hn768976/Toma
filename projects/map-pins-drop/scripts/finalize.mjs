// Mastering step for the delivered MP4s.
// Remotion's JPEG frame pipeline encodes full-range "yuvj420p". This pass
// converts it to standard limited-range BT.709 yuv420p H.264 (High profile,
// +faststart), which plays correctly everywhere, using Remotion's bundled
// ffmpeg (no system ffmpeg required).
//   usage: node scripts/finalize.mjs <in.mp4> <out.mp4>
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const [inArg, outArg] = process.argv.slice(2);
if (!inArg || !outArg) {
  console.error("usage: node scripts/finalize.mjs <in.mp4> <out.mp4>");
  process.exit(1);
}
// absolute paths: the bundled ffmpeg does not run from the project folder
const input = resolve(inArg);
const output = resolve(outArg);
mkdirSync(dirname(output), { recursive: true });
const args = [
  "remotion", "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
  "-i", input,
  "-vf", "scale=in_range=pc:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709:flags=accurate_rnd+full_chroma_int,format=yuv420p",
  "-c:v", "libx264", "-profile:v", "high", "-preset", "slow", "-crf", "14",
  "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
  "-movflags", "+faststart", "-an",
  output,
];
const r = spawnSync("npx", args, { stdio: "inherit", shell: process.platform === "win32" });
process.exit(r.status ?? 1);
