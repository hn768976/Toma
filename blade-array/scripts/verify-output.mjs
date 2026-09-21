/**
 * Steps 1, 4 and 5 of the verify loop, run against the encoded mp4s - not the
 * studio preview.
 *
 *   node scripts/verify-output.mjs [out/Name.mp4 ...]
 *
 * With no arguments it checks every mp4 in out/.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { readPNG, px, luma } from "./png.mjs";

const BIN = path.resolve("node_modules/@remotion/compositor-linux-x64-gnu");
const ffmpeg = path.join(BIN, "ffmpeg");
const ffprobe = path.join(BIN, "ffprobe");

const FRAMES = [0, 150, 300, 450, 599];
const FPS = 30;

const files = process.argv.length > 2
  ? process.argv.slice(2)
  : readdirSync("out").filter((f) => f.endsWith(".mp4")).sort().map((f) => path.join("out", f));

const hue = ([r, g, b]) => {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (d === 0) return -1;
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
};

function probe(file) {
  const out = execFileSync(ffprobe, [
    "-v", "error",
    "-show_entries", "stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1", file,
  ]).toString();
  const g = (k) => (out.match(new RegExp(`^${k}=(.*)$`, "m")) ?? [])[1];
  return {
    width: Number(g("width")), height: Number(g("height")),
    fps: g("r_frame_rate"), codec: g("codec_name"), pix: g("pix_fmt"),
    duration: Number(g("duration")), hasAudio: /codec_type=audio/.test(out),
  };
}

function columnProfile(img) {
  const p = new Float64Array(img.width);
  for (let x = 0; x < img.width; x++) {
    let s = 0, n = 0;
    for (let y = 0; y < img.height; y += 4) { s += luma(img, x, y); n++; }
    p[x] = s / n;
  }
  return p;
}

/** Sharp discontinuities: the blade seams, which the colour sweep does not move. */
function sharpEdges(p, lit = 12) {
  const scored = [];
  for (let x = 2; x < p.length - 2; x++) {
    if (p[x] < lit) continue;
    scored.push([x, Math.abs(p[x - 2] + p[x + 2] - 2 * p[x])]);
  }
  scored.sort((a, b) => b[1] - a[1]);
  const picked = [];
  for (const [x] of scored) {
    if (picked.some((q) => Math.abs(q - x) < 10)) continue;
    picked.push(x);
    if (picked.length >= 40) break;
  }
  return picked.sort((a, b) => a - b);
}

function seamMinima(img, y) {
  const L = []; for (let x = 0; x < img.width; x++) L.push(luma(img, x, y));
  const out = [];
  for (let x = 2; x < img.width - 2; x++) {
    const v = L[x], a = Math.max(L[x - 2], L[x + 2]);
    if (v <= L[x - 1] && v <= L[x + 1] && a - v > Math.max(5, a * 0.09)) out.push(x);
  }
  return out.filter((s, i) => i === 0 || s - out[i - 1] > 4);
}

/**
 * Banding: on a blade array the smooth direction is vertical - a column runs up
 * one blade with no seams in it. Report the longest run of one value inside a
 * window that is mid-tone, gently ramping and free of edges, plus how much
 * dither survived the encode.
 */
function banding(img, W = 120) {
  let worst = 0, windows = 0, noiseSum = 0, noiseN = 0;
  const step = Math.max(1, Math.floor(img.width / 160));
  for (let x = 0; x < img.width; x += step) {
    for (let ch = 0; ch < 3; ch++) {
      const v = []; for (let y = 0; y < img.height; y++) v.push(px(img, x, y)[ch]);
      for (let s = 0; s + W < v.length; s += W >> 1) {
        const win = v.slice(s, s + W);
        const mn = Math.min(...win), mx = Math.max(...win);
        const mean = win.reduce((a, b) => a + b, 0) / W;
        if (mean < 24 || mx - mn < 3 || mx - mn > 30) continue;
        let edgy = false;
        for (let i = 1; i < W; i++) if (Math.abs(win[i] - win[i - 1]) > 3) { edgy = true; break; }
        if (edgy) continue;
        windows++;
        for (let i = 2; i < W - 2; i++) {
          const m5 = (win[i - 2] + win[i - 1] + win[i] + win[i + 1] + win[i + 2]) / 5;
          noiseSum += Math.abs(win[i] - m5); noiseN++;
        }
        let run = 1;
        for (let i = 1; i <= W; i++) {
          if (i < W && win[i] === win[i - 1]) run++;
          else { if (run > worst) worst = run; run = 1; }
        }
      }
    }
  }
  return { worst, windows, noise: noiseN ? noiseSum / noiseN : null };
}

/** The same scan, over the dark ramps that the mid-tone one skips. */
function bandingDark(img, W = 120) {
  let worst = 0, windows = 0, noiseSum = 0, noiseN = 0;
  const step = Math.max(1, Math.floor(img.width / 160));
  for (let x = 0; x < img.width; x += step) {
    for (let ch = 0; ch < 3; ch++) {
      const v = []; for (let y = 0; y < img.height; y++) v.push(px(img, x, y)[ch]);
      for (let s = 0; s + W < v.length; s += W >> 1) {
        const win = v.slice(s, s + W);
        const mn = Math.min(...win), mx = Math.max(...win);
        const mean = win.reduce((a, b) => a + b, 0) / W;
        if (mean < 3 || mean > 26 || mx - mn < 2 || mx - mn > 18) continue;
        let edgy = false;
        for (let i = 1; i < W; i++) if (Math.abs(win[i] - win[i - 1]) > 3) { edgy = true; break; }
        if (edgy) continue;
        windows++;
        for (let i = 2; i < W - 2; i++) {
          const m5 = (win[i - 2] + win[i - 1] + win[i] + win[i + 1] + win[i + 2]) / 5;
          noiseSum += Math.abs(win[i] - m5); noiseN++;
        }
        let run = 1;
        for (let i = 1; i <= W; i++) {
          if (i < W && win[i] === win[i - 1]) run++;
          else { if (run > worst) worst = run; run = 1; }
        }
      }
    }
  }
  return { worst, windows, noise: noiseN ? noiseSum / noiseN : 0 };
}

function gridStats(img) {
  const v = [];
  for (let gy = 0; gy < 16; gy++) for (let gx = 0; gx < 28; gx++)
    v.push(luma(img, Math.round(((gx + 0.5) / 28) * img.width), Math.round(((gy + 0.5) / 16) * img.height)));
  const sorted = [...v].sort((a, b) => a - b);
  return {
    p50: Math.round(sorted[sorted.length >> 1]),
    under8: (v.filter((x) => x < 8).length / v.length) * 100,
    under16: (v.filter((x) => x < 16).length / v.length) * 100,
  };
}

let failures = 0;
const say = (ok, text) => { if (!ok) failures++; console.log(`   ${ok ? "PASS" : "FAIL"}  ${text}`); };

for (const file of files) {
  console.log(`\n=== ${path.basename(file)} ===`);
  const p = probe(file);
  say(p.width === 1920 && p.height === 1080, `resolution ${p.width}x${p.height} (want 1920x1080)`);
  say(p.fps === "30/1", `frame rate ${p.fps} (want 30/1)`);
  say(Math.abs(p.duration - 20) < 0.02, `duration ${p.duration}s (want 20.0)`);
  say(p.codec === "h264" && p.pix === "yuv420p", `${p.codec} / ${p.pix}`);
  say(!p.hasAudio, p.hasAudio ? "an audio stream is present" : "no audio stream");

  const dir = mkdtempSync(path.join(tmpdir(), "blade-verify-"));
  const imgs = {};
  for (const f of FRAMES) {
    const out = path.join(dir, `f${f}.png`);
    execFileSync(ffmpeg, ["-v", "error", "-ss", String(f / FPS), "-i", file, "-frames:v", "1", "-y", out]);
    imgs[f] = readPNG(out);
  }
  const first = imgs[0];

  // Blade pitch and count.
  const y = Math.round(first.height * 0.45);
  const sm = seamMinima(first, y);
  const gaps = sm.slice(1).map((s, i) => s - sm[i]).sort((a, b) => a - b);
  const pitch = gaps[gaps.length >> 1] ?? 0;
  console.log(`   info  blade pitch ~${pitch}px -> ~${pitch ? Math.round(first.width / pitch) : "?"} blades across the frame`);

  // Colour must vary across the width of one blade.
  let best = null;
  for (let i = 1; i < sm.length; i++) {
    const a = sm[i - 1], b = sm[i];
    if (b - a < 12) continue;
    const at = (t) => px(first, a + Math.round((b - a) * t), y);
    const [l, c, r] = [at(0.2), at(0.5), at(0.8)];
    if (Math.max(...c) < 40) continue;
    const hs = [hue(l), hue(c), hue(r)].filter((h) => h >= 0);
    // Hue is circular: 350 and 11 degrees are 21 apart, not 339.
    const arc = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
    let spread = 0;
    for (let a = 0; a < hs.length; a++)
      for (let b = a + 1; b < hs.length; b++) spread = Math.max(spread, arc(hs[a], hs[b]));
    const lums = [l, c, r].map((q) => 0.2126 * q[0] + 0.7152 * q[1] + 0.0722 * q[2]);
    const lumRange = Math.max(...lums) - Math.min(...lums);
    if (!best || spread > best.spread) best = { l, c, r, spread, lumRange };
  }
  say(best !== null && (best.spread > 8 || best.lumRange > 25),
    best ? `colour across one blade: L=${best.l} C=${best.c} R=${best.r} ` +
      `(hue spread ${best.spread.toFixed(0)}deg, luma range ${best.lumRange.toFixed(0)})`
      : "could not isolate a lit blade");

  // The row runs past both side edges. Measured over all five frames: on the
  // darkest compositions an edge column can sit inside a black band at one
  // moment, which says nothing about whether blades are there.
  const colLit = (img, rx) => {
    let n = 0; const xx = Math.round(img.width * rx);
    for (let yy = 0; yy < img.height; yy += 2) if (luma(img, xx, yy) > 3) n++;
    return (n / (img.height / 2)) * 100;
  };
  const leftLit = Math.max(...FRAMES.map((f) => colLit(imgs[f], 0.002)));
  const rightLit = Math.max(...FRAMES.map((f) => colLit(imgs[f], 0.998)));
  say(leftLit > 80 && rightLit > 80,
    `outermost columns lit ${leftLit.toFixed(0)}% / ${rightLit.toFixed(0)}% at their brightest frame ` +
    `(array runs past both edges)`);

  // Blades are cropped top and bottom: the first and last rows must carry the
  // same blade comb as the middle, not blade ends or empty background.
  const combAt = (img, ry) => {
    const yy = Math.round((img.height - 1) * ry);
    const v = []; for (let x = 0; x < img.width; x++) v.push(luma(img, x, yy));
    let turns = 0;
    for (let x = 2; x < v.length - 2; x++) {
      const a = Math.max(v[x - 2], v[x + 2]);
      if (v[x] <= v[x - 1] && v[x] <= v[x + 1] && a - v[x] > Math.max(3, a * 0.08)) turns++;
    }
    return turns;
  };
  const brightest = FRAMES.reduce((b, f) => (gridStats(imgs[f]).p50 > gridStats(imgs[b]).p50 ? f : b), FRAMES[0]);
  const bi = imgs[brightest];
  say(combAt(bi, 0) > 8 && combAt(bi, 1) > 8,
    `blade comb present on the very first and last rows (${combAt(bi, 0)} / ${combAt(bi, 1)} seams) ` +
    `- blades are cropped, no ends visible`);

  // The colour has moved.
  let diff = 0, n = 0;
  for (let yy = 0; yy < first.height; yy += 7) for (let xx = 0; xx < first.width; xx += 7) {
    const a = px(imgs[0], xx, yy), b = px(imgs[300], xx, yy);
    diff += Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]); n++;
  }
  say(diff / n / 3 > 6, `colour moved between frames 0 and 300 (mean delta ${(diff / n / 3).toFixed(1)}/255)`);

  // Static or moving blades.
  const pa = columnProfile(imgs[0]), pb = columnProfile(imgs[300]);
  const ea = sharpEdges(pa), eb = sharpEdges(pb);
  const both = ea.filter((x) => pb[x] >= 12);
  const matched = both.filter((x) => eb.some((q) => Math.abs(x - q) <= 2)).length;
  const pct = both.length ? (matched / both.length) * 100 : 0;
  console.log(`   info  blade seams shared with frame 300: ${matched}/${both.length} (${pct.toFixed(0)}%) ` +
    `- look 1 expects nearly all, look 2 expects few`);

  // Look 2: the wave. Only meaningful where the blades actually move, which is
  // exactly what the seam-sharing figure above distinguishes.
  if (pct < 60) {
    // Visible widths must vary across the frame: some blades near edge-on and
    // thin, some face-on and wide.
    const g = sm.slice(1).map((q, i) => q - sm[i]).filter((q) => q < 200);
    const mean = g.reduce((a, b) => a + b, 0) / Math.max(g.length, 1);
    const sd = Math.sqrt(g.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(g.length, 1));
    say(sd / mean > 0.18,
      `visible blade widths vary across the frame (spread ${(sd / mean * 100).toFixed(0)}% of the mean)`);

    // The crossing line, where the twist passes edge-on: per x-band, the height
    // at which the band is darkest. It must sit somewhere else at frame 300.
    const crossing = (img) => {
      const out = [];
      for (let b = 0; b < 8; b++) {
        const x0 = Math.floor((b / 8) * img.width), x1 = Math.floor(((b + 1) / 8) * img.width);
        let bestY = 0, bestV = Infinity;
        for (let y = 20; y < img.height - 20; y += 4) {
          let sum = 0, n = 0;
          for (let x = x0; x < x1; x += 3) { sum += luma(img, x, y); n++; }
          const v = sum / n;
          if (v < bestV) { bestV = v; bestY = y; }
        }
        out.push(bestY);
      }
      return out;
    };
    const c0 = crossing(imgs[0]), c300 = crossing(imgs[300]);
    const shift = c0.reduce((a, y, i) => a + Math.abs(y - c300[i]), 0) / c0.length;
    say(shift > 30,
      `crossing line sits at a different height at frame 300 ` +
      `(mean shift ${shift.toFixed(0)}px; f0 ${c0.join(",")} -> f300 ${c300.join(",")})`);

    // Dark gaps through the row.
    const darkFrac = FRAMES.map((f) => gridStats(imgs[f]).under16);
    say(Math.max(...darkFrac) > 8,
      `dark gaps visible through the row (up to ${Math.max(...darkFrac).toFixed(0)}% near-black)`);
  }

  // Hues present in one frame.
  const buckets = new Set();
  for (let yy = 0; yy < first.height; yy += 9) for (let xx = 0; xx < first.width; xx += 9) {
    const q = px(first, xx, yy);
    if (Math.max(...q) < 60) continue;
    const h = hue(q); if (h >= 0) buckets.add(Math.floor(h / 30));
  }
  console.log(`   info  distinct 30deg hue buckets in frame 0: ${buckets.size}`);

  // Black level across the loop.
  const stats = FRAMES.map((f) => gridStats(imgs[f]));
  console.log(`   info  median luma per frame: ${stats.map((s) => s.p50).join(" ")}` +
    `   near-black (<16): ${stats.map((s) => s.under16.toFixed(0) + "%").join(" ")}`);

  // Unlit blades must still be physically there: brighten the near-black
  // regions heavily and look for the blade comb.
  const darkest = FRAMES.reduce((b, f) => (gridStats(imgs[f]).p50 < gridStats(imgs[b]).p50 ? f : b), FRAMES[0]);
  const di = imgs[darkest];
  let darkSeams = 0, darkCols = 0;
  for (const ry of [0.25, 0.5, 0.75]) {
    const yy = Math.round(di.height * ry);
    const v = []; for (let x = 0; x < di.width; x++) v.push(luma(di, x, yy));
    // Only the stretches that are near-black to begin with.
    for (let x0 = 0; x0 + 200 < v.length; x0 += 200) {
      const win = v.slice(x0, x0 + 200);
      if (Math.max(...win) > 16) continue;
      darkCols++;
      for (let i = 2; i < win.length - 2; i++) {
        const a = Math.max(win[i - 2], win[i + 2]);
        if (win[i] <= win[i - 1] && win[i] <= win[i + 1] && a - win[i] >= 1) darkSeams++;
      }
    }
  }
  if (darkCols > 0) {
    say(darkSeams / darkCols > 3,
      `unlit blades still present: ${(darkSeams / darkCols).toFixed(1)} seams per 200px of near-black ` +
      `(frame ${darkest}, ${darkCols} windows)`);
  } else {
    console.log(`   info  no near-black stretches at frame ${darkest} to test for hidden blades`);
  }

  // Banding in the dark, which is where it shows first. Same scan, lower floor.
  let darkBand = null;
  for (const f of FRAMES) {
    const b = bandingDark(imgs[f]);
    if (!darkBand || b.worst > darkBand.worst) darkBand = { ...b, f };
  }
  if (darkBand.windows > 0) {
    say(darkBand.worst <= 150,
      `banding in the dark: longest flat run ${darkBand.worst}px (frame ${darkBand.f}, ` +
      `${darkBand.windows} windows), surviving dither ${darkBand.noise.toFixed(2)} lsb`);
  } else {
    console.log(`   info  no dark smooth ramps to scan for banding`);
  }

  // Banding, on the worst frame of the five.
  let worstBand = null;
  for (const f of FRAMES) {
    const b = banding(imgs[f]);
    if (!worstBand || b.worst > worstBand.worst) worstBand = { ...b, f };
  }
  say(worstBand.windows === 0 || worstBand.worst <= 130,
    `banding: longest flat run ${worstBand.worst}px in a smooth ramp (frame ${worstBand.f}, ` +
    `${worstBand.windows} windows), surviving dither ${worstBand.noise === null ? "n/a" : worstBand.noise.toFixed(2)} lsb`);

  rmSync(dir, { recursive: true, force: true });
}

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
