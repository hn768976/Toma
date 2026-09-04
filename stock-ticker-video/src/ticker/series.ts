import { mulberry32 } from "./random";

export type Shock = {
  /** Where the shock starts, as a fraction of the session. */
  at: number;
  /** How many minutes it plays out over. */
  span: number;
  /** Total relative move, e.g. -0.018 for a 1.8% drop. */
  pct: number;
};

export type SeriesConfig = {
  seed: number;
  points: number;
  /** Yesterday's closing price — the dotted reference line. */
  prevClose: number;
  /** Gap between the previous close and the opening print. */
  openGap: number;
  /** Total drift applied evenly across the session, before shocks. */
  drift: number;
  /** Per-minute noise amplitude. */
  vol: number;
  shocks: Shock[];
};

/** Half-cosine ramp: a shock that starts and ends without a corner. */
const rampWeight = (t: number): number =>
  t <= 0 ? 0 : t >= 1 ? 1 : 0.5 - 0.5 * Math.cos(Math.PI * t);

/**
 * A seeded random walk with a configured drift and a handful of scripted
 * shocks. Deterministic, so every frame — and the readout that reads off it —
 * sees exactly the same numbers. No real market data is involved.
 */
export const buildSeries = (config: SeriesConfig): number[] => {
  const { seed, points, prevClose, openGap, drift, vol, shocks } = config;
  const rand = mulberry32(seed);

  // Per-step shock increments, precomputed so the walk stays a single pass.
  const shockStep = new Array<number>(points).fill(0);
  for (const shock of shocks) {
    const start = Math.round(shock.at * (points - 1));
    const span = Math.max(1, Math.round(shock.span));
    let previous = 0;
    for (let k = 1; k <= span; k += 1) {
      const index = start + k;
      if (index >= points) break;
      const weight = rampWeight(k / span);
      shockStep[index] += shock.pct * (weight - previous);
      previous = weight;
    }
  }

  const driftStep = drift / (points - 1);
  const values = new Array<number>(points);
  let price = prevClose * (1 + openGap);
  values[0] = price;

  for (let i = 1; i < points; i += 1) {
    const noise = (rand() * 2 - 1) * vol;
    // A touch of mean reversion keeps the walk from wandering off the plot
    // while leaving the minute-to-minute texture intact.
    const pull = (values[i - 1] / (prevClose * (1 + openGap)) - 1) * -0.0015;
    price *= 1 + driftStep + shockStep[i] + noise + pull;
    values[i] = price;
  }

  return values;
};

/** The "9:31 AM" style clock label for a point index into the session. */
export const minuteLabel = (
  indexFromOpen: number,
  sessionOpenMinutes: number,
): string => {
  const total = sessionOpenMinutes + indexFromOpen;
  const hour24 = Math.floor(total / 60) % 24;
  const minute = total % 60;
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
};

/** The "10 AM" style label used on the time axis. */
export const hourLabel = (hour24: number): string => {
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12} ${suffix}`;
};
