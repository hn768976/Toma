/**
 * Two-opposed-hues palettes plus the sector field that pools them into
 * regions rather than alternating them evenly.
 */

import { COLOR_BUCKETS, RAMP_STEPS } from "./constants";
import { clamp01, lerp } from "./random";

export type VariantId = "orangeBlue" | "goldMagenta";

export type Palette = {
  id: VariantId;
  /** Background radial gradient, centre -> corners. */
  bgInner: string;
  bgOuter: string;
  /** Two opposed hue ramps, each [dim, bright]. */
  ramps: [[string, string], [string, string]];
  /** Soft haze at the top and the bottom of frame. */
  hazeTop: string;
  hazeBottom: string;
  /** Tint of the central core cluster. */
  core: string;
};

export const PALETTES: Record<VariantId, Palette> = {
  orangeBlue: {
    id: "orangeBlue",
    bgInner: "#040a20",
    bgOuter: "#01030a",
    ramps: [
      ["#f04a1a", "#ff7a3a"],
      ["#2a5fe8", "#6ab0ff"],
    ],
    hazeTop: "#ff5c30",
    hazeBottom: "#2a6cff",
    core: "#a8d4ff",
  },
  goldMagenta: {
    id: "goldMagenta",
    bgInner: "#120426",
    bgOuter: "#05010c",
    ramps: [
      ["#f0a020", "#ffd27a"],
      ["#e026a0", "#ff7ad0"],
    ],
    hazeTop: "#ffb43c",
    hazeBottom: "#e83ab0",
    core: "#ffc8ea",
  },
};

const hexToRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/**
 * 48 buckets: for each hue family, 24 brightness steps running from the dim
 * end of the ramp to the bright end, with the top steps blending toward white
 * so the hottest elements clip out under additive compositing.
 */
export const buildBuckets = (palette: Palette): string[] => {
  const out: string[] = new Array(COLOR_BUCKETS);
  for (let family = 0; family < 2; family++) {
    const [c0, c1] = palette.ramps[family].map(hexToRgb);
    // Three stops: a darkened version of the ramp's low end, the low end
    // itself, then the bright end. Without the dark stop, dim elements would
    // have to be faded to grey instead of simply being darker, which is what
    // drains the colour out of the mid field.
    const dark: [number, number, number] = [
      c0[0] * 0.3,
      c0[1] * 0.3,
      c0[2] * 0.34,
    ];
    for (let step = 0; step < RAMP_STEPS; step++) {
      const t = step / (RAMP_STEPS - 1);
      const a = t < 0.5 ? dark : c0;
      const b = t < 0.5 ? c0 : c1;
      const k = t < 0.5 ? t / 0.5 : (t - 0.5) / 0.5;
      let r = lerp(a[0], b[0], k);
      let g = lerp(a[1], b[1], k);
      let bl = lerp(a[2], b[2], k);
      // Only the very top of the ramp clips to white, so white stays a
      // highlight rather than the default for anything bright.
      const hot = clamp01((t - 0.88) / 0.12);
      if (hot > 0) {
        const w = hot * hot * 0.7;
        r = lerp(r, 255, w);
        g = lerp(g, 255, w);
        bl = lerp(bl, 255, w);
      }
      out[family * RAMP_STEPS + step] = `rgb(${Math.round(r)},${Math.round(
        g,
      )},${Math.round(bl)})`;
    }
  }
  return out;
};

export const bucketIndex = (family: number, intensity: number) => {
  const step = Math.min(
    RAMP_STEPS - 1,
    Math.max(0, Math.floor(clamp01(intensity) * RAMP_STEPS)),
  );
  return family * RAMP_STEPS + step;
};

/**
 * Low-frequency field over the field angle, in [0, 1]. Values near 0 and 1 are
 * solidly one hue; the fuzzy middle is where the two hues interleave. Because
 * it is a function of the *field* angle the colour regions rotate with the
 * assembly rather than staying pinned to the screen.
 */
export const sectorField = (theta: number): number => {
  const v =
    0.62 * Math.sin(theta + 0.55) +
    0.3 * Math.sin(2 * theta - 1.2) +
    0.16 * Math.sin(3 * theta + 2.4);
  return clamp01(0.5 + v * 0.78);
};
