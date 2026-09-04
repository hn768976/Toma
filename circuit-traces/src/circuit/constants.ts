// Every dimension in this project is expressed in "base pixels" on a canonical
// 3840x2160 board. At draw time they are multiplied by `width / BASE_W`, so a
// 1080p preview and a 4K render are the same picture at two resolutions.
export const BASE_W = 3840;
export const BASE_H = 2160;

export const FPS = 30;
export const DURATION_IN_FRAMES = 480; // 16s

// The board is generated larger than the frame on every side so the slow
// camera drift never exposes an edge.
export const OVERSCAN = 140;

// Routing grid pitch. All component pins are placed on multiples of this so
// traces leave them without an off-grid first step.
export const GRID = 20;

// The hue ramp is quantised into this many buckets so draws can be batched by
// colour instead of restyling per segment.
export const HUE_BUCKETS = 48;

/** Discrete trace widths, in base px: thin signal lines through to buses. */
export const TIER_WIDTHS = [2.6, 4.2, 6.6] as const;

export type HueStop = { t: number; h: number; s: number; l: number };

export type Palette = {
  /** Board substrate. */
  background: string;
  /** Hue/saturation/lightness as a function of horizontal position (t = x / BASE_W). */
  stops: readonly HueStop[];
  /** Lightness, in %, of an unlit trace — the board is dark until a pulse lights it. */
  unlitL: number;
  /** Saturation multiplier applied to unlit copper. */
  unlitSat: number;
  /** Lightness of unlit component outlines, in %. */
  outlineL: number;
  /** Fraction of pulses that run near-white instead of taking their trace's hue. */
  hotFraction: number;
  /** Faint substrate mottling colour. */
  mottle: string;
};

export const PALETTES: Record<"neon" | "amber", Palette> = {
  // V1 — the reference match: green at the left edge, cyan through the middle,
  // magenta and violet at the right. Interpolated in HSL, so the crossing from
  // cyan to magenta runs through blue rather than through grey.
  neon: {
    background: "#04060c",
    stops: [
      { t: 0.0, h: 148, s: 75, l: 51 }, // #22e07a
      { t: 0.42, h: 188, s: 86, l: 53 }, // #22d3ee
      { t: 0.8, h: 310, s: 75, l: 51 }, // #e026c0
      { t: 1.0, h: 262, s: 79, l: 57 }, // #7a3ce8
    ],
    unlitL: 12,
    unlitSat: 0.9,
    outlineL: 15,
    hotFraction: 0.06,
    mottle: "#0a1020",
  },
  // V2 — a single amber/gold family on near-black. Same geometry language,
  // completely different thumbnail: industrial rather than cyber.
  amber: {
    background: "#050403",
    stops: [
      { t: 0.0, h: 29, s: 84, l: 47 }, // toward #8a4a10 territory
      { t: 0.45, h: 36, s: 87, l: 55 }, // #f0a028
      { t: 1.0, h: 42, s: 100, l: 65 }, // #ffd27a
    ],
    unlitL: 17,
    unlitSat: 0.9,
    outlineL: 21,
    hotFraction: 0.1,
    mottle: "#140c05",
  },
};

export type VariantName = keyof typeof PALETTES;
