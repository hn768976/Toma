// Palette ramps for the halftone sheet.
//
// Hue is a function of position along the sheet's length only (the row
// index), so a colour lookup table of PALETTE_BUCKETS entries can be built
// once per palette and reused for every frame and every dot. Per-dot
// brightness is applied as a multiplier at draw time.

export type Hsl = { h: number; s: number; l: number };
export type Rgb = { r: number; g: number; b: number };

export type Palette = {
  /** t = 0 is the far end of the sheet, t = 1 the near end. */
  stops: { t: number; color: Hsl }[];
  /** Colour of the wide background glow under the densest region. */
  glow: Rgb;
};

// V1 — magenta #e026c0 (near) through violet #7a3ce8 to blue #2a5fe8 (far).
export const MAGENTA_PALETTE: Palette = {
  stops: [
    { t: 0, color: { h: 224, s: 0.8, l: 0.54 } }, // #2a5fe8
    { t: 0.5, color: { h: 260, s: 0.78, l: 0.57 } }, // #7a3ce8
    { t: 1, color: { h: 309, s: 0.74, l: 0.51 } }, // #e026c0
  ],
  glow: { r: 118, g: 60, b: 210 },
};

// V2 — cyan #22d3ee (near) through teal #12a878 to deep green #0a6a4a (far).
export const CYAN_PALETTE: Palette = {
  stops: [
    { t: 0, color: { h: 160, s: 0.83, l: 0.23 } }, // #0a6a4a
    { t: 0.5, color: { h: 163, s: 0.8, l: 0.36 } }, // #12a878
    { t: 1, color: { h: 189, s: 0.85, l: 0.53 } }, // #22d3ee
  ],
  glow: { r: 26, g: 168, b: 150 },
};

export const PALETTES = {
  magenta: MAGENTA_PALETTE,
  cyan: CYAN_PALETTE,
} as const;

export type PaletteName = keyof typeof PALETTES;

const hueToChannel = (p: number, q: number, tRaw: number): number => {
  let t = tRaw;
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
};

export const hslToRgb = ({ h, s, l }: Hsl): Rgb => {
  const hn = (((h % 360) + 360) % 360) / 360;
  if (s === 0) {
    const v = l * 255;
    return { r: v, g: v, b: v };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: hueToChannel(p, q, hn + 1 / 3) * 255,
    g: hueToChannel(p, q, hn) * 255,
    b: hueToChannel(p, q, hn - 1 / 3) * 255,
  };
};

// Interpolating in HSL keeps saturation up across the magenta -> violet ->
// blue sweep; a straight sRGB lerp desaturates badly through the middle.
const sampleHsl = (palette: Palette, t: number): Hsl => {
  const stops = palette.stops;
  const clamped = Math.min(1, Math.max(0, t));
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1];
    const b = stops[i];
    if (clamped <= b.t) {
      const span = b.t - a.t;
      const k = span === 0 ? 0 : (clamped - a.t) / span;
      return {
        h: a.color.h + (b.color.h - a.color.h) * k,
        s: a.color.s + (b.color.s - a.color.s) * k,
        l: a.color.l + (b.color.l - a.color.l) * k,
      };
    }
  }
  return stops[stops.length - 1].color;
};

/**
 * Builds the colour lookup table used to batch dots by colour bucket.
 * Index 0 is the far end of the sheet, index buckets-1 the near end.
 */
export const buildColorRamp = (palette: Palette, buckets: number): Rgb[] => {
  const ramp: Rgb[] = new Array(buckets);
  for (let i = 0; i < buckets; i++) {
    ramp[i] = hslToRgb(sampleHsl(palette, i / (buckets - 1)));
  }
  return ramp;
};
