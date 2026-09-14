import { mulberry32 } from "./random";

// A series is a list of y-values in the 0..1 range (0 = bottom of its
// own plot band, 1 = top). Versions map that band onto stage units.
export type Series = number[];

export type SeriesOptions = {
  // Number of samples along the line. More samples = more jitter detail.
  count?: number;
  // Per-step random walk amplitude, before smoothing.
  volatility?: number;
  // Overall drift from start to end, in normalized units.
  trend?: number;
  // Moving-average window; higher is smoother/wavier, lower is noisier.
  smoothing?: number;
  // Where the walk starts, in normalized units.
  start?: number;
};

const movingAverage = (values: number[], window: number) => {
  if (window <= 1) {
    return values;
  }
  const half = Math.floor(window / 2);
  return values.map((_, i) => {
    let sum = 0;
    let n = 0;
    for (let k = i - half; k <= i + half; k++) {
      if (k >= 0 && k < values.length) {
        sum += values[k];
        n++;
      }
    }
    return sum / n;
  });
};

// Builds a smoothed random walk with an optional linear trend, then
// rescales it into 0..1 so callers can place it in any plot band without
// worrying about the raw amplitude.
export const buildSeries = (
  seed: number,
  options: SeriesOptions = {},
): Series => {
  const {
    count = 180,
    volatility = 0.08,
    trend = 0.35,
    smoothing = 5,
    start = 0.5,
  } = options;

  const rand = mulberry32(seed * 7919 + 13);
  const walk: number[] = [];
  let value = start;
  for (let i = 0; i < count; i++) {
    value += (rand() - 0.5) * volatility;
    walk.push(value + (trend * i) / (count - 1));
  }

  const smoothed = movingAverage(walk, smoothing);
  const min = Math.min(...smoothed);
  const max = Math.max(...smoothed);
  const span = max - min || 1;
  return smoothed.map((v) => (v - min) / span);
};

// Adds a fine high-frequency tremble on top of an existing series - the
// references' lines are smooth in the large but visibly noisy up close.
export const addTremble = (
  series: Series,
  seed: number,
  amount: number,
): Series => {
  const rand = mulberry32(seed * 104729 + 7);
  return series.map((v) =>
    Math.min(1, Math.max(0, v + (rand() - 0.5) * amount)),
  );
};

export type PlotBand = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export const pointAt = (series: Series, band: PlotBand, index: number) => {
  const t = index / (series.length - 1);
  return {
    x: band.x + t * band.width,
    y: band.y + band.height - series[index] * band.height,
  };
};

// Straight polyline. The reference lines are dense enough that segment
// joins read as noise rather than as corners, so smoothing the path
// would actually cost detail.
export const seriesPath = (series: Series, band: PlotBand) => {
  return series
    .map((_, i) => {
      const p = pointAt(series, band, i);
      return `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`;
    })
    .join(" ");
};

// Deterministic, finance-looking numbers for tick columns and labels.
export const formatMoney = (value: number, decimals = 2) =>
  value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

export const formatPercent = (value: number) => `${value.toFixed(2)}%`;
