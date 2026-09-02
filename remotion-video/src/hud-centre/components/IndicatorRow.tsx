import React from "react";
import { Panel } from "./Panel";
import type { Rect } from "../layout";
import { PALETTE, withAlpha } from "../palette";
import { sansFont } from "../fonts";
import { smallCaps } from "@lib/draw/panel-chrome";
import { pick, rnd } from "@lib/random/seeded";

// Blink periods, all divisors of 450 so every light returns to its frame-0
// state at the cut. Mixed periods are what make the pattern read as irregular.
const BLINK_PERIODS = [15, 18, 25, 30, 45, 50] as const;

export type IndicatorRowProps = {
  rect: Rect;
  index: number;
  panelCount: number;
  frame: number;
  label: string;
  seed: string;
  count?: number;
};

/** A row of small square indicator lights blinking in irregular patterns. */
export const IndicatorRow: React.FC<IndicatorRowProps> = ({
  rect,
  index,
  panelCount,
  frame,
  label,
  seed,
  count = 18,
}) => {
  const drawStatic = (ctx: CanvasRenderingContext2D, inner: Rect) => {
    smallCaps(ctx, label, inner.x, inner.y + inner.h / 2, {
      font: sansFont(500, 22),
      color: withAlpha(PALETTE.textPale, 0.75),
    });
  };

  const drawDynamic = (ctx: CanvasRenderingContext2D, inner: Rect) => {
    const left = inner.x + 150;
    const track = inner.w - 150;
    const slot = track / count;
    const size = Math.min(slot * 0.62, inner.h * 0.7);
    const y = inner.y + (inner.h - size) / 2;

    for (let i = 0; i < count; i++) {
      const period = pick(`${seed}-per-${i}`, BLINK_PERIODS);
      const gen = Math.floor(frame / period);
      const on = rnd(`${seed}-on-${i}-${gen}`) > 0.42;
      const age = frame - gen * period;
      // Short decay after each turn-on, so lights pop rather than sit lit.
      const level = on ? Math.max(0.25, 1 - age / (period * 0.55)) : 0.12;
      const amber = i % 7 === 3;
      const color = amber ? PALETTE.accentAmber : PALETTE.elementCyan;
      const x = left + slot * i + (slot - size) / 2;

      ctx.fillStyle = withAlpha(color, 0.16);
      ctx.fillRect(x, y, size, size);
      ctx.save();
      ctx.globalAlpha = level;
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 12 * level;
      ctx.fillRect(x + 3, y + 3, size - 6, size - 6);
      ctx.restore();
    }
  };

  return (
    <Panel
      rect={rect}
      index={index}
      panelCount={panelCount}
      frame={frame}
      drawStatic={drawStatic}
      drawDynamic={drawDynamic}
    />
  );
};
