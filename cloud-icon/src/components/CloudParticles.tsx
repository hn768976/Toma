import React, { useMemo } from "react";
import { Easing, interpolate } from "remotion";
import {
  CLOUD,
  FINISH,
  CLOUD_CENTER_Y,
  HEIGHT,
  PARTICLES,
  TIMING,
  WIDTH,
} from "../config";
import { drawCloudSilhouette } from "../cloudShape";
import { buildMaskField, particlesFromMask } from "../lib/particleFromMask";
import { bloomPass, withAlpha } from "../lib/postFx";
import { rand, randRange } from "../lib/random";
import type { Theme } from "../theme";
import { layerStyle, useCanvasDraw, useScratchCanvas } from "../lib/canvas";
import { RING_RADIUS } from "./SegmentRing";

type CloudParticle = {
  /** Sampled resting position. */
  x: number;
  y: number;
  radius: number;
  /** 0 at the silhouette edge, 1 deep inside. */
  depth: number;
  outside: boolean;
  /** Index into the palette ramp: 0 = cyan body, 1 = near-white. */
  tone: number;
  baseAlpha: number;
  /** Where it flies in from. */
  startX: number;
  startY: number;
  /** Frames after the assemble window opens before this one launches. */
  delay: number;
  twinklePeriod: number;
  twinklePhase: number;
  /** Free-drift excursion — zero for all but a handful of particles. */
  driftAmp: number;
  driftAngle: number;
  driftPhase: number;
};

/**
 * The cloud itself: ~2200 particles rejection-sampled against the silhouette
 * with edge-weighted density, flying in from a wide scatter edge-first so the
 * outline resolves before the interior fills.
 */
export const CloudParticles: React.FC<{ frame: number; theme: Theme }> = ({
  frame,
  theme,
}) => {
  const particles = useMemo<CloudParticle[]>(() => {
    const field = buildMaskField({
      width: WIDTH,
      height: HEIGHT,
      downscale: PARTICLES.maskDownscale,
      draw: drawCloudSilhouette,
    });

    const sampled = particlesFromMask({
      field,
      count: PARTICLES.count,
      outsideFraction: PARTICLES.outsideFraction,
      edgeFalloff: PARTICLES.edgeFalloff,
      interiorFloor: PARTICLES.interiorFloor,
      outsideBand: 210,
      seed: "cloud-icon/particles",
    });

    // Launch order is driven by each particle's depth *rank*, not its raw
    // depth: the edge-weighted sampler bunches most particles into a narrow
    // band of depths, so a raw-depth delay would launch nearly everything at
    // once. Ranking guarantees a clean edge-first wave whatever the
    // distribution looks like. Outliers are pinned to the back of the queue.
    const order = sampled
      .map((p, i) => ({ i, key: p.outside ? Infinity : p.depth }))
      .sort((a, b) => a.key - b.key);
    const rank = new Float64Array(sampled.length);
    order.forEach((entry, position) => {
      rank[entry.i] = sampled.length <= 1 ? 0 : position / (sampled.length - 1);
    });

    return sampled.map((p, i) => {
      const toneRoll = rand(`tone-${i}`);
      // Most particles sit in the cyan body; a scattering run near-white.
      // Edge particles are nudged brighter, which sharpens the silhouette.
      const tone = Math.min(1, Math.pow(toneRoll, 2.4) + (1 - p.depth) * 0.22);
      const brightRoll = rand(`bright-${i}`);

      // Launch from well outside the ring, in every direction.
      const angle = rand(`launch-angle-${i}`) * Math.PI * 2;
      const distance = randRange(`launch-dist-${i}`, RING_RADIUS * 1.6, RING_RADIUS * 2.7);

      // Edge first, interior last, with a couple of frames of jitter so the
      // wave front stays organic rather than reading as a sweep line.
      const delay = Math.max(
        0,
        Math.pow(rank[i], 1.2) * TIMING.particleDelaySpread +
          (rand(`delay-jitter-${i}`) - 0.35) * 5,
      );

      const drifts = rand(`drift-roll-${i}`) < (p.outside ? 0.5 : 0.02);

      return {
        x: p.x,
        y: p.y,
        radius: randRange(`size-${i}`, PARTICLES.minRadius, PARTICLES.maxRadius),
        depth: p.depth,
        outside: p.outside,
        tone,
        // Biased low so most particles are dim and the bright ones tell.
        baseAlpha: 0.18 + Math.pow(brightRoll, 2.1) * 0.82,
        startX: CLOUD.centerX + Math.cos(angle) * distance,
        startY: CLOUD_CENTER_Y + Math.sin(angle) * distance,
        delay,
        twinklePeriod: randRange(
          `twinkle-period-${i}`,
          TIMING.twinklePeriodMin,
          TIMING.twinklePeriodMax,
        ),
        twinklePhase: rand(`twinkle-phase-${i}`) * Math.PI * 2,
        driftAmp: drifts ? randRange(`drift-amp-${i}`, TIMING.driftMin, TIMING.driftMax) : 0,
        driftAngle: rand(`drift-angle-${i}`) * Math.PI * 2,
        driftPhase: rand(`drift-phase-${i}`) * Math.PI * 2,
      };
    });
  }, []);

  const scratch = useScratchCanvas();

  const ref = useCanvasDraw(WIDTH, HEIGHT, (ctx, canvas) => {
    if (frame < TIMING.assembleStart) return;

    // Breathing: +/-1% about the cloud's centre. sin(0) = 0 at the start of
    // the idle act, so it eases in from the assembled pose with no jump.
    const breatheT = Math.max(0, frame - TIMING.idleStart);
    const scale =
      1 +
      TIMING.breatheAmount * Math.sin((breatheT / TIMING.breathePeriod) * Math.PI * 2);

    ctx.save();
    ctx.translate(CLOUD.centerX, CLOUD_CENTER_Y);
    ctx.scale(scale, scale);
    ctx.translate(-CLOUD.centerX, -CLOUD_CENTER_Y);

    for (const p of particles) {
      const t = interpolate(
        frame,
        [
          TIMING.assembleStart + p.delay,
          TIMING.assembleStart + p.delay + TIMING.particleFlightFrames,
        ],
        [0, 1],
        {
          easing: Easing.out(Easing.cubic),
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        },
      );
      if (t <= 0) continue;

      // Free drift is an excursion away from rest and back, phased in only
      // once the particle has landed.
      let dx = 0;
      let dy = 0;
      if (p.driftAmp > 0 && frame > TIMING.idleStart) {
        const cycle =
          (1 -
            Math.cos(
              ((frame - TIMING.idleStart) / TIMING.driftPeriod) * Math.PI * 2 +
                p.driftPhase,
            )) /
          2;
        const swing = cycle * p.driftAmp;
        dx = Math.cos(p.driftAngle) * swing;
        dy = Math.sin(p.driftAngle) * swing;
      }

      const x = p.startX + (p.x + dx - p.startX) * t;
      const y = p.startY + (p.y + dy - p.startY) * t;

      // Twinkle only kicks in as a particle settles, so the fly-in reads clean.
      const twinkle =
        0.68 +
        0.32 *
          Math.sin((frame / p.twinklePeriod) * Math.PI * 2 + p.twinklePhase) *
          t;
      const alpha = p.baseAlpha * twinkle * t * (p.outside ? 0.62 : 1);

      ctx.beginPath();
      ctx.fillStyle = withAlpha(
        p.tone > 0.72 ? theme.cloudWhite : p.tone > 0.34 ? theme.cloudPale : theme.cloudCyan,
        Math.max(0, alpha),
      );
      ctx.arc(x, y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    bloomPass(canvas, ctx, {
      downscale: 4,
      scratch,
      layers: FINISH.bloom.particles,
    });
  });

  return <canvas ref={ref} style={layerStyle(5)} />;
};
