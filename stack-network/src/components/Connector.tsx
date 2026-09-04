import React from "react";
import { tripProgress } from "../lib/loop";
import { tierBlur, tierOpacity } from "../lib/constants";
import type { ResolvedConnector } from "../lib/scene";
import type { Theme } from "../lib/theme";

/**
 * One dashed connector, with its dashes marching along the path.
 *
 * This is the signature motion, and it loops because the dash offset
 * advances a whole number of dash periods over the composition: at the
 * last frame the pattern has slid back into the position it started in.
 *
 * Each connector gets its own <svg> sized to its own bounding box. That
 * matters for the depth of field -- a per-connector filter: blur() then
 * only has to touch a small box rather than a full 5600x3400 plane.
 */
export const Connector: React.FC<{
  connector: ResolvedConnector;
  theme: Theme;
  progress: number;
}> = ({ connector, theme, progress }) => {
  const { spec, geom, box, dashLength, gapLength, period } = connector;
  const color = spec.color ?? theme.dash;
  const blur = tierBlur(spec.tier);

  // Whole periods travelled so far. Negative marches the other way.
  const dashOffset = -spec.march * period * progress;

  const dotRadius = spec.dots?.radius ?? spec.width * 1.7;

  return (
    <svg
      width={box.width}
      height={box.height}
      viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`}
      style={{
        position: "absolute",
        left: box.x,
        top: box.y,
        overflow: "visible",
        opacity: tierOpacity(spec.tier) * (spec.fade ?? 1),
        ...(blur > 0 ? { filter: `blur(${blur}px)` } : null),
      }}
    >
      {/* Soft under-stroke: the bloom the bright dashes sit inside. It
          carries the dash colour rather than a darker one, or it reads as
          a dirty outline against the near-black field. */}
      <path
        d={geom.d}
        fill="none"
        stroke={color}
        strokeWidth={spec.width * 2.8}
        strokeLinecap="round"
        strokeDasharray={`${dashLength} ${gapLength}`}
        strokeDashoffset={dashOffset}
        opacity={0.17}
      />
      <path
        d={geom.d}
        fill="none"
        stroke={color}
        strokeWidth={spec.width}
        strokeLinecap="round"
        strokeDasharray={`${dashLength} ${gapLength}`}
        strokeDashoffset={dashOffset}
      />

      {/* Round terminals, as on the reference's schematic runs. */}
      {spec.caps ? (
        <>
          <circle cx={geom.start.x} cy={geom.start.y} r={spec.width * 1.5} fill={color} />
          <circle cx={geom.end.x} cy={geom.end.y} r={spec.width * 1.5} fill={color} />
        </>
      ) : null}

      {/* Direction chevrons, fixed to the path rather than travelling. */}
      {spec.chevrons?.map((at, i) => {
        const p = geom.pointAt(at * geom.length);
        const s = spec.width * 3.6;
        return (
          <g key={i} transform={`translate(${p.x} ${p.y}) rotate(${p.angle})`} opacity={0.92}>
            <path
              d={`M ${-s} ${-s} L 0 0 L ${-s} ${s}`}
              fill="none"
              stroke={color}
              strokeWidth={spec.width * 1.15}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={`M ${-s * 2.1} ${-s} L ${-s * 1.1} 0 L ${-s * 2.1} ${s}`}
              fill="none"
              stroke={color}
              strokeWidth={spec.width * 1.15}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.6}
            />
          </g>
        );
      })}

      {/* Dots riding the path; whole trips over the loop. */}
      {spec.dots
        ? Array.from({ length: spec.dots.count }, (_, i) => {
            const t = tripProgress(
              progress,
              spec.dots!.trips,
              spec.dots!.phase + i / spec.dots!.count,
            );
            const p = geom.pointAt(t * geom.length);
            // Fade in and out at the ends so a dot never blinks out mid-air.
            const ends = Math.min(1, Math.min(t, 1 - t) / 0.06);
            return (
              <g key={`d${i}`} opacity={ends}>
                <circle cx={p.x} cy={p.y} r={dotRadius * 2.6} fill={color} opacity={0.18} />
                <circle cx={p.x} cy={p.y} r={dotRadius} fill="#ffffff" opacity={0.92} />
              </g>
            );
          })
        : null}
    </svg>
  );
};
