import React, { useLayoutEffect, useMemo } from "react";
import { PLANE_TILE } from "./constants";
import { withAlpha } from "../lib/color";
import { FONT_CONDENSED, FONT_MONO } from "./fonts";
import {
  barHeights,
  fieldLabel,
  groupLabel,
  readoutValue,
  stateLabel,
} from "./hud-content";
import { rndInt, rndPick, rndRange } from "../lib/seeded";
import type { HudPlane } from "./hud-plane";

/**
 * A dense row of small illegible readouts, bar groups and tiny labels that
 * runs the full width of the plane and beyond.
 *
 * Content is generated for ONE tile of PLANE_TILE plane-px and repeated. The
 * plane drifts by exactly one tile over the 390 frames, so the strip scrolls
 * for the whole loop and frame 390 lands back on frame 0 pixel for pixel.
 */

type Cell =
  | { kind: "readout"; x: number; w: number; digits: number }
  | { kind: "bars"; x: number; w: number; count: number }
  | { kind: "label"; x: number; w: number }
  | { kind: "kv"; x: number; w: number }
  | { kind: "block"; x: number; w: number };

const KINDS = [
  "readout",
  "bars",
  "label",
  "kv",
  "block",
  "readout",
  "kv",
] as const;

const buildCells = (seed: string, dense: boolean): Cell[] => {
  const cells: Cell[] = [];
  let x = 0;
  let i = 0;
  const gap = dense ? 1 : 2;
  while (x < PLANE_TILE) {
    const kind = rndPick(`${seed}:k:${i}`, KINDS);
    const w = Math.round(
      rndRange(`${seed}:w:${i}`, 74, 168) * (dense ? 1 : 1.35),
    );
    // The last cell is trimmed to the tile so the repeat has no gap.
    const fit = Math.min(w, PLANE_TILE - x);
    if (fit < 40) break;
    if (kind === "readout")
      cells.push({ kind, x, w: fit, digits: rndInt(`${seed}:d:${i}`, 3, 6) });
    else if (kind === "bars")
      cells.push({ kind, x, w: fit, count: rndInt(`${seed}:c:${i}`, 5, 10) });
    else cells.push({ kind, x, w: fit });
    x += fit + rndRange(`${seed}:g:${i}`, 10, 34) * gap;
    i++;
  }
  return cells;
};

export const DataStrip: React.FC<{
  plane: HudPlane;
  /** Plane-space vertical position of the strip's top edge. */
  y: number;
  height: number;
  seed: string;
  frame: number;
  /** Draw two stacked rows instead of one. */
  rows?: number;
}> = ({ plane, y, height, seed, frame, rows = 2 }) => {
  const dense = plane.variant.density === "high";
  const rowCells = useMemo(
    () =>
      Array.from({ length: rows }, (_, r) =>
        buildCells(`${seed}:r${r}`, dense),
      ),
    [seed, rows, dense],
  );

  useLayoutEffect(() => {
    const p = plane.variant.palette;
    const glow = plane.glow;
    const rowH = height / rows;
    const kStart =
      Math.floor((plane.bounds.minX - plane.drift) / PLANE_TILE) - 1;
    const kEnd = Math.ceil((plane.bounds.maxX - plane.drift) / PLANE_TILE) + 1;
    const span = plane.bounds.maxX - plane.bounds.minX + 800;

    plane.paint(
      { u: plane.bounds.minX - 400, v: y, w: span, h: height },
      (ctx, isFirstBand) => {
        for (let r = 0; r < rows; r++) {
          const top = y + r * rowH;
          const cells = rowCells[r];
          // A hairline rule under each row ties the readouts into a strip.
          ctx.strokeStyle = withAlpha(p.panelBorder, 0.32);
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(plane.bounds.minX - 300, top + rowH - 6);
          ctx.lineTo(plane.bounds.maxX + 300, top + rowH - 6);
          ctx.stroke();

          for (let k = kStart; k <= kEnd; k++) {
            const base = k * PLANE_TILE + plane.drift;
            for (let ci = 0; ci < cells.length; ci++) {
              const c = cells[ci];
              const cx = base + c.x;
              // Cell identity is tied to its slot in the tile, never to `k`, so
              // every tile carries the same content and the scroll is seamless.
              const id = `${seed}:r${r}:${ci}`;
              if (c.kind === "readout") {
                ctx.fillStyle = withAlpha(p.textPale, 0.85);
                ctx.font = `500 20px ${FONT_CONDENSED}`;
                ctx.fillText(fieldLabel(`${id}:l`), cx, top + 22);
                ctx.fillStyle = p.textBright;
                ctx.font = `400 30px ${FONT_MONO}`;
                ctx.fillText(
                  readoutValue(id, frame, c.digits),
                  cx,
                  top + rowH - 16,
                );
              } else if (c.kind === "bars") {
                const hs = barHeights(id, frame, c.count);
                const bw = Math.max(4, (c.w - (c.count - 1) * 5) / c.count);
                for (let b = 0; b < c.count; b++) {
                  const bh = (rowH - 26) * hs[b];
                  ctx.fillStyle = withAlpha(p.textPale, 0.5 + hs[b] * 0.45);
                  ctx.fillRect(cx + b * (bw + 5), top + rowH - 12 - bh, bw, bh);
                }
              } else if (c.kind === "label") {
                ctx.fillStyle = withAlpha(p.textPale, 0.72);
                ctx.font = `600 22px ${FONT_CONDENSED}`;
                ctx.fillText(groupLabel(id), cx, top + rowH * 0.62);
              } else if (c.kind === "kv") {
                ctx.fillStyle = withAlpha(p.textPale, 0.8);
                ctx.font = `500 22px ${FONT_CONDENSED}`;
                ctx.fillText(
                  `${fieldLabel(`${id}:k`)} ${stateLabel(`${id}:s`)}`,
                  cx,
                  top + rowH * 0.44,
                );
                ctx.fillStyle = withAlpha(p.textBright, 0.75);
                ctx.font = `400 24px ${FONT_MONO}`;
                ctx.fillText(
                  readoutValue(`${id}:v`, frame, 3),
                  cx,
                  top + rowH * 0.92,
                );
              } else {
                // A handful of blocks take the accent colour. These, plus the
                // accent marks, are the only non-monochrome HUD elements.
                const accent = rndInt(`${id}:acc`, 0, 11) === 0;
                const col = accent ? p.accent : p.panelBorder;
                ctx.fillStyle = withAlpha(col, accent ? 0.7 : 0.3);
                ctx.fillRect(cx, top + 10, c.w, rowH - 26);
                ctx.strokeStyle = withAlpha(col, 0.8);
                ctx.lineWidth = 2;
                ctx.strokeRect(cx, top + 10, c.w, rowH - 26);
                // The strip spans all three depth bands, so this callback
                // runs three times; the bloom accumulator must take the
                // accent block only once.
                if (accent && isFirstBand) {
                  glow.fillStyle = withAlpha(col, 0.4);
                  glow.fillRect(cx, top + 10, c.w, rowH - 26);
                }
              }
            }
          }
        }
      },
    );
  });

  return null;
};
