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
 * Sub-pixel position of the strongest luminance edge in a column window.
 * A locked camera keeps this constant; a dolly, an orbit or an eased push
 * would all move it.
 */
const edgePosition = (img, xFrac, y0, y1) => {
  const x = Math.round(xFrac * img.width);
  let num = 0;
  let den = 0;
  for (let y = Math.round(y0 * img.height) + 1; y < Math.round(y1 * img.height) - 1; y++) {
    const g = Math.abs(img.lum(x, y + 1) - img.lum(x, y - 1));
    const w = g * g; // square it so the dominant edge wins over shading
    num += w * y;
    den += w;
  }
  return den > 0 ? num / den : NaN;
};

/** Where the brightest point sits along a horizontal band — tracks the ring segment. */
const brightestX = (img, y0, y1, x0 = 0.05, x1 = 0.95) => {
  let best = -1;
  let bestX = NaN;
  for (let x = Math.round(x0 * img.width); x < Math.round(x1 * img.width); x++) {
    let s = 0;
    for (let y = Math.round(y0 * img.height); y < Math.round(y1 * img.height); y++) s += img.lum(x, y);
    if (s > best) {
      best = s;
      bestX = x / img.width;
    }
  }
  return bestX;
};

/** Where the camera-lock probe looks, per look: a fixed feature away from the plinth. */
const LOCK_PROBE = {
  "DuotoneGlass": { x: 0.12, y0: 0.55, y1: 0.85, what: "backdrop/floor horizon, far left" },
  "NeonRing": { x: 0.5, y0: 0.42, y1: 0.56, what: "disc top-face edge (the field has no other feature)" },
  "FlutedPlaster": { x: 0.06, y0: 0.55, y1: 0.85, what: "wall/floor seam, far left" },
  "WoodLeaf": { x: 0.06, y0: 0.35, y1: 0.62, what: "wall/floor seam, far left" },
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
const positions = lockFrames.map((f) => edgePosition(imgs[f], probe.x, probe.y0, probe.y1));
const drift = Math.max(...positions) - Math.min(...positions);
report(
  drift < 1.0,
  `feature holds the same pixel row across frames 0/150/299 (${probe.what})`,
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
  const track = (y0, y1) => FRAMES.map((f) => brightestX(imgs[f], y0, y1));
  const top = track(0.385, 0.42);
  const bot = track(0.62, 0.68);
  const spread = (v) => Math.max(...v.slice(0, 4)) - Math.min(...v.slice(0, 4));
  const pct = (v) => v.map((x) => `${(x * 100).toFixed(1)}%`).join(" -> ");

  report(spread(top) > 0.05, "top ring: bright segment travels around the ring", `frames 0/75/150/225/299: ${pct(top)}`);
  report(spread(bot) > 0.05, "bottom ring: bright segment travels around the ring", `frames 0/75/150/225/299: ${pct(bot)}`);
  report(
    Math.abs(top[4] - top[0]) > 0.001,
    "top ring: segment position at frame 299 differs from frame 0 (by one loop step)",
    `${(top[0] * 100).toFixed(2)}% -> ${(top[4] * 100).toFixed(2)}%`,
  );
  report(
    Math.abs(bot[4] - bot[0]) > 0.001,
    "bottom ring: segment position at frame 299 differs from frame 0 (by one loop step)",
    `${(bot[0] * 100).toFixed(2)}% -> ${(bot[4] * 100).toFixed(2)}%`,
  );
  report(
    Math.abs(top[1] - bot[1]) > 0.02 || Math.abs(top[2] - bot[2]) > 0.02,
    "the two rings travel at different rates",
    `at frame 75: top ${(top[1] * 100).toFixed(1)}% vs bottom ${(bot[1] * 100).toFixed(1)}%`,
  );
} else if (look === "DuotoneGlass") {
  // The two keys breathe out of phase, so the left/right balance has to
  // shift over the clip rather than both simply rising and falling together.
  const bal = (im) => {
    const l = meanRect(im, 0.3, 0.55, 0.37, 0.64);
    const r = meanRect(im, 0.63, 0.55, 0.7, 0.64);
    return (l[0] + l[1] + l[2]) / (r[0] + r[1] + r[2]);
  };
  const vals = FRAMES.map((f) => bal(imgs[f]));
  const spread = Math.max(...vals) - Math.min(...vals);
  report(spread > 0.02, "key balance shifts across the clip (keys breathe out of phase)", `L/R ratio ${vals.map((v) => v.toFixed(3)).join(" ")}`);
} else {
  // The gobo must actually sway: some part of the wall changes tone.
  const sample = (im) => meanRect(im, 0.05, 0.05, 0.45, 0.3)[0];
  const vals = FRAMES.map((f) => sample(imgs[f]));
  const spread = Math.max(...vals) - Math.min(...vals);
  report(spread > 1.0, "foliage shadow moves across the clip", `wall tone ${vals.map((v) => v.toFixed(1)).join(" ")}`);
}

console.log(failures ? `\n${failures} FAILED` : "\nall checks passed");
process.exit(failures ? 1 : 0);
