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

/** Body and wick widths at 4K: thin bodies, prominent wicks. */
const BODY_WIDTH = 16;
const WICK_WIDTH = 3;
/** A body this thin would vanish; give doji candles a visible bar. */
const MIN_BODY = 3;

export const CandleSeries: React.FC<Props> = ({
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
  const { candleUp, candleDown } = config.palette;

  for (let i = 0; i < slots; i += 1) {
    const candle = series.candles[wrap(i, series.count)];
    const x = baseX + i * series.pitch;
    const color = candle.up ? candleUp : candleDown;

    const yHigh = priceToY(candle.high, series, band);
    const yLow = priceToY(candle.low, series, band);
    const yOpen = priceToY(candle.open, series, band);
    const yClose = priceToY(candle.close, series, band);

    ctx.fillStyle = color;
    ctx.fillRect(x - WICK_WIDTH / 2, yHigh, WICK_WIDTH, yLow - yHigh);

    const top = Math.min(yOpen, yClose);
    const bodyHeight = Math.max(MIN_BODY, Math.abs(yClose - yOpen));
    ctx.fillRect(x - BODY_WIDTH / 2, top, BODY_WIDTH, bodyHeight);
  }

  return null;
};
