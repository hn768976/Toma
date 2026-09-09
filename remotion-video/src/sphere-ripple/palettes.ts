/**
 * The ONLY place in the project where a hex colour literal is allowed.
 * Everything downstream works with the parsed RGB triples or with the
 * ramp helpers below, so a new palette never requires new code.
 */

export type PaletteName =
  | "cobalt"
  | "cyan"
  | "violet"
  | "emerald"
  | "amber"
  | "crimson";

export type PaletteHex = {
  /** Deep base the whole frame sits on. */
  bgDeep: string;
  /** Broad radial wash lifting the area around the sphere. */
  bgWash: string;
  /** Darkest ring tone — rings facing away from the light. */
  ringDim: string;
  ringMid: string;
  ringBright: string;
  /** Near-white centre of a ring's core stroke. */
  ringCore: string;
};

export const PALETTES: Record<PaletteName, PaletteHex> = {
  cobalt: {
    bgDeep: "#020A2E",
    bgWash: "#0A2470",
    ringDim: "#1E4A9F",
    ringMid: "#2E7FE8",
    ringBright: "#5FA8FF",
    ringCore: "#D8ECFF",
  },
  cyan: {
    bgDeep: "#01141C",
    bgWash: "#063A50",
    ringDim: "#14607A",
    ringMid: "#2E9FC4",
    ringBright: "#4FD4F5",
    ringCore: "#D8F8FF",
  },
  violet: {
    bgDeep: "#0A0424",
    bgWash: "#241058",
    ringDim: "#3A1A8A",
    ringMid: "#6F3FD4",
    ringBright: "#A87FF5",
    ringCore: "#E8D8FF",
  },
  emerald: {
    bgDeep: "#011408",
    bgWash: "#063A1E",
    ringDim: "#14603A",
    ringMid: "#2EA86B",
    ringBright: "#5FE8A0",
    ringCore: "#D8FFE8",
  },
  amber: {
    bgDeep: "#140A02",
    bgWash: "#3A2008",
    ringDim: "#6B4014",
    ringMid: "#C4802E",
    ringBright: "#F5B85F",
    ringCore: "#FFE8C8",
  },
  crimson: {
    bgDeep: "#14020A",
    bgWash: "#3A0A1E",
    ringDim: "#6B1430",
    ringMid: "#C42E5F",
    ringBright: "#F55F80",
    ringCore: "#FFD8E4",
  },
};

export const PALETTE_NAMES = Object.keys(PALETTES) as PaletteName[];

export type Rgb = { r: number; g: number; b: number };

const parseHex = (hex: string): Rgb => {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
};

export type Palette = {
  name: PaletteName;
  bgDeep: Rgb;
  bgWash: Rgb;
  /** dim -> mid -> bright -> core, as a 4-stop ramp. */
  ramp: Rgb[];
};

export const resolvePalette = (name: PaletteName): Palette => {
  const hex = PALETTES[name];
  return {
    name,
    bgDeep: parseHex(hex.bgDeep),
    bgWash: parseHex(hex.bgWash),
    ramp: [
      parseHex(hex.ringDim),
      parseHex(hex.ringMid),
      parseHex(hex.ringBright),
      parseHex(hex.ringCore),
    ],
  };
};

/**
 * Samples the four-stop ring ramp. `t` is a 0..1 brightness: 0 lands on the
 * dim tone, 1 on the near-white core. The stops are unevenly spaced so the
 * mid tone occupies most of the range — that keeps palettes whose dim and mid
 * values sit close together (amber, emerald) from collapsing into one tone
 * once a region is blurred.
 */
const RAMP_STOPS = [0, 0.4, 0.74, 1];

export const rampAt = (palette: Palette, t: number): Rgb => {
  const c = Math.max(0, Math.min(1, t));
  let i = 0;
  while (i < RAMP_STOPS.length - 2 && c > RAMP_STOPS[i + 1]) i++;
  const a = palette.ramp[i];
  const b = palette.ramp[i + 1];
  const span = RAMP_STOPS[i + 1] - RAMP_STOPS[i];
  const k = span === 0 ? 0 : (c - RAMP_STOPS[i]) / span;
  return {
    r: a.r + (b.r - a.r) * k,
    g: a.g + (b.g - a.g) * k,
    b: a.b + (b.b - a.b) * k,
  };
};

export const rgba = (c: Rgb, alpha: number, gain = 1): string => {
  const r = Math.round(Math.min(255, c.r * gain));
  const g = Math.round(Math.min(255, c.g * gain));
  const b = Math.round(Math.min(255, c.b * gain));
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
};

export const rgbCss = (c: Rgb, gain = 1): string =>
  `rgb(${Math.round(Math.min(255, c.r * gain))}, ${Math.round(
    Math.min(255, c.g * gain),
  )}, ${Math.round(Math.min(255, c.b * gain))})`;
