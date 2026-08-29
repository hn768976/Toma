import React from "react";
import { FONT, Rect, TABLE_SLOTS } from "../layout";
import { MONO, SANS } from "../fonts";
import type { FrameState } from "../lib/frame";
import { Ctx, resetCtx, setFont, withAlpha } from "../lib/canvas";
import { LOOPING_PERIODS, epochAt } from "../lib/schedule";
import { pad, rndInt, rndPick } from "../lib/rand";
import type { VariantConfig } from "../variants";

const ROWS = 9;
/** Relative column starts inside the table's width. */
const COLS = [0, 0.2, 0.36, 0.6, 0.82];

/** Which cells are live. A sparse live set keeps the reroll rate at the
 *  3-5 cells per second the brief asks for rather than a boil. */
const isLive = (row: number, col: number): boolean => (row * 5 + col * 3) % 4 === 1;

const cellText = (
  cfg: VariantConfig,
  seed: string,
  col: number,
  epoch: number,
): string => {
  const L = cfg.labels;
  const k = `${seed}-${epoch}`;
  if (col === 0) return rndPick(k, L.namePool).split(" ")[0];
  if (col === 1) return String(rndInt(k, 1, 9));
  if (col === 2) return rndPick(k, L.codePool).slice(0, 7);
  if (col === 3) {
    return `${pad(rndInt(`${k}-d`, 1, 28), 2)}.${pad(rndInt(`${k}-m`, 1, 12), 2)}.${rndInt(`${k}-y`, 1978, 1998)}`;
  }
  return rndPick(k, L.tokenPool);
};

/**
 * Rows of short label/value pairs in five columns, small enough to read as
 * texture rather than copy. Values reroll on looping epochs; when the alert
 * schedule freezes the tables they simply stop advancing.
 */
export const DataTable: React.FC<{ state: FrameState; index: number }> = ({
  state,
  index,
}) => {
  const { ctx, cfg } = state;
  const p = cfg.palette;
  const rect: Rect = TABLE_SLOTS[index];
  const frame = state.tablesFrozen ? state.tableFreezeFrame : state.frame;

  resetCtx(ctx);
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();

  const dim = state.tablesFrozen ? 0.55 : 1;

  setFont(ctx, { family: MONO, size: FONT.tableTitle, weight: 500 }, 1);
  ctx.fillStyle = withAlpha(p.text, 0.95 * dim);
  ctx.textBaseline = "top";
  ctx.fillText(cfg.labels.tableTitles[index], rect.x + 6, rect.y);

  const headY = rect.y + 42;
  setFont(ctx, { family: MONO, size: FONT.tableHead, weight: 500 }, 0.6);
  ctx.fillStyle = withAlpha(p.text, 0.75 * dim);
  cfg.labels.tableColumns.forEach((c, i) => {
    ctx.fillText(c, rect.x + 6 + COLS[i] * rect.w, headY);
  });

  ctx.strokeStyle = withAlpha(p.panelBorder, 0.45 * dim);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 1; i < COLS.length; i++) {
    const x = Math.round(rect.x + COLS[i] * rect.w - 12) + 0.5;
    ctx.moveTo(x, headY - 8);
    ctx.lineTo(x, rect.y + rect.h - 6);
  }
  ctx.moveTo(rect.x, Math.round(headY + 30) + 0.5);
  ctx.lineTo(rect.x + rect.w, Math.round(headY + 30) + 0.5);
  ctx.stroke();

  const rowTop = headY + 48;
  const rowH = (rect.h - (rowTop - rect.y) - 10) / ROWS;
  setFont(ctx, { family: MONO, size: FONT.tableCell }, 0.4);

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS.length; c++) {
      const seed = `tb-${index}-${r}-${c}`;
      const live = isLive(r, c);
      const period = LOOPING_PERIODS[(r + c * 3) % LOOPING_PERIODS.length];
      const epoch = live ? epochAt(frame, period, (r * 37 + c * 91) % period) : 0;
      const text = cellText(cfg, seed, c, epoch);
      const x = rect.x + 6 + COLS[c] * rect.w;
      const y = rowTop + r * rowH;

      // A scattering of highlighted cells, as on the reference kit.
      const hot = live && (r + c) % 7 === 2;
      if (hot) {
        ctx.fillStyle = withAlpha(p.trace, 0.8 * dim);
        ctx.fillRect(x - 4, y - 2, Math.min(96, rect.w * 0.16), FONT.tableCell + 8);
        ctx.fillStyle = withAlpha(p.background, 0.95);
      } else {
        ctx.fillStyle = withAlpha(p.text, (live ? 0.9 : 0.62) * dim);
      }
      ctx.fillText(text, x, y);
    }
  }

  ctx.restore();
  ctx.textBaseline = "alphabetic";
  return null;
};

/** Shared by the thumbnail list: a tiny left-aligned run of instrument text. */
export const tinyText = (
  ctx: Ctx,
  text: string,
  x: number,
  y: number,
  color: string,
  size = FONT.tiny,
): void => {
  setFont(ctx, { family: SANS, size }, 0.4);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
};
