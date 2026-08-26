import type {VariantConfig} from './config';
import type {Painter} from './paint';
import type {Series} from './series';
import type {Theme} from './theme';

export type DrawOp = {z: number; run: () => void};

/**
 * Everything a layer needs for one frame.
 *
 * Layers register a draw op with an explicit z rather than relying on effect
 * ordering, so compositing order is fixed by the layer itself and cannot drift
 * with React's scheduling.
 */
export type Scene = {
  painter: Painter;
  series: Series;
  cfg: VariantConfig;
  theme: Theme;
  frame: number;
  /** chart-space scroll offset, always in (-seriesWidth, 0] */
  offsetX: number;
  seriesWidth: number;
  /** price -> chart-space y */
  yOf: (price: number) => number;
  ops: DrawOp[];
};

export const Z = {
  grid: 10,
  trend: 20,
  volume: 30,
  candles: 40,
  ladder: 50,
} as const;
