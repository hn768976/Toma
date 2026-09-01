import React, { useMemo } from "react";
import { random, useCurrentFrame } from "remotion";
import { LAYOUT } from "../layout";
import { loopT } from "../lib/anim";
import { alpha } from "../lib/color";
import { line, px, text, triangle, type Ctx } from "../lib/draw";
import type { Palette, RailStyle, Variant } from "../variants";
import { Layer } from "./Layer";

const TICK_STEP = 24;

/** v1: a line carrying evenly spaced ticks, every fifth one longer. */
const drawTicked = (
  ctx: Ctx,
  w: number,
  h: number,
  dir: 1 | -1,
  p: Palette,
): void => {
  const baseY = dir === 1 ? LAYOUT.rails.lineY : h - LAYOUT.rails.lineY;
  line(ctx, 0, px(baseY), w, px(baseY), p.panelBorder, 3, 0.95);

  const count = Math.floor(w / TICK_STEP);
  for (let i = 0; i <= count; i++) {
    const x = px(i * TICK_STEP);
    const long = i % 5 === 0;
    const len = long ? 26 : 13;
    line(ctx, x, baseY, x, baseY + len * dir, long ? p.pale : p.railDim, 2, long ? 0.9 : 0.65);
    if (i % 20 === 0) {
      triangle(ctx, i * TICK_STEP, baseY + 34 * dir, 11, dir, p.element, 0.95);
    }
    if (i % 40 === 0 && i > 0 && i < count - 4) {
      text(ctx, String(i * 5).padStart(4, "0"), i * TICK_STEP, baseY + 66 * dir, {
        size: 24,
        color: alpha(p.textPale, 0.8),
        weight: 500,
        align: "center",
        tabular: true,
        tracking: 2,
      });
    }
  }
};

/** v2: rows of short filled blocks at varied widths, with gaps between groups. */
const drawSegmented = (
  ctx: Ctx,
  w: number,
  h: number,
  dir: 1 | -1,
  p: Palette,
): void => {
  const baseY = dir === 1 ? LAYOUT.rails.lineY : h - LAYOUT.rails.lineY;
  line(ctx, 0, px(baseY), w, px(baseY), alpha(p.panelBorder, 0.7), 2, 0.8);

  let x = 0;
  let i = 0;
  while (x < w) {
    const group = 3 + Math.floor(random(`seg-g-${i}`) * 4);
    for (let g = 0; g < group && x < w; g++) {
      const bw = 14 + Math.round(random(`seg-w-${i}-${g}`) * 46);
      const bh = 10 + Math.round(random(`seg-h-${i}-${g}`) * 22);
      const bright = random(`seg-b-${i}-${g}`) > 0.78;
      ctx.save();
      ctx.fillStyle = bright ? p.element : p.railDim;
      ctx.globalAlpha = bright ? 0.95 : 0.8;
      ctx.fillRect(x, dir === 1 ? baseY + 4 : baseY - 4 - bh, bw, bh);
      ctx.restore();
      x += bw + 8;
    }
    if (i % 4 === 0) {
      triangle(ctx, x + 10, baseY + 42 * dir, 11, dir, p.accent, 0.9);
    }
    x += 44;
    i++;
  }
};

const RAILS: Record<
  RailStyle,
  (ctx: Ctx, w: number, h: number, dir: 1 | -1, p: Palette) => void
> = { ticked: drawTicked, segmented: drawSegmented };

/**
 * Full-width rail. The static chrome is rasterised ONCE into an offscreen
 * canvas (useMemo) and blitted every frame; only the sliding marker redraws.
 */
export const TickRail: React.FC<{ variant: Variant; edge: "top" | "bottom" }> = ({
  variant,
  edge,
}) => {
  const frame = useCurrentFrame();
  const rect = edge === "top" ? LAYOUT.rails.top : LAYOUT.rails.bottom;
  const dir: 1 | -1 = edge === "top" ? 1 : -1;
  const p = variant.palette;

  const chrome = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = rect.w;
    c.height = rect.h;
    const ctx = c.getContext("2d");
    if (ctx) {
      RAILS[variant.railStyle](ctx, rect.w, rect.h, dir, p);
    }
    return c;
  }, [rect.w, rect.h, dir, p, variant.railStyle]);

  // two whole traversals per loop, opposite directions top and bottom
  const t = loopT(frame) * 2 % 1;
  const mx = edge === "top" ? t * rect.w : (1 - t) * rect.w;
  const baseY = dir === 1 ? LAYOUT.rails.lineY : rect.h - LAYOUT.rails.lineY;

  return (
    <Layer
      x={rect.x}
      y={rect.y}
      w={rect.w}
      h={rect.h}
      bloom={{ radius: 8, alpha: 0.3 }}
      draw={(ctx) => {
        ctx.drawImage(chrome, 0, 0);
        ctx.save();
        ctx.fillStyle = p.accent;
        ctx.fillRect(mx - 3, baseY - 30 * (dir === 1 ? 0 : 1), 6, 30);
        ctx.restore();
        triangle(ctx, mx, baseY + 4 * dir, 15, dir, p.accent, 1);
        line(ctx, mx - 90, px(baseY), mx + 90, px(baseY), p.accent, 4, 0.9);
      }}
    />
  );
};
