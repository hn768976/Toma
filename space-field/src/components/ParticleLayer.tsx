import React, { useCallback, useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { alphaBucket, buildColorTable } from "../lib/color";
import { TAU, clamp, loopPhase, smoothstep } from "../lib/math";
import {
  buildBursts,
  buildFlares,
  buildParticles,
  eventEnvelope,
} from "../particles";
import type { Variant } from "../variants";
import { CanvasLayer, makeOffscreen } from "./CanvasLayer";

/** The bloom pass is drawn at a quarter of each axis and upscaled. */
const BLOOM_SCALE = 0.25;

/**
 * The particle field. One system, two draw modes.
 *
 * "streak" (warp family): particles travel radially outward from the core on
 * an exponential radius, so speed grows with radius, and each is drawn as a
 * tapered streak whose length follows its current speed — nearly a point near
 * the core, long and thin by the time it leaves the frame. Each particle
 * completes a whole number of traversals per loop, recycling to the next of
 * its own seeded angles at the moment its alpha is zero.
 *
 * "point" (starfield family): the same particles hold as round points while
 * the whole field drifts on a closed path and each particle wanders a little
 * on a closed path of its own. No core, no radial motion.
 *
 * The particle set itself is built once (useMemo) and never rebuilt per frame.
 */
export const ParticleLayer: React.FC<{ readonly variant: Variant }> = ({
  variant,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const aspect = width / height;

  const particles = useMemo(
    () => buildParticles(variant, aspect),
    [variant, aspect],
  );
  const colorTable = useMemo(
    () => buildColorTable(variant.colors.map((c) => c.hex)),
    [variant],
  );
  const bursts = useMemo(() => buildBursts(variant), [variant]);
  const flares = useMemo(() => buildFlares(variant), [variant]);

  const bloomWidth = Math.round(width * BLOOM_SCALE);
  const bloomHeight = Math.round(height * BLOOM_SCALE);
  const bloomBuffer = useMemo(
    () => makeOffscreen(bloomWidth, bloomHeight),
    [bloomWidth, bloomHeight],
  );
  const bloomBlur = useMemo(
    () => makeOffscreen(bloomWidth, bloomHeight),
    [bloomWidth, bloomHeight],
  );

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      const loop = variant.loopLength;
      const phase = loopPhase(frame, loop);
      const strings = colorTable.strings;

      // Short bright twinkles: only a handful are ever live at once, so they
      // go into a small map rather than a per-particle branch.
      const boosts = new Map<number, number>();
      for (const flare of flares) {
        const envelope = eventEnvelope(frame, flare.start, flare.duration, loop);
        if (envelope > 0) {
          boosts.set(
            flare.index,
            (boosts.get(flare.index) ?? 1) + (flare.gain - 1) * envelope,
          );
        }
      }
      const hasBoosts = boosts.size > 0;

      // Sector bursts (warpViolet only).
      let burstAngle = 0;
      let burstHalfWidth = 0;
      let burstGain = 1;
      for (const burst of bursts) {
        const envelope = eventEnvelope(frame, burst.start, burst.duration, loop);
        if (envelope > 0) {
          burstAngle = burst.angle;
          burstHalfWidth = burst.halfWidth;
          burstGain = 1 + (burst.gain - 1) * envelope;
          break;
        }
      }

      const diagonal = Math.hypot(w, h);
      const streak = variant.streak;
      const core = variant.core;
      const growth = streak ? Math.log(streak.rEnd / streak.rStart) : 1;
      const rStart = streak ? streak.rStart * diagonal : 0;
      const maxLength = streak ? streak.maxLength * diagonal : 0;
      const cx = core ? core.x * w : w / 2;
      const cy = core ? core.y * h : h / 2;

      // Whole-field drift on a closed path (point mode).
      const drift = variant.drift;
      const fieldDx = drift ? drift.fieldAmp * Math.sin(TAU * phase) : 0;
      const fieldDy = drift ? drift.fieldAmp * 0.62 * Math.sin(TAU * 2 * phase) : 0;

      const twinkleAmp = variant.twinkle.amp;

      /**
       * Paints the field into `target`, scaled by `s`, skipping anything
       * dimmer than `minAlpha`. Called once at full size for the image and
       * once, small and thresholded, to build the bloom.
       */
      const paint = (
        target: CanvasRenderingContext2D,
        s: number,
        minAlpha: number,
      ) => {
        const margin = 0.12 * diagonal * s;
        const sw = w * s;
        const sh = h * s;

        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];

          const twinkle =
            1 +
            twinkleAmp *
              Math.sin(
                TAU * ((frame % p.twinklePeriod) / p.twinklePeriod + p.twinklePhase),
              );
          let alpha = p.brightness * twinkle;
          if (hasBoosts) {
            const boost = boosts.get(i);
            if (boost !== undefined) {
              alpha *= boost;
            }
          }

          if (streak && core) {
            const u = phase * p.cycles + p.phase;
            const t = u - Math.floor(u);
            const traversal = Math.floor(u) % p.cycles;
            const angle = p.angles[traversal];

            if (burstHalfWidth > 0) {
              let delta = Math.abs(angle - burstAngle) % TAU;
              if (delta > Math.PI) {
                delta = TAU - delta;
              }
              if (delta < burstHalfWidth) {
                alpha *= burstGain;
              }
            }

            // Radius grows exponentially, so speed is proportional to radius
            // and the field visibly stretches as particles accelerate away.
            const radius = rStart * Math.exp(growth * t);
            const speed = (radius * growth * p.cycles) / loop;

            alpha *= smoothstep(0, 0.06, t);
            if (alpha < minAlpha || alpha <= 0.004) {
              continue;
            }

            const dx = Math.cos(angle);
            const dy = Math.sin(angle);
            const headX = (cx + dx * radius) * s;
            const headY = (cy + dy * radius) * s;
            if (
              headX < -margin ||
              headX > sw + margin ||
              headY < -margin ||
              headY > sh + margin
            ) {
              continue;
            }

            const length =
              Math.min(speed * streak.lengthScale, maxLength) * s;
            // Streaks also widen a little as they leave the core, which keeps
            // the near-core particles reading as points.
            const halfWidth =
              (p.size / 2) *
              s *
              (0.5 + 0.5 * Math.min(1, radius / (0.15 * diagonal)));

            const bucket = alphaBucket(clamp(alpha, 0, 1));
            const row = strings[p.colorIndex];

            if (length < halfWidth * 2.2) {
              target.fillStyle = row[bucket];
              target.beginPath();
              target.arc(headX, headY, Math.max(halfWidth, 0.4), 0, TAU);
              target.fill();
              continue;
            }

            const tailX = headX - dx * length;
            const tailY = headY - dy * length;
            const nx = -dy * halfWidth;
            const ny = dx * halfWidth;
            const tailHalf = halfWidth * 0.12;
            const tnx = -dy * tailHalf;
            const tny = dx * tailHalf;

            const gradient = target.createLinearGradient(
              headX,
              headY,
              tailX,
              tailY,
            );
            gradient.addColorStop(0, row[bucket]);
            gradient.addColorStop(
              0.35,
              row[alphaBucket(clamp(alpha * 0.45, 0, 1))],
            );
            gradient.addColorStop(1, row[0]);
            target.fillStyle = gradient;
            target.beginPath();
            target.moveTo(headX + nx, headY + ny);
            target.lineTo(headX - nx, headY - ny);
            target.lineTo(tailX - tnx, tailY - tny);
            target.lineTo(tailX + tnx, tailY + tny);
            target.closePath();
            target.fill();

            // A solid head keeps the leading end reading as a hot point.
            if (halfWidth >= 0.9) {
              target.fillStyle = row[bucket];
              target.beginPath();
              target.arc(headX, headY, halfWidth, 0, TAU);
              target.fill();
            }
            continue;
          }

          // ── point mode ────────────────────────────────────────────────
          if (alpha < minAlpha || alpha <= 0.004) {
            continue;
          }

          const wanderX =
            p.driftAmp * Math.cos(TAU * (p.driftFx * phase + p.driftPx));
          const wanderY =
            p.driftAmp * Math.sin(TAU * (p.driftFy * phase + p.driftPy));
          const x = (p.bx * w + fieldDx + wanderX) * s;
          const y = (p.by * h + fieldDy + wanderY) * s;
          if (x < -margin || x > sw + margin || y < -margin || y > sh + margin) {
            continue;
          }

          const bucket = alphaBucket(clamp(alpha, 0, 1));
          const row = strings[p.colorIndex];
          const radius = Math.max((p.size / 2) * s, 0.42);

          target.fillStyle = row[bucket];
          target.beginPath();
          target.arc(x, y, radius, 0, TAU);
          target.fill();

          if (p.spikeLength > 0 && variant.spikes) {
            const armLength = p.spikeLength * s;
            const baseHalf = Math.max(radius * 0.32, 0.35);
            const tipAlpha = clamp(alpha * variant.spikes.alpha, 0, 1);
            const arms = [
              [1, 0],
              [-1, 0],
              [0, 1],
              [0, -1],
            ] as const;
            for (const [ax, ay] of arms) {
              const tipX = x + ax * armLength;
              const tipY = y + ay * armLength;
              const gradient = target.createLinearGradient(x, y, tipX, tipY);
              gradient.addColorStop(0, row[alphaBucket(tipAlpha)]);
              gradient.addColorStop(1, row[0]);
              target.fillStyle = gradient;
              target.beginPath();
              target.moveTo(x - ay * baseHalf, y - ax * baseHalf);
              target.lineTo(x + ay * baseHalf, y + ax * baseHalf);
              target.lineTo(tipX, tipY);
              target.closePath();
              target.fill();
            }
          }
        }
      };

      paint(ctx, 1, 0);

      // Bloom: redraw only the brightest particles small, blur them there and
      // add the result back. Blurring at a quarter of each axis costs a
      // sixteenth of a full-resolution blur and looks the same once upscaled.
      const bloomCtx = bloomBuffer.getContext("2d");
      const blurCtx = bloomBlur.getContext("2d");
      if (bloomCtx && blurCtx && variant.bloom.strength > 0) {
        bloomCtx.setTransform(1, 0, 0, 1, 0, 0);
        bloomCtx.globalCompositeOperation = "source-over";
        bloomCtx.globalAlpha = 1;
        bloomCtx.filter = "none";
        bloomCtx.clearRect(0, 0, bloomWidth, bloomHeight);
        bloomCtx.globalCompositeOperation = "lighter";
        paint(bloomCtx, BLOOM_SCALE, variant.bloom.threshold);

        blurCtx.setTransform(1, 0, 0, 1, 0, 0);
        blurCtx.globalCompositeOperation = "source-over";
        blurCtx.globalAlpha = 1;
        blurCtx.filter = "none";
        blurCtx.clearRect(0, 0, bloomWidth, bloomHeight);
        blurCtx.filter = `blur(${variant.bloom.radius * BLOOM_SCALE}px)`;
        blurCtx.drawImage(bloomBuffer, 0, 0);
        blurCtx.filter = "none";

        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = variant.bloom.strength;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(bloomBlur, 0, 0, bloomWidth, bloomHeight, 0, 0, w, h);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
      }
    },
    [
      variant,
      frame,
      particles,
      colorTable,
      bursts,
      flares,
      bloomBuffer,
      bloomBlur,
      bloomWidth,
      bloomHeight,
    ],
  );

  return <CanvasLayer draw={draw} blend="screen" />;
};
