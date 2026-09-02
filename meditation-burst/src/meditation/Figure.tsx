import React, { useMemo } from "react";
import { useCanvas } from "../lib/useCanvas";
import { layerStyle } from "./layers";
import {
  breathScale,
  cameraDrift,
  FIGURE_PAD_TOP,
  Layout,
} from "./layout";
import { VariantConfig } from "./variants";

/**
 * The seated figure, as pure silhouette.
 *
 * `public/lotus.svg` carries mid-grey patches in the legs and hands,
 * inherited from the source artwork. Any tonal variation inside the
 * figure would read as a rendering error here — the whole point is a
 * solid form against light — so the raster is flattened with a
 * 'source-in' fill: the SVG's alpha channel is kept (edges stay
 * anti-aliased) and every colour inside it is replaced by the single
 * silhouette colour.
 *
 * The raster is built ONCE and blitted per frame. The only per-frame
 * work is the breath.
 */

/** Hair bun, in fractions of the figure's own bounding box. */
const BUN = { cx: 0.4735, cy: 0.002, rx: 0.056, ry: 0.045 };

export type FigureRaster = {
  canvas: HTMLCanvasElement;
  /** Height of the padded canvas as a multiple of the figure height. */
  heightFactor: number;
};

const rasterCache = new Map<string, FigureRaster>();

/**
 * Rasterises the silhouette into an offscreen canvas with headroom above
 * the figure's own box, so the bun has somewhere to sit.
 */
export const rasterizeFigure = (
  image: HTMLImageElement,
  figureWidth: number,
  figureHeight: number,
  color: string,
): FigureRaster => {
  const key = `${image.src}|${Math.round(figureWidth)}|${Math.round(
    figureHeight,
  )}|${color}`;
  const hit = rasterCache.get(key);
  if (hit) return hit;

  const pad = figureHeight * FIGURE_PAD_TOP;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(figureWidth);
  canvas.height = Math.ceil(figureHeight + pad);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("rasterizeFigure: no 2d context");

  ctx.drawImage(image, 0, pad, figureWidth, figureHeight);

  // Flatten every fill in the source — black body, grey leg and hand
  // patches alike — to one colour, keeping the alpha channel.
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // The hair bun: a small ellipse at the crown in the same fill, sized
  // so it merges into the head's outline rather than sitting on it.
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(
    BUN.cx * figureWidth,
    pad + BUN.cy * figureHeight,
    BUN.rx * figureWidth,
    BUN.ry * figureHeight,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  const raster = { canvas, heightFactor: (figureHeight + pad) / figureHeight };
  rasterCache.set(key, raster);
  return raster;
};

/**
 * Blits the silhouette with its breath applied: a ±0.6% scale
 * oscillation on a 150-frame sine, anchored at the base so the figure
 * never leaves the horizon.
 */
export const paintFigure = (
  ctx: CanvasRenderingContext2D,
  raster: FigureRaster,
  layout: Layout,
  frame: number,
): void => {
  const s = breathScale(frame);
  const w = layout.figureWidth * s;
  const h = layout.figureHeight * raster.heightFactor * s;
  const x = layout.figureLeft + (layout.figureWidth - w) / 2;
  const y = layout.horizonY - h;
  ctx.drawImage(raster.canvas, x, y, w, h);
};

export const Figure: React.FC<{
  config: VariantConfig;
  layout: Layout;
  frame: number;
  image: HTMLImageElement | null;
}> = ({ config, layout, frame, image }) => {
  const raster = useMemo(
    () =>
      image
        ? rasterizeFigure(
            image,
            layout.figureWidth,
            layout.figureHeight,
            config.palette.silhouette,
          )
        : null,
    [image, layout.figureWidth, layout.figureHeight, config.palette.silhouette],
  );

  const ref = useCanvas(layout.width, layout.height, (ctx) => {
    if (!raster) return;
    const drift = cameraDrift(frame);
    ctx.save();
    ctx.translate(drift.x, drift.y);
    paintFigure(ctx, raster, layout, frame);
    ctx.restore();
  });

  return <canvas ref={ref} style={layerStyle("normal")} />;
};
