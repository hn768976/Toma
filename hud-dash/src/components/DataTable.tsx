import React, { useMemo } from "react";
import { random, useCurrentFrame } from "remotion";
import { LOOP } from "../constants";
import { wrap } from "../lib/anim";
import { alpha } from "../lib/color";
import { line, text } from "../lib/draw";
import type { Variant } from "../variants";
import { Layer } from "./Layer";

/** 6 frames per tick -> 5 rerolls a second, and 65 ticks inside the loop. */
const TICK = 6;
const TICKS = LOOP / TICK;

/**
 * Pre-computed reroll schedule: one cell changes per tick, chosen by a stable
 * seed. Every cell's value at every tick is derived, never simulated, and the
 * table state at tick 0 is the state the loop ends on — so it closes cleanly.
 */
const buildSchedule = (cells: number, seed: string): number[][] => {
  const order = Array.from({ length: TICKS }, (_, t) =>
    Math.min(cells - 1, Math.floor(random(`${seed}-pick-${t}`) * cells)),
  );
  const counts = new Array<number>(cells).fill(0);
  for (const c of order) {
    counts[c]++;
  }
  const cur = Array.from({ length: cells }, (_, c) =>
    random(`${seed}-v-${c}-${Math.max(0, counts[c] - 1)}`),
  );
  const idx = new Array<number>(cells).fill(0);
  const frames: number[][] = [];
  for (let t = 0; t < TICKS; t++) {
    const c = order[t];
    cur[c] = random(`${seed}-v-${c}-${idx[c]}`);
    idx[c]++;
    frames.push(cur.slice());
  }
  return frames;
};

/** A grid of numeric values — cols x rows, rerolling a few cells a second. */
export const DataTable: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  seed: string;
  variant: Variant;
}> = ({ x, y, w, h, seed, variant }) => {
  const frame = useCurrentFrame();
  const p = variant.palette;
  const { cols, rows } = variant.panels.table;
  const scale = variant.panels.textScale;
  const schedule = useMemo(
    () => buildSchedule(cols * rows, seed),
    [cols, rows, seed],
  );

  const tick = Math.floor(wrap(frame) / TICK);
  const values = schedule[tick];
  const justChanged = (i: number): boolean =>
    values[i] !== schedule[(tick - 1 + TICKS) % TICKS][i];

  const cw = w / cols;
  const rh = h / rows;
  const size = Math.min(rh * 0.78, 36 * scale);

  return (
    <Layer
      x={x}
      y={y}
      w={w}
      h={h}
      bloom={{ radius: 8, alpha: 0.26 }}
      draw={(ctx) => {
        for (let c = 1; c < cols; c++) {
          line(ctx, c * cw, 0, c * cw, h, alpha(p.panelBorder, 0.4), 2);
        }
        for (let r = 0; r < rows; r++) {
          if (r % 2 === 1) {
            ctx.save();
            ctx.fillStyle = alpha(p.panelBorder, 0.12);
            ctx.fillRect(0, r * rh, w, rh);
            ctx.restore();
          }
          for (let c = 0; c < cols; c++) {
            const i = r * cols + c;
            const v = values[i];
            const hot = justChanged(i);
            if (hot) {
              ctx.save();
              ctx.fillStyle = alpha(p.accent, 0.22);
              ctx.fillRect(c * cw + 2, r * rh + 1, cw - 4, rh - 2);
              ctx.restore();
            }
            text(
              ctx,
              (v * 1000).toFixed(1).padStart(6, "0"),
              c * cw + cw - 10 * scale,
              r * rh + rh / 2,
              {
                size,
                color: hot ? p.textBright : p.textPale,
                weight: hot ? 700 : 500,
                align: "right",
                tabular: true,
              },
            );
          }
        }
      }}
    />
  );
};
