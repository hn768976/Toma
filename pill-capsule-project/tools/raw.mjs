// Decode an image or a single video frame to raw RGB24 via Remotion's ffmpeg.
// Used by the verify loop for pixel sampling and frame comparison.
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const FFMPEG = process.env.FFMPEG_BIN ?? "npx";
const FFMPEG_ARGS = process.env.FFMPEG_BIN ? [] : ["remotion", "ffmpeg"];

export const rawRGB = (file, { seekSeconds } = {}) => {
  if (!existsSync(file)) throw new Error(`no such file: ${file}`);
  const dir = mkdtempSync(join(tmpdir(), "raw-"));
  const out = join(dir, "f.rgb");
  const args = [...FFMPEG_ARGS, "-v", "error", "-y"];
  if (seekSeconds !== undefined) args.push("-ss", String(seekSeconds));
  args.push("-i", file, "-frames:v", "1", "-pix_fmt", "rgb24", "-f", "rawvideo", out);
  execFileSync(FFMPEG, args, { stdio: ["ignore", "ignore", "pipe"] });
  const probeArgs = [
    ...(process.env.FFMPEG_BIN ? [] : ["remotion", "ffprobe"]),
    "-v", "error", "-select_streams", "v:0",
    "-show_entries", "stream=width,height",
    "-of", "csv=p=0", file,
  ];
  const probeBin = process.env.FFPROBE_BIN ?? (process.env.FFMPEG_BIN ? "ffprobe" : "npx");
  const dims = execFileSync(probeBin, probeArgs).toString().trim().split(/[,\s]+/);
  const width = Number(dims[0]);
  const height = Number(dims[1]);
  return { data: readFileSync(out), width, height };
};

export const pixel = (img, x, y) => {
  const i = (Math.round(y) * img.width + Math.round(x)) * 3;
  return [img.data[i], img.data[i + 1], img.data[i + 2]];
};

export const hex = (p) => "#" + p.map((v) => v.toString(16).padStart(2, "0")).join("");
