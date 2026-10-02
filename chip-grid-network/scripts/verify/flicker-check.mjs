// Detects single-frame pops (fireflies, flashes that shouldn't be there):
// downsamples every frame of a video to 192x108 luma with ffmpeg, then for
// each frame n compares each block with the BRIGHTEST block within +/-R
// blocks (R = 3, i.e. +/-30 px at 1080p) in frames n-1 and n+1. A block far
// brighter than that in both neighbours is a one-frame event. The spatial
// tolerance keeps fast camera moves (a bright edge travelling a block or two
// per frame) from counting; legitimate changes (a node switching, a front
// moving) also stay close to at least one neighbour.
// Usage: node scripts/verify/flicker-check.mjs <video.mp4 | dir/element-%03d.png> [threshold=60] [startNumber] [radius=3]
import { execFileSync } from "node:child_process";

const [video, thrArg, startArg, radiusArg] = process.argv.slice(2);
const R = Number(radiusArg ?? 3);
const input = video.includes("%") ? ["-start_number", String(startArg ?? 0), "-i", video] : ["-i", video];
const THR = Number(thrArg ?? 60);
const W = 192;
const H = 108;
const raw = execFileSync("ffmpeg", ["-v", "error", ...input, "-vf", `scale=${W}:${H}:flags=area`, "-f", "rawvideo", "-pix_fmt", "gray", "-"], {
  maxBuffer: 1 << 30,
});
const N = raw.length / (W * H);
const at = (f, i) => raw[f * W * H + i];
// per-frame max filter over a (2R+1)^2 neighbourhood
const maxFiltered = (f) => {
  const out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let m = 0;
      for (let dy = -R; dy <= R; dy++) {
        const yy = Math.min(H - 1, Math.max(0, y + dy));
        for (let dx = -R; dx <= R; dx++) {
          const xx = Math.min(W - 1, Math.max(0, x + dx));
          m = Math.max(m, at(f, yy * W + xx));
        }
      }
      out[y * W + x] = m;
    }
  }
  return out;
};
const maxes = [];
for (let f = 0; f < N; f++) maxes.push(maxFiltered(f));
const events = [];
for (let f = 1; f < N - 1; f++) {
  let worst = 0;
  let wi = 0;
  for (let i = 0; i < W * H; i++) {
    const v = at(f, i);
    const a = maxes[f - 1][i];
    const b = maxes[f + 1][i];
    // brighter than BOTH neighbours by more than THR
    const d = Math.min(v - a, v - b);
    if (d > worst) {
      worst = d;
      wi = i;
    }
  }
  if (worst > THR) events.push({ f, worst, x: (wi % W) * 10, y: Math.floor(wi / W) * 10 });
}
console.log(`${video}: ${N} frames, ${events.length} one-frame pops above ${THR} (motion tolerance +/-${R * 10}px)`);
for (const e of events.slice(0, 20)) console.log(`  frame ${e.f}: +${e.worst} at ~(${e.x}, ${e.y})`);
process.exit(events.length ? 1 : 0);
