import React, { useMemo } from "react";
import type { ElementRenderProps, Measurer } from "../layout";
import { THEME } from "../theme";
import type { StrokeSet } from "../theme";
import {
  ctxOf,
  cycleIndex,
  hLine,
  makeCanvas,
  pick,
  rnd,
  rndInt,
  REROLL_PERIODS,
} from "../draw/util";
import { HudCanvas } from "./canvas";
import { condensedFont, monoFont } from "../fonts";

const TABLE_W = 490;
const TITLE_H = 34;
const ROW_H = 26;
const PAD = 10;

const dims = (config: { rows?: number; columns?: number }) => ({
  rows: config.rows ?? 10,
  columns: config.columns ?? 3,
});

export const measureDataTable: Measurer = ({ config, scale }) => {
  const d = dims(config);
  return {
    w: Math.round(TABLE_W * scale),
    h: Math.round((TITLE_H + PAD * 2 + d.rows * ROW_H) * scale),
  };
};

type Cell = { period: number; phase: number };

const cellValue = (seed: string, r: number, c: number, index: number) => {
  const style = rnd(`${seed}-cs-${r}-${c}`);
  if (style < 0.34) {
    return String(rndInt(`${seed}-v-${r}-${c}-${index}`, 0, 999)).padStart(3, "0");
  }
  if (style < 0.68) {
    return rndInt(`${seed}-h-${r}-${c}-${index}`, 16, 255).toString(16).toUpperCase().padStart(2, "0");
  }
  return String(rndInt(`${seed}-n-${r}-${c}-${index}`, 10, 99));
};

const rowLabel = (seed: string, r: number) =>
  `${pick(`${seed}-la-${r}`, ["H", "C", "N", "D", "S", "L", "T", "P", "K", "R", "Z"] as const)}${rndInt(`${seed}-lb-${r}`, 10, 99)}`;

export const DataTable: React.FC<ElementRenderProps> = ({
  frame,
  scale,
  stroke,
  config,
  width,
  height,
  dimmed,
}) => {
  const d = dims(config);
  const valueFont = Math.round(14 * scale);
  const labelFont = Math.round(16 * scale);

  // Roughly 40% of the cells reroll, which lands the table at 2-4 changes a
  // second. Every period divides 600, so the schedule closes the loop.
  const cells = useMemo(() => {
    const map: (Cell | null)[][] = [];
    for (let r = 0; r < d.rows; r++) {
      const row: (Cell | null)[] = [];
      for (let c = 0; c < d.columns; c++) {
        const live = rnd(`${config.seed}-live-${r}-${c}`) < 0.4;
        row.push(
          live
            ? {
                period: pick(`${config.seed}-p-${r}-${c}`, REROLL_PERIODS),
                phase: rndInt(`${config.seed}-ph-${r}-${c}`, 0, 599),
              }
            : null,
        );
      }
      map.push(row);
    }
    return map;
  }, [config.seed, d.rows, d.columns]);

  const colX = useMemo(
    () =>
      Array.from(
        { length: d.columns },
        (_, c) => Math.round(((c + 1) / d.columns) * (TABLE_W - 130) * scale) + Math.round(120 * scale),
      ),
    [d.columns, scale],
  );

  const chrome = useMemo(() => {
    const canvas = makeCanvas(width, height);
    const ctx = ctxOf(canvas);
    const s: StrokeSet = stroke;

    ctx.fillStyle = THEME.textDim;
    ctx.font = condensedFont(Math.round(21 * scale), 500);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(config.title ?? "SECTOR", 0, Math.round(20 * scale));

    ctx.strokeStyle = THEME.dim;
    ctx.lineWidth = s.structure;
    hLine(ctx, 0, width, TITLE_H * scale);
    hLine(ctx, 0, width, height - s.structure);

    const top = (TITLE_H + PAD) * scale;
    ctx.font = monoFont(labelFont, 500);
    for (let r = 0; r < d.rows; r++) {
      const y = top + r * ROW_H * scale + labelFont;
      ctx.fillStyle = THEME.textDim;
      ctx.textAlign = "left";
      ctx.fillText(rowLabel(config.seed, r), 0, y);
    }

    ctx.font = monoFont(valueFont);
    ctx.textAlign = "right";
    for (let r = 0; r < d.rows; r++) {
      for (let c = 0; c < d.columns; c++) {
        if (cells[r]?.[c]) {
          continue;
        }
        const y = top + r * ROW_H * scale + valueFont;
        ctx.globalAlpha = rnd(`${config.seed}-a-${r}-${c}`) < 0.2 ? 0.95 : 0.5;
        ctx.fillStyle = THEME.textDim;
        ctx.fillText(cellValue(config.seed, r, c, 0), colX[c] as number, y);
      }
    }

    return canvas;
  }, [width, height, scale, stroke, config.seed, config.title, d.rows, d.columns, cells, colX, labelFont, valueFont]);

  const draw = (ctx: CanvasRenderingContext2D) => {
    ctx.globalAlpha = dimmed ? 0.3 : 1;
    ctx.drawImage(chrome, 0, 0);

    const base = dimmed ? 0.3 : 1;
    const top = (TITLE_H + PAD) * scale;
    ctx.font = monoFont(valueFont);
    ctx.textAlign = "right";
    ctx.textBaseline = "alphabetic";

    for (let r = 0; r < d.rows; r++) {
      for (let c = 0; c < d.columns; c++) {
        const cell = cells[r]?.[c];
        if (!cell) {
          continue;
        }
        const index = cycleIndex(frame, cell.period, cell.phase);
        const y = top + r * ROW_H * scale + valueFont;
        ctx.globalAlpha = (rnd(`${config.seed}-a-${r}-${c}`) < 0.2 ? 0.95 : 0.62) * base;
        ctx.fillStyle = THEME.textWhite;
        ctx.fillText(cellValue(config.seed, r, c, index), colX[c] as number, y);
      }
    }

    ctx.globalAlpha = 1;
  };

  return <HudCanvas width={width} height={height} draw={draw} />;
};
