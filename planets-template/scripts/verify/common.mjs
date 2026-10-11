import fs from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { openBrowser } from "@remotion/renderer";
import sharp from "sharp";

export const browserExecutable = fs.existsSync("/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell")
  ? "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell" : null;
export const gl = process.env.REMOTION_GL ?? "angle";
export const chromiumOptions = { gl };
export const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")));

export async function makeBundle() {
  return args.bundle ?? (await bundle({ entryPoint: path.resolve("src/index.ts") }));
}
export async function freshBrowser() {
  return openBrowser("chrome", { browserExecutable, chromiumOptions });
}
export async function pixels(file) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, info };
}
export async function samePixels(a, b) {
  const [pa, pb] = await Promise.all([pixels(a), pixels(b)]);
  if (pa.info.width !== pb.info.width || pa.info.height !== pb.info.height) return { equal: false, diff: Infinity };
  let diff = 0, maxd = 0;
  for (let i = 0; i < pa.data.length; i++) {
    const d = Math.abs(pa.data[i] - pb.data[i]);
    if (d) { diff++; if (d > maxd) maxd = d; }
  }
  return { equal: diff === 0, diff, maxd };
}
