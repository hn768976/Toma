import { useMemo } from "react";
import type { Matrix, PlaneBounds } from "./plane";
import { planeBounds, planeMatrix, planeScaleX, screenToPlane } from "./plane";

export type Rect = { x: number; y: number; w: number; h: number };

export type PanelSpec = Rect & {
  readonly seed: string;
  readonly depth: "far" | "mid";
  /** Frame the panel starts drawing on, during the 30-70 stagger. */
  readonly drawAt: number;
  readonly rows: number;
  readonly bars: number;
};

export type Layout = {
  matrix: Matrix;
  bounds: PlaneBounds;
  dialog: Rect;
  titleBar: Rect;
  body: Rect;
  icon: Rect;
  bar: Rect;
  statusLine: { x: number; y: number; size: number };
  banner: { x: number; y: number; size: number };
  panels: readonly PanelSpec[];
  /** How many plane px map to one screen px horizontally. */
  scale: number;
};

/** Dialog occupies ~46% of the frame width, positioned centre-right. */
const DIALOG_WIDTH_FRACTION = 0.46;
const DIALOG_ASPECT = 1.6;
const TITLE_BAR_FRACTION = 0.11;
const ICON_FRACTION = 0.34;

export const buildLayout = (w: number, h: number): Layout => {
  const matrix = planeMatrix(w, h);
  const bounds = planeBounds(matrix, w, h);
  const scale = planeScaleX(matrix);

  const dw = (DIALOG_WIDTH_FRACTION * w) / scale;
  const dh = dw / DIALOG_ASPECT;
  const centre = screenToPlane(matrix, w * 0.55, h * 0.5);

  const dialog: Rect = {
    x: centre.x - dw / 2,
    y: centre.y - dh / 2,
    w: dw,
    h: dh,
  };

  const titleH = dh * TITLE_BAR_FRACTION;
  const titleBar: Rect = { x: dialog.x, y: dialog.y, w: dw, h: titleH };
  const body: Rect = {
    x: dialog.x,
    y: dialog.y + titleH,
    w: dw,
    h: dh - titleH,
  };

  const iconSize = dh * ICON_FRACTION;
  const icon: Rect = {
    x: dialog.x + dw / 2 - iconSize / 2,
    y: body.y + body.h * 0.4 - iconSize / 2,
    w: iconSize,
    h: iconSize,
  };

  const barW = dw * 0.82;
  const barH = dh * 0.072;
  const bar: Rect = {
    x: dialog.x + dw / 2 - barW / 2,
    y: body.y + body.h * 0.64,
    w: barW,
    h: barH,
  };

  const statusLine = {
    x: dialog.x + dw / 2,
    y: body.y + body.h * 0.87,
    size: dh * 0.062,
  };

  const banner = {
    x: dialog.x + dw / 2,
    y: body.y + body.h * 0.75,
    size: dh * 0.125,
  };

  // Scattered around the dialog at varied depths, staggered on between
  // frames 32 and 66.
  const p = (
    dx: number,
    dy: number,
    pw: number,
    ph: number,
    depth: "far" | "mid",
    drawAt: number,
    rows: number,
    bars: number,
    seed: string,
  ): PanelSpec => ({
    x: centre.x + dx,
    y: centre.y + dy,
    w: pw,
    h: ph,
    depth,
    drawAt,
    rows,
    bars,
    seed,
  });

  const panels: PanelSpec[] = [
    p(-1210, -820, 700, 270, "far", 32, 4, 1, "panel-a"),
    p(-240, -840, 560, 215, "mid", 38, 3, 0, "panel-b"),
    p(640, -830, 640, 300, "mid", 44, 4, 2, "panel-c"),
    p(1010, -180, 380, 540, "far", 50, 6, 0, "panel-d"),
    p(540, 680, 700, 330, "mid", 47, 4, 2, "panel-e"),
    p(-400, 740, 520, 260, "far", 56, 3, 1, "panel-f"),
    p(-1960, 140, 470, 640, "far", 41, 7, 1, "panel-g"),
    p(-1560, 830, 640, 250, "far", 62, 3, 2, "panel-h"),
  ];

  return {
    matrix,
    bounds,
    dialog,
    titleBar,
    body,
    icon,
    bar,
    statusLine,
    banner,
    panels,
    scale,
  };
};

export const useLayout = (w: number, h: number): Layout =>
  useMemo(() => buildLayout(w, h), [w, h]);
