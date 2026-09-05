import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { BEATS, ITEM_DURATION, SPIN } from "../constants";
import { arcPath, radialPath } from "../geometry";
import { drawOn, spin, stagger } from "../timing";
import { colorOf, type LayerProps } from "./common";

/** Layer 7 — the faint broken outer circles and the long radial lines. */
export const OuterFrame: React.FC<LayerProps> = ({ layout, palette, h }) => {
  const frame = useCurrentFrame();
  const rotation = spin(frame, BEATS.outer[0], SPIN.outer);
  const total = layout.outerArcs.length + layout.radials.length;
  return (
    <g transform={`rotate(${rotation})`}>
      {layout.outerArcs.map((a, i) => {
        const p = stagger(
          frame,
          a.order,
          total,
          BEATS.outer,
          ITEM_DURATION.outerArc,
          Easing.inOut(Easing.cubic),
        );
        if (p <= 0) return null;
        return (
          <path
            key={`a${i}`}
            d={arcPath(a.r * h, a.a0, a.a1)}
            fill="none"
            stroke={colorOf(palette, a.color)}
            strokeWidth={a.width * h}
            opacity={0.9}
            {...drawOn(p)}
          />
        );
      })}
      {layout.radials.map((r, i) => {
        const p = stagger(
          frame,
          layout.outerArcs.length + r.order,
          total,
          BEATS.outer,
          ITEM_DURATION.radial,
          Easing.out(Easing.cubic),
        );
        if (p <= 0) return null;
        return (
          <path
            key={`r${i}`}
            d={radialPath(r.r0 * h, r.r1 * h, r.angle)}
            fill="none"
            stroke={palette.dim}
            strokeWidth={r.width * h}
            opacity={0.85}
            {...drawOn(p)}
          />
        );
      })}
    </g>
  );
};

/** Sparse marks out towards the frame corners, so the ring is not sitting in a void. */
export const CornerMarks: React.FC<LayerProps> = ({ layout, palette, h }) => {
  const frame = useCurrentFrame();
  return (
    <g>
      {layout.cornerMarks.map((m, i) => {
        const p = stagger(
          frame,
          m.order,
          layout.cornerMarks.length,
          BEATS.outer,
          ITEM_DURATION.cornerMark,
        );
        if (p <= 0) return null;
        const scale = interpolate(p, [0, 1], [0.3, 1], {
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.cubic),
        });
        const color = colorOf(palette, m.color);
        return (
          <g key={i} transform={`translate(${m.x * h} ${m.y * h}) scale(${scale})`}>
            <rect
              x={(-m.w * h) / 2}
              y={(-m.h * h) / 2}
              width={m.w * h}
              height={m.h * h}
              fill={m.filled ? color : "none"}
              stroke={color}
              strokeWidth={m.width * h}
              opacity={p * 0.42}
            />
          </g>
        );
      })}
    </g>
  );
};
