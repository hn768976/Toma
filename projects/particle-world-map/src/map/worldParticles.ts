import { geoEquirectangular, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import landTopo from "../data/land-50m.json";
import { mulberry32 } from "../lib/random";

/**
 * Builds the particle world map:
 *  1. rasterise Natural Earth land (world-atlas, 1:50m) into an
 *     equirectangular mask canvas with d3-geo,
 *  2. rejection-sample random points on land with a fixed seed.
 * Output positions are in map-plane units (see MAP_* constants).
 */

// Map placement on its plane (world units), matching the reference framing.
export const MAP_LEFT = -5.95;
export const MAP_RIGHT = 4.35;
export const MAP_TOP = 3.2;
export const MAP_BOTTOM = -3.45;
// Latitude window shown (Antarctica omitted like in the reference).
const LAT_TOP = 83;
const LAT_BOTTOM = -56;

export type MapParticles = {
  positions: Float32Array; // xyz
  sizes: Float32Array;
  brightness: Float32Array;
  phases: Float32Array;
  count: number;
};

/**
 * Optional 3x3 homography (row-major) mapping Mercator (u, v) to map-plane
 * units (u = (lon+180)/360, v = 0.5 - ln(tan(pi/4 + lat/2)) / 2pi). Used by Version 1 to reproduce the reference's
 * perspective-tilted map exactly (fitted to landmark positions measured on the
 * reference: Alaska, Cape Horn, Greenland N/S, Cape Agulhas, Australia, NZ).
 */
export type Homography = [number, number, number, number, number, number, number, number, number];

export const REFERENCE_MAP_HOMOGRAPHY: Homography = [
  8.474522, 0.934195, -5.94696, -1.738304, -6.965612, 3.915727, -0.154765, -0.294681, 1.0,
];

export const buildWorldParticles = (
  count: number,
  seed = 2024,
  depthJitter = 0.02,
  homography?: Homography,
): MapParticles => {
  const W = 4096;
  const H = 2048;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("2D context unavailable");
  const topo = landTopo as unknown as Topology<{ land: GeometryCollection }>;
  const land = feature(topo, topo.objects.land);
  const projection = geoEquirectangular()
    .scale(W / (2 * Math.PI))
    .translate([W / 2, H / 2]);
  const path = geoPath(projection, ctx);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  path(land);
  ctx.fill();
  const mask = ctx.getImageData(0, 0, W, H).data;

  const vTop = (90 - LAT_TOP) / 180;
  const vBot = (90 - LAT_BOTTOM) / 180;
  const rnd = mulberry32(seed);
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const brightness = new Float32Array(count);
  const phases = new Float32Array(count);
  let n = 0;
  let guard = 0;
  while (n < count && guard < count * 80) {
    guard++;
    const u = rnd();
    const v = vTop + rnd() * (vBot - vTop);
    const px = Math.min(W - 1, Math.floor(u * W));
    const py = Math.min(H - 1, Math.floor(v * H));
    if (mask[(py * W + px) * 4] < 128) continue;
    let x = MAP_LEFT + u * (MAP_RIGHT - MAP_LEFT);
    let y = MAP_TOP - ((v - vTop) / (vBot - vTop)) * (MAP_TOP - MAP_BOTTOM);
    let persp = 1;
    if (homography) {
      const H = homography;
      const lat = ((90 - v * 180) * Math.PI) / 180;
      const vm = 0.5 - Math.log(Math.tan(Math.PI / 4 + lat / 2)) / (2 * Math.PI);
      const w = H[6] * u + H[7] * vm + H[8];
      x = (H[0] * u + H[1] * vm + H[2]) / w;
      y = (H[3] * u + H[4] * vm + H[5]) / w;
      // dots grow on the nearer (right) side, like true perspective
      persp = Math.min(1.6, Math.max(0.6, Math.pow(w / 0.8, -1.5)));
    }
    positions[n * 3] = x;
    positions[n * 3 + 1] = y;
    positions[n * 3 + 2] = (rnd() - 0.5) * 2 * depthJitter;
    const r = rnd();
    sizes[n] = (0.55 + Math.pow(rnd(), 2.2) * 1.4) * persp;
    brightness[n] = r > 0.98 ? 1.3 + rnd() * 1.0 : 0.18 + Math.pow(rnd(), 1.4) * 0.72;
    phases[n] = rnd() * Math.PI * 2;
    n++;
  }
  return {
    positions: positions.subarray(0, n * 3),
    sizes: sizes.subarray(0, n),
    brightness: brightness.subarray(0, n),
    phases: phases.subarray(0, n),
    count: n,
  };
};
