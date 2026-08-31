import { mulberry32 } from "./random";

export type Shock = {
  // Index within the tile where an outsized move lands.
  index: number;
  // Size of that move, as a multiple of `volatility`.
  magnitude: number;
};

// Everything about the shape of the price series is a parameter — the
// three variants differ in these numbers, not in code.
export type SeriesParams = {
  seed: number;
  // Typical size of one candle's move, in price units.
  volatility: number;
  // Mean number of candles in a directional run. Low = choppy and
  // reversal-heavy, high = long trending stretches.
  runLength: number;
  // -1..1. Its sign is the direction of the trend; its magnitude is the
  // chance a trend run simply keeps going instead of giving way to a
  // pullback, which is what keeps the runs irregular. 0 = no trend.
  trendBias: number;
  // 0..1. Damps moves that run against the trend, so pullbacks stay shallow.
  pullbackDamp: number;
  // 0..1. Shortens counter-trend runs, so pullbacks stay brief as well as
  // shallow. 1 leaves them the same length as trend runs.
  pullbackRunScale: number;
  // Chance a candle gets a long wick, and how long that wick runs.
  wickFrequency: number;
  wickScale: number;
  // Wick length every candle gets regardless.
  baseWickScale: number;
  shocks: Shock[];
  // Optional exact net change across one tile. Leave it off and the walk's
  // own net is used as the drift, which is the honest thing to do for a
  // trending series: forcing a smaller net would have to flatten or invert
  // the very runs that make the trend. Set it (to 0) for a range-bound
  // series that should not wander off the top or bottom of the frame.
  netTarget?: number;
};

export type Candle = {
  open: number;
  close: number;
  high: number;
  low: number;
  // Kept so the forming candle's wobble is a stable per-candle amount.
  wobbleAmplitude: number;
  wobblePhase: number;
};

export type Series = {
  candles: Candle[];
  count: number;
  // Net price change across one tile. The series tiles as
  // base[j mod count] + driftPerTile * floor(j / count), so the trend runs
  // on forever while the pattern repeats every `count` candles — which is
  // what makes the scroll loop seamlessly.
  driftPerTile: number;
  // High-to-low extent of one tile, and its midpoint. The price scale is
  // fixed from these once, so it never rescales mid-loop.
  low: number;
  high: number;
  mid: number;
};

const START_PRICE = 100;

// Rescales the up-steps and the down-steps by separate factors so the walk
// nets out to exactly `target` while its gross movement (and therefore its
// candle sizes and its every direction) is preserved. Solving
//   a*U - b*D = target,  a*U + b*D = U + D
// keeps total activity fixed, so no candle changes colour and the chart
// keeps the texture the run parameters gave it.
const retargetNet = (steps: number[], target: number) => {
  let up = 0;
  let down = 0;
  for (const step of steps) {
    if (step >= 0) up += step;
    else down -= step;
  }
  const gross = up + down;
  if (gross === 0 || Math.abs(target) >= gross) return steps;
  const a = up === 0 ? 1 : (gross + target) / (2 * up);
  const b = down === 0 ? 1 : (gross - target) / (2 * down);
  return steps.map((step) => (step >= 0 ? step * a : step * b));
};

export const generateSeries = (params: SeriesParams, count: number): Series => {
  const rand = mulberry32(params.seed);
  const biasSign = params.trendBias === 0 ? -1 : Math.sign(params.trendBias);
  const shockAt: Record<number, number> = {};
  for (const shock of params.shocks) {
    shockAt[shock.index] = shock.magnitude;
  }

  // 1. Walk the closes with the requested character. Runs alternate rather
  // than being re-drawn from a biased coin: a biased coin re-rolled after
  // every short pullback almost always lands back on the trend, which wipes
  // the counter-moves out entirely. Alternating gives a predictable ratio of
  // up to down candles — runLength against runLength * pullbackRunScale —
  // and trendBias supplies the irregularity on top.
  let steps: number[] = [];
  let direction = params.trendBias >= 0 ? 1 : -1;
  let runLeft = 0;
  for (let i = 0; i < count; i++) {
    if (runLeft <= 0) {
      const extendsTrend =
        direction === biasSign &&
        params.trendBias !== 0 &&
        rand() < Math.abs(params.trendBias);
      if (!extendsTrend) direction = -direction;
      const length =
        direction === biasSign && params.trendBias !== 0
          ? params.runLength
          : params.trendBias === 0
            ? params.runLength
            : params.runLength * params.pullbackRunScale;
      runLeft = 1 + Math.floor(rand() * Math.max(1, 2 * length - 1));
    }
    const shock = shockAt[i];
    if (shock === undefined) {
      let step = params.volatility * (0.35 + rand() * 1.35) * direction;
      // A move against the bias is a pullback, and pullbacks stay shallow.
      if (params.trendBias !== 0 && direction !== biasSign) {
        step *= params.pullbackDamp;
      }
      steps.push(step);
    } else {
      // A capitulation: one near-vertical move that overrides the run.
      steps.push(params.volatility * shock * biasSign);
      runLeft = 1;
    }
    runLeft--;
  }

  if (params.netTarget !== undefined) {
    steps = retargetNet(steps, params.netTarget);
  }

  const closes: number[] = [];
  let price = START_PRICE;
  for (const step of steps) {
    price += step;
    closes.push(price);
  }
  const driftPerTile = closes[count - 1] - START_PRICE;

  // 2. Bodies, wicks and the per-candle forming wobble. Candle 0 opens at
  // START_PRICE, which is exactly the previous tile's last close once the
  // tile drift is subtracted — so the seam between tiles is invisible.
  const candles: Candle[] = [];
  for (let i = 0; i < count; i++) {
    const open = i === 0 ? START_PRICE : closes[i - 1];
    const close = closes[i];
    const wickRand = mulberry32(params.seed * 31 + i * 977 + 7);
    const bodyTop = Math.max(open, close);
    const bodyBottom = Math.min(open, close);
    const reference = Math.max(Math.abs(close - open), params.volatility * 0.3);
    const isShock = shockAt[i] !== undefined;

    const wickLength = (roll: number) => {
      const long =
        roll < params.wickFrequency ? wickRand() * params.wickScale : 0;
      return reference * (params.baseWickScale * wickRand() + long);
    };
    const upWick = wickLength(wickRand());
    let downWick = wickLength(wickRand());
    if (isShock) {
      // The capitulation candle gets a long tail beneath it.
      downWick += reference * 0.3;
    }

    candles.push({
      open,
      close,
      high: bodyTop + upWick,
      low: bodyBottom - downWick,
      wobbleAmplitude: params.volatility * (0.5 + wickRand() * 0.7),
      wobblePhase: wickRand() * Math.PI * 2,
    });
  }

  let low = Infinity;
  let high = -Infinity;
  for (const candle of candles) {
    if (candle.low < low) low = candle.low;
    if (candle.high > high) high = candle.high;
  }
  // The forming candle can push briefly past the tile's own range; pad so it
  // never clips against the frame edge.
  const pad = (high - low) * 0.06;
  low -= pad;
  high += pad;

  return {
    candles,
    count,
    driftPerTile,
    low,
    high,
    mid: (low + high) / 2,
  };
};
