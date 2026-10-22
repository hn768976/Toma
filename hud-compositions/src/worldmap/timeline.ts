import { easeInOut, lerp, ramp } from "../common/math";
import { MapCamera } from "./projection";

/** Beat sheet in frames at 30 fps (reference timestamps in comments). */
export const W = {
  reveal: 0, // 0.0 s map glitches in from black
  authIn: 16, // 0.5 s authentication dialog
  authUser: 22,
  authPass: 34,
  authButton: 50,
  authOut: 60, // 2.0 s
  panelsIn: 60, // 2.0 s side panels flicker on
  loadingIn: 62, // INTERFACE LOADING bar
  loadingDone: 116,
  decodeIn: 70,
  searchIn: 122, // 4.1 s SEARCH REQUEST dialog
  searchType: 132,
  searchOut: 180, // 6.0 s
  objLabel: 182,
  brighten: 196, // 6.5 s land highlight
  zoomNA: [208, 226], // 6.9-7.5 s dive into North America
  frameIn: 226,
  whipAsia: [300, 318], // 10.0-10.6 s
  whipAfrica: [404, 418], // 13.5-13.9 s
  targetMarks: 430,
  gridScan: 452,
  alpha: 510, // 17.0 s ALPHA PROTOCOL INITIALIZATION
  targetData: 526, // 17.5 s TARGET DATA panel
} as const;

const WORLD: MapCamera = { lon: 8, lat: 8, k: 1.0 };
const NA: MapCamera = { lon: -96, lat: 49, k: 2.15 };
const NA2: MapCamera = { lon: -93, lat: 48, k: 2.22 };
const ASIA: MapCamera = { lon: 96, lat: 50, k: 2.3 };
const ASIA2: MapCamera = { lon: 100, lat: 49, k: 2.36 };
const AFR: MapCamera = { lon: 38, lat: 21, k: 2.5 };
const AFR2: MapCamera = { lon: 39, lat: 22, k: 2.62 };

const mix = (a: MapCamera, b: MapCamera, t: number, dip = 0): MapCamera => ({
  lon: lerp(a.lon, b.lon, t),
  lat: lerp(a.lat, b.lat, t),
  // Log-space zoom with an optional pull-back mid-move for whip pans.
  k: Math.exp(lerp(Math.log(a.k), Math.log(b.k), t)) * (1 - dip * Math.sin(Math.PI * t)),
});

export const mapCameraAt = (f: number): MapCamera => {
  if (f < W.zoomNA[0]) return mix(WORLD, { ...WORLD, k: 1.04 }, ramp(f, 0, W.zoomNA[0]));
  if (f < W.zoomNA[1]) return mix({ ...WORLD, k: 1.04 }, NA, ramp(f, W.zoomNA[0], W.zoomNA[1], easeInOut));
  if (f < W.whipAsia[0]) return mix(NA, NA2, ramp(f, W.zoomNA[1], W.whipAsia[0]));
  if (f < W.whipAsia[1]) return mix(NA2, ASIA, ramp(f, W.whipAsia[0], W.whipAsia[1], easeInOut), 0.25);
  if (f < W.whipAfrica[0]) return mix(ASIA, ASIA2, ramp(f, W.whipAsia[1], W.whipAfrica[0]));
  if (f < W.whipAfrica[1]) return mix(ASIA2, AFR, ramp(f, W.whipAfrica[0], W.whipAfrica[1], easeInOut), 0.12);
  return mix(AFR, AFR2, ramp(f, W.whipAfrica[1], 626));
};

/** Which focus region is active (drives coordinates and reticle paths). */
export const regionAt = (f: number): "world" | "na" | "asia" | "africa" => {
  if (f < W.zoomNA[1]) return "world";
  if (f < (W.whipAsia[0] + W.whipAsia[1]) / 2) return "na";
  if (f < (W.whipAfrica[0] + W.whipAfrica[1]) / 2) return "asia";
  return "africa";
};
