import React from "react";
import { useFrameGuard } from "../useCanvas";
import { TILE_COPIES } from "../plane";
import type { Plane } from "../plane";
import { chartBand, priceToY, slotCount, wrap } from "../chartGeometry";
import type { Series } from "../series";
import type { VariantConfig } from "../variants";

type Props = {
  ctx: CanvasRenderingContext2D;
  plane: Plane;
  series: Series;
  config: VariantConfig;
  baseX: number;
  /** Identifies this frame, so a double render never double-draws. */
  drawKey: string;
};

const LINE_WIDTH = 5;
/** Wide, low-alpha passes under the crisp stroke: cheap, controllable bloom. */
const BLOOM_PASSES = [
  { width: 22, alpha: 0.1 },
  { width: 12, alpha: 0.16 },
];

/**
 * Two or three smooth curves at different smoothing lengths, each a different
 * colour. Because the underlying series is cyclic the averages are too, so the
 * curves redraw smoothly as the plane scrolls and meet themselves at the loop.
 */
export const MovingAverage: React.FC<Props> = ({
  ctx,
  plane,
  series,
  config,
  baseX,
  drawKey,
}) => {
  const shouldDraw = useFrameGuard();
  if (!shouldDraw(drawKey)) return null;

  const band = chartBand(plane);
  const slots = slotCount(series, TILE_COPIES.length);

  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  series.movingAverages.forEach((line, index) => {
    const color = config.palette.maLines[index % config.palette.maLines.length];

    // Quadratic midpoint smoothing: at 4K a 40px-pitch polyline reads as
    // faceted, and these are meant to be curves, not step charts.
    const path = new Path2D();
    const px = (i: number) => baseX + i * series.pitch;
    const py = (i: number) => priceToY(line[wrap(i, series.count)], series, band);
    path.moveTo(px(0), py(0));
    for (let i = 1; i < slots - 1; i += 1) {
      path.quadraticCurveTo(
        px(i),
        py(i),
        (px(i) + px(i + 1)) / 2,
        (py(i) + py(i + 1)) / 2,
      );
    }
    path.lineTo(px(slots - 1), py(slots - 1));

    ctx.strokeStyle = color;
    ctx.globalCompositeOperation = "lighter";
    for (const pass of BLOOM_PASSES) {
      ctx.globalAlpha = pass.alpha;
      ctx.lineWidth = pass.width;
      ctx.stroke(path);
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.lineWidth = LINE_WIDTH;
    ctx.stroke(path);
  });

  return null;
};
