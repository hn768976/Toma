import {lerp} from '../spectrum/random';

export type Hsl = {h: number; s: number; l: number};

export const hexToHsl = (hex: string): Hsl => {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;

  if (d === 0) {
    return {h: 0, s: 0, l};
  }

  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) {
    h = ((g - b) / d) % 6;
  } else if (max === g) {
    h = (b - r) / d + 2;
  } else {
    h = (r - g) / d + 4;
  }
  h *= 60;
  if (h < 0) {
    h += 360;
  }
  return {h, s, l};
};

export const hsl = ({h, s, l}: Hsl, alpha = 1): string =>
  alpha >= 1
    ? `hsl(${h.toFixed(2)} ${(s * 100).toFixed(1)}% ${(l * 100).toFixed(1)}%)`
    : `hsl(${h.toFixed(2)} ${(s * 100).toFixed(1)}% ${(l * 100).toFixed(1)}% / ${alpha.toFixed(3)})`;

/**
 * Interpolate a list of hex stops in HSL so the sweep between them stays
 * continuous — interpolating the same stops in RGB desaturates through the
 * middle and turns the magenta-to-cyan run muddy.
 *
 * Hue is walked the short way round, which for this palette is a plain
 * monotone descent (magenta 310 -> violet -> blue -> cyan 189).
 */
export const makeHslRamp = (stops: string[]) => {
  const hsls = stops.map(hexToHsl);
  return (t: number): Hsl => {
    const x = Math.min(1, Math.max(0, t)) * (hsls.length - 1);
    const i = Math.min(hsls.length - 2, Math.floor(x));
    const f = x - i;
    const a = hsls[i];
    const b = hsls[i + 1];

    let dh = b.h - a.h;
    if (dh > 180) {
      dh -= 360;
    }
    if (dh < -180) {
      dh += 360;
    }

    return {
      h: (a.h + dh * f + 360) % 360,
      s: lerp(a.s, b.s, f),
      l: lerp(a.l, b.l, f),
    };
  };
};
