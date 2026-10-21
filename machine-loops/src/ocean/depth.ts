// Depth model: scale layout, unit conversion, the dive timeline and pressure.
import data from "../../data/oceanDepth.json";

export const FT_PER_M = 3.28084;
export const metresToFeet = (m: number) => Math.round(m * FT_PER_M);
// Seawater: about 0.1 MPa per 10 m (rho*g ~ 1.0e4 Pa/m), as specified.
export const pressureMPa = (m: number) => m / 100;

export const TICKS: number[] = data.metreTicks;
// Layout in 1080p units (scaled by height/1080). Ticks are evenly spaced;
// depth 0 sits one badge-height above the 200 m tick.
export const Y0 = 84;
export const ROW0 = 156;
export const ROW = 78;
const knotsM = [0, ...TICKS];
const knotsY = [Y0, ...TICKS.map((_, i) => ROW0 + i * ROW)];
export const depthToY = (m: number) => {
  if (m <= 0) return Y0 + (m / 200) * (ROW0 - Y0);
  for (let i = 1; i < knotsM.length; i++) {
    if (m <= knotsM[i]) {
      const t = (m - knotsM[i - 1]) / (knotsM[i] - knotsM[i - 1]);
      return knotsY[i - 1] + t * (knotsY[i] - knotsY[i - 1]);
    }
  }
  const last = knotsM.length - 1;
  return knotsY[last] + ((m - knotsM[last]) / 1000) * ROW;
};

// Dive: eased segments between zone lines with short pauses on each line.
// Frames at 30fps: dive ends at 390 (13 s), then a 2 s hold.
const SEG: [number, number, number][] = [
  // [startFrame, endFrame, targetDepth]
  [0, 52, 200],
  [64, 118, 1000],
  [130, 214, 4000],
  [226, 286, 6000],
  [298, 390, 11030],
];
export const START_DEPTH = 40;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const diveDepth = (frame: number) => {
  let d = START_DEPTH;
  for (const [a, b, target] of SEG) {
    if (frame <= a) return d;
    if (frame < b) {
      const t = ease((frame - a) / (b - a));
      return d + (target - d) * t;
    }
    d = target;
  }
  return d;
};
export const DIVE_END = 390;
export { data as oceanText };
