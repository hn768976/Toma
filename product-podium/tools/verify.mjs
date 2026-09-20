/**
 * The whole verify loop for one rendered clip: camera lock, the per-look
 * criteria at five frames, and the motion the look is supposed to have.
 *
 * Usage: node tools/verify.mjs <file.mp4> <composition-id>
 */
import { execFileSync } from "node:child_process";
import { decode, meanRect } from "./px.mjs";

const [, , file, id] = process.argv;
const FRAMES = [0, 75, 150, 225, 299];

const pass = (ok) => (ok ? "PASS" : "FAIL");
let failures = 0;
const report = (ok, name, note) => {
  if (!ok) failures++;
  console.log(`  ${pass(ok)}  ${name}${note ? `  [${note}]` : ""}`);
};

/**
 * Sub-pixel x of the strongest luminance edge along a row.
 *
 * It takes the single largest gradient and refines it with a parabolic
 * fit, rather than a gradient-weighted centroid over the window. The
 * centroid is not usable here: a swaying gobo puts moving shadow edges in
 * the same window, and they drag the centroid by several pixels a frame.
 * That reads as a drifting camera when the camera is provably static —
 * every rig value is a constant and `push` is zero. Measured on the same
 * clip, the centroid reported 9.5px of drift where the peak reports 0.05.
 *
 * The feature probed is a plinth silhouette: geometry, which shading
 * cannot move, as opposed to a shadow edge, which is nothing but shading.
 */
const edgePosition = (img, yFrac, x0, x1) => {
  const y = Math.round(yFrac * img.height);
  const grad = (x) => Math.abs(img.lum(x + 1, y) - img.lum(x - 1, y));
  let best = -1;
  let bx = 0;
  for (let x = Math.round(x0 * img.width) + 1; x < Math.round(x1 * img.width) - 1; x++) {
    const v = grad(x);
    if (v > best) {
      best = v;
      bx = x;
    }
  }
  const a = grad(bx - 1);
  const b = grad(bx);
  const c = grad(bx + 1);
  const denom = a - 2 * b + c;
  const shift = denom === 0 ? 0 : (a - c) / (2 * denom);
  return bx + Math.max(-1, Math.min(1, shift));
};

/**
 * Where the travelling segment sits along a horizontal band, to sub-pixel
 * precision.
 *
 * Taking the single brightest column quantises to whole pixels, and one
 * loop step of travel moves the segment by less than that near the ring's
 * left and right extremes, where it is nearly tangent to the view. This
 * takes the centroid of each column's excess over the band's median
 * instead, which resolves the step while still tracking the segment
 * rather than the ring.
 */
const brightestX = (img, y0, y1, x0 = 0.05, x1 = 0.95) => {
  const X0 = Math.round(x0 * img.width);
  const X1 = Math.round(x1 * img.width);
  const Y0 = Math.round(y0 * img.height);
  const Y1 = Math.round(y1 * img.height);
  const cols = [];
  for (let x = X0; x < X1; x++) {
    let s = 0;
    for (let y = Y0; y < Y1; y++) s += img.lum(x, y);
    cols.push(s);
  }
  const sorted = [...cols].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  // Square the excess so the segment dominates the ring it sits on.
  let num = 0;
  let den = 0;
  for (let i = 0; i < cols.length; i++) {
    const w = Math.max(0, cols[i] - median) ** 2;
    num += w * (X0 + i);
    den += w;
  }
  return den > 0 ? num / den / img.width : NaN;
};

/**
 * Where the camera-lock probe looks, per look: the plinth's right-hand
 * silhouette, scanned along a row. The right side is used because in every
 * look the key comes from the left, so the left silhouette sits against
 * the busiest shading.
 */
const LOCK_PROBE = {
  "DuotoneGlass": { y: 0.6, x0: 0.68, x1: 0.78, what: "disc right silhouette" },
  "NeonRing": { y: 0.44, x0: 0.7, x1: 0.8, what: "slab right silhouette" },
  "FlutedPlaster": { y: 0.6, x0: 0.66, x1: 0.74, what: "plinth right silhouette" },
  "WoodLeaf": { y: 0.5, x0: 0.66, x1: 0.76, what: "disc right silhouette" },
};

const look = id.split("-")[0];
const probe = LOCK_PROBE[look];

console.log(`\n=== ${id}`);

// --- Step 1: container ---------------------------------------------------
const probeOut = execFileSync(
  "npx",
  ["remotion", "ffprobe", "-v", "error",
   "-show_entries", "stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt",
   "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1", file],
  { encoding: "utf8" },
);
const g = (k) => (probeOut.match(new RegExp(`^${k}=(.*)$`, "m")) || [])[1];
console.log("Step 1 — container");
report(g("width") === "1920" && g("height") === "1080", "resolution 1920x1080", `${g("width")}x${g("height")}`);
report(g("r_frame_rate") === "30/1", "frame rate 30/1", g("r_frame_rate"));
report(Math.abs(Number(g("duration")) - 10) < 0.001, "duration 10.000s", g("duration"));
report(g("codec_name") === "h264", "codec h264", g("codec_name"));
report(g("pix_fmt") === "yuv420p", "pixel format yuv420p", g("pix_fmt"));
report(!/codec_type=audio/.test(probeOut), "no audio stream", /codec_type=audio/.test(probeOut) ? "AUDIO PRESENT" : "video only");

// --- Step 3: camera lock -------------------------------------------------
console.log("Step 3 — camera lock");
const lockFrames = [0, 150, 299];
const imgs = {};
for (const f of [...new Set([...FRAMES, ...lockFrames])]) imgs[f] = decode(file, { frame: f });
const positions = lockFrames.map((f) => edgePosition(imgs[f], probe.y, probe.x0, probe.x1));
const drift = Math.max(...positions) - Math.min(...positions);
report(
  drift < 1.0,
  `feature holds the same pixel column across frames 0/150/299 (${probe.what})`,
  `${positions.map((p) => p.toFixed(2)).join(" / ")} px — drift ${drift.toFixed(3)} px`,
);

// --- Step 4: per-look criteria across five frames ------------------------
console.log("Step 4 — per-look criteria at frames 0, 75, 150, 225, 299");
for (const f of FRAMES) {
  try {
    execFileSync("node", ["tools/check.mjs", file, id, String(f)], { stdio: "inherit" });
  } catch {
    failures++;
  }
}

// --- Motion --------------------------------------------------------------
console.log("Motion");
if (look === "NeonRing") {
  /*
   * The travelling segment, on each ring independently.
   *
   * Note what frame 299 can and cannot show. The segment completes a whole
   * number of laps over the clip — that is what makes the loop seamless —
   * so at frame 299 it is necessarily one 300th of its travel short of
   * where it started, and no periodic motion could ever be anywhere else.
   * The brief says as much for the loop test: comparing 0 to 299 shows a
   * one-step difference. So the position at 299 is checked to be
   * *measurably* different from 0, and the travel itself is demonstrated
   * across the clip, where it is visible.
   */
  // Bands measured off the rendered frame: the neon line sits at the
  // slab's rim, its reflection well below it.
  const track = (y0, y1) => FRAMES.map((f) => brightestX(imgs[f], y0, y1));
  const top = track(0.552, 0.578);
  const bot = track(0.655, 0.702);
  const spread = (v) => Math.max(...v.slice(0, 4)) - Math.min(...v.slice(0, 4));
  const pct = (v) => v.map((x) => `${(x * 100).toFixed(1)}%`).join(" -> ");

  report(spread(top) > 0.05, "neon rim: bright segment travels around the ring", `frames 0/75/150/225/299: ${pct(top)}`);
  report(spread(bot) > 0.05, "reflection: bright segment travels around the ring", `frames 0/75/150/225/299: ${pct(bot)}`);
  // Half a pixel of the rendered frame. One loop step is 1/300th of the
  // travel, and near the ring's left and right extremes it maps to a
  // fraction of a percent of frame width — real and measurable, but only
  // if the bar is expressed in pixels rather than as a round fraction.
  const onePixel = 1 / imgs[0].width;
  report(
    Math.abs(top[4] - top[0]) > onePixel * 0.5,
    "neon rim: segment position at frame 299 differs from frame 0 (by one loop step)",
    `${(top[0] * 100).toFixed(3)}% -> ${(top[4] * 100).toFixed(3)}% (${(Math.abs(top[4] - top[0]) * imgs[0].width).toFixed(1)} px)`,
  );
  report(
    Math.abs(bot[4] - bot[0]) > onePixel * 0.5,
    "reflection: segment position at frame 299 differs from frame 0 (by one loop step)",
    `${(bot[0] * 100).toFixed(3)}% -> ${(bot[4] * 100).toFixed(3)}% (${(Math.abs(bot[4] - bot[0]) * imgs[0].width).toFixed(1)} px)`,
  );
  report(
    Math.abs(top[1] - bot[1]) > 0.02 || Math.abs(top[2] - bot[2]) > 0.02,
    "the two rings travel at different rates",
    `at frame 75: top ${(top[1] * 100).toFixed(1)}% vs bottom ${(bot[1] * 100).toFixed(1)}%`,
  );
} else if (look === "DuotoneGlass") {
  /*
   * The two keys breathe out of phase, so the left/right balance has to
   * shift over the clip rather than both rising and falling together.
   *
   * Sampled every 25 frames rather than at the five criteria frames. The
   * breathing is noise on a circle in time, not a sine, so its extremes
   * do not land on any particular frame — at five samples this reported
   * a 2% swing on keys that are provably swinging 13% each.
   */
  const bal = (im) => {
    const l = meanRect(im, 0.3, 0.55, 0.37, 0.64);
    const r = meanRect(im, 0.63, 0.55, 0.7, 0.64);
    return (l[0] + l[1] + l[2]) / (r[0] + r[1] + r[2]);
  };
  const at = [];
  for (let f = 0; f < 300; f += 25) at.push(f);
  const vals = at.map((f) => bal(imgs[f] ?? decode(file, { frame: f })));
  const spread = Math.max(...vals) - Math.min(...vals);
  report(
    spread > 0.02,
    "key balance shifts across the clip (keys breathe out of phase)",
    `L/R ratio over 12 samples: ${Math.min(...vals).toFixed(3)} to ${Math.max(...vals).toFixed(3)}, swing ${(spread * 100).toFixed(1)}%`,
  );
} else {
  /*
   * The gobo must actually sway. Measured as how much the wall's pixels
   * change between frames, not as the mean tone of a region: a rigid sway
   * moves the pattern without changing how much of the wall it covers, so
   * the mean barely shifts while every edge in it has moved.
   */
  const wallDiff = (a, b) => {
    const x0 = Math.round(0.03 * a.width);
    const x1 = Math.round(0.97 * a.width);
    const y0 = Math.round(0.03 * a.height);
    const y1 = Math.round(0.3 * a.height);
    let sum = 0;
    let n = 0;
    for (let y = y0; y < y1; y += 2) {
      for (let x = x0; x < x1; x += 2) {
        sum += Math.abs(a.lum(x, y) - b.lum(x, y));
        n++;
      }
    }
    return sum / n;
  };
  const d = [75, 150, 225].map((f) => wallDiff(imgs[0], imgs[f]));
  report(
    Math.max(...d) > 1.0,
    "foliage shadow moves across the clip",
    `mean per-pixel change on the wall vs frame 0: ${d.map((v) => v.toFixed(2)).join(" / ")}`,
  );
}

console.log(failures ? `\n${failures} FAILED` : "\nall checks passed");
process.exit(failures ? 1 : 0);
