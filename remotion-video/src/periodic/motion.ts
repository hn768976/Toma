import { interpolate, random } from "remotion";
import { CATEGORY_ORDER, type ElementCategory } from "./elements";
import {
  CELL_SIZE,
  FRAME_HEIGHT,
  FRAME_WIDTH,
  HOLD_START,
  PLACED_ELEMENTS,
  type PlacedElement,
} from "./layout";
import type { Variant } from "./variants";

/**
 * Every value here is a pure function of the frame number and a stable string
 * seed, so `remotion render` is deterministic.
 */

export type CellTiming = {
  /** Frame the cell starts moving. */
  start: number;
  /** Frames it spends travelling. */
  travel: number;
  /** Frame it settles, and the landing flash fires. */
  land: number;
  /** Where it comes from, top-left corner, in viewBox units. */
  fromX: number;
  fromY: number;
  /** Start rotation in degrees; it unwinds to 0 as the cell settles. */
  fromRotation: number;
  /** Sideways bow of the travel path, in viewBox units. */
  bow: number;
};

const OFF_FRAME_MARGIN = 120;
/** How far past the frame edges a scattered cell may start. */
const SCATTER_OVERSHOOT_X = 800;
const SCATTER_OVERSHOOT_Y = 600;

const scatterOrder = (): number[] => {
  const indices = PLACED_ELEMENTS.map((_, index) => index);
  return indices.sort(
    (a, b) =>
      random(`arrival-order-${PLACED_ELEMENTS[a].atomicNumber}`) -
      random(`arrival-order-${PLACED_ELEMENTS[b].atomicNumber}`),
  );
};

const nearestEdgeStart = (
  element: PlacedElement,
): { fromX: number; fromY: number } => {
  const toLeft = element.cx;
  const toRight = FRAME_WIDTH - element.cx;
  const toTop = element.cy;
  const toBottom = FRAME_HEIGHT - element.cy;
  const nearest = Math.min(toLeft, toRight, toTop, toBottom);

  if (nearest === toLeft) {
    return { fromX: -(CELL_SIZE + OFF_FRAME_MARGIN), fromY: element.y };
  }
  if (nearest === toRight) {
    return { fromX: FRAME_WIDTH + OFF_FRAME_MARGIN, fromY: element.y };
  }
  if (nearest === toTop) {
    return { fromX: element.x, fromY: -(CELL_SIZE + OFF_FRAME_MARGIN) };
  }
  return { fromX: element.x, fromY: FRAME_HEIGHT + OFF_FRAME_MARGIN };
};

/**
 * One timing per element, in element order. The stagger is spread so that the
 * last cell has *settled* by `lastLandingFrame` - the hold needs a finished
 * table, so the window covers travel as well as departure.
 */
export const buildTimings = (variant: Variant): CellTiming[] => {
  const { arrival } = variant;
  const count = PLACED_ELEMENTS.length;
  const stagger =
    (arrival.lastLandingFrame - arrival.travelFrames) / (count - 1);

  const slotOf = new Array<number>(count);
  if (arrival.mode === "scatter") {
    scatterOrder().forEach((elementIndex, slot) => {
      slotOf[elementIndex] = slot;
    });
  } else {
    // Atomic-number order: the table builds row by row, left to right, and the
    // f-block rows fill at their real place in the sequence.
    for (let i = 0; i < count; i++) {
      slotOf[i] = i;
    }
  }

  return PLACED_ELEMENTS.map((element, index) => {
    const start = slotOf[index] * stagger;
    const seed = element.atomicNumber;

    if (arrival.mode === "sequential") {
      const { fromX, fromY } = nearestEdgeStart(element);
      return {
        start,
        travel: arrival.travelFrames,
        land: start + arrival.travelFrames,
        fromX,
        fromY,
        fromRotation: 0,
        bow: 0,
      };
    }

    return {
      start,
      travel: arrival.travelFrames,
      land: start + arrival.travelFrames,
      fromX:
        -SCATTER_OVERSHOOT_X +
        random(`scatter-x-${seed}`) * (FRAME_WIDTH + SCATTER_OVERSHOOT_X * 2),
      fromY:
        -SCATTER_OVERSHOOT_Y +
        random(`scatter-y-${seed}`) * (FRAME_HEIGHT + SCATTER_OVERSHOOT_Y * 2),
      fromRotation:
        (random(`scatter-rot-${seed}`) * 2 - 1) * arrival.maxRotationDeg,
      bow: (random(`scatter-bow-${seed}`) * 2 - 1) * 240,
    };
  });
};

/* ------------------------------------------------------------- the hold --- */

/** Periods that divide the 150-frame hold exactly. */
const BREATHE_PERIODS = [25, 30, 50, 75];
const BREATHE_DEPTH = 0.08;

/** +/-8% glow on a seeded sine, one seeded period per cell. */
export const breatheAt = (frame: number, atomicNumber: number): number => {
  const period =
    BREATHE_PERIODS[
      Math.floor(random(`breathe-period-${atomicNumber}`) * BREATHE_PERIODS.length)
    ];
  const phase = random(`breathe-phase-${atomicNumber}`) * Math.PI * 2;
  return 1 + BREATHE_DEPTH * Math.sin((frame / period) * Math.PI * 2 + phase);
};

const SPARK_BUCKET = 10;
const SPARKS_PER_BUCKET = 3;
const SPARK_BUCKETS = 300 / SPARK_BUCKET;

/**
 * A few cells per second brighten for ~5 frames. The bucket seeds come from
 * `frame % 300`, so the pattern is stable for any frame.
 */
export const sparkAmounts = (frame: number, count: number): number[] => {
  const out = new Array<number>(count).fill(0);
  const currentBucket = Math.floor(frame / SPARK_BUCKET);

  for (let bucket = currentBucket - 1; bucket <= currentBucket; bucket++) {
    if (bucket < 0) {
      continue;
    }
    const elapsed = frame - bucket * SPARK_BUCKET;
    const amount = interpolate(elapsed, [0, 2, 5], [0, 1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    if (amount <= 0) {
      continue;
    }
    const seedBucket = bucket % SPARK_BUCKETS;
    for (let n = 0; n < SPARKS_PER_BUCKET; n++) {
      const index = Math.floor(random(`spark-${seedBucket}-${n}`) * count);
      out[index] = Math.max(out[index], amount);
    }
  }

  return out;
};

const DRIFT_RADIUS = 10;

/** Slight ambient drift of the whole table on a closed path. No camera move. */
export const driftAt = (frame: number): { x: number; y: number } => ({
  x: DRIFT_RADIUS * Math.sin((frame / 240) * Math.PI * 2),
  y: DRIFT_RADIUS * Math.sin((frame / 120) * Math.PI * 2 + Math.PI / 3),
});

/* -------------------------------------------------------- the highlight --- */

/**
 * 1 = full intensity. During the "categories" hold one category sits at 1
 * while the rest fall to `dimTo`, cross-fading between segments.
 */
export const highlightIntensity = (
  variant: Variant,
  frame: number,
  category: ElementCategory,
): number => {
  const { highlight } = variant;
  if (highlight.mode === "none" || frame < HOLD_START) {
    return 1;
  }

  const elapsed = frame - HOLD_START;
  const segment = Math.min(
    CATEGORY_ORDER.length - 1,
    Math.floor(elapsed / highlight.segmentFrames),
  );
  const withinSegment = elapsed - segment * highlight.segmentFrames;

  const valueFor = (index: number) =>
    index < 0
      ? 1
      : CATEGORY_ORDER[index] === category
        ? 1
        : highlight.dimTo;

  const blend = interpolate(
    withinSegment,
    [0, highlight.crossfadeFrames],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return valueFor(segment - 1) + (valueFor(segment) - valueFor(segment - 1)) * blend;
};
