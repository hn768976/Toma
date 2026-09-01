import React from "react";
import { useCurrentFrame } from "remotion";
import { steppedSpring } from "../lib/anim";
import { alpha } from "../lib/color";
import { arc, line, ring, text, type Ctx } from "../lib/draw";
import type { Palette, Variant } from "../variants";
import { Layer } from "./Layer";

const TAU = Math.PI * 2;

/** unequal segment spans, so the broken arc never reads as a dashed circle */
const SPANS = [0.22, 0.13, 0.3, 0.09, 0.17];

/**
 * A circle with a broken arc around it and a smaller inner ring.
 * `seed` drives the values and arc positions, so the left and right gauges
 * are mirrors in POSITION but never in content.
 */
export const drawRingGauge = (
  ctx: Ctx,
  cx: number,
  cy: number,
  r: number,
  seed: string,
  frame: number,
  p: Palette,
  opts: { label?: string; compact?: boolean } = {},
): void => {
  const compact = opts.compact ?? false;

  // outer broken arc — segments sweep to new positions on springs every 78f
  SPANS.forEach((span, i) => {
    const at = steppedSpring(frame, `${seed}-arc-${i}`, 78, 0, 1, i * 13);
    const from = (at + i / SPANS.length) * TAU;
    arc(
      ctx,
      cx,
      cy,
      r,
      from,
      from + span * TAU,
      i % 2 === 0 ? p.element : p.accent,
      compact ? 9 : 16,
      0.95,
    );
  });

  // the circle itself
  ring(ctx, cx, cy, r * 0.78, alpha(p.panelBorder, 0.9), compact ? 2 : 3);

  // progress sweep on the circle
  const sweep = steppedSpring(frame, `${seed}-sweep`, 78, 0.15, 0.92, 39);
  arc(
    ctx,
    cx,
    cy,
    r * 0.78,
    -Math.PI / 2,
    -Math.PI / 2 + sweep * TAU,
    p.accent,
    compact ? 4 : 7,
    0.95,
    "round",
  );

  // smaller inner ring
  ring(ctx, cx, cy, r * 0.46, alpha(p.element, 0.75), compact ? 2 : 3);
  ring(ctx, cx, cy, r * 0.4, alpha(p.pale, 0.35), 2);

  if (!compact) {
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * TAU;
      const rr = r * 0.64;
      const len = i % 3 === 0 ? 16 : 8;
      line(
        ctx,
        cx + Math.cos(a) * rr,
        cy + Math.sin(a) * rr,
        cx + Math.cos(a) * (rr - len),
        cy + Math.sin(a) * (rr - len),
        p.textPale,
        2,
        i % 3 === 0 ? 0.7 : 0.35,
      );
    }
  }

  const value = steppedSpring(frame, `${seed}-val`, 78, 0, 100, 26);
  text(ctx, value.toFixed(1), cx, cy - (compact ? 2 : 8), {
    size: compact ? r * 0.4 : r * 0.34,
    color: p.textBright,
    weight: 700,
    align: "center",
    tabular: true,
  });
  if (opts.label && !compact) {
    text(ctx, opts.label, cx, cy + r * 0.26, {
      size: r * 0.13,
      color: p.textPale,
      weight: 600,
      align: "center",
      tracking: r * 0.02,
    });
  }
};

export const RingGauge: React.FC<{
  cx: number;
  cy: number;
  r: number;
  seed: string;
  label: string;
  variant: Variant;
}> = ({ cx, cy, r, seed, label, variant }) => {
  const frame = useCurrentFrame();
  const pad = 40;
  const box = (r + pad) * 2;
  return (
    <Layer
      x={cx - box / 2}
      y={cy - box / 2}
      w={box}
      h={box}
      bloom={{ radius: 16, alpha: 0.42 }}
      draw={(ctx) =>
        drawRingGauge(ctx, box / 2, box / 2, r, seed, frame, variant.palette, {
          label,
        })
      }
    />
  );
};

/** Two small ring indicators side by side — the right column's first panel. */
export const RingPair: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  seed: string;
  variant: Variant;
}> = ({ x, y, w, h, seed, variant }) => {
  const frame = useCurrentFrame();
  const r = Math.min(h / 2, w / 4.4) * 0.94;
  return (
    <Layer
      x={x}
      y={y}
      w={w}
      h={h}
      bloom={{ radius: 10, alpha: 0.32 }}
      draw={(ctx) => {
        [0.26, 0.74].forEach((f, i) => {
          drawRingGauge(
            ctx,
            w * f,
            h / 2,
            r,
            `${seed}-pair-${i}`,
            frame,
            variant.palette,
            { compact: true },
          );
        });
        line(ctx, w / 2, h * 0.16, w / 2, h * 0.84, alpha(variant.palette.panelBorder, 0.7), 2);
      }}
    />
  );
};
