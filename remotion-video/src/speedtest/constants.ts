/**
 * Layout, palette and timing for the "5G Speed Test" motion graphic.
 *
 * Everything is authored in a 768 x 432 *design* coordinate space and drawn
 * into an SVG viewBox of that size, so the exact same source renders crisp at
 * 1080p, 4K or any other 16:9 output. Nothing here is in output pixels.
 */

export const BASE_W = 768;
export const BASE_H = 432;

export const FPS = 30;

/** 10s of content - the running length of both reference clips. */
export const DURATION_IN_FRAMES = 300;

/* ------------------------------------------------------------------ */
/* Palette                                                             */
/* ------------------------------------------------------------------ */

export const PALETTE = {
  /** Deep navy backdrop shared by both versions. */
  bg: "#051C29",
  /** Flat version accent: soft steel cyan, no glow. */
  flat: "#86CFE9",
  /** Neon version accent: hot aqua that blooms well under a glow filter. */
  neon: "#7BF7F7",
  /** Unlit dot. */
  dim: "#1B4356",
  /** Scale ticks and hub rings. */
  tick: "#2E6273",
  /** Micro labels (Min / Max / Mbps / Ms). */
  red: "#BA4547",
  pillTrack: "#17485B",
  pillTextOff: "#337C93",
  grid: "#0E3A4C",
} as const;

export const FONT_DISPLAY = "Rajdhani";
export const FONT_MICRO = "Archivo";

/* ------------------------------------------------------------------ */
/* Dial geometry                                                       */
/* ------------------------------------------------------------------ */

/**
 * Angles are SVG screen angles: degrees, 0 = east, growing clockwise (because
 * +y points down). Every dial opens at the bottom, symmetric about straight
 * down, with Min on the left horn and Max on the right.
 */
export const ARC_START = 143.5;
export const ARC_SWEEP = 253;

/** Text pinned to a measured width, so tracking is part of the design. */
export type MicroLabel = { text: string; width: number };

export type DialSpec = {
  cx: number;
  cy: number;
  /** Outer edge of the thick arc. */
  radius: number;
  arcWidth: number;
  tickRadius: number;
  tickCount: number;
  /** Ticks stop this many degrees short of each arc end. */
  tickInset: number;
  tickDot: number;
  hubRadius: number;
  /** Half-width of the needle blade where it leaves the hub. */
  needleBase: number;
  needleLength: number;
  /** Half-width at the rounded tip. */
  needleTip: number;
  /** Faint ring floating around the hub; 0 to omit. */
  innerRing: number;

  /** Caption under the dial, set to an exact width so tracking reads right. */
  caption: { text: string; y: number; size: number; width: number };
  /** Red unit label, offset down from the hub. */
  unit: MicroLabel & { dy: number; size: number };
  /** Red labels at the two horns. */
  ends: {
    min: MicroLabel;
    max: MicroLabel;
    radius: number;
    angle: number;
    size: number;
  };
};

const BIG = {
  radius: 132,
  arcWidth: 12,
  tickRadius: 112,
  tickCount: 30,
  tickInset: 8.25,
  tickDot: 1.1,
  hubRadius: 7,
  needleBase: 3.6,
  needleLength: 108,
  needleTip: 0.9,
  innerRing: 33,
  unit: { text: "Mbps", dy: 23, size: 8.2, width: 28 },
  ends: {
    min: { text: "Min", width: 18 },
    max: { text: "Max", width: 20 },
    radius: 94.6,
    angle: 147.75,
    size: 7.4,
  },
} as const;

export const DOWNLOAD_DIAL: DialSpec = {
  ...BIG,
  cx: 209.5,
  cy: 212,
  caption: { text: "DOWNLOAD", y: 290, size: 13.2, width: 81 },
};

export const UPLOAD_DIAL: DialSpec = {
  ...BIG,
  cx: 558.5,
  cy: 212,
  caption: { text: "UPLOAD", y: 290, size: 13.2, width: 56 },
};

export const PING_DIAL: DialSpec = {
  cx: 384,
  cy: 330,
  radius: 48,
  arcWidth: 5.5,
  tickRadius: 36,
  tickCount: 21,
  tickInset: 10,
  tickDot: 0.55,
  hubRadius: 3.2,
  needleBase: 1.6,
  needleLength: 34,
  needleTip: 0.35,
  innerRing: 14,
  caption: { text: "PING", y: 367, size: 4.6, width: 13 },
  unit: { text: "Ms", dy: 15, size: 4.2, width: 8 },
  ends: {
    min: { text: "Low", width: 8 },
    max: { text: "High", width: 10 },
    radius: 41,
    angle: 140,
    size: 4.2,
  },
};

/* ------------------------------------------------------------------ */
/* Toggle pill                                                         */
/* ------------------------------------------------------------------ */

export const PILL = {
  cx: 385,
  cy: 87.5,
  width: 80,
  height: 35,
  /** The knob is a touch taller than the track, so it stands proud of it. */
  knobRadius: 18.5,
  /** Horizontal travel of the knob centre from the pill centre. */
  knobTravel: 20.5,
  textSize: 17,
} as const;

/* ------------------------------------------------------------------ */
/* Activity level meters                                               */
/* ------------------------------------------------------------------ */

export const DOTS = {
  y: 339,
  count: 15,
  diameter: 7,
  pitch: 10.35,
  /** Centre of the innermost dot of the left strip; strips fill outward. */
  innerEnd: 296,
} as const;
