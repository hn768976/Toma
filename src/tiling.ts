import {CHART} from './config';
import {candleX} from './draw';
import type {Scene} from './scene';
import {type Candle, formCandle} from './series';

export type Placed = {
  candle: Candle;
  /** chart-space x of the candle centre */
  x: number;
  /** formation progress, 0 just born .. 1 locked */
  t: number;
};

/**
 * Place every candle that is currently on the chart.
 *
 * The series is drawn twice (offset by one series width) so the tile is
 * seamless, and nothing is drawn to the right of the forming edge — a live
 * chart has no candles in the future, which is what leaves room for the order
 * book beside the last price.
 */
export const placeCandles = (scene: Scene): Placed[] => {
  const {series, offsetX, seriesWidth, cfg} = scene;
  const N = series.candles.length;
  const halfW = CHART.width / 2;
  const span = CHART.pitch * CHART.formingSpanCandles;
  const leftLimit = -halfW - CHART.pitch;

  const out: Placed[] = [];
  const kMin = Math.floor((leftLimit - offsetX) / seriesWidth) - 1;
  const kMax = Math.ceil((CHART.formingEdgeX - offsetX) / seriesWidth) + 1;

  for (let k = kMin; k <= kMax; k++) {
    const base = offsetX + k * seriesWidth;
    for (let i = 0; i < N; i++) {
      const x = candleX(i) + base;
      if (x > CHART.formingEdgeX || x < leftLimit) continue;
      const t = (CHART.formingEdgeX - x) / span;
      const candle =
        t >= 1
          ? series.candles[i]
          : formCandle(series.candles[i], t, series.unit, cfg.seed);
      out.push({candle, x, t});
    }
  }
  return out;
};
