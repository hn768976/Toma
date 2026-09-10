// The three colour versions. Build is identical for all of them; only these
// values change, which is the point — it is a background texture where the
// colour is the product.

import { BUCKETS } from "./constants";

export type DotPalette = {
  /** Frame background, behind the haze. */
  background: string;
  /** Dot colour ramp: dim -> mid -> hot. */
  dim: string;
  mid: string;
  hot: string;
  /** Broad glow haze painted behind the grid, and its peak opacity. */
  haze: string;
  hazeAlpha: number;
};

export const PALETTES = {
  blue: {
    background: "#020c1e",
    dim: "#0d3a7a",
    mid: "#2a7ae0",
    hot: "#c8e4ff",
    haze: "#0a4fbe",
    hazeAlpha: 0.62,
  },
  amber: {
    background: "#0e0802",
    dim: "#5a3a08",
    mid: "#e0a020",
    hot: "#fff0c0",
    // Deeper and much weaker than the blue haze: a warm mass at the same
    // strength reads as a flat brown wash rather than a glow, and the version
    // is meant to be amber on near-black.
    haze: "#8a4a06",
    hazeAlpha: 0.32,
  },
  mono: {
    background: "#050506",
    dim: "#2a2d32",
    mid: "#8a9099",
    hot: "#ffffff",
    // Neutral by construction, so the only chroma in the frame is the slight
    // coolness of the specified dot ramp itself.
    haze: "#6d6d6f",
    hazeAlpha: 0.44,
  },
} satisfies Record<string, DotPalette>;

export type PaletteName = keyof typeof PALETTES;

export const parseHex = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

// Interpolate in linear light rather than straight sRGB. Mixing gamma-encoded
// values darkens the middle of a ramp, which on a dim-to-white ramp shows up
// as a muddy band right where most of the dots live.
const toLinear = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

const toSrgb = (c: number) => {
  const s = c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
  return Math.round(Math.min(255, Math.max(0, s * 255)));
};

const mixLinear = (
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): string => {
  const ch = (i: number) => {
    const la = toLinear(a[i]);
    const lb = toLinear(b[i]);
    return toSrgb(la + (lb - la) * t);
  };
  return `rgb(${ch(0)},${ch(1)},${ch(2)})`;
};

/**
 * Precomputes one CSS colour per brightness bucket. Buckets exist so the draw
 * loop can set fillStyle once per bucket instead of once per dot — at ~9200
 * dots a per-dot style change is what actually costs time, not the fillRect.
 */
export const buildRamp = (palette: DotPalette): string[] => {
  const dim = parseHex(palette.dim);
  const mid = parseHex(palette.mid);
  const hot = parseHex(palette.hot);

  const ramp: string[] = [];
  for (let i = 0; i < BUCKETS; i++) {
    const t = i / (BUCKETS - 1);
    // Mid sits at 0.68, not the midpoint: the dot brightness distribution is
    // heavily bottom-weighted, so an even split spends most of the ramp above
    // where the dots actually are and the whole field reads as one flat
    // mid-tone. Stretching dim -> mid keeps the low end separable and leaves
    // the hot end a short punch.
    const KNEE = 0.68;
    ramp.push(
      t <= KNEE
        ? mixLinear(dim, mid, t / KNEE)
        : mixLinear(mid, hot, (t - KNEE) / (1 - KNEE)),
    );
  }
  return ramp;
};
