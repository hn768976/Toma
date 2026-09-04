import {
  SESSION_POINTS,
  SWEEP_END_FRAME,
  SWEEP_START_FRAME,
} from "./constants";

export type Layout = {
  width: number;
  height: number;
  /** 1 at 3840x2160. Every hard-coded size below is multiplied by it. */
  unit: number;
  plotLeft: number;
  plotRight: number;
  plotTop: number;
  plotBottom: number;
  plotWidth: number;
  plotHeight: number;
  marginLeft: number;
  marginRight: number;
};

export const buildLayout = (width: number, height: number): Layout => {
  const plotLeft = width * 0.076;
  const plotRight = width * 0.965;
  const plotTop = height * 0.372;
  const plotBottom = height * 0.868;
  return {
    width,
    height,
    unit: width / 3840,
    plotLeft,
    plotRight,
    plotTop,
    plotBottom,
    plotWidth: plotRight - plotLeft,
    plotHeight: plotBottom - plotTop,
    marginLeft: width * 0.058,
    marginRight: width * 0.965,
  };
};

export type Scale = {
  /** Point index (may be fractional) to x. */
  x: (index: number) => number;
  /** Price to y. */
  y: (value: number) => number;
  min: number;
  max: number;
};

export const buildScale = (
  values: number[],
  prevClose: number,
  layout: Layout,
): Scale => {
  // The previous close is inside the domain so its dotted line is always
  // on screen, whichever way the session went.
  const low = Math.min(prevClose, ...values);
  const high = Math.max(prevClose, ...values);
  const pad = (high - low) * 0.16;
  const min = low - pad;
  const max = high + pad * 0.5;
  const span = max - min;
  return {
    x: (index) => layout.plotLeft + (index / (values.length - 1)) * layout.plotWidth,
    y: (value) => layout.plotBottom - ((value - min) / span) * layout.plotHeight,
    min,
    max,
  };
};

/**
 * Where the playhead sits at a given frame. Linear by design — easing would
 * make it read as an animation rather than a playback scrub.
 */
export const sweepProgress = (frame: number): number => {
  const t = (frame - SWEEP_START_FRAME) / (SWEEP_END_FRAME - SWEEP_START_FRAME);
  return Math.min(1, Math.max(0, t));
};

export type PlayheadState = {
  progress: number;
  /** Fractional index into the series. */
  cursor: number;
  index: number;
  frac: number;
  /** The interpolated series value under the playhead. */
  value: number;
  x: number;
  y: number;
};

/**
 * The one place the playhead position and its value are derived, so the
 * floating readout can never disagree with the line beneath it.
 */
export const playheadAt = (
  frame: number,
  values: number[],
  scale: Scale,
): PlayheadState => {
  const progress = sweepProgress(frame);
  const cursor = progress * (values.length - 1);
  const index = Math.min(values.length - 2, Math.floor(cursor));
  const frac = cursor - index;
  const value = values[index] + (values[index + 1] - values[index]) * frac;
  return {
    progress,
    cursor,
    index,
    frac,
    value,
    x: scale.x(cursor),
    y: scale.y(value),
  };
};

/** Both paths are built from the same point list, in composition pixels. */
export const buildPaths = (
  values: number[],
  scale: Scale,
  layout: Layout,
): { line: string; area: string; lengths: number[]; totalLength: number } => {
  const points = values.map((v, i) => [scale.x(i), scale.y(v)] as const);
  const line = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(" ");
  const baseline = layout.plotBottom;
  const area = `${line} L${points[points.length - 1][0].toFixed(2)} ${baseline.toFixed(
    2,
  )} L${points[0][0].toFixed(2)} ${baseline.toFixed(2)} Z`;

  // Cumulative polyline length, so the stroke reveal can be driven by
  // stroke-dasharray and still land exactly under the playhead.
  const lengths = new Array<number>(points.length).fill(0);
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += Math.hypot(
      points[i][0] - points[i - 1][0],
      points[i][1] - points[i - 1][1],
    );
    lengths[i] = total;
  }
  return { line, area, lengths, totalLength: total };
};

/** Drawn length at the playhead — the dash value that reveals up to it. */
export const revealedLength = (
  head: PlayheadState,
  lengths: number[],
): number => {
  const a = lengths[head.index];
  const b = lengths[head.index + 1];
  return a + (b - a) * head.frac;
};

/**
 * Index of the point the playhead is closest to, for clock labels. Floored at
 * 1 so the session range never reads as ending before it began.
 */
export const nearestMinute = (head: PlayheadState): number =>
  Math.min(SESSION_POINTS - 1, Math.max(1, Math.round(head.cursor)));
