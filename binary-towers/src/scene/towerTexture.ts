import {
  CELL_H,
  CELL_W,
  CONTENT_STEPS,
  FLIP_PERIODS,
  FONT_SIZE,
  MONO_FAMILY,
  TEX_ROWS,
} from "../constants";
import { hash4 } from "../lib/random";
import { Palette, rampColor } from "./palette";
import { PlaneSpec } from "./layout";

const GLOW_SPRITE = 128;
const glowCache = new Map<string, HTMLCanvasElement>();

/**
 * One soft radial sprite per palette, composited additively behind the hottest
 * characters. This is the whole bloom budget: cheap, and confined to the
 * leading edges so the digits stay readable instead of melting into slabs.
 */
const glowSprite = (p: Palette) => {
  const cached = glowCache.get(p.id);
  if (cached) return cached;
  const c = document.createElement("canvas");
  c.width = GLOW_SPRITE;
  c.height = GLOW_SPRITE;
  const ctx = c.getContext("2d")!;
  const r = GLOW_SPRITE / 2;
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, p.glow);
  g.addColorStop(0.28, p.glow);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = 1;
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, GLOW_SPRITE, GLOW_SPRITE);
  glowCache.set(p.id, c);
  return c;
};

/**
 * Value of one cell at a given content step.
 *
 * Every cell picks a flip period out of FLIP_PERIODS; each of those divides
 * CONTENT_STEPS, so `epoch` advances a whole number of times per loop and the
 * digit content at step s is identical to the content at step s + CONTENT_STEPS.
 */
const cellBit = (planeId: number, row: number, col: number, step: number) => {
  const period = FLIP_PERIODS[Math.floor(hash4(planeId, row, col, 23) * FLIP_PERIODS.length)];
  const phase = Math.floor(hash4(planeId, row, col, 29) * period);
  const epochs = CONTENT_STEPS / period;
  const epoch = Math.floor((step + phase) / period) % epochs;
  return hash4(planeId, row, col, 1013 + epoch) < 0.5 ? "0" : "1";
};

export type TowerCanvas = {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
};

/**
 * Draws one tower's full character grid. The canvas tiles vertically: the plane
 * only shows `visibleRows / TEX_ROWS` of it and the UV offset scrolls, so no
 * mesh is ever created per character.
 */
export const drawTowerCanvas = (
  plane: PlaneSpec,
  palette: Palette,
  step: number,
): TowerCanvas => {
  const width = plane.cols * CELL_W;
  const height = TEX_ROWS * CELL_H;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, width, height);

  const P = plane.headPeriod;
  const sprite = glowSprite(palette);

  // Per-column constants: head phase and an overall dimming, so some columns
  // sit back and the curtain does not read as a flat wall.
  const colPhase: number[] = [];
  const colDim: number[] = [];
  for (let c = 0; c < plane.cols; c++) {
    colPhase.push(Math.floor(hash4(plane.id, c, 11, 0) * P));
    colDim.push(0.62 + hash4(plane.id, c, 13, 0) * 0.38);
  }

  const brightness: number[] = new Array(plane.cols * TEX_ROWS).fill(-1);

  for (let c = 0; c < plane.cols; c++) {
    for (let r = 0; r < TEX_ROWS; r++) {
      if (hash4(plane.id, r, c, 7) < plane.gaps) continue;
      // Distance from this row up to the next head below it: the trail is left
      // behind above the leading edge as the column falls.
      const a = (((colPhase[c] - r) % P) + P) % P;
      let b = a === 0 ? 1 : Math.exp(-a / plane.trail) * 0.84;
      b *= colDim[c] * plane.gain;
      if (hash4(plane.id, r, c, 19) < 0.018) b = Math.max(b, 0.94);
      brightness[c * TEX_ROWS + r] = b;
    }
  }

  // Pass 1 — bloom, additive, hottest characters only.
  ctx.globalCompositeOperation = "lighter";
  for (let c = 0; c < plane.cols; c++) {
    for (let r = 0; r < TEX_ROWS; r++) {
      const b = brightness[c * TEX_ROWS + r];
      if (b < 0.72) continue;
      const x = c * CELL_W + CELL_W / 2;
      const y = r * CELL_H + CELL_H / 2;
      const size = GLOW_SPRITE * (0.5 + (b - 0.72) * 1.7);
      ctx.globalAlpha = 0.09 + (b - 0.72) * 1.25;
      ctx.drawImage(sprite, x - size / 2, y - size / 2, size, size);
    }
  }

  // Pass 2 — the digits themselves.
  ctx.globalCompositeOperation = "source-over";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let c = 0; c < plane.cols; c++) {
    for (let r = 0; r < TEX_ROWS; r++) {
      const b = brightness[c * TEX_ROWS + r];
      if (b < 0) continue;
      ctx.font = `${b > 0.62 ? 700 : 400} ${FONT_SIZE}px "${MONO_FAMILY}", monospace`;
      ctx.fillStyle = rampColor(palette, b);
      ctx.globalAlpha = Math.min(1, 0.62 + b * 0.38);
      ctx.fillText(
        cellBit(plane.id, r, c, step),
        c * CELL_W + CELL_W / 2,
        r * CELL_H + CELL_H / 2,
      );
    }
  }
  ctx.globalAlpha = 1;

  return { canvas, width, height };
};
