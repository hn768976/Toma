/**
 * Everything that varies between images lives here. The renderer walks this
 * structure and knows nothing about individual compositions, so adding a
 * ninth setup is a data edit, never a code edit.
 *
 * Coordinate conventions
 *   x, y      normalised to the frame: 0..1 across the width / height
 *   r         blob radius as a fraction of the frame WIDTH (aspect neutral)
 *   scaleX/Y  elongation applied after `rotate`, around the blob centre
 *   rotate    degrees, clockwise on screen
 *   blur      pixels at 3840 wide; scaled with the frame so output is
 *             resolution independent
 */

import type { PaletteName } from "./palettes";

/**
 * The falloff profile is the difference between "light" and "a soft disc".
 * A plain linear ramp reads as a spotlight, so every blob picks a named
 * profile: some hold their colour well into the radius and then drop away,
 * others give it up immediately and trail out for a long time.
 *
 * Stops are [offset, alpha]; alpha is multiplied by the blob's own opacity.
 */
export const FALLOFFS = {
  /** Holds near full strength to 40% of the radius, then drops. */
  plateau: [
    [0, 1],
    [0.28, 0.97],
    [0.44, 0.86],
    [0.62, 0.5],
    [0.78, 0.21],
    [0.9, 0.06],
    [1, 0],
  ],
  /** Bright core that gives up fast and trails out gently. */
  core: [
    [0, 1],
    [0.12, 0.82],
    [0.26, 0.55],
    [0.45, 0.28],
    [0.66, 0.12],
    [0.85, 0.03],
    [1, 0],
  ],
  /** The neutral, evenly rounded profile. */
  soft: [
    [0, 1],
    [0.2, 0.86],
    [0.42, 0.6],
    [0.64, 0.32],
    [0.83, 0.11],
    [1, 0],
  ],
  /** Never reaches full strength; a wide, low wash used to tint overlaps. */
  haze: [
    [0, 0.8],
    [0.22, 0.66],
    [0.46, 0.42],
    [0.7, 0.19],
    [0.88, 0.05],
    [1, 0],
  ],
  /** A hard, narrow ridge — reads as an edge of light rather than a glow. */
  blade: [
    [0, 1],
    [0.1, 0.96],
    [0.24, 0.78],
    [0.42, 0.46],
    [0.62, 0.2],
    [0.82, 0.05],
    [1, 0],
  ],
  /** Long and even, for the elongated blobs that carry a beam. */
  beam: [
    [0, 1],
    [0.34, 0.82],
    [0.55, 0.56],
    [0.74, 0.28],
    [0.9, 0.08],
    [1, 0],
  ],
} as const satisfies Record<string, readonly (readonly [number, number])[]>;

export type FalloffName = keyof typeof FALLOFFS;

export type BlobConfig = {
  readonly x: number;
  readonly y: number;
  readonly r: number;
  /** Index into the palette's colour set; cycles if the palette is shorter. */
  readonly colour: number;
  readonly opacity: number;
  readonly falloff: FalloffName;
  readonly scaleX?: number;
  readonly scaleY?: number;
  readonly rotate?: number;
};

export type EdgeConfig = {
  /** Fraction of the frame the falloff acts over. 0 disables the edge. */
  readonly inset: number;
  /** How dark the very edge goes. 1 is black. */
  readonly strength: number;
  /** >1 pushes the darkening towards the edge, <1 spreads it inwards. */
  readonly power: number;
};

export type CornerConfig = {
  /** 0 or 1 — which corner, in normalised frame coordinates. */
  readonly x: number;
  readonly y: number;
  /** Reach as a fraction of the frame diagonal. */
  readonly radius: number;
  readonly strength: number;
};

export type GrainConfig = {
  /** Overall amount, 0..1. Restrained at 0.4, very heavy at 1. */
  readonly intensity: number;
  /** How much more grain the darkest regions get than the brightest. */
  readonly darkGain: number;
  readonly brightGain: number;
  /** Grid resolution of the low-frequency field that varies grain by region. */
  readonly variationCells: number;
  /** Spread of that variation: [min, max] multiplier. */
  readonly variation: readonly [number, number];
};

export type CompositionConfig = {
  readonly description: string;
  readonly blobs: readonly BlobConfig[];
  /** Blur applied to the whole composited field, in px at 3840 wide. */
  readonly blur: number;
  /** Multiplier on the palette background — the composition's darkness. */
  readonly background: number;
  /**
   * How much of the background goes dark with the light at the frame edges.
   * 1 crushes the corners to pure black; lower values leave a little value
   * under them for the grain to work against.
   */
  readonly backgroundDrop: number;
  /** Multiplier on the blob field as a whole. */
  readonly gain: number;
  readonly edges: {
    readonly left: EdgeConfig;
    readonly right: EdgeConfig;
    readonly top: EdgeConfig;
    readonly bottom: EdgeConfig;
  };
  readonly corners?: readonly CornerConfig[];
  readonly grain: GrainConfig;
};

const edge = (inset: number, strength: number, power = 1): EdgeConfig => ({
  inset,
  strength,
  power,
});

const grain = (
  intensity: number,
  variationCells = 9,
  variation: readonly [number, number] = [0.62, 1.45],
  darkGain = 1.75,
  brightGain = 0.6,
): GrainConfig => ({ intensity, darkGain, brightGain, variationCells, variation });

export const COMPOSITIONS = {
  /**
   * g01 TWO POLES — a large blob upper-left, another right of centre, dark
   * space between and around them. A third low haze sits in the gap so the
   * two colours meet as a broad transitional band rather than two spotlights.
   */
  g01: {
    description: "Two poles with a broad transitional band between them",
    blobs: [
      { x: 0.24, y: 0.31, r: 0.33, colour: 0, opacity: 1, falloff: "soft", scaleX: 1.16, scaleY: 1 },
      { x: 0.69, y: 0.56, r: 0.31, colour: 3, opacity: 1, falloff: "soft", scaleX: 1.14, scaleY: 1.06 },
      { x: 0.47, y: 0.44, r: 0.32, colour: 1, opacity: 0.62, falloff: "haze", scaleX: 1.45, scaleY: 0.8, rotate: -14 },
    ],
    blur: 150,
    background: 1.15,
    backgroundDrop: 0.6,
    gain: 1,
    edges: {
      left: edge(0.3, 0.82),
      right: edge(0.26, 0.76),
      top: edge(0.3, 0.72),
      bottom: edge(0.32, 0.86),
    },
    corners: [
      { x: 0, y: 1, radius: 0.55, strength: 0.6 },
      { x: 1, y: 0, radius: 0.55, strength: 0.55 },
    ],
    grain: grain(0.58),
  },

  /**
   * g02 DIAGONAL BEAM — three elongated blobs stacked perpendicular to a
   * lower-left/upper-right diagonal, so they read as parallel bands. The
   * perpendicular step is 1:3 in normalised units because the frame is 16:9;
   * anything else and the bands fan instead of staying parallel.
   */
  g02: {
    description: "Three parallel colour bands on a lower-left to upper-right diagonal",
    blobs: [
      { x: 0.43, y: 0.365, r: 0.36, colour: 3, opacity: 0.92, falloff: "blade", scaleX: 2.2, scaleY: 0.2, rotate: -30 },
      { x: 0.5, y: 0.58, r: 0.37, colour: 1, opacity: 1, falloff: "beam", scaleX: 2.2, scaleY: 0.22, rotate: -30 },
      { x: 0.57, y: 0.795, r: 0.36, colour: 0, opacity: 0.95, falloff: "blade", scaleX: 2.2, scaleY: 0.2, rotate: -30 },
    ],
    blur: 130,
    background: 1.15,
    backgroundDrop: 0.6,
    gain: 1.05,
    edges: {
      left: edge(0.34, 0.8),
      right: edge(0.28, 0.72),
      top: edge(0.36, 0.86),
      bottom: edge(0.3, 0.78),
    },
    corners: [{ x: 0, y: 0, radius: 0.75, strength: 0.82 }],
    grain: grain(0.86, 8, [0.55, 1.5]),
  },

  /**
   * g03 HORIZONTAL BAND — one wide elongated blob across the middle third
   * with two smaller blobs of other colours overlapping its ends, so the band
   * changes hue from left to right. The most symmetric of the eight.
   */
  g03: {
    description: "A wide horizontal band with differently coloured ends",
    blobs: [
      { x: 0.5, y: 0.5, r: 0.42, colour: 1, opacity: 1, falloff: "beam", scaleX: 2.35, scaleY: 0.28 },
      { x: 0.09, y: 0.52, r: 0.26, colour: 0, opacity: 0.95, falloff: "core", scaleX: 1.3, scaleY: 0.62 },
      { x: 0.9, y: 0.48, r: 0.27, colour: 3, opacity: 0.98, falloff: "core", scaleX: 1.3, scaleY: 0.62 },
    ],
    blur: 145,
    background: 1.25,
    backgroundDrop: 0.6,
    gain: 1,
    edges: {
      left: edge(0.2, 0.6),
      right: edge(0.2, 0.6),
      top: edge(0.42, 0.9),
      bottom: edge(0.42, 0.9),
    },
    grain: grain(0.9, 10, [0.55, 1.5]),
  },

  /**
   * g04 SWEEP FROM CORNER — a beam entering at the lower right and reaching
   * to the upper left. The taper is built from two blobs on the same axis:
   * a broad one at the entry end and a narrower one further along, because a
   * single radial gradient is symmetric and cannot narrow on its own.
   */
  g04: {
    description: "A narrowing beam sweeping in from the lower-right corner",
    blobs: [
      { x: 0.76, y: 0.74, r: 0.42, colour: 0, opacity: 0.62, falloff: "haze", scaleX: 1.35, scaleY: 0.9, rotate: 29 },
      { x: 0.66, y: 0.66, r: 0.46, colour: 1, opacity: 1, falloff: "core", scaleX: 1.7, scaleY: 0.3, rotate: 29 },
      { x: 0.41, y: 0.43, r: 0.3, colour: 2, opacity: 0.92, falloff: "blade", scaleX: 1.6, scaleY: 0.16, rotate: 29 },
    ],
    blur: 140,
    background: 1.1,
    backgroundDrop: 0.78,
    gain: 1,
    edges: {
      left: edge(0.38, 0.84),
      right: edge(0.18, 0.5),
      top: edge(0.4, 0.86),
      bottom: edge(0.2, 0.58),
    },
    corners: [{ x: 0, y: 0, radius: 0.8, strength: 1 }],
    grain: grain(0.56),
  },

  /**
   * g05 LOW CURVE — two blobs placed so the sum of their fields reads as one
   * shallow curve across the lower half, rising to the right. The upper half
   * is left almost empty.
   */
  g05: {
    description: "A shallow curve of light across the lower half, rising right",
    blobs: [
      { x: 0.22, y: 0.9, r: 0.38, colour: 0, opacity: 0.95, falloff: "soft", scaleX: 1.55, scaleY: 0.44, rotate: 2 },
      { x: 0.78, y: 0.54, r: 0.34, colour: 2, opacity: 1, falloff: "soft", scaleX: 1.35, scaleY: 0.56, rotate: -34 },
    ],
    blur: 150,
    background: 1.15,
    backgroundDrop: 0.6,
    gain: 1,
    edges: {
      left: edge(0.26, 0.72),
      right: edge(0.22, 0.6),
      top: edge(0.5, 0.92),
      bottom: edge(0.24, 0.66),
    },
    corners: [{ x: 0, y: 0, radius: 0.7, strength: 0.72 }],
    grain: grain(0.6),
  },

  /**
   * g06 VERTICAL STREAKS — six narrow vertical blobs at irregular positions,
   * each a different colour, of varying height and opacity. The radii are
   * kept short enough that none of them reaches the top or bottom edge.
   */
  g06: {
    description: "Six narrow vertical streaks of varying height and opacity",
    blobs: [
      { x: 0.11, y: 0.52, r: 0.5, colour: 0, opacity: 0.8, falloff: "beam", scaleX: 0.085, scaleY: 0.5 },
      { x: 0.24, y: 0.46, r: 0.52, colour: 3, opacity: 1, falloff: "beam", scaleX: 0.06, scaleY: 0.58 },
      { x: 0.35, y: 0.57, r: 0.46, colour: 1, opacity: 0.72, falloff: "soft", scaleX: 0.115, scaleY: 0.46 },
      { x: 0.51, y: 0.44, r: 0.52, colour: 2, opacity: 1, falloff: "beam", scaleX: 0.055, scaleY: 0.6 },
      { x: 0.64, y: 0.54, r: 0.5, colour: 0, opacity: 0.9, falloff: "core", scaleX: 0.08, scaleY: 0.54 },
      { x: 0.83, y: 0.47, r: 0.48, colour: 1, opacity: 0.82, falloff: "beam", scaleX: 0.07, scaleY: 0.48 },
    ],
    blur: 120,
    background: 1.2,
    backgroundDrop: 0.55,
    gain: 1.05,
    edges: {
      left: edge(0.18, 0.62),
      right: edge(0.18, 0.62),
      top: edge(0.2, 0.6),
      bottom: edge(0.2, 0.6),
    },
    grain: grain(1, 12, [0.55, 1.6]),
  },

  /**
   * Bands are stepped PERPENDICULAR to their own axis, which on a 16:9 frame
   * means a normalised step of dy/dx = tan(60 deg) * 16/9 ~= 3.08 for a -30
   * degree axis. Step them at any other ratio — 1:1 looks right and is not —
   * and they slide along each other's length instead of stacking, overlap
   * everywhere at once, and the additive sum goes white in the middle.
   *
   * g07 FULL DIAGONAL — four broad bands on the same diagonal, overlapping
   * enough that the field fills the frame and passes through the palette's
   * intermediates on the way across. Only the two off-diagonal corners fall
   * away; the edges themselves stay open.
   */
  g07: {
    description: "A full-frame diagonal transition, corner to corner",
    blobs: [
      { x: 0.361, y: 0.926, r: 0.5, colour: 0, opacity: 0.56, falloff: "beam", scaleX: 2.1, scaleY: 0.4, rotate: -30 },
      { x: 0.454, y: 0.642, r: 0.5, colour: 1, opacity: 0.54, falloff: "beam", scaleX: 2.1, scaleY: 0.4, rotate: -30 },
      { x: 0.546, y: 0.358, r: 0.5, colour: 3, opacity: 0.56, falloff: "beam", scaleX: 2.1, scaleY: 0.4, rotate: -30 },
      { x: 0.639, y: 0.074, r: 0.5, colour: 2, opacity: 0.5, falloff: "beam", scaleX: 2.1, scaleY: 0.4, rotate: -30 },
    ],
    blur: 145,
    background: 1.15,
    backgroundDrop: 0.7,
    gain: 1.05,
    edges: {
      left: edge(0.12, 0.3),
      right: edge(0.12, 0.3),
      top: edge(0.12, 0.28),
      bottom: edge(0.12, 0.28),
    },
    corners: [
      { x: 0, y: 0, radius: 0.55, strength: 0.92 },
      { x: 1, y: 1, radius: 0.55, strength: 0.92 },
    ],
    grain: grain(0.84, 9, [0.62, 1.4]),
  },

  /**
   * g08 SOFT FLOOD — four large overlapping blobs covering the frame with no
   * dark centre at all. The palest and most open of the eight: the additive
   * overlap of four wide plateaus lifts the middle towards white, which is
   * what makes it usable behind dark text.
   */
  g08: {
    description: "Four overlapping floods filling the frame, corners only falling away",
    blobs: [
      { x: 0.16, y: 0.22, r: 0.48, colour: 0, opacity: 0.86, falloff: "plateau", scaleX: 1.24, scaleY: 1.14 },
      { x: 0.76, y: 0.18, r: 0.46, colour: 1, opacity: 0.76, falloff: "plateau", scaleX: 1.24, scaleY: 1.04 },
      { x: 0.24, y: 0.86, r: 0.48, colour: 2, opacity: 0.7, falloff: "soft", scaleX: 1.3, scaleY: 1.04 },
      { x: 0.88, y: 0.78, r: 0.46, colour: 3, opacity: 0.8, falloff: "soft", scaleX: 1.24, scaleY: 1.04 },
    ],
    blur: 160,
    background: 1.5,
    backgroundDrop: 0.5,
    gain: 1.05,
    edges: {
      left: edge(0.16, 0.42),
      right: edge(0.16, 0.42),
      top: edge(0.16, 0.4),
      bottom: edge(0.16, 0.4),
    },
    corners: [
      { x: 0, y: 0, radius: 0.5, strength: 0.55 },
      { x: 1, y: 0, radius: 0.5, strength: 0.55 },
      { x: 0, y: 1, radius: 0.5, strength: 0.55 },
      { x: 1, y: 1, radius: 0.5, strength: 0.55 },
    ],
    grain: grain(0.54),
  },
} as const satisfies Record<string, CompositionConfig>;

export type CompositionName = keyof typeof COMPOSITIONS;

export const COMPOSITION_NAMES = Object.keys(COMPOSITIONS) as CompositionName[];

/** The file name a still is written under, shared by the batch and the sheet. */
export const stillFileName = (composition: CompositionName, palette: PaletteName): string =>
  `graingrad-${composition}-${palette}.png`;

/** The palette pairing used by the batch renderer. */
export const BATCH_PAIRS = {
  g01: ["cyanMagenta", "deepBlue"],
  g02: ["warmSpectrum", "tealPurple"],
  g03: ["crimsonGlow", "violetBlue"],
  g04: ["deepBlue", "cyanMagenta"],
  g05: ["violetBlue", "crimsonGlow"],
  g06: ["warmSpectrum", "violetBlue"],
  g07: ["cyanMagenta", "tealPurple"],
  g08: ["tealPurple", "deepBlue"],
} as const satisfies Record<CompositionName, readonly [PaletteName, PaletteName]>;
