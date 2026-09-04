/**
 * Quality checks against the ENCODED file rather than the preview, which is
 * where the real risks live: chroma drift from the yuv420p round-trip, and
 * banding in the long near-flat fog gradients.
 *
 * Usage: node tools/qc.mjs <file.mp4|file.png> [--neutral]
 *
 * A PNG is measured for spatial grain and banding only; an mp4 additionally
 * gets the temporal and loop checks.
 */

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const FFMPEG = "node_modules/@remotion/compositor-linux-x64-gnu/ffmpeg";
const FFPROBE = "node_modules/@remotion/compositor-linux-x64-gnu/ffprobe";

const file = process.argv[2];
const checkNeutral = process.argv.includes("--neutral");
const isStill = /\.png$/i.test(file);
if (!file || !existsSync(file)) throw new Error(`No such file: ${file}`);

const probe = JSON.parse(
  execFileSync(FFPROBE, [
    "-v", "error", "-select_streams", "v:0",
    "-show_entries", "stream=width,height,nb_frames,r_frame_rate,pix_fmt,codec_name",
    "-of", "json", file,
  ]).toString(),
).streams[0];

const W = probe.width;
const H = probe.height;
console.log(`file      ${file}`);
console.log(`stream    ${probe.codec_name} ${W}x${H} ${probe.pix_fmt} ${probe.r_frame_rate} ${probe.nb_frames} frames`);

/**
 * Decode one frame to raw rgb24.
 *
 * Remotion ships a stripped ffmpeg: no `select` filter and no rawvideo *muxer*,
 * so seek by timestamp (`-ss` after `-i`, which decodes and discards for frame
 * accuracy) and pipe the frame out through image2pipe.
 */
const FPS = eval(probe.r_frame_rate);
const SIZE = W * H * 3;

const grabOne = (frame) => {
  if (isStill) {
    const res = spawnSync(
      FFMPEG,
      ["-v", "error", "-i", file, "-c:v", "rawvideo", "-pix_fmt", "rgb24",
       "-f", "image2pipe", "-"],
      { maxBuffer: 1 << 29 },
    );
    if (res.status !== 0) throw new Error(res.stderr?.toString() || "ffmpeg failed");
    if (res.stdout.length < SIZE) throw new Error("Short decode of still");
    return res.stdout.subarray(0, SIZE);
  }

  // Seek a little short of the target and take the Nth frame of a short run:
  // seeking directly at the final frame yields nothing in this build.
  //
  // Two details matter. The seek lands half a frame *before* the first frame
  // wanted, because accurate seeking emits frames with pts >= ss and landing
  // mid-interval would silently skip one. And `-fps_mode passthrough` is
  // required: ffmpeg's default CFR mode duplicates the first frame to fill the
  // gap left by a fractional seek, which makes consecutive frames compare as
  // identical.
  const lead = Math.min(frame, 3);
  const res = spawnSync(
    FFMPEG,
    ["-v", "error", "-i", file, "-ss", `${Math.max(0, (frame - lead - 0.5) / FPS)}`,
     "-frames:v", `${lead + 1}`, "-fps_mode", "passthrough",
     "-c:v", "rawvideo", "-pix_fmt", "rgb24", "-f", "image2pipe", "-"],
    { maxBuffer: 1 << 29 },
  );
  if (res.status !== 0) throw new Error(res.stderr?.toString() || "ffmpeg failed");
  const got = Math.floor(res.stdout.length / SIZE);
  if (got < lead + 1) {
    throw new Error(`Short decode for frame ${frame}: got ${got} of ${lead + 1} frames`);
  }
  return res.stdout.subarray(lead * SIZE, (lead + 1) * SIZE);
};

const grab = (frames) => frames.map(grabOne);

const at = (buf, x, y) => {
  const i = (y * W + x) * 3;
  return [buf[i], buf[i + 1], buf[i + 2]];
};

// --- 1. Colour neutrality (V1 must be strictly grey) ----------------------
if (checkNeutral) {
  const [f] = grab([isStill ? 0 : 150]);
  let worst = 0;
  let sum = 0;
  let n = 0;
  for (let y = 0; y < H; y += 3) {
    for (let x = 0; x < W; x += 3) {
      const [r, g, b] = at(f, x, y);
      const d = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
      worst = Math.max(worst, d);
      sum += d;
      n++;
    }
  }
  console.log(`neutral   max channel spread ${worst}, mean ${(sum / n).toFixed(3)} (0 = perfectly neutral)`);
}

// --- 2. Banding: longest run of one value along a radial through the sky ---
{
  const [f] = grab([isStill ? 0 : 150]);
  const y0 = Math.round(H * 0.425);
  let longest = 0;
  let run = 1;
  let prev = null;
  for (let x = Math.round(W * 0.46); x < W; x++) {
    const v = at(f, x, y0)[1];
    if (v === prev) run++;
    else {
      longest = Math.max(longest, run);
      run = 1;
    }
    prev = v;
  }
  console.log(`banding   longest identical-value run along the sky radial: ${longest}px (a hard contour would be tens of px)`);
}

// --- 3. Spatial grain -----------------------------------------------------
{
  const [f] = grab([isStill ? 0 : 150]);
  // Fit and subtract a local plane, then take the residual's standard
  // deviation. Subtracting the plane removes the sky gradient, and unlike a
  // neighbour-difference estimator this does not assume the grain is
  // uncorrelated between adjacent pixels — which it deliberately is not.
  //
  // Trees would swamp the residual, so scan a grid of patches and keep the
  // quietest: that one is open sky, i.e. gradient plus grain and nothing else.
  const P = 96;
  let best = Infinity;
  for (let py = 0; py < 6; py++) {
    for (let pxi = 0; pxi < 8; pxi++) {
      const x0 = Math.round((0.04 + pxi * 0.115) * W);
      const y0 = Math.round((0.04 + py * 0.15) * H);
      let n = 0, sx = 0, sy = 0, sz = 0, sxx = 0, syy = 0, sxy = 0, sxz = 0, syz = 0;
      for (let y = 0; y < P; y++) {
        for (let x = 0; x < P; x++) {
          const z = at(f, x0 + x, y0 + y)[1];
          n++; sx += x; sy += y; sz += z;
          sxx += x * x; syy += y * y; sxy += x * y; sxz += x * z; syz += y * z;
        }
      }
      // Least squares for z = a + b*x + c*y, on centred coordinates.
      const mx = sx / n, my = sy / n, mz = sz / n;
      const cxx = sxx - n * mx * mx, cyy = syy - n * my * my, cxy = sxy - n * mx * my;
      const cxz = sxz - n * mx * mz, cyz = syz - n * my * mz;
      const det = cxx * cyy - cxy * cxy;
      const b = det === 0 ? 0 : (cxz * cyy - cyz * cxy) / det;
      const c = det === 0 ? 0 : (cyz * cxx - cxz * cxy) / det;
      let ss = 0;
      for (let y = 0; y < P; y++) {
        for (let x = 0; x < P; x++) {
          const z = at(f, x0 + x, y0 + y)[1];
          ss += (z - (mz + b * (x - mx) + c * (y - my))) ** 2;
        }
      }
      best = Math.min(best, Math.sqrt(ss / n));
    }
  }
  console.log(`grain-sp  spatial sigma ${best.toFixed(2)}/255 = ${((best / 255) * 100).toFixed(2)}% (target ~2.5%)`);
}

// --- 4. Temporal grain and loop seam --------------------------------------
if (!isStill) {
  const frames = grab([0, 1, 2, 299, 300, 598, 599]);
  const idx = Object.fromEntries([0, 1, 2, 299, 300, 598, 599].map((f, i) => [f, frames[i]]));

  const meanAbsDiff = (a, b) => {
    let sum = 0;
    let n = 0;
    for (let p = 0; p < a.length; p += 33) {
      sum += Math.abs(a[p] - b[p]);
      n++;
    }
    return sum / n;
  };

  // Grain shows up as the frame-to-frame difference in otherwise still areas.
  const step = meanAbsDiff(idx[1], idx[2]);
  console.log(`grain-t   mean |frame1 - frame2| = ${step.toFixed(2)}/255 = ${((step / 255) * 100).toFixed(2)}%`);

  // A seamless loop means the 599 -> 0 step is no larger than a typical step.
  // Frame 0 is the keyframe, so measure against 0 -> 1 rather than a pair of
  // inter frames: an I-frame carries different quantisation noise, and
  // comparing across that boundary inflates the number for reasons that have
  // nothing to do with the animation.
  const seam = meanAbsDiff(idx[599], idx[0]);
  const acrossKeyframe = meanAbsDiff(idx[0], idx[1]);
  const typical = meanAbsDiff(idx[299], idx[300]);
  console.log(`loop      step 599->0 = ${seam.toFixed(2)}, step 0->1 = ${acrossKeyframe.toFixed(2)}, typical inter step = ${typical.toFixed(2)}`);
  console.log(`          ratio vs the comparable 0->1 step: ${(seam / acrossKeyframe).toFixed(2)} (~1.0 = seamless)`);

  // Motion over the whole clip should be small but non-zero.
  console.log(`motion    mean |frame0 - frame300| = ${meanAbsDiff(idx[0], idx[300]).toFixed(2)}/255`);
}
