import React from "react";
import { CELL_MATRIX, FONT, STRIP_H } from "../layout";
import { MONO } from "../fonts";
import type { FrameState } from "../lib/frame";
import { mix, resetCtx, setFont, withAlpha } from "../lib/canvas";
import { LOOPING_PERIODS, epochAt } from "../lib/schedule";
import { pad, rnd, rndInt } from "../lib/rand";

const COLS = 26;
const ROWS = 13;

/**
 * An irregular grid of small filled squares at varied brightnesses, like a
 * gel readout. Roughly four cells change per second; under the alert schedule
 * the matrix goes mostly dark and stays that way.
 */
export const CellMatrix: React.FC<{ state: FrameState }> = ({ state }) => {
  const { ctx, cfg, frame, matrixDarkness } = state;
  const p = cfg.palette;
  const r = CELL_MATRIX;

  resetCtx(ctx);
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x + 4, r.y + STRIP_H + 4, r.w - 8, r.h - STRIP_H - 8);
  ctx.clip();

  const gridX = r.x + 22;
  const gridY = r.y + STRIP_H + 22;
  const gridW = r.w * 0.665;
  const gridH = r.h - STRIP_H - 44;
  const cw = gridW / COLS;
  const ch = gridH / ROWS;

  for (let cx = 0; cx < COLS; cx++) {
    for (let cy = 0; cy < ROWS; cy++) {
      // Only a fraction of the grid is ever occupied, which is what gives the
      // matrix its irregular, sample-like look.
      if (rnd(`cm-on-${cx}-${cy}`) > 0.46) continue;

      const period = LOOPING_PERIODS[(cx * 5 + cy * 3) % LOOPING_PERIODS.length];
      const live = (cx * 7 + cy * 11) % 5 === 0;
      const epoch = live ? epochAt(frame, period, (cx * 61 + cy * 17) % period) : 0;
      const k = `cm-${cx}-${cy}-${epoch}`;

      // Once the matrix starts going dark only the brightest cells survive.
      const survives = rnd(`cm-keep-${cx}-${cy}`) > matrixDarkness * 0.97;
      if (!survives) continue;

      const level = 0.12 + 0.88 * rnd(`${k}-v`) ** 1.6;
      const size = Math.min(cw, ch) * (0.44 + 0.5 * rnd(`${k}-s`));
      const pale = rnd(`${k}-p`) > 0.86;
      ctx.fillStyle = pale
        ? withAlpha(mix(p.cell, p.tracePale, 0.7), level)
        : withAlpha(mix(p.cellDim, p.cell, level), 0.4 + 0.6 * level);
      ctx.fillRect(
        gridX + cx * cw + (cw - size) / 2,
        gridY + cy * ch + (ch - size) / 2,
        size,
        size,
      );
    }
  }

  // The column of tiny tag/value pairs down the right of the panel.
  setFont(ctx, { family: MONO, size: FONT.tiny }, 0.4);
  ctx.textBaseline = "top";
  const tagX = r.x + r.w * 0.72;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 2; col++) {
      const period = LOOPING_PERIODS[(row + col * 2) % LOOPING_PERIODS.length];
      const epoch = epochAt(frame, period, (row * 43 + col * 71) % period);
      const k = `cmt-${row}-${col}-${epoch}`;
      ctx.fillStyle = withAlpha(p.text, 0.72);
      ctx.fillText(
        `${cfg.labels.matrixTag} - ${pad(rndInt(`${k}-a`, 10, 99), 2)}/${pad(rndInt(`${k}-b`, 10, 99), 2)}`,
        tagX + col * 110,
        gridY + 12 + row * 40,
      );
    }
  }

  ctx.restore();
  ctx.textBaseline = "alphabetic";
  return null;
};
