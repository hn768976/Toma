import React, { useMemo } from "react";
import { withAlpha } from "./color";
import { buildAngularCdf, distanceToEdge, sampleAngle } from "./radialPlaces";
import { rnd, rndBiased, rndPick, rndRange } from "./rand";
import { useCanvas } from "./useCanvas";

/**
 * <SparkField> — small bright points scattered through a radial field,
 * denser near the origin, flickering on seeded schedules and drifting
 * along the radial directions.
 *
 * `direction` matches <RadiantBurst>: +1 drifts outward with an ease-out,
 * -1 drifts inward and accelerates as the sparks close on the origin. The
 * origin-density bias is applied to whichever end of the drift is the
 * settled one, so inward sparks still have somewhere to travel from.
 *
 * Deterministic and loop-safe: every flicker and drift period must divide
 * the composition's loop length, and each spark's alpha envelope reaches
 * zero at both ends of its drift cycle, so the wrap is never visible.
 */

const DEFAULT_FLICKER_PERIODS = [30, 40, 50, 60, 75, 100, 120] as const;
const DEFAULT_DRIFT_PERIODS = [150, 200, 300, 600] as const;

export type SparkFieldProps = {
  width: number;
  height: number;
  originX: number;
  originY: number;
  frame: number;
  seed: string;
  color: string;
  count: number;
  /** +1 drifts away from the origin, -1 drifts toward it. */
  direction: 1 | -1;
  /**
   * Weight of a spark at angular distance `phi` (0..PI) from straight up.
   * Memoise this: a new function identity rebuilds the whole field.
   */
  angularWeight: (phi: number) => number;
  /** Radius, in pixels, of the ordinary and the standout sparks. */
  sizes?: { small: [number, number]; large: [number, number] };
  /** Fraction of sparks rendered noticeably larger and brighter. */
  largeShare?: number;
  /** Drift distance range in pixels. */
  travel?: [number, number];
  /**
   * Flicker periods in frames. Each MUST divide the composition's loop
   * length exactly, or the field will jump at the wrap.
   */
  flickerPeriods?: readonly number[];
  /** Drift periods in frames. Each MUST divide the loop length exactly. */
  driftPeriods?: readonly number[];
  offset?: { x: number; y: number };
  style?: React.CSSProperties;
  className?: string;
};

/** Stable default objects — see the note in HorizonSilhouette.tsx. */
const DEFAULT_SIZES = {
  small: [7, 17] as [number, number],
  large: [22, 36] as [number, number],
};
const DEFAULT_TRAVEL: [number, number] = [110, 420];
const NO_OFFSET = { x: 0, y: 0 };

type Spark = {
  angle: number;
  radius: number;
  travel: number;
  size: number;
  bright: boolean;
  alpha: number;
  flickerPeriod: number;
  flickerPhase: number;
  driftPeriod: number;
  driftPhase: number;
};

const SPRITE = 64;
const spriteCache = new Map<string, HTMLCanvasElement>();

/** One soft radial dot, rendered once and blitted per spark. */
const sparkSprite = (color: string): HTMLCanvasElement => {
  const hit = spriteCache.get(color);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = SPRITE;
  c.height = SPRITE;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("sparkSprite: no 2d context");
  const r = SPRITE / 2;
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, withAlpha(color, 1));
  g.addColorStop(0.16, withAlpha(color, 0.85));
  g.addColorStop(0.42, withAlpha(color, 0.22));
  g.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SPRITE, SPRITE);
  spriteCache.set(color, c);
  return c;
};

type BuildOptions = Required<
  Pick<
    SparkFieldProps,
    | "width"
    | "height"
    | "originX"
    | "originY"
    | "count"
    | "direction"
    | "angularWeight"
    | "seed"
    | "sizes"
    | "largeShare"
    | "travel"
    | "flickerPeriods"
    | "driftPeriods"
  >
>;

const buildSparks = (o: BuildOptions): Spark[] => {
  const cdf = buildAngularCdf(
    (a) =>
      o.angularWeight(
        Math.abs(
          Math.atan2(Math.sin(a + Math.PI / 2), Math.cos(a + Math.PI / 2)),
        ),
      ),
    { bins: 1440 },
  );
  const outward = o.direction === 1;
  const sparks: Spark[] = [];
  for (let i = 0; i < o.count; i++) {
    const seed = `${o.seed}:spark:${i}`;
    const angle = sampleAngle(cdf, rnd(`${seed}:u`));
    const edge = distanceToEdge(o.originX, o.originY, o.width, o.height, angle);
    // Biased toward the origin, so the field is densest where the
    // filaments are. The bias is applied to whichever end of the drift is
    // the "settled" one: an outward spark starts near the origin and
    // leaves, an inward spark arrives there. Applying it to the start in
    // both cases would leave inward sparks with nowhere to travel — they
    // would pile up on the origin and sit still.
    const anchor = rndBiased(`${seed}:r`, 40, edge * 1.02, 2.1);
    const distance = rndRange(`${seed}:t`, o.travel[0], o.travel[1]);
    const radius = outward ? anchor : Math.min(edge * 1.05, anchor + distance);
    const bright = rnd(`${seed}:b`) < o.largeShare;
    sparks.push({
      angle,
      radius,
      travel: distance * (outward ? 1 : -1),
      size: bright
        ? rndRange(`${seed}:s`, o.sizes.large[0], o.sizes.large[1])
        : rndRange(`${seed}:s`, o.sizes.small[0], o.sizes.small[1]),
      bright,
      alpha: bright
        ? rndRange(`${seed}:a`, 0.7, 1)
        : rndRange(`${seed}:a`, 0.25, 0.65),
      flickerPeriod: rndPick(`${seed}:fp`, o.flickerPeriods),
      flickerPhase: rnd(`${seed}:fh`) * Math.PI * 2,
      driftPeriod: rndPick(`${seed}:dp`, o.driftPeriods),
      driftPhase: rnd(`${seed}:dh`),
    });
  }
  return sparks;
};

export const SparkField: React.FC<SparkFieldProps> = ({
  width,
  height,
  originX,
  originY,
  frame,
  seed,
  color,
  count,
  direction,
  angularWeight,
  sizes = DEFAULT_SIZES,
  largeShare = 0.13,
  travel = DEFAULT_TRAVEL,
  flickerPeriods = DEFAULT_FLICKER_PERIODS,
  driftPeriods = DEFAULT_DRIFT_PERIODS,
  offset = NO_OFFSET,
  style,
  className,
}) => {
  const sparks = useMemo(
    () =>
      buildSparks({
        width,
        height,
        originX,
        originY,
        count,
        direction,
        angularWeight,
        seed,
        sizes,
        largeShare,
        travel,
        flickerPeriods,
        driftPeriods,
      }),
    [
      width,
      height,
      originX,
      originY,
      count,
      direction,
      angularWeight,
      seed,
      sizes,
      largeShare,
      travel,
      flickerPeriods,
      driftPeriods,
    ],
  );
  const sprite = useMemo(() => sparkSprite(color), [color]);

  const ref = useCanvas(width, height, (ctx) => {
    const tau = Math.PI * 2;
    const inward = direction === -1;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(offset.x, offset.y);

    for (const s of sparks) {
      const cycle = (frame / s.driftPeriod + s.driftPhase) % 1;
      // Inward sparks accelerate as they approach the origin; outward
      // ones ease out. Either way the envelope pins alpha to 0 at both
      // ends of the cycle, so the wrap is never visible.
      const eased = inward ? Math.pow(cycle, 1.9) : Math.pow(cycle, 0.78);
      const r = Math.max(12, s.radius + s.travel * eased);
      const envelope = Math.sin(Math.PI * cycle);
      const flicker =
        0.32 +
        0.68 *
          Math.pow(
            0.5 + 0.5 * Math.sin((tau * frame) / s.flickerPeriod + s.flickerPhase),
            2.6,
          );
      const alpha = s.alpha * envelope * flicker;
      if (alpha <= 0.004) continue;
      const size = s.size * (s.bright ? 1 + 0.35 * flicker : 1);
      ctx.globalAlpha = Math.min(1, alpha);
      ctx.drawImage(
        sprite,
        originX + Math.cos(s.angle) * r - size,
        originY + Math.sin(s.angle) * r - size,
        size * 2,
        size * 2,
      );
    }

    ctx.restore();
  });

  return <canvas ref={ref} style={style} className={className} />;
};
