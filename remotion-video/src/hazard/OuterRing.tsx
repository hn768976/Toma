/**
 * The dark disc the symbol sits on, and the bright ring around it.
 *
 * The ring is the frame's brightest continuous element: a thin hard stroke
 * with two soft halos stacked additively beneath it. Its glow breathes on a
 * sine whose period divides the loop exactly, so it returns to where it began.
 *
 * Between the disc and the ring a thin band of plate is left showing through —
 * the disc is drawn smaller than the ring, and nothing fills the gap.
 */

import React from "react";
import { TAU } from "./constants";
import { hexToRgb, rgba } from "../lib/remotion-lib";

export interface OuterRingProps {
  ctx: CanvasRenderingContext2D;
  centerX: number;
  centerY: number;
  discRadius: number;
  ringRadius: number;
  ringWidth: number;
  discColor: string;
  ringColor: string;
  glowColor: string;
  /** 1 at rest; the caller breathes this around 1. */
  glow: number;
}

export const OuterRing: React.FC<OuterRingProps> = ({
  ctx,
  centerX,
  centerY,
  discRadius,
  ringRadius,
  ringWidth,
  discColor,
  ringColor,
  glowColor,
  glow,
}) => {
  const glowRgb = hexToRgb(glowColor);
  const discRgb = hexToRgb(discColor);
  const bounds = ringRadius * 1.9;

  ctx.save();
  // Blurred strokes are expensive over a full 4K surface; clipping to the
  // ring's own neighbourhood keeps the filter cost proportional to the ring.
  ctx.beginPath();
  ctx.rect(centerX - bounds, centerY - bounds, bounds * 2, bounds * 2);
  ctx.clip();

  // The disc: near black, lifted very slightly at its edge so it reads as a
  // surface rather than a hole.
  const discGradient = ctx.createRadialGradient(
    centerX - discRadius * 0.25,
    centerY - discRadius * 0.3,
    discRadius * 0.05,
    centerX,
    centerY,
    discRadius,
  );
  discGradient.addColorStop(0, rgba([discRgb[0] + 10, discRgb[1] + 10, discRgb[2] + 9], 1));
  discGradient.addColorStop(0.65, discColor);
  discGradient.addColorStop(1, rgba([discRgb[0] + 5, discRgb[1] + 5, discRgb[2] + 4], 1));
  ctx.globalCompositeOperation = "source-over";
  ctx.beginPath();
  ctx.arc(centerX, centerY, discRadius, 0, TAU);
  ctx.fillStyle = discGradient;
  ctx.fill();

  // Two soft halos, then the hard stroke on top.
  ctx.globalCompositeOperation = "lighter";
  const halos: [number, number, number][] = [
    [78, ringWidth * 4.2, 0.3],
    [26, ringWidth * 1.9, 0.42],
  ];
  for (const [blur, width, alpha] of halos) {
    ctx.filter = `blur(${blur}px)`;
    ctx.beginPath();
    ctx.arc(centerX, centerY, ringRadius, 0, TAU);
    ctx.strokeStyle = rgba(glowRgb, alpha * glow);
    ctx.lineWidth = width;
    ctx.stroke();
  }
  ctx.filter = "none";

  ctx.globalCompositeOperation = "source-over";
  ctx.beginPath();
  ctx.arc(centerX, centerY, ringRadius, 0, TAU);
  ctx.strokeStyle = ringColor;
  ctx.lineWidth = ringWidth;
  ctx.stroke();

  // A touch of the glow colour riding on the stroke itself.
  ctx.globalCompositeOperation = "lighter";
  ctx.beginPath();
  ctx.arc(centerX, centerY, ringRadius, 0, TAU);
  ctx.strokeStyle = rgba(glowRgb, 0.5 * glow);
  ctx.lineWidth = ringWidth * 0.55;
  ctx.stroke();

  ctx.restore();
  return null;
};
