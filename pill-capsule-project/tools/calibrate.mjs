// Backdrop calibration.
//
// The sweep is lit geometry, so its albedo is not its on-screen colour: the
// light rig multiplies it and AgX compresses the result. This measures the
// effective irradiance at two control points from one render, then solves for
// the albedo that lands on a target colour. Beats guessing at 45s a render.
//
// Usage: node tools/calibrate.mjs <render.png> <albedoFloorHex> <albedoWallHex>
//                                 <targetFloorHex> <targetWallHex>
import { readPNG, pixel, hex } from "./png.mjs";

const [file, albFloor, albWall, tgtFloor, tgtWall] = process.argv.slice(2);

const srgbToLinear = (c) =>
  c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
const linearToSrgb = (c) =>
  c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
const parse = (h) => {
  const n = parseInt(h.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => srgbToLinear(v / 255));
};
const toHex = (lin) =>
  "#" +
  lin
    .map((v) => Math.round(Math.min(1, Math.max(0, linearToSrgb(v))) * 255).toString(16).padStart(2, "0"))
    .join("");

const { preToneMapSolve } = await import("./agx.mjs");

const img = readPNG(file);
// The sweep lerps by sqrt(t), so these two points are close to the pure floor
// and pure wall albedos.
const POINTS = { floor: [0.5, 0.985], wall: [0.5, 0.015] };

for (const [name, albedoHex, targetHex] of [
  ["floor", albFloor, tgtFloor],
  ["wall", albWall, tgtWall],
]) {
  const [u, v] = POINTS[name];
  const measured = pixel(img, u * (img.width - 1), v * (img.height - 1));
  // Undo AgX to recover the scene radiance that produced the measured pixel.
  const radiance = preToneMapSolve(hex(measured)).linear;
  const albedo = parse(albedoHex);
  const E = [radiance.r, radiance.g, radiance.b].map((r, i) => r / Math.max(albedo[i], 1e-6));
  const wantRadiance = preToneMapSolve(targetHex).linear;
  const needAlbedo = [wantRadiance.r, wantRadiance.g, wantRadiance.b].map((r, i) =>
    Math.min(1, r / Math.max(E[i], 1e-6)),
  );
  console.log(
    `${name.padEnd(5)} measured ${hex(measured)}  target ${targetHex}  ` +
      `albedo ${albedoHex} -> ${toHex(needAlbedo)}` +
      (needAlbedo.some((c) => c >= 1) ? "  [CLIPPED: rig is too dim here]" : ""),
  );
}
