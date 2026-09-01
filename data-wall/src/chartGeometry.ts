import { HEIGHT } from "./plane";
import type { Plane } from "./plane";
import type { Series } from "./series";

/**
 * Where the chart lives on the plane: the lower ~55%, split into a candle
 * band and a volume band beneath it. It runs the full tile width, so it always
 * extends past both side edges of the frame.
 */
export type ChartBand = {
  candleTop: number;
  candleBottom: number;
  volumeTop: number;
  volumeBottom: number;
};

export const chartBand = (plane: Plane): ChartBand => {
  // Vertical placement is measured against what is actually visible at the
  // centre of the frame, not against the full plane: the plane overruns the
  // frame by a long way and the shear pushes plane-y further off screen the
  // further left you go.
  const vy = HEIGHT / 2 / plane.matrix.d;
  const top = -0.18 * vy; // the top of the lower ~55% of the plane
  const bottom = 0.9 * vy; // past the bottom edge, so the bars run off frame
  const h = bottom - top;
  return {
    candleTop: top,
    candleBottom: top + h * 0.52,
    volumeTop: top + h * 0.58,
    volumeBottom: bottom,
  };
};

/** Maps a price into plane y within the candle band. */
export const priceToY = (
  price: number,
  series: Series,
  band: ChartBand,
): number => {
  const t = (price - series.min) / (series.max - series.min);
  return band.candleBottom - t * (band.candleBottom - band.candleTop);
};

/**
 * Total number of candle slots drawn per frame: three tile copies, which is
 * exactly what it takes to cover the frame at any drift offset. Slots that
 * fall outside the canvas cost nothing beyond the clip test.
 */
export const slotCount = (series: Series, copies: number): number =>
  series.count * copies;

/** Positive modulo, for indexing a cyclic series. */
export const wrap = (i: number, n: number): number => ((i % n) + n) % n;
