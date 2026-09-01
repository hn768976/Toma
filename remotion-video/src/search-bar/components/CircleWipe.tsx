import React from "react";
import { Easing, interpolate } from "remotion";
import { CanvasLayer } from "./CanvasLayer";
import type { Layout } from "../layout";

/**
 * A solid circle growing out of the bar until it covers the frame.
 *
 * The radius eases IN — slow to start, accelerating — which is what separates
 * a deliberate transition from a balloon inflating. An ease-out here would
 * lunge and then creep, and the last few percent of coverage would drag.
 */
export const CircleWipe: React.FC<{
  layout: Layout;
  width: number;
  height: number;
  color: string;
  start: number;
  end: number;
  frame: number;
}> = ({ layout, width, height, color, start, end, frame }) => {
  const cx = layout.barX + layout.barW / 2;
  const cy = layout.iconCy;
  const corners = [
    Math.hypot(cx, cy),
    Math.hypot(width - cx, cy),
    Math.hypot(cx, height - cy),
    Math.hypot(width - cx, height - cy),
  ];
  const full = Math.max(corners[0], corners[1], corners[2], corners[3]);

  const progress = interpolate(frame, [start, end], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.cubic),
  });

  return (
    <CanvasLayer
      x={0}
      y={0}
      width={width}
      height={height}
      draw={(ctx) => {
        if (progress <= 0) {
          return;
        }
        ctx.fillStyle = color;
        if (progress >= 1) {
          ctx.fillRect(0, 0, width, height);
          return;
        }
        ctx.beginPath();
        ctx.arc(cx, cy, full * progress, 0, Math.PI * 2);
        ctx.fill();
      }}
    />
  );
};
