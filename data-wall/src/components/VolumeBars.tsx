import React from "react";
import { useFrameGuard } from "../useCanvas";
import { TILE_COPIES } from "../plane";
import type { Plane } from "../plane";
import { chartBand, slotCount, wrap } from "../chartGeometry";
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

/** Bar width at 4K. Narrower than a candle body, so the two bands read apart. */
const BAR_WIDTH = 14;

/**
 * Thin vertical bars beneath the candles, from their own seeded series, in one
 * colour at reduced opacity. Drawn first so everything else sits above them.
 */
export const VolumeBars: React.FC<Props> = ({
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
  const height = band.volumeBottom - band.volumeTop;
  const slots = slotCount(series, TILE_COPIES.length);

  ctx.globalAlpha = config.volumeAlpha;
  ctx.fillStyle = config.palette.volumeBar;
  for (let i = 0; i < slots; i += 1) {
    const v = series.volume[wrap(i, series.count)];
    const h = v * height;
    ctx.fillRect(
      baseX + i * series.pitch - BAR_WIDTH / 2,
      band.volumeBottom - h,
      BAR_WIDTH,
      h,
    );
  }
  ctx.globalAlpha = 1;

  return null;
};
