import React, { useMemo } from "react";
import { withAlpha } from "../lib/color";
import {
  buildAngularCdf,
  distanceToEdge,
  sampleAngle,
} from "../lib/radialPlaces";
import { rnd, rndBiased, rndPick, rndRange } from "../lib/rand";
import { useCanvas } from "../lib/useCanvas";
import { layerStyle } from "./layers";
import { cameraDrift, Layout, TAU } from "./layout";
import { angularWeight, VariantConfig } from "./variants";

/**
 * Small bright points scattered through the filament field, denser near
 * the origin. They flicker on seeded schedules and drift along the
 * filament directions — outward when the burst radiates, inward (and
 * accelerating as they close on the origin) when it contracts.
 *
 * Every period below divides the 600-frame loop, and each spark's alpha
 * envelope reaches zero at both ends of its drift cycle, so the moment a
 * spark wraps back to its start is invisible.
 */

/** Divisors of 600. */
const FLICKER_PERIODS = [30, 40, 50, 60, 75, 100, 120] as const;
const DRIFT_PERIODS = [150, 200, 300, 600] as const;
/** Fraction of sparks rendered noticeably larger and brighter. */
const BRIGHT_SHARE = 0.13;

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

const buildSparks = (
  config: VariantConfig,
  layout: Layout,
  seedPrefix: string,
): Spark[] => {
  const cdf = buildAngularCdf(
    (a) => {
      const phi = Math.abs(
        Math.atan2(Math.sin(a + Math.PI / 2), Math.cos(a + Math.PI / 2)),
      );
      return angularWeight(config.angular, phi);
    },
    { bins: 1440 },
  );
  const outward = config.burstDirection === 1;
  const sparks: Spark[] = [];
  for (let i = 0; i < config.sparkCount; i++) {
    const seed = `${seedPrefix}:spark:${i}`;
    const angle = sampleAngle(cdf, rnd(`${seed}:u`));
    const edge = distanceToEdge(
      layout.originX,
      layout.originY,
      layout.width,
      layout.height,
      angle,
    );
    // Biased toward the origin, so the field is densest where the
    // filaments are. The bias is applied to whichever end of the drift
    // is the "settled" one: an outward spark starts near the origin and
    // leaves, an inward spark arrives there. Applying it to the start in
    // both cases would leave inward sparks with nowhere to travel — they
    // would pile up on the origin and sit still.
    const anchor = rndBiased(`${seed}:r`, 40, edge * 1.02, 2.1);
    const distance = rndRange(`${seed}:t`, 110, 420);
    const radius = outward ? anchor : Math.min(edge * 1.05, anchor + distance);
    const bright = rnd(`${seed}:b`) < BRIGHT_SHARE;
    sparks.push({
      angle,
      radius,
      travel: distance * (outward ? 1 : -1),
      size: bright
        ? rndRange(`${seed}:s`, 22, 36)
        : rndRange(`${seed}:s`, 7, 17),
      bright,
      alpha: bright
        ? rndRange(`${seed}:a`, 0.7, 1)
        : rndRange(`${seed}:a`, 0.25, 0.65),
      flickerPeriod: rndPick(`${seed}:fp`, FLICKER_PERIODS),
      flickerPhase: rnd(`${seed}:fh`) * TAU,
      driftPeriod: rndPick(`${seed}:dp`, DRIFT_PERIODS),
      driftPhase: rnd(`${seed}:dh`),
    });
  }
  return sparks;
};

export const SparkField: React.FC<{
  config: VariantConfig;
  layout: Layout;
  frame: number;
  seed: string;
}> = ({ config, layout, frame, seed }) => {
  const sparks = useMemo(
    () => buildSparks(config, layout, seed),
    [config, layout, seed],
  );
  const sprite = useMemo(
    () => sparkSprite(config.palette.sparkPale),
    [config.palette.sparkPale],
  );

  const ref = useCanvas(layout.width, layout.height, (ctx) => {
    const drift = cameraDrift(frame);
    const inward = config.burstDirection === -1;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(drift.x, drift.y);

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
            0.5 +
              0.5 * Math.sin((TAU * frame) / s.flickerPeriod + s.flickerPhase),
            2.6,
          );
      const alpha = s.alpha * envelope * flicker;
      if (alpha <= 0.004) continue;
      const size = s.size * (s.bright ? 1 + 0.35 * flicker : 1);
      ctx.globalAlpha = Math.min(1, alpha);
      ctx.drawImage(
        sprite,
        layout.originX + Math.cos(s.angle) * r - size,
        layout.originY + Math.sin(s.angle) * r - size,
        size * 2,
        size * 2,
      );
    }

    ctx.restore();
  });

  return <canvas ref={ref} style={layerStyle("screen")} />;
};
