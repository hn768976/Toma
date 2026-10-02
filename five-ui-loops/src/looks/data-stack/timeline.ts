// Look 3 timeline — every value is a pure function of the frame.
import { clamp01, smoothstep } from "../../lib/random";

export const LAYERS = 6;
export const BOX_HALF = 1.1; // outline box half width
export const BOX_H = 3.4; // outline box height
export const LAYER_HALF = 0.95;
export const LAYER_THICK = 0.11;
export const layerY = (i: number) => 0.38 + i * 0.53;

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

// 0–60: vertical lines rise (bottom square draws in first 30 frames)
export const verticalRise = (f: number) => easeOutCubic(clamp01(f / 60));
export const bottomDraw = (f: number) => easeOutCubic(clamp01(f / 30));

// 60–240: layers from the bottom up; each slides down into place and flashes
const LAYER_START = 64;
const LAYER_STEP = 29;
const LAYER_DUR = 26;
export const layerState = (i: number, f: number) => {
  const s = LAYER_START + i * LAYER_STEP;
  const t = clamp01((f - s) / LAYER_DUR);
  const land = s + LAYER_DUR;
  const flash = f >= land ? Math.exp(-(f - land) / 6) : 0;
  return {
    appear: smoothstep(0, 0.45, t),
    drop: 0.55 * (1 - easeOutCubic(t)), // height above its slot
    flash,
  };
};

// 240–300: top edges draw, glass box fades in, whole stack brightens
export const topDraw = (f: number) => easeOutCubic(clamp01((f - 240) / 45));
export const boxGlass = (f: number) => smoothstep(240, 300, f);
export const brighten = (f: number) => 1 + 0.3 * smoothstep(240, 300, f);

// 300–360: shimmer band sweeping up, a few particles rising
export const shimmerY = (f: number) => (f < 296 ? -99 : -0.6 + ((f - 296) / 64) * (BOX_H + 1.5));
export const particleWindow = (f: number) => smoothstep(285, 305, f);

// Camera: slow push-in with a slight arc.
export const camera = (f: number) => {
  const t = f / 359;
  const e = t * t * (3 - 2 * t) * 0.5 + t * 0.5;
  const dist = 14.6 - 1.8 * e;
  const az = ((40 + 9 * e) * Math.PI) / 180;
  const el = ((35 - 1.5 * e) * Math.PI) / 180;
  return { dist, az, el };
};
