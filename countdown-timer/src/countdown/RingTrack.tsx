import React, { useLayoutEffect } from "react";
import { bloomPass, sharpPass } from "./effects";
import { beginScratch, claim, type Stage } from "./stage";

export type RingTrackProps = {
  stage: Stage | null;
  frame: number;
  background: string;
  centerX: number;
  centerY: number;
  radius: number;
  lineWidth: number;
  color: string;
};

/**
 * The thin circle the bars stand on, at their inner radius.
 *
 * Faint by design — it exists to stop the digits in the middle from
 * looking detached from the ring of bars around them, not to be seen in
 * its own right.
 */
export const RingTrack: React.FC<RingTrackProps> = ({
  stage,
  frame,
  background,
  centerX,
  centerY,
  radius,
  lineWidth,
  color,
}) => {
  useLayoutEffect(() => {
    if (!stage) return;
    const target = claim(stage, "ring-track", frame, background);
    if (!target) return;
    const ctx = beginScratch(stage);
    if (!ctx) return;

    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Only the faintest lift; the track is not a light source.
    bloomPass(target, stage, lineWidth * 3, 0.35);
    sharpPass(target, stage);
  }, [stage, frame, background, centerX, centerY, radius, lineWidth, color]);

  return null;
};
