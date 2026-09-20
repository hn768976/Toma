/**
 * Layout for V2, "Loopable isometric branching neural network".
 *
 * The reference is not a fan radiating from a point -- it is a *combed
 * sheet*. Fibres are rooted at even intervals along a straight line lying on
 * a flat plane, they all set off perpendicular to that line, and they curl
 * progressively to one side as they travel. Seen from a shallow angle the
 * root line reads as the straight edge of a receding plane, and the fibres
 * read as a brushed surface curling away from it. Stacking two of those
 * planes gives the layered, isometric look.
 *
 * Everything animated is periodic over exactly `V2_DURATION_IN_FRAMES`, so
 * the last frame hands back to the first with no seam.
 */

import { mulberry32 } from "../core/noise";

export const V2_FPS = 30;
export const V2_DURATION_IN_FRAMES = 240;
export const TAU = Math.PI * 2;

/** Depth slices, assigned per fibre rather than per sheet. */
export type BandId = 0 | 1 | 2;
export const BANDS: readonly BandId[] = [0, 1, 2];

export type Sheet = {
  /** Centre of the root line. */
  cx: number;
  cy: number;
  cz: number;
  /** Heading of the root line within the plane (XZ), in radians. */
  rootAngle: number;
  /** Extra rotation of the sweep away from perpendicular. */
  skew: number;
  rootLength: number;
  fibreCount: number;
  brightness: number;
  seed: number;
};

export type Fibre = {
  sheet: number;
  /** Position along the root line, -0.5..0.5. */
  s: number;
  length: number;
  /** How hard the fibre curls sideways as it travels. */
  curl: number;
  /** Slight out-of-plane bow, so the sheet is not perfectly flat. */
  lift: number;
  widthScale: number;
  tone: number;
  /** 0 = cool blue, 1 = the red-orange minority. */
  warmth: number;
  /** Bright white-cyan fibres catching the light across part of the sheet. */
  highlight: number;
  isSpine: boolean;
  phase: number;
  dim: number;
  /** Depth slice this fibre is drawn into. */
  band: BandId;
};

export type BandData = {
  band: BandId;
  sheets: Sheet[];
  fibres: Fibre[];
};

const SHEET_SPECS: { cy: number; cz: number; rootAngle: number; scale: number; brightness: number }[] = [
  // The sheet the shot is built around.
  { cy: 0, cz: 0, rootAngle: -0.66, scale: 1, brightness: 1 },
  // A second plane behind and above it, giving the stacked-layer read.
  { cy: 4.6, cz: -14, rootAngle: -0.72, scale: 0.92, brightness: 0.5 },
];

export const v2Camera = (frame: number) => {
  const f = frame / V2_DURATION_IN_FRAMES;
  // About 25 degrees above the plane: shallow enough that the root line
  // reads as a hard edge, steep enough to see along the sheet.
  return {
    x: 1.2 + Math.sin(TAU * f) * 0.5,
    y: 7.2 + Math.sin(TAU * f + 1.2) * 0.28,
    z: 16 + Math.cos(TAU * f) * 0.45,
    lookX: 3.4 + Math.sin(TAU * f + 2.1) * 0.3,
    lookY: 0.6,
    lookZ: -1.5,
  };
};

export const buildV2Field = (): { sheets: Sheet[]; fibres: Fibre[] } => {
  const rnd = mulberry32(0x5eed02);

  const sheets: Sheet[] = SHEET_SPECS.map((spec, i) => ({
    cx: 0 + (rnd() - 0.5) * 2,
    cy: spec.cy,
    cz: spec.cz,
    rootAngle: spec.rootAngle,
    skew: 0.34 + rnd() * 0.16,
    rootLength: 48 * spec.scale,
    fibreCount: Math.round(200 * spec.scale),
    brightness: spec.brightness,
    seed: i * 977,
  }));

  const fibres: Fibre[] = [];

  for (let si = 0; si < sheets.length; si++) {
    const sheet = sheets[si];

    // A contiguous run of bright fibres, as though a highlight is falling
    // across one part of the sheet.
    const highlightAt = 0.12 + rnd() * 0.3;
    const highlightWidth = 0.07 + rnd() * 0.05;
    // The warm fibres sit together in a band too, rather than being sprinkled.
    const warmAt = -0.12 + rnd() * 0.24;
    const warmWidth = 0.13 + rnd() * 0.09;

    for (let i = 0; i < sheet.fibreCount; i++) {
      const even = i / (sheet.fibreCount - 1) - 0.5;
      const s = even + (rnd() - 0.5) * (0.6 / sheet.fibreCount);

      const dHighlight = Math.abs(s - highlightAt);
      const dWarm = Math.abs(s - warmAt);

      fibres.push({
        sheet: si,
        s,
        // Length varies smoothly along the sheet, so the tips describe a
        // curve rather than a ragged edge.
        length: (14 + Math.sin((s + 0.5) * Math.PI) * 5) * (0.85 + rnd() * 0.3),
        // Wide variation on purpose: fibres that curl at slightly different
        // rates separate as they travel, which is what opens the far end of
        // the sheet into a fan instead of keeping it a solid bundle.
        curl: 0.34 + rnd() * 0.62,
        lift: (rnd() - 0.5) * 0.5,
        widthScale: 0.7 + rnd() * 0.7,
        tone: Math.pow(rnd(), 1.5),
        warmth: dWarm < warmWidth ? 1 - dWarm / warmWidth : 0,
        highlight:
          dHighlight < highlightWidth ? 1 - dHighlight / highlightWidth : 0,
        isSpine: false,
        phase: rnd() * TAU,
        dim: 0.55 + rnd() * 0.6,
        band: 1,
      });
    }
  }

  // One mint strand riding the top of the main sheet.
  const spine = fibres.find((f) => f.sheet === 0 && f.s > 0.3);
  if (spine) {
    spine.isSpine = true;
    spine.widthScale = 1.6;
    spine.dim = 1.4;
  }

  return { sheets, fibres };
};
