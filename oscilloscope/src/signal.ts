/**
 * Waveform generation. Everything in here is a pure function of world-space x,
 * so a frame can be rendered in isolation on any thread: no `Math.random()`,
 * no module-level mutable state, no dependence on the previously drawn frame.
 */

import {
  NOISE_BOTTOM_OCTAVES,
  NOISE_TOP_OCTAVES,
  LOOP_DISTANCE,
  SQUARE_DUTY,
} from "./constants";

/** Positive modulo, so negative world coordinates hash the same as positive. */
const mod = (n: number, m: number) => ((n % m) + m) % m;

/** Integer hash (a 32-bit mix in the style of murmur's finaliser) -> [0, 1). */
const hash = (n: number) => {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x = Math.imul(x ^ (x >>> 16), 0x27d4eb2f);
  return ((x ^ (x >>> 15)) >>> 0) / 4294967296;
};

/**
 * Value noise on a lattice of `step` design px, linearly interpolated so the
 * result keeps the hard corners a raw signal trace has. The lattice index is
 * taken modulo `LOOP_DISTANCE / step`, which is why the noise repeats exactly
 * once per loop instead of drifting.
 */
const valueNoise = (x: number, step: number, seed: number) => {
  const period = LOOP_DISTANCE / step;
  const t = x / step;
  const i = Math.floor(t);
  const f = t - i;
  const a = hash(mod(i, period) * 2654435761 + seed);
  const b = hash(mod(i + 1, period) * 2654435761 + seed);
  return a + (b - a) * f;
};

/** Sums weighted octaves into a signed value in roughly [-1, 1]. */
const fbm = (
  x: number,
  octaves: readonly (readonly [number, number])[],
  seed: number,
) => {
  let sum = 0;
  let weight = 0;
  for (let o = 0; o < octaves.length; o++) {
    const [step, amp] = octaves[o];
    sum += (valueNoise(x, step, seed + o * 101) - 0.5) * 2 * amp;
    weight += amp;
  }
  return sum / weight;
};

export const noiseTop = (x: number) => fbm(x, NOISE_TOP_OCTAVES, 17);
export const noiseBottom = (x: number) => fbm(x, NOISE_BOTTOM_OCTAVES, 883);
/** Low-amplitude fuzz riding on the secondary sine, as in the reference. */
export const sineFuzz = (x: number) =>
  fbm(x, [
    [96, 0.5],
    [32, 0.7],
  ], 4409);

/**
 * World-space sample positions covering the visible window, snapped to a
 * multiple of `step`. Snapping matters: it keeps every polyline vertex on the
 * same world coordinate from frame to frame, so the trace translates instead
 * of crawling.
 */
const worldSamples = (scroll: number, width: number, step: number) => {
  const first = Math.floor(scroll / step) * step - step;
  const last = scroll + width + step;
  const xs: number[] = [];
  for (let x = first; x <= last; x += step) {
    xs.push(x);
  }
  return xs;
};

const toPath = (points: readonly (readonly [number, number])[]) => {
  let d = "";
  for (let i = 0; i < points.length; i++) {
    d += `${i === 0 ? "M" : "L"}${points[i][0].toFixed(1)} ${points[i][1].toFixed(1)}`;
    if (i < points.length - 1) {
      d += " ";
    }
  }
  return d;
};

type WavePath = {
  scroll: number;
  width: number;
  step: number;
  /** y in design px for a given world-space x. */
  valueAt: (worldX: number) => number;
};

/** Builds a screen-space SVG path by walking the visible window in world space. */
export const wavePath = ({ scroll, width, step, valueAt }: WavePath) =>
  toPath(
    worldSamples(scroll, width, step).map(
      (worldX) => [worldX - scroll, valueAt(worldX)] as const,
    ),
  );

/**
 * A square wave drawn from its exact edge positions rather than sampled, so the
 * transitions stay perfectly vertical and the tops perfectly flat at any
 * resolution.
 */
export const squarePath = ({
  scroll,
  width,
  wavelength,
  center,
  amplitude,
}: {
  scroll: number;
  width: number;
  wavelength: number;
  center: number;
  amplitude: number;
}) => {
  const high = center - amplitude;
  const low = center + amplitude;
  const level = (worldX: number) =>
    mod(worldX, wavelength) < wavelength * SQUARE_DUTY ? high : low;

  const points: (readonly [number, number])[] = [];
  const startX = scroll - wavelength;
  points.push([startX - scroll, level(startX)] as const);

  const firstCycle = Math.floor(startX / wavelength);
  const lastCycle = Math.ceil((scroll + width) / wavelength);
  for (let c = firstCycle; c <= lastCycle; c++) {
    const rise = c * wavelength;
    const fall = rise + wavelength * SQUARE_DUTY;
    for (const edge of [rise, fall]) {
      if (edge <= startX || edge > scroll + width + wavelength) {
        continue;
      }
      // Land on the edge at the old level, then step to the new one: two
      // points at the same x is what makes the transition vertical.
      points.push([edge - scroll, level(edge - 0.001)] as const);
      points.push([edge - scroll, level(edge + 0.001)] as const);
    }
  }
  const endX = scroll + width + wavelength;
  points.push([endX - scroll, level(endX)] as const);
  return toPath(points);
};
