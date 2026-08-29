import React, { useMemo } from "react";
import {
  CELL_MATRIX,
  CORNER_TICK,
  BORDER_W,
  FONT,
  HEIGHT,
  INDICATOR_PANELS,
  Rect,
  SPECTRUM,
  STRIP_H,
  TABLE_PANEL,
  THUMB_PANEL,
  WAVE_PANELS,
  WIDTH,
  wavePlot,
} from "../layout";
import { MONO, SANS } from "../fonts";
import type { FrameState } from "../lib/frame";
import {
  Ctx,
  cornerTicks,
  resetCtx,
  setFont,
  strokeRect,
  withAlpha,
} from "../lib/canvas";
import type { VariantConfig } from "../variants";

/** Panel fill, 2px border, corner ticks and the tiny top label strip. */
export const drawPanelChrome = (
  ctx: Ctx,
  r: Rect,
  cfg: VariantConfig,
  strip: string,
  tag?: string,
): void => {
  const p = cfg.palette;
  ctx.fillStyle = p.panelFill;
  ctx.fillRect(r.x, r.y, r.w, r.h);

  ctx.fillStyle = withAlpha(p.panelBorder, 0.16);
  ctx.fillRect(r.x + BORDER_W, r.y + BORDER_W, r.w - BORDER_W * 2, STRIP_H);

  strokeRect(ctx, r, p.panelBorder, BORDER_W);
  cornerTicks(ctx, r, withAlpha(p.panelBorder, 0.75), CORNER_TICK, BORDER_W);

  ctx.textBaseline = "middle";
  setFont(ctx, { family: SANS, size: FONT.strip, weight: 500 }, 2.4);
  ctx.fillStyle = withAlpha(p.text, 0.92);
  ctx.fillText(strip, r.x + 18, r.y + BORDER_W + STRIP_H / 2 + 1);

  if (tag) {
    setFont(ctx, { family: MONO, size: FONT.tiny }, 0);
    ctx.textAlign = "right";
    ctx.fillStyle = withAlpha(p.text, 0.7);
    ctx.fillText(tag, r.x + r.w - 60, r.y + BORDER_W + STRIP_H / 2 + 1);
    ctx.textAlign = "left";
  }

  // The short dash that sits at the right end of every strip.
  ctx.strokeStyle = withAlpha(p.text, 0.8);
  ctx.lineWidth = BORDER_W;
  ctx.beginPath();
  ctx.moveTo(r.x + r.w - 46, r.y + BORDER_W + STRIP_H / 2);
  ctx.lineTo(r.x + r.w - 18, r.y + BORDER_W + STRIP_H / 2);
  ctx.stroke();
  ctx.textBaseline = "alphabetic";
};

/** The faint internal grid of a waveform panel. */
const drawGrid = (ctx: Ctx, r: Rect, cfg: VariantConfig): void => {
  ctx.save();
  ctx.strokeStyle = cfg.palette.gridLine;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  const cols = 10;
  const rows = 4;
  for (let i = 1; i < cols; i++) {
    const x = Math.round(r.x + (r.w * i) / cols) + 0.5;
    ctx.moveTo(x, r.y);
    ctx.lineTo(x, r.y + r.h);
  }
  for (let i = 1; i < rows; i++) {
    const y = Math.round(r.y + (r.h * i) / rows) + 0.5;
    ctx.moveTo(r.x, y);
    ctx.lineTo(r.x + r.w, y);
  }
  ctx.stroke();
  ctx.restore();
};

const buildStaticLayer = (cfg: VariantConfig): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d") as Ctx;
  resetCtx(ctx);

  const p = cfg.palette;
  const L = cfg.labels;
  ctx.fillStyle = p.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  drawPanelChrome(ctx, THUMB_PANEL, cfg, L.thumbPanelTitle);
  drawPanelChrome(ctx, TABLE_PANEL, cfg, L.panelStrip);

  WAVE_PANELS.forEach((r, i) => {
    drawPanelChrome(ctx, r, cfg, L.waveformCodes[i]);
    const plot = wavePlot(r);
    drawGrid(ctx, plot, cfg);
    // The two-letter channel label, upper-left inside the plot.
    setFont(ctx, { family: SANS, size: FONT.waveId, weight: 500 }, 1);
    ctx.fillStyle = withAlpha(p.tracePale, 0.95);
    ctx.textBaseline = "top";
    ctx.fillText(L.waveformIds[i], plot.x + 26, plot.y + 44);
    ctx.textBaseline = "alphabetic";
  });

  drawPanelChrome(ctx, CELL_MATRIX, cfg, L.matrixTitle);
  drawPanelChrome(ctx, SPECTRUM, cfg, L.spectrumTitle);
  INDICATOR_PANELS.forEach((r, i) => {
    drawPanelChrome(ctx, r, cfg, L.indicatorTitles[i]);
  });

  return canvas;
};

/**
 * Blits the memoised static layer. Everything that never moves — background,
 * panel fills, borders, corner ticks, grids and fixed labels — is rasterised
 * exactly once and copied in a single drawImage each frame.
 */
export const PanelChrome: React.FC<{ state: FrameState }> = ({ state }) => {
  const { ctx, cfg, alert } = state;
  const layer = useMemo(() => buildStaticLayer(cfg), [cfg]);

  resetCtx(ctx);
  ctx.drawImage(layer, 0, 0);

  // An alert repaints one panel's border in the readout red for a few frames.
  if (alert) {
    const r = WAVE_PANELS[alert.target];
    resetCtx(ctx);
    strokeRect(ctx, r, cfg.palette.readoutValue, BORDER_W * 2);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    strokeRect(ctx, r, withAlpha(cfg.palette.readoutValue, 0.35), BORDER_W * 8);
    ctx.restore();
  }

  return null;
};
