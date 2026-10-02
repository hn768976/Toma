/**
 * Highlight clipping check on an encoded video: for every Nth frame, the share
 * of pixels whose R, G and B are all >= 250 (flat white), and the largest such
 * connected blob size estimate (pixels in the worst 64x64 tile).
 *   npx tsx scripts/clipping.ts out/CardRain_Gold.mp4 [every=10]
 */
import { execFileSync } from "node:child_process";
const [video, everyArg] = process.argv.slice(2);
const every = Number(everyArg ?? 10);
const W = 480, H = 270; // analyse at quarter res: blobs, not single sparkles
const raw = execFileSync("ffmpeg", ["-v", "error", "-i", video, "-vf", `select=not(mod(n\\,${every})),scale=${W}:${H}:flags=area`, "-vsync", "0", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], { maxBuffer: 1 << 30 });
const n = raw.length / (W * H * 3);
let worst = { f: 0, frac: 0, tile: 0 };
let sum = 0;
for (let i = 0; i < n; i++) {
  let clip = 0;
  const tiles = new Map<number, number>();
  for (let p = 0; p < W * H; p++) {
    const o = (i * W * H + p) * 3;
    if (raw[o] >= 250 && raw[o + 1] >= 250 && raw[o + 2] >= 250) {
      clip++;
      const t = Math.floor((p % W) / 16) + 100 * Math.floor(p / W / 16);
      tiles.set(t, (tiles.get(t) ?? 0) + 1);
    }
  }
  const frac = clip / (W * H);
  const tile = Math.max(0, ...tiles.values()) / 256;
  sum += frac;
  if (frac > worst.frac) worst = { f: i * every, frac, tile };
}
console.log(`${video}: ${n} frames sampled; mean flat-white share ${(sum / n * 100).toFixed(3)}%; worst frame ${worst.f}: ${(worst.frac * 100).toFixed(2)}% of frame (densest 64px tile ${(worst.tile * 100).toFixed(0)}% clipped)`);
