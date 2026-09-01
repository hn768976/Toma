import React, { useMemo } from "react";
import { useCurrentFrame } from "remotion";
import { useCanvas, useFrameGuard } from "../useCanvas";
import { HEIGHT, WIDTH, setPlaneTransform, tileBaseX } from "../plane";
import type { Plane } from "../plane";
import { buildSeries } from "../series";
import type { VariantConfig } from "../variants";
import { VolumeBars } from "./VolumeBars";
import { CandleSeries } from "./CandleSeries";
import { MovingAverage } from "./MovingAverage";

type Props = { plane: Plane; config: VariantConfig; variantKey: string };

/**
 * Owns the chart canvas and the price series, and clears the surface during
 * its own render — which React runs before any child renders — so the three
 * drawing components below can simply paint, in order, straight onto it.
 *
 * Keeping candles, volume and averages on one surface rather than three keeps
 * the compositor down to three 4K layers for the whole piece.
 */
export const ChartLayer: React.FC<Props> = ({ plane, config, variantKey }) => {
  const frame = useCurrentFrame();
  const { ctx, mount } = useCanvas(WIDTH, HEIGHT);
  const shouldClear = useFrameGuard();

  const series = useMemo(
    () => buildSeries(plane, config.chart.maLengths),
    [plane, config.chart.maLengths],
  );

  const baseX = tileBaseX(frame, plane);

  if (shouldClear(`${variantKey}:${frame}`)) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    setPlaneTransform(ctx, plane, frame);
  }

  const shared = {
    ctx,
    plane,
    series,
    config,
    baseX,
    drawKey: `${variantKey}:${frame}`,
  };

  return (
    <div
      ref={mount}
      style={{ position: "absolute", inset: 0, opacity: config.chartOpacity }}
    >
      {config.chart.volume ? <VolumeBars {...shared} /> : null}
      {config.chart.candles ? <CandleSeries {...shared} /> : null}
      {config.chart.movingAverages > 0 ? <MovingAverage {...shared} /> : null}
    </div>
  );
};
