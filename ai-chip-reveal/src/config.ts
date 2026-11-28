/**
 * ai-chip-reveal - everything you are likely to want to change lives here:
 * format, timings, the two colour palettes and the part counts.
 * (Light, bloom, grain and other "look" settings are in src/look.ts.)
 */

export const SHORT_NAME = "ai-chip-reveal";

/* ---- format -------------------------------------------------------------- */
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
/** reference: 10.041667 s at 24 fps -> round(10.041667 * 30) = 301 frames */
export const DURATION_IN_FRAMES = 301;

/* ---- palettes ------------------------------------------------------------ */
export interface Palette {
  /** glowing board traces */
  trace: string;
  /** hottest part of a trace / glow */
  traceHot: string;
  /** the glowing letters on the chip */
  letters: string;
  /** fine circuit pattern on the chip */
  chipTrace: string;
  /** plated pins of the chip */
  pin: string;
  /** small coloured lights that spill glow colour onto nearby parts */
  spill: string;
  /** tint of the warm fill light */
  fill: string;
}

/** Version 1 - the reference palette: black, silver and amber. */
export const PALETTE_V1: Palette = {
  trace: "#e07818",
  traceHot: "#ffae48",
  letters: "#ffc060",
  chipTrace: "#e8842a",
  pin: "#80582a",
  spill: "#ff7a18",
  fill: "#ffd2a8",
};

/** Version 2 - same design, cold palette: black, silver and electric cyan. */
export const PALETTE_V2: Palette = {
  trace: "#12a8ff",
  traceHot: "#58d8ff",
  letters: "#8fe6ff",
  chipTrace: "#2ebeff",
  pin: "#aebfd0",
  spill: "#1e9cff",
  fill: "#a8d4ff",
};

/* ---- timings (seconds) --------------------------------------------------- */
export const TIMING = {
  /** the whip pull-back starts here */
  whipStart: 2.15,
  /** white-out flash at the start of the whip */
  flashAt: 2.44,
  flashWidth: 0.13,
  /** motion blur is only computed while the camera/board move fast */
  motionBlurFrom: 2.1,
  motionBlurTo: 3.55,
  /** the glow of the board fades down towards the end: [time, level] */
  fade: [[0, 1], [5.0, 1], [9.8, 0.75]] as [number, number][],
};

/**
 * Camera and board motion as keyframes [time in s, value]; they are joined by
 * a monotone cubic, so editing a number keeps the motion smooth.
 */
export const MOTION = {
  /** camera distance from its target, cm */
  distance: [
    [0, 21.5], [1.5, 23.0], [2.1, 24], [2.25, 27.5], [2.42, 44], [2.58, 68],
    [2.75, 84], [2.92, 98], [3.08, 106], [3.25, 112], [3.75, 118], [5.0, 124], [10.04, 132],
  ] as [number, number][],
  /** camera azimuth around the chip during the close-up, degrees */
  azimuth: [[0, -40], [1.5, -6], [2.15, 0], [10.04, 0]] as [number, number][],
  /** camera elevation, degrees */
  elevation: [[0, 8], [2.1, 2], [3.2, 0], [10.04, 0]] as [number, number][],
  /** board spin about its vertical axis, degrees */
  spin: [
    [0, 0], [2.15, 0], [2.42, 80], [2.75, 180], [3.08, 270], [3.4, 330],
    [3.75, 350], [4.5, 353], [10.04, 364],
  ] as [number, number][],
  /** 0 = camera looks at the chip, 1 = at the board centre */
  /** board tilt about its horizontal axis (top leaning away), degrees */
  tilt: [[0, 0], [2.15, 0], [3.4, -6], [10.04, -1]] as [number, number][],
  targetBlend: [[0, 0], [2.15, 0], [2.75, 1], [10.04, 1]] as [number, number][],
  /** vertical field of view, degrees */
  fov: 20,
  /** the camera aims this far above the chip centre during the close-up, cm */
  closeUpLift: 0.15,
  /** screen position (u) of the backdrop light pool over time */
  poolX: [[0, 0.62], [3.5, 0.62], [6, 0.58], [9.5, 0.5], [10.04, 0.49]] as [number, number][],
};

/* ---- counts / sizes (cm) ------------------------------------------------- */
export const BOARD = { w: 24, h: 26.5, t: 0.16 };
export const SOCKET = { x: 0.6, y: 6.2 };
export const COUNTS = {
  /** pins per side of the chip, and the size of the empty centre field */
  pinGrid: 19,
  pinHole: 11,
  /** fan-out lines per side of the letter block */
  chipLines: 13,
  /** routed glowing traces on the board */
  traces: 44,
  /** tiny scattered surface-mount parts */
  smallParts: 380,
  /** square chips scattered over the board */
  chips: 9,
  capacitors: 8,
  whiteBlocks: 7,
  sideBars: 4,
  slots: 7,
  /** small capacitor cans, in three clusters */
  cans: 16,
};
export const SEED = 20240611;

/* ---- assembly ------------------------------------------------------------ */
/**
 * During the spin the parts lift off the board, then each group settles back
 * in its own time window. `off` is the offset when fully out (cm: x right,
 * y up, z towards the viewer); `settle` is [start, end] in seconds.
 */
export interface GroupMove {
  off: [number, number, number];
  settle: [number, number];
}
export const ASSEMBLY: {
  out: [number, number];
  fallback: GroupMove;
  groups: Record<string, GroupMove>;
} = {
  /** the parts leave the board between these two times */
  out: [2.3, 3.1],
  fallback: { off: [0, 0, 1.5], settle: [3.6, 6.0] },
  groups: {
    socket: { off: [0, 0, 1.0], settle: [3.4, 5.2] },
    blocks: { off: [-3.0, 0.5, 2.4], settle: [5.4, 8.6] },
    caps: { off: [-1.8, 2.6, 3.2], settle: [5.0, 8.0] },
    bars: { off: [1.0, 2.0, 2.8], settle: [5.6, 9.0] },
    io: { off: [-3.6, 0.6, 1.8], settle: [6.2, 9.8] },
    slotsA: { off: [0, -1.0, 2.6], settle: [4.4, 7.4] },
    slotsB: { off: [0, -1.6, 3.8], settle: [5.4, 8.8] },
    heatsink: { off: [1.4, 2.0, 3.6], settle: [6.0, 9.6] },
    whites: { off: [1.8, 0, 2.2], settle: [4.8, 7.8] },
    chips: { off: [0, 0, 1.8], settle: [4.2, 7.0] },
    cans: { off: [0.3, 2.4, 4.2], settle: [6.4, 11.4] },
    header: { off: [0, -1.8, 1.2], settle: [5.6, 9.2] },
    smdA: { off: [0, 0, 1.0], settle: [4.0, 6.4] },
    smdB: { off: [0, 0.9, 2.2], settle: [5.0, 8.4] },
    smdC: { off: [-0.7, 1.6, 3.2], settle: [6.2, 11.6] },
  },
};
