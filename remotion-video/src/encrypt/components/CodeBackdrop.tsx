import { useMemo } from "react";
import { random } from "remotion";
import type { Buffers } from "../buffers";
import { SOFT_RES, makeCache } from "../buffers";
import { withAlpha } from "../colors";
import { codeLine, garble } from "../content";
import { MONO } from "../fonts";
import type { Layout } from "../layout";
import { applyMatrix } from "../plane";
import type { Painter } from "../painter";
import { LAYER } from "../painter";
import type { ScreenState } from "../state";
import type { Palette } from "../variants";

/**
 * The dense field of illegible machine text the dialog floats on, plus the
 * faint grid across the whole plane.
 *
 * This layer is SUBORDINATE. It is drawn once into two cached canvases —
 * split by depth so the columns near the frame edges land in the softest
 * buffer — and afterwards only blitted, drifting very slowly.
 */

const COLUMN_PITCH = 360;
/** Columns further than this from the plane centre read as "far". */
const FAR_DISTANCE = 1500;
/** The whole layer is held well under the dialog. */
const LAYER_ALPHA = 0.9;
const GRID_PITCH = 165;

type Column = {
  x: number;
  y: number;
  width: number;
  fontSize: number;
  lineHeight: number;
  alpha: number;
  lines: string[];
  depth: "far" | "mid";
};

const buildColumns = (
  x0: number,
  y0: number,
  w: number,
  h: number,
  centreX: number,
): Column[] => {
  const columns: Column[] = [];
  const count = Math.ceil(w / COLUMN_PITCH);
  for (let i = 0; i < count; i++) {
    const seed = `col-${i}`;
    const fontSize = 26 + random(`${seed}-size`) * 13;
    const lineHeight = fontSize * 1.45;
    const x = x0 + i * COLUMN_PITCH + random(`${seed}-x`) * 46;
    const y = y0 + random(`${seed}-y`) * lineHeight * 4 - lineHeight * 2;
    const rows = Math.ceil((h + lineHeight * 4) / lineHeight);
    const lines: string[] = [];
    for (let r = 0; r < rows; r++) {
      // Occasional blank rows keep the columns from reading as a solid slab.
      lines.push(random(`${seed}-blank-${r}`) < 0.12 ? "" : codeLine(`${seed}-${r}`));
    }
    columns.push({
      x,
      y,
      width: COLUMN_PITCH - 30,
      fontSize,
      lineHeight,
      alpha: 0.45 + random(`${seed}-a`) * 0.55,
      lines,
      depth:
        Math.abs(x + COLUMN_PITCH / 2 - centreX) > FAR_DISTANCE ? "far" : "mid",
    });
  }
  return columns;
};

const paintColumns = (
  cache: CanvasRenderingContext2D,
  columns: Column[],
  originX: number,
  originY: number,
  palette: Palette,
): void => {
  cache.setTransform(SOFT_RES, 0, 0, SOFT_RES, -originX * SOFT_RES, -originY * SOFT_RES);
  cache.textBaseline = "top";
  for (const col of columns) {
    cache.font = `400 ${col.fontSize}px ${MONO}`;
    cache.fillStyle = withAlpha(palette.backdropText, col.alpha);
    for (let r = 0; r < col.lines.length; r++) {
      const line = col.lines[r];
      if (line === "") continue;
      cache.fillText(line, col.x, col.y + r * col.lineHeight, col.width);
    }
  }
};

export const CodeBackdrop: React.FC<{
  painter: Painter;
  buffers: Buffers;
  layout: Layout;
  palette: Palette;
  state: ScreenState;
}> = ({ painter, buffers, layout, palette, state }) => {
  const cached = useMemo(() => {
    const { bounds } = layout;
    const centreX = bounds.x0 + bounds.w / 2;
    const columns = buildColumns(
      bounds.x0,
      bounds.y0,
      bounds.w,
      bounds.h,
      centreX,
    );

    const far = makeCache(bounds.w * SOFT_RES, bounds.h * SOFT_RES);
    const mid = makeCache(bounds.w * SOFT_RES, bounds.h * SOFT_RES);

    // The grid sits with the deepest layer, barely above the background.
    far.setTransform(
      SOFT_RES,
      0,
      0,
      SOFT_RES,
      -bounds.x0 * SOFT_RES,
      -bounds.y0 * SOFT_RES,
    );
    far.strokeStyle = withAlpha(palette.gridLine, 0.85);
    far.lineWidth = 2;
    far.beginPath();
    for (let x = bounds.x0; x <= bounds.x1; x += GRID_PITCH) {
      far.moveTo(x, bounds.y0);
      far.lineTo(x, bounds.y1);
    }
    for (let y = bounds.y0; y <= bounds.y1; y += GRID_PITCH) {
      far.moveTo(bounds.x0, y);
      far.lineTo(bounds.x1, y);
    }
    far.stroke();

    paintColumns(
      far,
      columns.filter((c) => c.depth === "far"),
      bounds.x0,
      bounds.y0,
      palette,
    );
    paintColumns(
      mid,
      columns.filter((c) => c.depth === "mid"),
      bounds.x0,
      bounds.y0,
      palette,
    );

    // Only columns that clear the dialog can corrupt visibly, so the failure
    // variant picks its column from those.
    const garbleCandidates = columns.filter(
      (c) => c.x + c.width < layout.dialog.x - 120,
    );

    return { far: far.canvas, mid: mid.canvas, garbleCandidates };
  }, [layout, palette]);

  painter.register("backdrop", LAYER.backdrop, () => {
    const { bounds } = layout;
    // A very slow drift, so the field never sits perfectly still.
    const dx = state.frame * 0.1;
    const dy = state.frame * -0.14;
    const alpha = state.backdropAlpha * LAYER_ALPHA;
    if (alpha <= 0) return;

    for (const [buffer, image] of [
      [buffers.far, cached.far],
      [buffers.mid, cached.mid],
    ] as const) {
      const ctx = buffer.ctx;
      applyMatrix(ctx, buffer.matrix);
      ctx.globalAlpha = alpha;
      ctx.drawImage(
        image,
        bounds.x0 + dx,
        bounds.y0 + dy,
        bounds.w,
        bounds.h,
      );
      ctx.globalAlpha = 1;
    }

    // On failure one column corrupts and keeps re-corrupting every frame.
    if (state.garbleColumn === null || cached.garbleCandidates.length === 0) {
      return;
    }
    const col =
      cached.garbleCandidates[
        state.garbleColumn % cached.garbleCandidates.length
      ];
    const buffer = col.depth === "far" ? buffers.far : buffers.mid;
    const ctx = buffer.ctx;
    applyMatrix(ctx, buffer.matrix);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = palette.backgroundDeep;
    ctx.fillRect(
      col.x + dx - 8,
      bounds.y0 + dy,
      col.width + 22,
      bounds.h,
    );
    ctx.font = `400 ${col.fontSize}px ${MONO}`;
    ctx.textBaseline = "top";
    ctx.fillStyle = withAlpha(palette.backdropText, Math.min(1, col.alpha + 0.3));
    for (let r = 0; r < col.lines.length; r++) {
      ctx.fillText(
        garble(`garble-${state.frame}-${r}`, 14),
        col.x + dx,
        col.y + dy + r * col.lineHeight,
        col.width,
      );
    }
    ctx.globalAlpha = 1;
  });

  return null;
};
