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
    const spread = hs.length < 2 ? 0 : Math.max(...hs) - Math.min(...hs);
    const lums = [l, c, r].map((q) => 0.2126 * q[0] + 0.7152 * q[1] + 0.0722 * q[2]);
    const lumRange = Math.max(...lums) - Math.min(...lums);
    if (!best || spread > best.spread) best = { l, c, r, spread, lumRange };
  }
  say(best !== null && (best.spread > 8 || best.lumRange > 25),
    best ? `colour across one blade: L=${best.l} C=${best.c} R=${best.r} ` +
      `(hue spread ${best.spread.toFixed(0)}deg, luma range ${best.lumRange.toFixed(0)})`
      : "could not isolate a lit blade");

  // The row runs past both side edges; blades are cropped top and bottom.
  const colLit = (rx) => {
    let n = 0; const xx = Math.round(first.width * rx);
    for (let yy = 0; yy < first.height; yy += 2) if (luma(first, xx, yy) > 3) n++;
    return (n / (first.height / 2)) * 100;
  };
  say(colLit(0.002) > 80 && colLit(0.998) > 80,
    `outermost columns lit ${colLit(0.002).toFixed(0)}% / ${colLit(0.998).toFixed(0)}% (array runs past both edges)`);

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
