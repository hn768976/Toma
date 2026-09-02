import React from "react";
import { Panel } from "./Panel";
import type { Rect } from "../layout";
import { PALETTE, withAlpha } from "../palette";
import { DURATION, TABLE_PERIODS } from "../timing";
import { monoFont, sansFont } from "../fonts";
import { smallCaps } from "@lib/draw/panel-chrome";
import { steppedValue } from "@lib/motion/stepped";
import { pick } from "@lib/random/seeded";
import { panelGrid } from "@lib/draw/grid";

export type DataTableProps = {
  rect: Rect;
  index: number;
  panelCount: number;
  frame: number;
  label: string;
  seed: string;
  columns?: number;
  rows?: number;
  headers?: string[];
};

/**
 * A grid of short values that reroll independently.
 *
 * Each cell gets its own reroll period (75/90/150 frames — all divisors of the
 * loop) and its own offset, so the table averages 6-7 rerolls a second with no
 * visible beat. A cell that has just changed is briefly underlaid, which is
 * what makes the churn readable at a glance.
 */
export const DataTable: React.FC<DataTableProps> = ({
  rect,
  index,
  panelCount,
  frame,
  label,
  seed,
  columns = 3,
  rows = 7,
  headers = ["IDX", "VAL", "REF"],
}) => {
  const drawStatic = (ctx: CanvasRenderingContext2D, inner: Rect) => {
    const colW = inner.w / columns;
    const headH = 40;

    for (let c = 0; c < columns; c++) {
      smallCaps(ctx, headers[c % headers.length], inner.x + colW * c, inner.y + 16, {
        font: sansFont(600, 22),
        color: PALETTE.elementCyan,
      });
    }
    panelGrid(ctx, {
      ...inner,
      columns,
      rows,
      headerHeight: headH,
      colors: {
        headerRule: withAlpha(PALETTE.elementDim, 0.7),
        line: PALETTE.gridLine,
      },
    });
  };

  const drawDynamic = (ctx: CanvasRenderingContext2D, inner: Rect) => {
    const colW = inner.w / columns;
    const headH = 40;
    const rowH = (inner.h - headH) / rows;

    ctx.font = monoFont(500, 26);
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < columns; c++) {
        const cellSeed = `${seed}-c${c}-r${r}`;
        const period = pick(`${cellSeed}-per`, TABLE_PERIODS);
        const offset = Math.floor((r * columns + c) * 13.7) % period;
        const { value, ageInGeneration } = steppedValue({
          frame,
          period,
          loopLength: DURATION,
          seed: cellSeed,
          min: 0,
          max: 9999,
          offset,
        });
        const x = inner.x + colW * c;
        const y = inner.y + headH + rowH * r + rowH / 2;
        const fresh = ageInGeneration < 5;

        if (fresh) {
          ctx.fillStyle = withAlpha(PALETTE.elementCyan, 0.2 * (1 - ageInGeneration / 5));
          ctx.fillRect(x - 8, y - rowH / 2 + 3, colW - 12, rowH - 6);
        }
        ctx.fillStyle = fresh
          ? PALETTE.textBright
          : withAlpha(PALETTE.textPale, c === 1 ? 0.95 : 0.72);
        ctx.fillText(String(Math.floor(value)).padStart(4, "0"), x, y);
      }
    }
  };

  return (
    <Panel
      rect={rect}
      index={index}
      panelCount={panelCount}
      frame={frame}
      label={label}
      drawStatic={drawStatic}
      drawDynamic={drawDynamic}
    />
  );
};
