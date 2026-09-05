import React from "react";
import { Easing, interpolate, interpolateColors, useCurrentFrame } from "remotion";
import { BEATS, ITEM_DURATION, SPIN } from "../constants";
import { arcPath, tangentialTransform } from "../geometry";
import { drawOn, flicker, spin, stagger } from "../timing";
import { colorOf, type LayerProps } from "./common";

/** Layer 1 — the innermost dashed circle, sweeping on dash by dash. */
export const DashedCircle: React.FC<LayerProps> = ({ layout, palette, h }) => {
  const frame = useCurrentFrame();
  const rotation = spin(frame, BEATS.dashedCircle[0], SPIN.dashedCircle);
  return (
    <g transform={`rotate(${rotation})`}>
      {layout.dashes.map((d, i) => {
        const p = stagger(
          frame,
          i,
          layout.dashes.length,
          BEATS.dashedCircle,
          ITEM_DURATION.dash,
          Easing.linear,
        );
        if (p <= 0) return null;
        return (
          <path
            key={i}
            d={arcPath(d.r * h, d.a0, d.a1)}
            fill="none"
            stroke={palette.dimWhite}
            strokeWidth={0.0014 * h}
            strokeLinecap="round"
            opacity={0.85}
            {...drawOn(p)}
          />
        );
      })}
    </g>
  );
};

/** Layer 2 — tangential rounded rectangles, arriving one at a time. */
export const SegmentRing: React.FC<LayerProps> = ({ layout, palette, h }) => {
  const frame = useCurrentFrame();
  const rotation = spin(frame, BEATS.segmentRing[0], SPIN.segmentRing);
  return (
    <g transform={`rotate(${rotation})`}>
      {layout.segments.map((s, i) => {
        const p = stagger(frame, i, layout.segments.length, BEATS.segmentRing, ITEM_DURATION.segment);
        if (p <= 0) return null;
        const scale = interpolate(p, [0, 1], [0.2, 1]);
        const color = colorOf(palette, s.color);
        const alive = s.filled ? flicker(frame, 700 + i, 0.5) : 1;
        return (
          <g key={i} transform={`${tangentialTransform(s.r * h, s.angle)} scale(${scale})`}>
            <rect
              x={(-s.w * h) / 2}
              y={(-s.h * h) / 2}
              width={s.w * h}
              height={s.h * h}
              rx={s.rx * h}
              fill={s.filled ? color : "none"}
              stroke={color}
              strokeWidth={0.0016 * h}
              opacity={p * (s.filled ? 0.95 : 0.85) * alive}
            />
          </g>
        );
      })}
    </g>
  );
};

/**
 * Layer 3 — the loud ring of blocks. Each one flashes white as it lights up,
 * then settles into the palette colour and flickers occasionally.
 * This is the only layer that receives the bloom filter.
 */
export const BlockRing: React.FC<LayerProps> = ({ layout, palette, h }) => {
  const frame = useCurrentFrame();
  const rotation = spin(frame, BEATS.blockRing[0], SPIN.blockRing);
  return (
    <g transform={`rotate(${rotation})`}>
      {layout.blocks.map((b, i) => {
        const p = stagger(
          frame,
          i,
          layout.blocks.length,
          BEATS.blockRing,
          ITEM_DURATION.block,
          Easing.linear,
        );
        if (p <= 0) return null;
        const scale = interpolate(p, [0, 0.6, 1], [0.35, 1.12, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.cubic),
        });
        const opacity =
          interpolate(p, [0, 0.25], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }) * flicker(frame, i, 0.55);
        const fill = interpolateColors(p, [0.45, 1], ["#ffffff", palette.block]);
        return (
          <g key={i} transform={`${tangentialTransform(b.r * h, b.angle)} scale(${scale})`}>
            <rect
              x={(-b.w * h) / 2}
              y={(-b.h * h) / 2}
              width={b.w * h}
              height={b.h * h}
              rx={b.rx * h}
              fill={fill}
              opacity={opacity}
            />
          </g>
        );
      })}
    </g>
  );
};
