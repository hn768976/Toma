/**
 * CounterBlock — the five large numerals beneath the chart, each with a small
 * label above it and a jagged sparkline below.
 *
 * The numerals are the largest type in the frame. They climb on the shared
 * timeline but through a per-counter polling staircase (see timeline.ts), so
 * they jump in uneven increments and hold flat in between rather than sliding
 * smoothly. The sparkline is revealed by the same staircase fraction, so it
 * redraws in step with its own counter.
 */

import { random } from "remotion";
import { COUNTER_CELLS, type Rect } from "../layout";
import { COUNTERS } from "../data";
import {
  drawTabular,
  measureTabular,
  withAlpha,
  formatCounter,
  type Ctx2D,
  type DashboardLayer,
  type PaintEnv,
} from "./utils";

const SPARK_POINTS = 30;
/** Ceiling for the numerals; the real size is fitted to the widest final value. */
const NUMERAL_SIZE_MAX = 138;
/** Share of a cell the widest numeral may occupy. */
const NUMERAL_FIT = 0.86;

const numeralSizeCache = new Map<string, number>();

/**
 * One type size for all five counters, fitted so the widest FINAL value still
 * clears its cell. Fitting against the final value (rather than the value on
 * screen) is what stops the numerals resizing as digits are added mid-climb.
 */
const numeralSize = (ctx: Ctx2D, family: string): number => {
  const cached = numeralSizeCache.get(family);
  if (cached !== undefined) return cached;

  const maxWidth = COUNTER_CELLS[0].w * NUMERAL_FIT;
  let size = NUMERAL_SIZE_MAX;
  for (const spec of COUNTERS) {
    const width = measureTabular(ctx, formatCounter(spec.target, spec.format), {
      size: NUMERAL_SIZE_MAX,
      weight: 700,
      color: "",
      family,
    });
    if (width > maxWidth) size = Math.min(size, (NUMERAL_SIZE_MAX * maxWidth) / width);
  }
  const fitted = Math.floor(size);
  numeralSizeCache.set(family, fitted);
  return fitted;
};

/** The fallback face has other metrics — re-fit once the real one lands. */
export const clearCounterSizeCache = (): void => {
  numeralSizeCache.clear();
};

/** A stable jagged walk per counter — the shape never changes between renders. */
const SPARKLINES: Record<string, number[]> = Object.fromEntries(
  COUNTERS.map((c) => [
    c.key,
    Array.from({ length: SPARK_POINTS }, (_, i) => {
      const rise = i / (SPARK_POINTS - 1);
      const jag = (random(`spark-${c.key}-${i}`) - 0.5) * 0.9;
      return Math.min(1, Math.max(0, 0.2 + rise * 0.55 + jag * 0.45));
    }),
  ]),
);

const sparkRect = (cell: Rect): Rect => ({
  x: cell.x + cell.w * 0.17,
  y: cell.y + 420,
  w: cell.w * 0.66,
  h: 150,
});

const drawSparkline = (ctx: Ctx2D, env: PaintEnv, cell: Rect, key: string, fraction: number): void => {
  const values = SPARKLINES[key];
  const area = sparkRect(cell);
  const revealed = fraction * (SPARK_POINTS - 1);
  const whole = Math.floor(revealed);

  ctx.save();
  ctx.strokeStyle = env.palette.counterMagenta;
  ctx.lineWidth = 5;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();

  const px = (i: number) => area.x + (area.w * i) / (SPARK_POINTS - 1);
  const py = (v: number) => area.y + area.h * (1 - v);

  if (revealed > 0.02) {
    ctx.moveTo(px(0), py(values[0]));
    for (let i = 1; i <= Math.min(whole, SPARK_POINTS - 1); i++) {
      ctx.lineTo(px(i), py(values[i]));
    }
    const partial = revealed - whole;
    if (partial > 0 && whole + 1 < SPARK_POINTS) {
      ctx.lineTo(
        px(whole + partial),
        py(values[whole] + (values[whole + 1] - values[whole]) * partial),
      );
    }
    ctx.stroke();
  }

  // A faint baseline keeps the sparkline anchored while it is still short.
  ctx.strokeStyle = withAlpha(env.palette.counterMagenta, 0.18);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(area.x, area.y + area.h);
  ctx.lineTo(area.x + area.w, area.y + area.h);
  ctx.stroke();
  ctx.restore();
};

export const CounterBlock: DashboardLayer = {
  name: "CounterBlock",
  paint: (env) => {
    const { ctx, glow, palette, anim, fontFamily } = env;

    COUNTERS.forEach((spec, i) => {
      const cell = COUNTER_CELLS[i];
      const state = anim.counters[i];
      const text = formatCounter(state.value, spec.format);

      const options = {
        size: numeralSize(ctx, fontFamily),
        weight: 700,
        color: palette.counterWhite,
        align: "center" as const,
        baseline: "alphabetic" as const,
        family: fontFamily,
      };
      drawTabular(ctx, text, cell.x + cell.w / 2, cell.y + 340, options);
      // Same numerals into the bloom buffer.
      drawTabular(glow, text, cell.x + cell.w / 2, cell.y + 340, options);

      drawSparkline(ctx, env, cell, spec.key, state.fraction);
    });
  },
};
