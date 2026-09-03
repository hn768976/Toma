import React, { useLayoutEffect, useMemo } from "react";
import { bloomPass, sharpPass } from "./effects";
import { beginScratch, claim, type Stage } from "./canvasStage";

export type RadialBarRingProps = {
  stage: Stage | null;
  /** Distinguishes this instance on a shared stage. */
  id?: string;
  frame: number;
  background: string;
  centerX: number;
  centerY: number;
  /** Inner radius — where every bar starts. */
  innerRadius: number;
  barCount: number;
  barWidth: number;
  minLength: number;
  maxLength: number;
  /** Rotation of the whole ring, radians. Carries the gradient with it. */
  rotation: number;
  /**
   * Per-bar length, as 0-1 between `minLength` and `maxLength`. Called
   * with the bar's index and its angle in the ring's OWN frame (i.e.
   * before `rotation`), so a caller's noise field stays attached to the
   * ring rather than sweeping past it.
   */
  lengthFactor: (index: number, ringAngle: number) => number;
  /** Colour for a position 0-1 around the sweep. */
  colorAt: (t: number) => string;
  bloomBlur: number;
  bloomAlpha: number;
};

/**
 * A ring of thin bars radiating outward from a circular track, their
 * lengths driven by the supplied function and their colours taken from
 * a gradient running once around the sweep.
 *
 * The bars are spaced evenly, which is the right choice here: it reads
 * as a meter rather than as a rosette precisely because the variation
 * lives in the LENGTHS, not in the spacing.
 *
 * Colour comes from a bar's angular position in the ring's own frame,
 * never from its length, so the gradient rotates with the ring instead
 * of shimmering as the lengths change.
 */
export const RadialBarRing: React.FC<RadialBarRingProps> = ({
  stage,
  id = "radial-bar-ring",
  frame,
  background,
  centerX,
  centerY,
  innerRadius,
  barCount,
  barWidth,
  minLength,
  maxLength,
  rotation,
  lengthFactor,
  colorAt,
  bloomBlur,
  bloomAlpha,
}) => {
  /** Static geometry: each bar's fixed angle and colour within the ring. */
  const bars = useMemo(
    () =>
      Array.from({ length: barCount }, (_, index) => {
        const t = index / barCount;
        return { index, ringAngle: t * Math.PI * 2, color: colorAt(t) };
      }),
    [barCount, colorAt],
  );

  useLayoutEffect(() => {
    if (!stage) return;
    const target = claim(stage, id, frame, background);
    if (!target) return;
    const ctx = beginScratch(stage);
    if (!ctx) return;

    ctx.lineCap = "round";
    ctx.lineWidth = barWidth;
    const span = maxLength - minLength;
    // Round caps add half a stroke width at each end, so pull the ends in
    // to keep the drawn bar the length the length function asked for.
    const capInset = barWidth / 2;

    for (const bar of bars) {
      const factor = Math.max(0, Math.min(1, lengthFactor(bar.index, bar.ringAngle)));
      const length = minLength + factor * span;
      const angle = bar.ringAngle + rotation;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const r0 = innerRadius + capInset;
      const r1 = innerRadius + length - capInset;
      if (r1 <= r0) continue;

      ctx.strokeStyle = bar.color;
      ctx.beginPath();
      ctx.moveTo(centerX + r0 * cos, centerY + r0 * sin);
      ctx.lineTo(centerX + r1 * cos, centerY + r1 * sin);
      ctx.stroke();
    }

    // Two bloom radii: a wide halo plus a tighter core, which reads as
    // neon far better than a single blur at either radius.
    bloomPass(target, stage, bloomBlur, bloomAlpha);
    bloomPass(target, stage, bloomBlur * 0.35, bloomAlpha * 0.9);
    sharpPass(target, stage);
  }, [
    stage,
    id,
    frame,
    background,
    bars,
    centerX,
    centerY,
    innerRadius,
    barWidth,
    minLength,
    maxLength,
    rotation,
    lengthFactor,
    bloomBlur,
    bloomAlpha,
  ]);

  return null;
};
