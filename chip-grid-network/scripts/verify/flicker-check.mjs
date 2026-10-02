// Detects single-frame pops (fireflies, flashes that shouldn't be there):
// downsamples every frame of a video to 192x108 luma with ffmpeg, then for
// each frame n compares it with the mean of frames n-1 and n+1. A pixel that
// is far brighter than both neighbours is a one-frame event. Legitimate
// changes (a node switching, a front moving) change over several frames and
// stay close to at least one neighbour.
// Usage: node scripts/verify/flicker-check.mjs <video.mp4 | dir/element-%03d.png> [threshold=60] [startNumber]
import { execFileSync } from "node:child_process";

const [video, thrArg, startArg] = process.argv.slice(2);
const input = video.includes("%") ? ["-start_number", String(startArg ?? 0), "-i", video] : ["-i", video];
const THR = Number(thrArg ?? 60);
const W = 192;
const H = 108;
const raw = execFileSync("ffmpeg", ["-v", "error", ...input, "-vf", `scale=${W}:${H}:flags=area`, "-f", "rawvideo", "-pix_fmt", "gray", "-"], {
  maxBuffer: 1 << 30,
});
const N = raw.length / (W * H);
const at = (f, i) => raw[f * W * H + i];
const events = [];
for (let f = 1; f < N - 1; f++) {
  let worst = 0;
  let wi = 0;
  for (let i = 0; i < W * H; i++) {
    const v = at(f, i);
    const a = at(f - 1, i);
    const b = at(f + 1, i);
    // brighter than BOTH neighbours by more than THR
    const d = Math.min(v - a, v - b);
    if (d > worst) {
      worst = d;
      wi = i;
    }
  }
  if (worst > THR) events.push({ f, worst, x: (wi % W) * 10, y: Math.floor(wi / W) * 10 });
}
console.log(`${video}: ${N} frames, ${events.length} one-frame pops above ${THR}`);
for (const e of events.slice(0, 20)) console.log(`  frame ${e.f}: +${e.worst} at ~(${e.x}, ${e.y})`);
process.exit(events.length ? 1 : 0);
