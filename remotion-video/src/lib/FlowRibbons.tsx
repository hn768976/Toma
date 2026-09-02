/**
 * <FlowRibbons> — long sweeping curved lines with travelling highlights.
 *
 * Subject-agnostic background motion: a set of generously curved lines
 * that enter and leave the frame edges, each carrying two or three short
 * bright segments that travel along it. The lines themselves sit close to
 * the background colour; the highlights are what make them visible, which
 * keeps them from competing with whatever the frame's actual subject is.
 *
 * Everything is seeded and every cycle's period divides `duration`, so
 * the set is identical on every render and the motion loops exactly.
 *
 * Generation is separated from drawing so the same ribbon set can be
 * drawn more than once — a `highlightsOnly` pass at reduced scale makes a
 * ready-made bloom source.
 *
 * @example
 * const ribbons = useMemo(() => buildRibbons({
 *   width: 3840, height: 2160, count: 28, seed: "flow",
 * }), []);
 * <FlowRibbons ribbons={ribbons} layer="back" frame={frame}
 *   width={3840} height={2160}
 *   colorDim="#14453A" colorBright="#4FE8C4" />
 */
import React from "react";
import { catmullRomPath, type Path, type Pt } from "./bezierPath";
import { taperedGradientStroke, taperedStroke } from "./taperedStroke";
import { loopPhase, loopSine } from "./loopMath";
import { makeRng, pick, range, rangeInt } from "./rng";
import { DrawCanvas } from "./DrawCanvas";

export type RibbonHighlight = {
  period: number;
  phase: number;
  /** Length of the highlight as a fraction of the ribbon. */
  span: number;
  intensity: number;
};

export type Ribbon = {
  path: Path;
  /** True for the minority that pass in front of the subject. */
  front: boolean;
  baseWidth: number;
  widthAmp: number;
  widthFreq: number;
  widthPhase: number;
  opacity: number;
  /** Closed drift: the ribbon returns to its start position at `duration`. */
  driftX: number;
  driftY: number;
  driftPeriod: number;
  driftPhase: number;
  highlights: RibbonHighlight[];
};

export type BuildRibbonsOptions = {
  width: number;
  height: number;
  count: number;
  seed: string;
  /** How many of `count` pass in front. Default 0. */
  frontCount?: number;
  /** Ribbons stay left of this fraction of the width. Default 0.75. */
  regionRight?: number;
  minWidth?: number;
  maxWidth?: number;
  highlightsMin?: number;
  highlightsMax?: number;
  highlightSpan?: number;
  /** Legal travel periods; each must divide the composition duration. */
  highlightPeriods?: number[];
  driftAmplitude?: number;
  driftPeriod?: number;
};

/**
 * Anchors are laid out with alternating offsets from the straight line
 * between entry and exit, which is what forces two or three genuine
 * inflections rather than one lazy arc.
 */
const buildAnchors = (
  rng: () => number,
  width: number,
  height: number,
  regionRight: number,
  front: boolean,
): Pt[] => {
  const right = front ? Math.min(1.14, regionRight + 0.42) : regionRight;
  const fromTop = rng() < 0.22;
  const toBottom = rng() < 0.26;

  const start: Pt = fromTop
    ? { x: range(rng, -0.08, 0.45) * width, y: -0.13 * height }
    : { x: -0.13 * width, y: range(rng, -0.12, 1.12) * height };
  const end: Pt = toBottom
    ? { x: range(rng, 0.12, right) * width, y: 1.13 * height }
    : { x: (right + range(rng, 0.0, 0.16)) * width, y: range(rng, -0.12, 1.12) * height };

  const interior = rangeInt(rng, 3, 4); // -> 2 or 3 inflections
  const amp = range(rng, 0.09, 0.27) * height;
  const flip = rng() < 0.5 ? 1 : -1;

  const anchors: Pt[] = [start];
  for (let i = 1; i <= interior; i++) {
    const t = i / (interior + 1);
    const sign = (i % 2 === 0 ? 1 : -1) * flip;
    anchors.push({
      x: start.x + (end.x - start.x) * t + range(rng, -0.05, 0.05) * width,
      y: start.y + (end.y - start.y) * t + sign * amp * range(rng, 0.6, 1.25),
    });
  }
  anchors.push(end);
  return anchors;
};

export const buildRibbons = (opts: BuildRibbonsOptions): Ribbon[] => {
  const {
    width,
    height,
    count,
    seed,
    frontCount = 0,
    regionRight = 0.75,
    minWidth = 2,
    maxWidth = 5,
    highlightsMin = 2,
    highlightsMax = 3,
    highlightSpan = 0.13,
    highlightPeriods = [600, 300, 200, 150, 120],
    driftAmplitude = 26,
    driftPeriod = 600,
  } = opts;

  const rng = makeRng(seed + ":ribbons");
  const out: Ribbon[] = [];
  for (let i = 0; i < count; i++) {
    const front = i < frontCount;
    const anchors = buildAnchors(rng, width, height, regionRight, front);
    const path = catmullRomPath(anchors, 220);

    const highlightCount = rangeInt(rng, highlightsMin, highlightsMax);
    const highlights: RibbonHighlight[] = [];
    for (let h = 0; h < highlightCount; h++) {
      highlights.push({
        period: pick(rng, highlightPeriods),
        phase: rng(),
        span: highlightSpan * range(rng, 0.7, 1.35),
        intensity: range(rng, 0.45, 0.85) * (front ? 0.5 : 1),
      });
    }

    out.push({
      path,
      front,
      baseWidth: range(rng, minWidth, maxWidth),
      widthAmp: range(rng, 0.2, 0.45),
      widthFreq: range(rng, 1, 2.3),
      widthPhase: rng(),
      opacity: front ? range(rng, 0.16, 0.28) : range(rng, 0.34, 0.72),
      driftX: range(rng, -1, 1) * driftAmplitude,
      driftY: range(rng, -1, 1) * driftAmplitude,
      driftPeriod,
      driftPhase: rng(),
      highlights,
    });
  }
  return out;
};

export type DrawRibbonsOptions = {
  frame: number;
  colorDim: string;
  colorBright: string;
  /** "back" and "front" select which half of the set to draw. */
  layer: "back" | "front" | "all";
  /** Multiplies every ribbon's opacity. */
  opacity?: number;
  /** Draw only the travelling highlights — a ready-made bloom source. */
  highlightsOnly?: boolean;
  /** Uniform scale applied before drawing, for reduced-resolution passes. */
  scale?: number;
  /** Translation applied before drawing — use for a parallax camera drift. */
  offsetX?: number;
  offsetY?: number;
};

const rgbaFrom = (hex: string, alpha: number): string => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha.toFixed(3)})`;
};

export const drawRibbons = (
  ctx: CanvasRenderingContext2D,
  ribbons: Ribbon[],
  opts: DrawRibbonsOptions,
): void => {
  const { frame, layer } = opts;
  const globalOpacity = opts.opacity ?? 1;
  const scale = opts.scale ?? 1;

  ctx.save();
  if (scale !== 1) ctx.scale(scale, scale);
  if (opts.offsetX || opts.offsetY) ctx.translate(opts.offsetX ?? 0, opts.offsetY ?? 0);

  for (let i = 0; i < ribbons.length; i++) {
    const r = ribbons[i];
    if (layer === "back" && r.front) continue;
    if (layer === "front" && !r.front) continue;

    const dx = r.driftX * loopSine(frame, r.driftPeriod, r.driftPhase);
    const dy = r.driftY * loopSine(frame, r.driftPeriod, r.driftPhase + 0.25);

    ctx.save();
    ctx.translate(dx, dy);

    const widthAt = (t: number) =>
      r.baseWidth *
      (1 + r.widthAmp * Math.sin((t * r.widthFreq + r.widthPhase) * Math.PI * 2));

    if (!opts.highlightsOnly) {
      taperedStroke(ctx, r.path, {
        widthAt,
        fillStyle: rgbaFrom(opts.colorDim, r.opacity * globalOpacity),
      });
    }

    for (let h = 0; h < r.highlights.length; h++) {
      const hi = r.highlights[h];
      // Travel from fully off one end to fully off the other, so a
      // highlight enters and leaves rather than popping into existence.
      const u = loopPhase(frame, hi.period, hi.phase);
      const center = -hi.span + u * (1 + 2 * hi.span);
      const a0 = center - hi.span * 0.5;
      const a1 = center + hi.span * 0.5;
      const from = Math.max(0, a0);
      const to = Math.min(1, a1);
      if (to <= from) continue;

      // Window position within the *unclipped* highlight, so a highlight
      // half off the end still fades correctly.
      const windowAt = (v: number) => {
        const g = (from + v * (to - from) - a0) / hi.span;
        return Math.pow(Math.sin(Math.PI * Math.max(0, Math.min(1, g))), 1.5);
      };

      taperedGradientStroke(ctx, r.path, {
        from,
        to,
        widthAt: (t) => widthAt(t) * (1 + 0.85 * Math.sin(Math.PI * ((t - a0) / hi.span))),
        colorAt: (v) =>
          rgbaFrom(
            opts.colorBright,
            windowAt(v) * hi.intensity * r.opacity * globalOpacity,
          ),
        stops: 18,
      });
    }
    ctx.restore();
  }
  ctx.restore();
};

export const FlowRibbons: React.FC<
  DrawRibbonsOptions & {
    ribbons: Ribbon[];
    width: number;
    height: number;
    style?: React.CSSProperties;
  }
> = ({ ribbons, width, height, style, ...drawOpts }) => (
  <DrawCanvas
    width={width}
    height={height}
    style={style}
    draw={(ctx) => drawRibbons(ctx, ribbons, drawOpts)}
  />
);
