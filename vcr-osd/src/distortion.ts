/**
 * The tape model. Every value here is a pure function of the frame number
 * modulo the composition length, so the last frame hands over cleanly to the
 * first one: events that straddle the seam are wrapped, not clipped.
 *
 * Displacements are expressed in "4K pixels" and multiplied by `unit`
 * (device height / 2160) at the call site, so a tracking jump covers the same
 * fraction of frame at 1080p as it does at 4K. Noise is the deliberate
 * exception — it is generated per device pixel, so the 4K render is finer.
 */

import {hash01, hashSigned, wrappedProgress} from "./noise";

/** Tracking events per loop. */
const TRACK_EVENTS = 18;
/** Tear events per loop — these are aimed at the text block. */
const TEAR_EVENTS = 5;
/** Vertical hold slips per loop. */
const SLIP_EVENTS = 5;

/** Frames between label blinks. Must divide the composition length. */
export const BLINK_INTERVAL = 100;
/** Offset so the loop does not open mid-blink. */
const BLINK_PHASE = 62;

export type RowField = {
  /** Horizontal displacement per output row, in device pixels. */
  shift: Int32Array;
  /** Tracking energy per output row, 0-1: drives chroma split and band noise. */
  energy: Float32Array;
  /** Peak energy anywhere in the frame this frame. */
  peak: number;
};

type Ctx = {
  frame: number;
  period: number;
  dh: number;
  unit: number;
  seed: number;
};

const softEdge = (v: number, edge: number): number =>
  edge <= 0 ? 1 : Math.min(1, v / edge);

/**
 * Horizontal tracking bands plus the harder tear events, resolved into a
 * per-row displacement field.
 */
export const rowField = (
  {frame, period, dh, unit, seed}: Ctx,
  textTop: number,
  textBottom: number,
): RowField => {
  const shift = new Int32Array(dh);
  const energy = new Float32Array(dh);
  let peak = 0;

  for (let k = 0; k < TRACK_EVENTS; k++) {
    const start = Math.floor(
      ((k + hash01(seed, k, 11) * 0.9) * period) / TRACK_EVENTS,
    );
    const duration = 3 + Math.floor(hash01(seed, k, 12) * 10);
    const p = wrappedProgress(frame, start, duration, period);
    if (p < 0) continue;

    // Appear and vanish over the event's few frames.
    const env = Math.pow(Math.sin(Math.PI * p), 0.55);
    const height = (0.008 + hash01(seed, k, 13) * 0.05) * dh;
    // Bands creep down the frame as they play, the way real tracking noise does.
    const drift = (0.02 + hash01(seed, k, 14) * 0.05) * dh * p;
    const centre = hash01(seed, k, 15) * dh + drift;
    const amount = hashSigned(seed, k, 16) * 26 * unit * env;
    const feather = Math.max(1, height * 0.18);

    const y0 = Math.max(0, Math.round(centre - height / 2));
    const y1 = Math.min(dh - 1, Math.round(centre + height / 2));
    for (let y = y0; y <= y1; y++) {
      const e =
        env *
        Math.min(softEdge(y - y0 + 1, feather), softEdge(y1 - y + 1, feather));
      shift[y] += Math.round(amount * e);
      energy[y] = Math.min(1, energy[y] + e);
      if (energy[y] > peak) peak = energy[y];
    }
  }

  // Tears: a hard split somewhere across the word, with everything below the
  // split thrown sideways for two or three frames.
  const span = Math.max(1, textBottom - textTop);
  for (let k = 0; k < TEAR_EVENTS; k++) {
    const start = Math.floor(
      ((k + hash01(seed, k, 21) * 0.85) * period) / TEAR_EVENTS,
    );
    const duration = 2 + Math.floor(hash01(seed, k, 22) * 3);
    const p = wrappedProgress(frame, start, duration, period);
    if (p < 0) continue;

    const cut = Math.round(textTop + hash01(seed, k, 23) * span);
    const amount = Math.round(hashSigned(seed, k, 24) * 70 * unit);
    // Everything below the split is thrown sideways...
    for (let y = cut; y < dh; y++) shift[y] += amount;
    // ...but the noise and the colour split stay at the split itself, so the
    // rest of the frame does not turn into a grey haze for two frames.
    const glow = Math.round(0.05 * dh);
    for (let y = cut; y < Math.min(dh, cut + glow); y++) {
      const e = 0.8 * (1 - (y - cut) / glow);
      energy[y] = Math.min(1, energy[y] + e);
      if (energy[y] > peak) peak = energy[y];
    }
  }

  return {shift, energy, peak};
};

/**
 * Vertical hold: a constant faint breathing plus occasional slips that jump the
 * frame and settle back over a dozen frames. Returned in device pixels.
 */
export const verticalHold = ({
  frame,
  period,
  unit,
  seed,
}: Ctx): number => {
  const t = (2 * Math.PI * frame) / period;
  let offset =
    Math.sin(3 * t) * 0.9 + Math.sin(11 * t + 2.1) * 0.5 + Math.sin(7 * t + 0.4) * 0.4;

  for (let k = 0; k < SLIP_EVENTS; k++) {
    const start = Math.floor(
      ((k + hash01(seed, k, 31) * 0.8) * period) / SLIP_EVENTS,
    );
    const duration = 10 + Math.floor(hash01(seed, k, 32) * 12);
    const p = wrappedProgress(frame, start, duration, period);
    if (p < 0) continue;
    const amplitude = hashSigned(seed, k, 33) * 14;
    // Damped, and exactly zero by the end so the settle is clean.
    offset += amplitude * (1 - p) * Math.exp(-2.4 * p) * Math.cos(p * Math.PI * 3);
  }

  return Math.round(offset * unit);
};

/** Brightness multiplier for the OSD: a short dim every BLINK_INTERVAL frames. */
export const blink = (frame: number): number => {
  const b = (frame + BLINK_PHASE) % BLINK_INTERVAL;
  if (b === 0 || b === 4) return 0.58;
  if (b > 0 && b < 4) return 0.22;
  return 1;
};
