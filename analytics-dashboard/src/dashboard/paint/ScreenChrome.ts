/**
 * ScreenChrome — everything in the frame that never changes: the background
 * wash, every panel shell, the chart grid and axis labels, the legend, the
 * counter labels, the side-panel titles and tracks, the world map and the donut
 * track.
 *
 * PERFORMANCE: this whole layer is rasterised exactly once per (buffer size,
 * palette) and cached. Per frame it costs a single `drawImage`. Only the
 * extending lines, the growing bars, the climbing counters, the donut sweep and
 * the ticker are redrawn.
 */

import { ALPHA, type Palette } from "../../variants";
import {
  DESIGN_HEIGHT,
  DESIGN_WIDTH,
  COUNTER_CELLS,
  LAYOUT,
  PANEL_RADIUS,
  type Rect,
} from "../layout";
import {
  COUNTERS,
  DONUT_SEGMENTS,
  MAP_BLOBS,
  SERIES,
  SERIES_POINTS,
  SIDE_PANELS,
  X_LABELS,
  Y_AXIS_MAX,
} from "../data";
import {
  drawPanel,
  drawText,
  roundRectPath,
  withAlpha,
  type Ctx2D,
  type DashboardLayer,
  type PaintEnv,
} from "./utils";

/** x centre of series point `i` inside the plot. */
export const pointX = (i: number): number =>
  LAYOUT.plot.x + (LAYOUT.plot.w * i) / (SERIES_POINTS - 1);

/** y for a data value, inside the plot. */
export const valueY = (value: number): number =>
  LAYOUT.plot.y + LAYOUT.plot.h * (1 - value / Y_AXIS_MAX);

const drawBackground = (ctx: Ctx2D, palette: Palette): void => {
  ctx.fillStyle = palette.backgroundDeep;
  ctx.fillRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);

  // A soft wash from the upper left keeps the flat fill from reading as dead.
  const wash = ctx.createRadialGradient(
    DESIGN_WIDTH * 0.16,
    DESIGN_HEIGHT * 0.08,
    0,
    DESIGN_WIDTH * 0.16,
    DESIGN_HEIGHT * 0.08,
    DESIGN_WIDTH * 0.92,
  );
  wash.addColorStop(0, withAlpha(palette.backgroundWash, 0.85));
  wash.addColorStop(0.55, withAlpha(palette.backgroundWash, 0.24));
  wash.addColorStop(1, withAlpha(palette.backgroundWash, 0));
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
};

const drawChartChrome = (ctx: Ctx2D, palette: Palette, family: string): void => {
  drawPanel(ctx, palette, LAYOUT.chart, ALPHA.panelFill);

  const { plot } = LAYOUT;

  ctx.lineWidth = 1.6;
  ctx.strokeStyle = palette.gridLine;

  // Horizontal grid every 500 units.
  for (let v = 0; v <= Y_AXIS_MAX; v += 500) {
    const y = valueY(v);
    ctx.beginPath();
    ctx.moveTo(plot.x, y);
    ctx.lineTo(plot.x + plot.w, y);
    ctx.stroke();
  }

  // Vertical grid at every x position.
  for (let i = 0; i < SERIES_POINTS; i++) {
    const x = pointX(i);
    ctx.beginPath();
    ctx.moveTo(x, plot.y);
    ctx.lineTo(x, plot.y + plot.h);
    ctx.stroke();
  }

  // Axes sit slightly brighter than the grid.
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = withAlpha(palette.textPale, 0.5);
  ctx.beginPath();
  ctx.moveTo(plot.x, plot.y);
  ctx.lineTo(plot.x, plot.y + plot.h);
  ctx.lineTo(plot.x + plot.w, plot.y + plot.h);
  ctx.stroke();

  // y-axis labels: 0 / 1K / 2K only.
  for (const [value, label] of [
    [0, "0"],
    [1000, "1K"],
    [2000, "2K"],
  ] as const) {
    drawText(ctx, label, plot.x - 40, valueY(value), {
      size: 46,
      weight: 600,
      color: palette.textPale,
      align: "right",
      baseline: "middle",
      family,
    });
  }

  // x-axis labels.
  X_LABELS.forEach((label, i) => {
    if (!label) return;
    drawText(ctx, label, pointX(i), plot.y + plot.h + 62, {
      size: 38,
      weight: 500,
      color: withAlpha(palette.textPale, 0.85),
      align: "center",
      baseline: "top",
      family,
    });
  });

  // Legend: one swatch per series, drawn at the series' own line weight.
  const seriesColor: Record<string, string> = {
    a: palette.seriesMagenta,
    b: palette.seriesBlue,
    c: palette.seriesWhite,
  };
  let cursor = LAYOUT.chartLegend.x + LAYOUT.chartLegend.w * 0.32;
  const legendY = LAYOUT.chartLegend.y + LAYOUT.chartLegend.h / 2;
  for (const series of SERIES) {
    ctx.strokeStyle = seriesColor[series.key];
    ctx.lineWidth = series.weight;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cursor, legendY);
    ctx.lineTo(cursor + 92, legendY);
    ctx.stroke();
    drawText(ctx, series.label, cursor + 116, legendY, {
      size: 40,
      weight: 600,
      color: palette.seriesWhite,
      baseline: "middle",
      family,
    });
    cursor += 116 + 210;
  }

  drawText(ctx, "Traffic Overview", LAYOUT.chart.x + 40, LAYOUT.chartLegend.y + 6, {
    size: 40,
    weight: 700,
    color: withAlpha(palette.textPale, 0.9),
    baseline: "top",
    family,
    letterSpacing: 2,
  });
};

const drawCounterChrome = (ctx: Ctx2D, palette: Palette, family: string): void => {
  drawPanel(ctx, palette, LAYOUT.counterRow, ALPHA.panelFill * 0.8);
  COUNTER_CELLS.forEach((cell, i) => {
    // Thin separators between the cells rather than five boxed panels.
    if (i > 0) {
      ctx.strokeStyle = withAlpha(palette.panelBorder, 0.75);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(cell.x - 15, cell.y + 44);
      ctx.lineTo(cell.x - 15, cell.y + cell.h - 44);
      ctx.stroke();
    }
    drawText(ctx, COUNTERS[i].label, cell.x + cell.w / 2, cell.y + 54, {
      size: 42,
      weight: 600,
      color: palette.textPale,
      align: "center",
      baseline: "top",
      family,
      letterSpacing: 1.5,
    });
  });
};

const drawDonutChrome = (ctx: Ctx2D, palette: Palette, family: string): void => {
  drawPanel(ctx, palette, LAYOUT.donut, ALPHA.panelFill);
  drawText(ctx, "Channel Mix", LAYOUT.donut.x + 36, LAYOUT.donut.y + 34, {
    size: 38,
    weight: 700,
    color: withAlpha(palette.textPale, 0.9),
    baseline: "top",
    family,
    letterSpacing: 2,
  });

  // The empty track the segments sweep into.
  const c = donutCentre();
  ctx.beginPath();
  ctx.arc(c.cx, c.cy, c.radius, 0, Math.PI * 2);
  ctx.lineWidth = c.thickness;
  ctx.strokeStyle = withAlpha(palette.gridLine, 0.85);
  ctx.stroke();

  // Legend swatch column inside the ring.
  const legendTop = c.cy - DONUT_SEGMENTS.length * 26;
  DONUT_SEGMENTS.forEach((segment, i) => {
    const y = legendTop + i * 56;
    ctx.fillStyle = segmentColor(palette, segment.tone);
    ctx.fillRect(c.cx - 130, y - 5, 50, 10);
    drawText(ctx, segment.label, c.cx - 64, y, {
      size: 32,
      weight: 500,
      color: palette.textPale,
      baseline: "middle",
      family,
    });
  });
};

export const segmentColor = (palette: Palette, tone: "accent" | "blue" | "pale"): string =>
  tone === "accent"
    ? palette.seriesMagenta
    : tone === "blue"
      ? palette.seriesBlue
      : withAlpha(palette.seriesWhite, 0.72);

export const donutCentre = (): { cx: number; cy: number; radius: number; thickness: number } => {
  const p = LAYOUT.donut;
  return {
    cx: p.x + p.w / 2,
    cy: p.y + p.h / 2 + 34,
    radius: Math.min(p.w, p.h - 80) * 0.33,
    thickness: 68,
  };
};

/** Row geometry shared between the static tracks and the animated fills. */
export const sideRowRect = (panel: Rect, index: number): Rect => ({
  x: panel.x + 36,
  y: panel.y + 128 + index * 68,
  w: panel.w - 72,
  h: 14,
});

const drawSidePanelChrome = (ctx: Ctx2D, palette: Palette, family: string): void => {
  const shells: Rect[] = [LAYOUT.sideA, LAYOUT.sideB];
  SIDE_PANELS.forEach((spec, panelIndex) => {
    const shell = shells[panelIndex];
    drawPanel(ctx, palette, shell, ALPHA.panelFill);
    drawText(ctx, spec.title, shell.x + 36, shell.y + 30, {
      size: 34,
      weight: 700,
      color: withAlpha(palette.textPale, 0.9),
      baseline: "top",
      family,
      letterSpacing: 2,
    });
    spec.rows.forEach((row, rowIndex) => {
      const track = sideRowRect(shell, rowIndex);
      drawText(ctx, row.label, track.x, track.y - 16, {
        size: 30,
        weight: 500,
        color: palette.textPale,
        baseline: "bottom",
        family,
      });
      drawText(ctx, row.value, track.x + track.w, track.y - 16, {
        size: 30,
        weight: 600,
        color: withAlpha(palette.seriesWhite, 0.9),
        align: "right",
        baseline: "bottom",
        family,
      });
      roundRectPath(ctx, track, track.h / 2);
      ctx.fillStyle = withAlpha(palette.gridLine, 0.9);
      ctx.fill();
    });
  });
};

const drawMapChrome = (ctx: Ctx2D, palette: Palette, family: string): void => {
  const shell = LAYOUT.map;
  drawPanel(ctx, palette, shell, ALPHA.panelFill);
  drawText(ctx, "Regions", shell.x + 36, shell.y + 26, {
    size: 34,
    weight: 700,
    color: withAlpha(palette.textPale, 0.9),
    baseline: "top",
    family,
    letterSpacing: 2,
  });

  const area: Rect = {
    x: shell.x + 36,
    y: shell.y + 92,
    w: shell.w - 72,
    h: shell.h - 128,
  };

  // Sample the blob field on a dot grid. Deliberately low contrast — it is
  // context behind the highlights, not a chart.
  const cols = 74;
  const rows = 34;
  const dot = Math.min(area.w / cols, area.h / rows) * 0.36;
  ctx.fillStyle = withAlpha(palette.seriesBlue, 0.4);
  for (let cx = 0; cx < cols; cx++) {
    for (let cy = 0; cy < rows; cy++) {
      const nx = (cx + 0.5) / cols;
      const ny = (cy + 0.5) / rows;
      const inside = MAP_BLOBS.some(
        (b) => ((nx - b.x) / b.rx) ** 2 + ((ny - b.y) / b.ry) ** 2 <= 1,
      );
      if (!inside) continue;
      ctx.beginPath();
      ctx.arc(area.x + nx * area.w, area.y + ny * area.h, dot, 0, Math.PI * 2);
      ctx.fill();
    }
  }
};

/** The area the world map dots occupy — reused by the animated highlights. */
export const mapArea = (): Rect => ({
  x: LAYOUT.map.x + 36,
  y: LAYOUT.map.y + 92,
  w: LAYOUT.map.w - 72,
  h: LAYOUT.map.h - 128,
});

const drawTickerChrome = (ctx: Ctx2D, palette: Palette): void => {
  const strip = LAYOUT.ticker;
  ctx.fillStyle = withAlpha(palette.panelFill, ALPHA.panelFill + 0.18);
  ctx.fillRect(strip.x, strip.y, strip.w, strip.h);
  ctx.strokeStyle = palette.panelBorder;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, strip.h);
  ctx.lineTo(strip.w, strip.h);
  ctx.stroke();
};

type CacheKey = string;
const chromeCache = new Map<CacheKey, HTMLCanvasElement>();

/**
 * Build (or reuse) the static layer at the buffer's real pixel size, so the
 * blit is 1:1 and nothing softens.
 */
export const getChromeCanvas = (env: PaintEnv): HTMLCanvasElement => {
  const key = `${env.bufferWidth}x${env.bufferHeight}|${env.palette.backgroundDeep}|${env.fontFamily}`;
  const cached = chromeCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = env.bufferWidth;
  canvas.height = env.bufferHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create the static chrome buffer");
  ctx.scale(env.scale, env.scale);

  const { palette, fontFamily } = env;
  drawBackground(ctx, palette);
  drawChartChrome(ctx, palette, fontFamily);
  drawCounterChrome(ctx, palette, fontFamily);
  drawDonutChrome(ctx, palette, fontFamily);
  drawSidePanelChrome(ctx, palette, fontFamily);
  drawMapChrome(ctx, palette, fontFamily);
  drawTickerChrome(ctx, palette);

  chromeCache.set(key, canvas);
  return canvas;
};

/** Drop the cache when the font finishes loading and the chrome must re-typeset. */
export const clearChromeCache = (): void => {
  chromeCache.clear();
};

export const ScreenChrome: DashboardLayer = {
  name: "ScreenChrome",
  paint: (env) => {
    const chrome = getChromeCanvas(env);
    env.ctx.save();
    env.ctx.setTransform(1, 0, 0, 1, 0, 0);
    env.ctx.drawImage(chrome, 0, 0);
    env.ctx.restore();
  },
};

export const PANEL_CORNER = PANEL_RADIUS;
