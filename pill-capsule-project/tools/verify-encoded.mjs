// Objective checks on the encoded files (verify-loop step 1).
//
// Everything here reads the rendered mp4, not the preview: banding, lifted
// blacks and pixel-format mistakes only exist after the encode.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { readPNG, pixel, hex } from "./png.mjs";

const OUT = "out/verify";
mkdirSync(OUT, { recursive: true });

const ffprobe = (args) =>
  execFileSync("npx", ["remotion", "ffprobe", ...args], { stdio: ["ignore", "pipe", "pipe"] })
    .toString()
    .trim();

const frameTo = (file, seconds, png) =>
  execFileSync(
    "npx",
    ["remotion", "ffmpeg", "-v", "error", "-y", "-ss", String(seconds), "-i", file, "-frames:v", "1", png],
    { stdio: ["ignore", "ignore", "pipe"] },
  );

const EXPECTED = [
  { file: "out/SinglePill_CapsuleGrey.mp4", duration: 10 },
  { file: "out/SinglePill_TabletBlue.mp4", duration: 10 },
  { file: "out/SinglePill_BlackMatte.mp4", duration: 20, pureBlack: true },
  { file: "out/FallingPills_MixedWhite.mp4", duration: 15 },
  { file: "out/FallingPills_BlueCapsule.mp4", duration: 15 },
  { file: "out/FallingPills_RedCapsule.mp4", duration: 15 },
];

let failures = 0;
const fail = (msg) => {
  failures++;
  console.log(`  FAIL  ${msg}`);
};
const pass = (msg) => console.log(`  pass  ${msg}`);

for (const spec of EXPECTED) {
  console.log(`\n${spec.file}`);
  if (!existsSync(spec.file)) {
    fail("file missing");
    continue;
  }

  const v = ffprobe([
    "-v", "error", "-select_streams", "v:0",
    "-show_entries", "stream=codec_name,width,height,r_frame_rate,pix_fmt",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1", spec.file,
  ]);
  const get = (k) => (v.match(new RegExp(`^${k}=(.*)$`, "m")) ?? [])[1];

  get("width") === "1920" && get("height") === "1080"
    ? pass("1920x1080")
    : fail(`resolution ${get("width")}x${get("height")}, expected 1920x1080`);
  get("r_frame_rate") === "30/1" ? pass("30/1 fps") : fail(`frame rate ${get("r_frame_rate")}`);
  get("codec_name") === "h264" ? pass("h264") : fail(`codec ${get("codec_name")}`);
  get("pix_fmt") === "yuv420p" ? pass("yuv420p") : fail(`pixel format ${get("pix_fmt")}`);

  const dur = Number(get("duration"));
  Math.abs(dur - spec.duration) < 0.05
    ? pass(`${dur.toFixed(3)}s`)
    : fail(`duration ${dur.toFixed(3)}s, expected ${spec.duration}s`);

  // Keep only lines that are a bare stream index; the CLI wrapper can print
  // unrelated notices on stdout.
  const audio = ffprobe([
    "-v", "error", "-select_streams", "a",
    "-show_entries", "stream=index", "-of", "csv=p=0", spec.file,
  ])
    .split("\n")
    .filter((l) => /^\d+$/.test(l.trim()));
  audio.length === 0
    ? pass("no audio stream")
    : fail(`audio stream present (index ${audio.join(", ")})`);

  if (spec.pureBlack) {
    // Look 2 ships as an overlay, so its black has to survive the encode.
    // Sample well away from the capsule, in both halves.
    for (const [label, t] of [["beauty", 2], ["matte", 12]]) {
      const png = `${OUT}/black-${label}.png`;
      frameTo(spec.file, t, png);
      const img = readPNG(png);
      const probes = [[8, 8], [img.width - 8, 8], [8, img.height - 8], [img.width - 8, img.height - 8], [40, img.height / 2]];
      const bad = probes.map((p) => pixel(img, p[0], p[1])).filter((c) => c.some((v) => v !== 0));
      bad.length === 0
        ? pass(`${label} half: background is 0,0,0`)
        : fail(`${label} half: background lifted to ${bad.map(hex).join(" ")}`);
    }
    // And the matte silhouette has to be pure white.
    const png = `${OUT}/matte-white.png`;
    frameTo(spec.file, 12, png);
    const img = readPNG(png);
    let peak = [0, 0, 0];
    for (let y = 0; y < img.height; y += 3) {
      for (let x = 0; x < img.width; x += 3) {
        const p = pixel(img, x, y);
        if (p[0] + p[1] + p[2] > peak[0] + peak[1] + peak[2]) peak = p;
      }
    }
    peak.every((c) => c === 255)
      ? pass("matte silhouette is 255,255,255")
      : fail(`matte silhouette peaks at ${hex(peak)}, expected #ffffff`);
  }
}

console.log(failures === 0 ? "\nAll encoded-file checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
