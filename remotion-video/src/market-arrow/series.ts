import { mulberry32 } from "../particle-ring/random";
import { DOWNTURN, RALLY } from "./constants";

// Every number in both scenes is precomputed once, deterministically,
// at module scope. Remotion renders frames out of order across workers,
// so anything derived from Math.random() per frame would flicker.

// ---------------------------------------------------------------------
// V1 — the plunging ticker
// ---------------------------------------------------------------------

// Value shown at numbered tick `i` of the ruler. Starts at -1,000 and
// subtracts a pseudo-random step per tick, so consecutive readouts
// differ by a few hundred to ~1,000 like the reference.
const DOWNTURN_TICKER: number[] = (() => {
  const rand = mulberry32(0x5eed1);
  const values: number[] = [];
  let value = DOWNTURN.startValue;
  for (let i = 0; i <= DOWNTURN.rulerMajors + 8; i++) {
    values.push(value);
    value -= DOWNTURN.stepMin + rand() * (DOWNTURN.stepMax - DOWNTURN.stepMin);
  }
  return values;
})();

export const downturnValueAt = (majorIndex: number): number =>
  DOWNTURN_TICKER[
    Math.max(0, Math.min(DOWNTURN_TICKER.length - 1, majorIndex))
  ];

// ---------------------------------------------------------------------
// V2 — the jagged trend line
// ---------------------------------------------------------------------

const smoothstep = (t: number) => t * t * (3 - 2 * t);

// Classic value noise: a seeded random value per integer lattice point,
// smoothstep-interpolated between them.
const valueNoise = (x: number, seed: number): number => {
  const i = Math.floor(x);
  const f = x - i;
  const a = mulberry32(i * 374761 + seed * 668265)();
  const b = mulberry32((i + 1) * 374761 + seed * 668265)();
  return a + (b - a) * smoothstep(f);
};

export type TrendPoint = { x: number; index: number };

// The rally chart, in (stage-x, ladder-index) world space. The shape is
// a strong upward drift plus four octaves of noise, with the top two
// octaves left deliberately spiky so the line reads as a tick chart
// rather than a smooth curve.
export const RALLY_TREND: TrendPoint[] = (() => {
  const pointCount = 170;
  const jitter = mulberry32(0x5eed2);
  const points: TrendPoint[] = [];
  for (let p = 0; p < pointCount; p++) {
    const u = p / (pointCount - 1);

    // Drift: a front-loaded climb, so the line has already left the
    // bottom of the ladder by the time the camera starts pulling back
    // and spreads across the frame rather than hugging one corner.
    const drift = -0.5 + 11.5 * Math.pow(u, 0.85);

    // Swings, largest first. Amplitude grows with u so the chart gets
    // more violent as the numbers get bigger — same as the reference.
    // ...tapered over the last stretch so the line lands cleanly on the
    // top rung instead of overshooting out of frame.
    const settle =
      1 - 0.6 * smoothstep(Math.max(0, Math.min(1, (u - 0.85) / 0.15)));
    const swell = (0.3 + 1.35 * u) * settle;
    const wobble =
      (valueNoise(u * 2.6, 11) - 0.5) * 2.4 * swell +
      (valueNoise(u * 6.5, 23) - 0.5) * 1.5 * swell +
      (valueNoise(u * 15.0, 37) - 0.5) * 0.75 * swell +
      (jitter() - 0.5) * 0.22 * swell;

    // One signature drawdown three-quarters of the way in, then the
    // recovery that carries the line to the top rung.
    const dip = -1.8 * Math.exp(-Math.pow((u - 0.76) / 0.05, 2));

    points.push({
      x: RALLY.chartStartX + (RALLY.chartEndX - RALLY.chartStartX) * u,
      index: drift + wobble + dip,
    });
  }
  return points;
})();
