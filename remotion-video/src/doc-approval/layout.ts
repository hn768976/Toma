/**
 * Frame geometry and the timeline. Everything here is expressed in 4K
 * device pixels; the composition's backing store is always 3840x2160 and
 * Remotion's `--scale` handles preview sizes.
 *
 * The loop rule: every period listed under TIMING must divide
 * DURATION_IN_FRAMES exactly, so that the state at frame 600 is the state
 * at frame 0 for all continuous motion.
 */

export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
export const DURATION_IN_FRAMES = 600;

/** Assert at module load that a period tiles the loop exactly. */
const loopPeriod = (frames: number): number => {
  if (DURATION_IN_FRAMES % frames !== 0) {
    throw new Error(
      `Period ${frames} does not divide ${DURATION_IN_FRAMES}; the loop would jump.`,
    );
  }
  return frames;
};

// ---------------------------------------------------------------- centre

/** The verdict icon is ~26% of the frame height, slightly above midline. */
export const ICON_DIAMETER = Math.round(HEIGHT * 0.26);
export const ICON_RADIUS = ICON_DIAMETER / 2;
export const ICON_CENTER_X = WIDTH / 2;
export const ICON_CENTER_Y = Math.round(HEIGHT * 0.44);
export const ICON_STROKE = 44;

/** Where the ring is broken, in degrees (canvas convention: 0 = +x, cw). */
export const RING_GAP_CENTER_DEG = -42;
export const RING_GAP_HALF_DEG = 24;

// ------------------------------------------------------------- documents

export const DOC_COUNT = 6;
export const DOC_WIDTH = 250;
export const DOC_HEIGHT = 330;
/** Distance from the icon centre to the nearest document's centre. */
export const DOC_INNER_OFFSET = 538;
export const DOC_SPACING = 384;
/** Indices drawn as a small stack of pages instead of a single sheet. */
export const STACK_INDICES: readonly number[] = [0, 4];

/** Document centres, left to right, on the horizontal line through the icon. */
export const DOC_CENTERS: readonly { x: number; y: number }[] = [
  { x: ICON_CENTER_X - DOC_INNER_OFFSET - DOC_SPACING * 2, y: ICON_CENTER_Y },
  { x: ICON_CENTER_X - DOC_INNER_OFFSET - DOC_SPACING, y: ICON_CENTER_Y },
  { x: ICON_CENTER_X - DOC_INNER_OFFSET, y: ICON_CENTER_Y },
  { x: ICON_CENTER_X + DOC_INNER_OFFSET, y: ICON_CENTER_Y },
  { x: ICON_CENTER_X + DOC_INNER_OFFSET + DOC_SPACING, y: ICON_CENTER_Y },
  { x: ICON_CENTER_X + DOC_INNER_OFFSET + DOC_SPACING * 2, y: ICON_CENTER_Y },
];

/**
 * Entrance order: outward from the centre, alternating sides. Index into
 * DOC_CENTERS; position in this array is the stagger step.
 */
export const DOC_ENTRANCE_ORDER: readonly number[] = [2, 3, 1, 4, 0, 5];

// ----------------------------------------------------------- rating row

export const RATING_CENTER_Y = ICON_CENTER_Y + ICON_RADIUS + 132;
export const STAR_OUTER_RADIUS = 58;
export const STAR_SPACING = 152;

// ---------------------------------------------------------------- label

export const LABEL_RIGHT_X = WIDTH - 470;
export const LABEL_BASELINE_Y = 336;
export const LABEL_FONT_SIZE = 46;
export const LABEL_LETTER_SPACING = 9;
export const LABEL_RULE_WIDTH = 560;

// -------------------------------------------------------- frame brackets

export const BRACKET_BOX = {
  left: 430,
  right: WIDTH - 430,
  top: 590,
  bottom: 1500,
};
export const BRACKET_ARM = 220;
export const BRACKET_STROKE = 4;

// ------------------------------------------------------------------- map

/**
 * The projected world is a little wider than the frame so the continents
 * bleed off both edges rather than floating inside it.
 */
export const MAP_WORLD_WIDTH = 4120;
export const MAP_CENTER_Y = 1010;
/** Peak backdrop drift, in pixels. Returns to zero at frame 600. */
export const MAP_DRIFT_X = 14;
export const MAP_DRIFT_Y = 9;

// --------------------------------------------------------- data columns

export const COLUMN_COUNT = 24;
export const COLUMN_WIDTH = WIDTH / COLUMN_COUNT;
/** Height of one repeat of a column's baked content. */
export const COLUMN_TILE_HEIGHT = 720;
export const COLUMN_GLYPH_SIZE = 26;

// ------------------------------------------------------------------ grain

export const GRAIN_TILE_WIDTH = 480;
export const GRAIN_TILE_HEIGHT = 270;
export const GRAIN_TILE_COUNT = loopPeriod(6);
export const GRAIN_ALPHA = 0.03;

export const VIGNETTE_STRENGTH = 0.2;

// ----------------------------------------------------------------- timing

export const TIMING = {
  backdropFadeIn: [0, 25] as const,
  ringDraw: [25, 52] as const,
  symbolDraw: [52, 70] as const,
  /** "rejected" only: the cross lands here and snaps down over 4 frames. */
  stampAt: 56,
  stampFrames: 4,
  shakeFrames: 3,
  shakeAmplitude: 6,
  bracketsFadeIn: [30, 96] as const,
  labelFadeIn: [100, 142] as const,
  docsStart: 70,
  docStagger: 10,
  docSpringDuration: 40,
  ratingStart: 160,
  starStagger: 8,
  starSpringDuration: 28,
  scoreFadeIn: [160, 186] as const,
  scoreRuleDraw: [186, 216] as const,
  holdStart: 220,
  settleStart: 560,

  /** Periods - each divides 600. */
  iconPulse: loopPeriod(120),
  docBobFastCycles: 3,
  docBobSlowCycles: 2,
  columnDriftBase: loopPeriod(600),
  accentRulePeriod: loopPeriod(150),
  /** Candidate flicker periods for the accent squares. */
  squareFlickerPeriods: [50, 60, 75, 100].map(loopPeriod),
  /** "rejected" only: candidate periods for a document's opacity dropout. */
  docFlickerPeriods: [60, 75, 100].map(loopPeriod),
  docFlickerFrames: 3,
} as const;
