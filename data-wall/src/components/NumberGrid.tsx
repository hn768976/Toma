import React, { useMemo, useRef } from "react";
import { useCurrentFrame } from "remotion";
import { useCanvas, useFrameGuard } from "../useCanvas";
import { FONT_FAMILY, fontReady } from "../fonts";
import {
  HEIGHT,
  TILE_COPIES,
  WIDTH,
  setPlaneTransform,
  tileBaseX,
} from "../plane";
import type { Plane } from "../plane";
import { buildGrid, cellStateAt, dirtyCellsAt } from "../grid";
import type { Cell, GridModel, Tone } from "../grid";
import type { VariantConfig } from "../variants";

type Props = { plane: Plane; config: VariantConfig; variantKey: string };

/** Right-hand padding inside a cell, as a share of the column pitch. */
const PAD_X = 0.16;

/** Beyond this many frames of drift it is cheaper to relay out the whole tile. */
const MAX_CACHE_GAP = 48;

type TileCache = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  /** Frame the cache currently reflects, or null when it is invalid. */
  frame: number | null;
  /** Whether the cache was laid out in the real webfont. */
  fontOk: boolean;
  key: string;
};

const toneColor = (tone: Tone, flash: boolean, config: VariantConfig): string => {
  const { palette } = config;
  if (flash) return palette.numberBright;
  if (tone === "accent") return palette.numberAccent;
  if (tone === "bright") return palette.numberBright;
  return palette.numberMid;
};

const drawCell = (
  ctx: CanvasRenderingContext2D,
  cell: Cell,
  frame: number,
  plane: Plane,
  config: VariantConfig,
) => {
  const x = cell.col * plane.colPitch;
  const y = cell.row * plane.rowPitch;
  ctx.clearRect(x, y, plane.colPitch, plane.rowPitch);
  if (cell.empty) return;

  const state = cellStateAt(cell, frame);
  const color = toneColor(state.tone, state.flash, config);

  // Moderate bloom, and only on what is already bright: the accent, the
  // bright tone and the three-frame flash. The mid tone stays crisp, which is
  // what keeps the field legible rather than milky.
  const glows = state.flash || state.tone !== "mid";
  ctx.shadowBlur = glows ? (state.flash ? 26 : 14) : 0;
  ctx.shadowColor = glows ? color : "transparent";
  ctx.fillStyle = color;
  ctx.fillText(
    state.value,
    x + plane.colPitch * (1 - PAD_X),
    y + plane.rowPitch / 2,
  );
  ctx.shadowBlur = 0;
};

const redrawAll = (
  cache: TileCache,
  grid: GridModel,
  frame: number,
  plane: Plane,
  config: VariantConfig,
) => {
  cache.ctx.clearRect(0, 0, cache.canvas.width, cache.canvas.height);
  for (const cell of grid.cells) {
    drawCell(cache.ctx, cell, frame, plane, config);
  }
};

/**
 * The texture of the piece: a dense field of percentage values covering the
 * whole plane.
 *
 * Laying out ~700 text cells at 4K every frame is far too expensive, so the
 * grid lives in one offscreen tile canvas that persists across frames. On a
 * normal frame only the handful of cells that reroll — plus the ones whose
 * flash just expired — are cleared and redrawn; the tile is then blitted onto
 * the plane three times to cover the frame.
 */
export const NumberGrid: React.FC<Props> = ({ plane, config, variantKey }) => {
  const frame = useCurrentFrame();
  const { ctx, mount } = useCanvas(WIDTH, HEIGHT);
  const shouldDraw = useFrameGuard();
  const cacheRef = useRef<TileCache | null>(null);

  const grid = useMemo(() => buildGrid(plane, config), [plane, config]);

  if (shouldDraw(`${variantKey}:${frame}`)) {
    const fontOk = fontReady(config.grid.fontSize);

    let cache = cacheRef.current;
    const key = `${variantKey}-${plane.tileW}x${plane.tileH}`;
    if (!cache || cache.key !== key) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(plane.tileW);
      canvas.height = Math.ceil(plane.tileH);
      cache = {
        canvas,
        ctx: canvas.getContext("2d") as CanvasRenderingContext2D,
        frame: null,
        fontOk: false,
        key,
      };
      cacheRef.current = cache;
    }

    cache.ctx.font = `600 ${config.grid.fontSize}px ${FONT_FAMILY}`;
    cache.ctx.textAlign = "right";
    cache.ctx.textBaseline = "middle";

    // A full relayout is needed on the first frame, when the webfont finally
    // arrives, and whenever the cache is too far from the frame being drawn.
    // Remotion hands frames to concurrent workers out of order, so a worker
    // typically steps forward several frames at a time rather than one — the
    // cache catches up by replaying every reroll in the gap, which is still a
    // few dozen cells instead of all seven hundred.
    const gap = cache.frame === null ? Infinity : Math.abs(frame - cache.frame);
    if (gap > MAX_CACHE_GAP || (fontOk && !cache.fontOk)) {
      redrawAll(cache, grid, frame, plane, config);
    } else if (gap > 0) {
      const lo = Math.min(cache.frame as number, frame);
      const hi = Math.max(cache.frame as number, frame);
      const dirty = new Set<number>();
      for (let t = lo + 1; t <= hi; t += 1) {
        for (const index of dirtyCellsAt(grid, t)) dirty.add(index);
      }
      for (const index of dirty) {
        drawCell(cache.ctx, grid.cells[index], frame, plane, config);
      }
    }
    cache.frame = frame;
    cache.fontOk = fontOk;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    setPlaneTransform(ctx, plane, frame);

    const baseX = tileBaseX(frame, plane);

    // Hairline rules, drawn live rather than baked into the tile so that
    // clearing a cell never punches a hole in them.
    ctx.strokeStyle = config.palette.gridRule;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 3;
    ctx.beginPath();
    const left = baseX;
    const right = baseX + TILE_COPIES.length * plane.tileW;
    for (let x = left; x <= right + 0.5; x += plane.colPitch) {
      ctx.moveTo(x, plane.originY);
      ctx.lineTo(x, plane.originY + plane.tileH);
    }
    for (let r = 0; r <= plane.tileRows; r += 1) {
      const y = plane.originY + r * plane.rowPitch;
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;

    for (const k of TILE_COPIES) {
      ctx.drawImage(cache.canvas, baseX + k * plane.tileW, plane.originY);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  return (
    <div
      ref={mount}
      style={{ position: "absolute", inset: 0, opacity: config.numbersOpacity }}
    />
  );
};
