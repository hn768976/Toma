import {
  HALO_ALPHA,
  HALO_MIN_ENERGY,
  HOT_ALPHA,
  HOT_MIN_ENERGY,
  HUE_STEPS,
  LEVEL_STEPS,
} from "./constants";

export type ColorStop = {
  t: number; // 0 = left edge of frame, 1 = right edge
  // Hue in degrees. Deliberately allowed outside 0..360 so a ramp can
  // run the short way round the wheel (V3 goes 38 -> -8 -> -68) with a
  // plain linear interpolation.
  h: number;
  s: number; // 0..100
  l: number; // 0..100
};

export type Palette = {
  id: string;
  label: string;
  stops: ColorStop[];
  // Tint of the broad background glow.
  glow: ColorStop;
};

// Hue is a function of horizontal position only, so the gradient stays
// pinned to the frame while the wave rolls through it.
export const PALETTES: Record<string, Palette> = {
  magentaCyan: {
    id: "magentaCyan",
    label: "Magenta -> cyan",
    stops: [
      { t: 0, h: 304, s: 76, l: 54 },
      { t: 0.28, h: 293.4, s: 74, l: 51 }, // #c026d3
      { t: 0.55, h: 256.1, s: 84, l: 57 }, // #6d3df0
      { t: 0.78, h: 210, s: 88, l: 56 },
      { t: 1, h: 187.9, s: 88, l: 55 }, // #22d3ee
    ],
    glow: { t: 0, h: 262, s: 84, l: 55 },
  },
  blueWhite: {
    id: "blueWhite",
    label: "Deep blue -> white",
    stops: [
      { t: 0, h: 228, s: 76, l: 46 },
      { t: 0.3, h: 224, s: 82, l: 54 },
      { t: 0.6, h: 214, s: 88, l: 62 },
      { t: 0.82, h: 205, s: 80, l: 76 },
      { t: 1, h: 197, s: 62, l: 90 },
    ],
    glow: { t: 0, h: 214, s: 82, l: 58 },
  },
  amberMagenta: {
    id: "amberMagenta",
    label: "Amber -> magenta",
    stops: [
      { t: 0, h: 41, s: 94, l: 55 },
      { t: 0.28, h: 26, s: 92, l: 54 },
      { t: 0.55, h: -8, s: 88, l: 62 },
      { t: 0.78, h: -40, s: 86, l: 61 },
      { t: 1, h: -68, s: 84, l: 60 },
    ],
    glow: { t: 0, h: -14, s: 86, l: 55 },
  },
};

export const hslToRgb = (h: number, s: number, l: number) => {
  const hue = ((h % 360) + 360) % 360;
  const sN = s / 100;
  const lN = l / 100;
  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const hp = hue / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = lN - c / 2;
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
};

// Interpolates the ramp in HSL at a horizontal position 0..1.
export const stopAt = (stops: ColorStop[], t: number): ColorStop => {
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
  let i = 0;
  while (i < stops.length - 2 && clamped > stops[i + 1].t) i++;
  const a = stops[i];
  const b = stops[i + 1];
  const span = b.t - a.t;
  const f = span <= 0 ? 0 : (clamped - a.t) / span;
  return {
    t: clamped,
    h: a.h + (b.h - a.h) * f,
    s: a.s + (b.s - a.s) * f,
    l: a.l + (b.l - a.l) * f,
  };
};

export const cssColor = (stop: ColorStop, alpha: number) => {
  const { r, g, b } = hslToRgb(stop.h, stop.s, stop.l);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export type PaletteTables = {
  // HUE_STEPS * LEVEL_STEPS ready-made fill styles, indexed by
  // hueBucket * LEVEL_STEPS + levelBucket.
  colors: string[];
  // Per level: halo opacity and white-hot core opacity (0 = don't draw).
  haloAlpha: Float32Array;
  hotAlpha: Float32Array;
  // Per hue bucket, the base colour used for the halo sprites.
  hueStops: ColorStop[];
};

const cache = new Map<string, PaletteTables>();

// Precomputes every colour the dot pass can need. The hot loop then only
// ever assigns an already-built string to ctx.fillStyle, and dots are
// drawn grouped by bucket so that assignment happens ~1500 times a frame
// instead of ~29,000 times.
export const paletteTables = (palette: Palette): PaletteTables => {
  const cached = cache.get(palette.id);
  if (cached) return cached;

  const colors: string[] = new Array(HUE_STEPS * LEVEL_STEPS);
  const haloAlpha = new Float32Array(LEVEL_STEPS);
  const hotAlpha = new Float32Array(LEVEL_STEPS);
  const hueStops: ColorStop[] = new Array(HUE_STEPS);

  for (let h = 0; h < HUE_STEPS; h++) {
    const base = stopAt(palette.stops, (h + 0.5) / HUE_STEPS);
    hueStops[h] = base;
    for (let lv = 0; lv < LEVEL_STEPS; lv++) {
      const e = (lv + 0.5) / LEVEL_STEPS;
      const hot = e * e * e * e; // only the very top of the range goes white
      const alpha = Math.min(1, 0.1 + 1.6 * Math.pow(e, 0.85));
      const lightness = base.l * (0.7 + 0.5 * e) + (99 - base.l) * hot;
      const saturation = base.s * (1 - 0.6 * hot);
      colors[h * LEVEL_STEPS + lv] = cssColor(
        { t: 0, h: base.h, s: saturation, l: Math.min(99, lightness) },
        alpha,
      );
    }
  }

  for (let lv = 0; lv < LEVEL_STEPS; lv++) {
    const e = (lv + 0.5) / LEVEL_STEPS;
    haloAlpha[lv] =
      e >= HALO_MIN_ENERGY
        ? HALO_ALPHA *
          Math.pow((e - HALO_MIN_ENERGY) / (1 - HALO_MIN_ENERGY), 1.3)
        : 0;
    hotAlpha[lv] =
      e >= HOT_MIN_ENERGY
        ? HOT_ALPHA * ((e - HOT_MIN_ENERGY) / (1 - HOT_MIN_ENERGY))
        : 0;
  }

  const tables: PaletteTables = { colors, haloAlpha, hotAlpha, hueStops };
  cache.set(palette.id, tables);
  return tables;
};
