import { random } from "remotion";
import type { Variant } from "./variants";
import { mix3 } from "./colors";

/**
 * The progress curve.
 *
 * Two things stop this reading as fake: the segment table gives it uneven pace
 * with real pauses, and the value is then snapped to an irregular ladder of
 * stops so it JUMPS rather than counting smoothly.
 */

const ease = (t: number, kind: string): number => {
  switch (kind) {
    case "out":
      return 1 - Math.pow(1 - t, 2.1);
    case "in":
      return Math.pow(t, 1.8);
    case "jerky":
      // Uneven descent: stutters and briefly plateaus on the way down.
      return Math.max(0, Math.min(1, t + 0.045 * Math.sin(t * Math.PI * 6.5)));
    default:
      return t;
  }
};

/** Raw, unsnapped percentage at `frame`. */
export const rawProgress = (variant: Variant, frame: number): number => {
  const segs = variant.curve.segments;
  const first = segs[0];
  const last = segs[segs.length - 1];
  if (frame <= first.from) return first.a;
  if (frame >= last.to) return last.b;
  for (const s of segs) {
    if (frame >= s.from && frame <= s.to) {
      const t = s.to === s.from ? 1 : (frame - s.from) / (s.to - s.from);
      return s.a + (s.b - s.a) * ease(t, s.ease);
    }
  }
  return last.b;
};

/**
 * The irregular ladder of stops the value snaps to. Built once from a stable
 * seed, with the curve's plateau values forced in so pauses land exactly.
 */
const buildStops = (variant: Variant): number[] => {
  const stops: number[] = [0];
  let v = 0;
  let i = 0;
  while (v < 100) {
    // Steps between ~1.1% and ~3.9%, so the bar advances visibly in chunks.
    v += 1.1 + random(`stop-${variant.mode}-${i}`) * 2.8;
    i++;
    if (v < 100) stops.push(Math.round(v * 10) / 10);
  }
  stops.push(100);
  for (const anchor of variant.curve.anchors) stops.push(anchor);
  return [...new Set(stops)].sort((x, y) => x - y);
};

const stopCache = new WeakMap<Variant, number[]>();

const stopsFor = (variant: Variant): number[] => {
  const cached = stopCache.get(variant);
  if (cached) return cached;
  const built = buildStops(variant);
  stopCache.set(variant, built);
  return built;
};

/** The displayed percentage: snapped down onto the irregular ladder. */
export const progressAt = (variant: Variant, frame: number): number => {
  const raw = rawProgress(variant, frame);
  const stops = stopsFor(variant);
  let out = stops[0];
  for (const s of stops) {
    if (s <= raw + 1e-6) out = s;
    else break;
  }
  return out;
};

/**
 * Distance the diagonal hatching has scrolled by `frame`, in plane px.
 *
 * This is the integral of the scroll speed, so the deceleration of the stall
 * is continuous — the hatching visibly slows and then stops rather than
 * cutting out.
 */
export const hatchScroll = (
  variant: Variant,
  frame: number,
  speed: number,
): number => {
  const stallAt = variant.curve.hatchStallAt;
  if (stallAt === null || frame <= stallAt) return speed * frame;
  const n = variant.curve.hatchStallFrames;
  const u = Math.min(1, (frame - stallAt) / n);
  // Speed ramps linearly 1 -> 0 over n frames; this is its integral.
  return speed * stallAt + speed * n * (u - (u * u) / 2);
};

/** Fill colour at `frame`: green through amber to red, or steady green. */
export const fillColorAt = (variant: Variant, frame: number): string => {
  const { palette, curve } = variant;
  if (curve.colorShiftAt === null) return palette.barFill;
  const t = (frame - curve.colorShiftAt) / curve.colorShiftFrames;
  return mix3(
    palette.barFillPre,
    palette.barFillMid,
    palette.barFill,
    Math.max(0, Math.min(1, t)),
  );
};

/** Icon colour at `frame`. Only leaves the nominal colour once things fail. */
export const iconColorAt = (
  variant: Variant,
  frame: number,
): { stroke: string; glow: string } => {
  const { palette, curve } = variant;
  if (curve.colorShiftAt === null) {
    return { stroke: palette.icon, glow: palette.iconGlow };
  }
  const t = Math.max(
    0,
    Math.min(1, (frame - curve.colorShiftAt) / curve.colorShiftFrames),
  );
  return {
    stroke: mix3(palette.iconPre, palette.barFillMid, palette.icon, t),
    glow: mix3(palette.iconGlowPre, palette.barFillMid, palette.iconGlow, t),
  };
};

export const statusLineAt = (variant: Variant, frame: number): string => {
  for (const [a, b] of variant.curve.statusAltWindows) {
    if (frame >= a && frame < b) return variant.labels.statusAlt;
  }
  return variant.labels.status;
};
