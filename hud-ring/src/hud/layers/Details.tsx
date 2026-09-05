import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { BEATS, ITEM_DURATION, SPIN } from "../constants";
import { arcPath, radialPath, rectPath, tangentialTransform } from "../geometry";
import { drawOn, flicker, spin, stagger } from "../timing";
import { colorOf, type LayerProps } from "./common";

const ARC_SPIN = [SPIN.arcsInner, SPIN.arcsMid, SPIN.arcsOuter] as const;

/** Layer 4 — broken arcs at three radii, each sweeping from one end to the other. */
export const Arcs: React.FC<LayerProps> = ({ layout, palette, h }) => {
  const frame = useCurrentFrame();
  return (
    <>
      {[0, 1, 2].map((group) => {
        const rotation = spin(frame, BEATS.arcs[0], ARC_SPIN[group]);
        return (
          <g key={group} transform={`rotate(${rotation})`}>
            {layout.arcs
              .filter((a) => a.group === group)
              .map((a, i) => {
                const p = stagger(
                  frame,
                  a.order,
                  layout.arcs.length,
                  BEATS.arcs,
                  ITEM_DURATION.arc,
                  Easing.inOut(Easing.cubic),
                );
                if (p <= 0) return null;
                return (
                  <path
                    key={i}
                    d={arcPath(a.r * h, a.a0, a.a1)}
                    fill="none"
                    stroke={colorOf(palette, a.color)}
                    strokeWidth={a.width * h}
                    strokeLinecap="butt"
                    {...drawOn(p)}
                  />
                );
              })}
          </g>
        );
      })}
    </>
  );
};

/** Layer 5a — the dense tick ring, each tick growing outward. */
export const TickRing: React.FC<LayerProps> = ({ layout, palette, h }) => {
  const frame = useCurrentFrame();
  const rotation = spin(frame, BEATS.ticks[0], SPIN.ticks);
  return (
    <g transform={`rotate(${rotation})`}>
      {layout.ticks.map((t, i) => {
        const p = stagger(frame, t.order, layout.ticks.length, BEATS.ticks, ITEM_DURATION.tick);
        if (p <= 0) return null;
        return (
          <path
            key={i}
            d={radialPath(t.r0 * h, t.r1 * h, t.angle)}
            fill="none"
            stroke={colorOf(palette, t.color)}
            strokeWidth={t.width * h}
            opacity={t.color === "dim" ? 0.9 : 0.75}
            {...drawOn(p)}
          />
        );
      })}
    </g>
  );
};

/**
 * Layer 6 — scattered data blocks in clusters. Outlined blocks draw their
 * border on, then scan their internal hatch lines in; filled blocks pop.
 */
export const DataBlocks: React.FC<LayerProps> = ({ layout, palette, h }) => {
  const frame = useCurrentFrame();
  const rotation = spin(frame, BEATS.dataBlocks[0], SPIN.dataBlocks);
  return (
    <g transform={`rotate(${rotation})`}>
      {layout.dataBlocks.map((b, i) => {
        const p = stagger(
          frame,
          b.order,
          layout.dataBlocks.length,
          BEATS.dataBlocks,
          ITEM_DURATION.dataBlock,
          Easing.linear,
        );
        if (p <= 0) return null;
        const color = colorOf(palette, b.color);
        const w = b.w * h;
        const bh = b.h * h;
        const x = -w / 2;
        const y = -bh / 2;
        const alive = flicker(frame, 2000 + i, 0.5);

        if (b.filled) {
          const scale = interpolate(p, [0, 1], [0.25, 1], {
            extrapolateRight: "clamp",
            easing: Easing.out(Easing.cubic),
          });
          return (
            <g key={i} transform={`${tangentialTransform(b.r * h, b.angle)} scale(${scale})`}>
              <rect x={x} y={y} width={w} height={bh} fill={color} opacity={0.85 * alive} />
            </g>
          );
        }

        const outline = interpolate(p, [0, 0.6], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.quad),
        });
        const hatchProgress = interpolate(p, [0.45, 1], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        // All hatch lines live in a single path so the draw-on scans them in order.
        const hatchD = Array.from({ length: b.hatch }, (_, k) => {
          const hy = y + (bh * (k + 1)) / (b.hatch + 1);
          return `M ${x + w * 0.12} ${hy} L ${x + w * 0.88} ${hy}`;
        }).join(" ");

        return (
          <g key={i} transform={tangentialTransform(b.r * h, b.angle)}>
            <path
              d={rectPath(x, y, w, bh)}
              fill="none"
              stroke={color}
              strokeWidth={b.width * h}
              opacity={0.8 * alive}
              {...drawOn(outline)}
            />
            {b.hatch > 0 && hatchProgress > 0 ? (
              <path
                d={hatchD}
                fill="none"
                stroke={color}
                strokeWidth={b.width * h * 0.8}
                opacity={0.55 * alive}
                {...drawOn(hatchProgress)}
              />
            ) : null}
          </g>
        );
      })}
    </g>
  );
};
