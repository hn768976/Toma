import {BASELINE_Y, BEAT_PX, R_AMPLITUDE, TRACE_X0} from './constants';

const gauss = (t: number, mu: number, sigma: number) =>
  Math.exp(-((t - mu) * (t - mu)) / (2 * sigma * sigma));

/** Deterministic value noise so every render produces the identical trace. */
const hash = (n: number) => {
  const s = Math.sin(n * 127.1) * 43758.5453123;
  return s - Math.floor(s);
};

const valueNoise = (x: number) => {
  const i = Math.floor(x);
  const f = x - i;
  const smooth = f * f * (3 - 2 * f);
  return hash(i) * (1 - smooth) + hash(i + 1) * smooth;
};

/**
 * One PQRST complex over a normalised beat phase.
 * Returns amplitude in units of the R spike height (R = 1.0, up is positive).
 */
export const ecgWave = (phase: number): number => {
  const t = phase - Math.floor(phase);
  return (
    0.115 * gauss(t, 0.155, 0.0285) + // P wave
    -0.055 * gauss(t, 0.2455, 0.0075) + // Q
    1.0 * gauss(t, 0.272, 0.0062) + // R spike
    -0.235 * gauss(t, 0.3035, 0.0098) + // S
    0.05 * gauss(t, 0.336, 0.016) + // J point / ST kick
    0.235 * gauss(t, 0.472, 0.047) + // T wave
    0.045 * gauss(t, 0.605, 0.031) // U wave
  );
};

/**
 * Screen-space y for the trace at a given x. The waveform is a function of
 * position, not time, so spikes stay anchored to the same pixels as the
 * cursor sweeps past - exactly as the reference behaves.
 */
export const traceY = (x: number): number => {
  const local = x - TRACE_X0;
  const wave = ecgWave(local / BEAT_PX);
  // Slow baseline wander plus fine sensor noise, both tied to x.
  const wander = (valueNoise(local / 165) - 0.5) * 0.05;
  const noise = (valueNoise(local / 5.5) - 0.5) * 0.022;
  return BASELINE_Y - (wave + wander + noise) * R_AMPLITUDE;
};

/** Sample the trace across [x0, x1] into an SVG path string. */
export const tracePath = (x0: number, x1: number, step = 1.4): string => {
  if (x1 <= x0) return '';
  let d = '';
  for (let x = x0; x < x1; x += step) {
    d += `${d ? 'L' : 'M'}${x.toFixed(2)} ${traceY(x).toFixed(2)}`;
  }
  d += `L${x1.toFixed(2)} ${traceY(x1).toFixed(2)}`;
  return d;
};
