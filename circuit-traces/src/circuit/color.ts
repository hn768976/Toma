import { HUE_BUCKETS, type Palette } from "./constants";

export type Rgb = { r: number; g: number; b: number };

export const hslToRgb = (h: number, s: number, l: number): Rgb => {
  const sN = Math.max(0, Math.min(1, s / 100));
  const lN = Math.max(0, Math.min(1, l / 100));
  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const hp = (((h % 360) + 360) % 360) / 60;
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

const css = ({ r, g, b }: Rgb) => `rgb(${r},${g},${b})`;

/** Interpolates the palette's horizontal ramp at t = x / BASE_W. */
export const stopAt = (palette: Palette, t: number) => {
  const stops = palette.stops;
  const clamped = Math.max(0, Math.min(1, t));
  let lower = stops[0];
  let upper = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (clamped >= stops[i].t && clamped <= stops[i + 1].t) {
      lower = stops[i];
      upper = stops[i + 1];
      break;
    }
  }
  const span = upper.t - lower.t || 1;
  const k = (clamped - lower.t) / span;
  return {
    h: lower.h + (upper.h - lower.h) * k,
    s: lower.s + (upper.s - lower.s) * k,
    l: lower.l + (upper.l - lower.l) * k,
  };
};

export const bucketOf = (t: number) =>
  Math.max(0, Math.min(HUE_BUCKETS - 1, Math.floor(t * HUE_BUCKETS)));

/** Centre of a bucket, back in 0..1 ramp space. */
const bucketT = (bucket: number) => (bucket + 0.5) / HUE_BUCKETS;

/**
 * How a pulse's colour evolves along its tail. `u` runs 0 at the faint tip of
 * the tail to 1 at the head: the head is pushed most of the way to white, the
 * body keeps the trace's hue, and brightness falls off steeply behind it so the
 * tail reads as a long fade rather than a solid bar.
 */
const tailProfile = (u: number) => {
  const brightness = Math.pow(u, 1.9);
  const whiteMix = Math.pow(u, 14) * 0.85;
  return { brightness, whiteMix };
};

export type Lut = {
  /** Unlit copper, one colour per hue bucket. */
  unlit: string[];
  /** Unlit component outlines, one colour per hue bucket. */
  outline: string[];
  /** pulse[bucket][step] — hue-tinted tail colours, brightness baked in. */
  pulse: string[][];
  /** Near-white tail colours for "hot" pulses. */
  hot: string[];
  /** Full-brightness colour per bucket, used for component flashes. */
  lit: string[];
};

export const buildLut = (palette: Palette, steps: number): Lut => {
  const unlit: string[] = [];
  const outline: string[] = [];
  const lit: string[] = [];
  const pulse: string[][] = [];

  for (let b = 0; b < HUE_BUCKETS; b++) {
    const { h, s, l } = stopAt(palette, bucketT(b));
    unlit.push(css(hslToRgb(h, s * palette.unlitSat, palette.unlitL)));
    outline.push(css(hslToRgb(h, s * palette.unlitSat * 0.8, palette.outlineL)));
    lit.push(css(hslToRgb(h, s, l)));

    const ramp: string[] = [];
    const base = hslToRgb(h, s, Math.min(56, l));
    for (let i = 0; i < steps; i++) {
      const u = (i + 1) / steps;
      const { brightness, whiteMix } = tailProfile(u);
      ramp.push(
        css({
          r: Math.round((base.r + (255 - base.r) * whiteMix) * brightness),
          g: Math.round((base.g + (255 - base.g) * whiteMix) * brightness),
          b: Math.round((base.b + (255 - base.b) * whiteMix) * brightness),
        }),
      );
    }
    pulse.push(ramp);
  }

  const hot: string[] = [];
  for (let i = 0; i < steps; i++) {
    const u = (i + 1) / steps;
    const { brightness, whiteMix } = tailProfile(u);
    // Hot pulses start pale and end white rather than carrying a hue.
    const warm = hslToRgb(palette.stops[palette.stops.length - 1].h, 34, 82);
    hot.push(
      css({
        r: Math.round((warm.r + (255 - warm.r) * whiteMix) * brightness),
        g: Math.round((warm.g + (255 - warm.g) * whiteMix) * brightness),
        b: Math.round((warm.b + (255 - warm.b) * whiteMix) * brightness),
      }),
    );
  }

  return { unlit, outline, pulse, hot, lit };
};
