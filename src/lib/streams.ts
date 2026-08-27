import type {MaskField} from './mask';
import {rnd, rndInt, rndRange, rndSigned} from './rng';
import {clamp, CANVAS_W, MASK_TO_CANVAS, smoothstep} from './space';

export const STREAM_COUNT = 7;
const PER_STREAM = 140;
/** Every travel cycle divides 480, so a particle is mid-path at the same place each loop. */
const TRAVEL_PERIODS = [120, 160, 240] as const;

/** A cubic run from the back of the skull out past the right frame edge. */
export type Stream = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  x3: number;
  y3: number;
};

export type StreamField = {
  streams: Stream[];
  count: number;
  streamIdx: Uint8Array;
  phase: Float32Array;
  period: Float32Array;
  /** Sideways offset from the path centre-line, giving the ribbon thickness. */
  offset: Float32Array;
  radius: Float32Array;
  bright: Float32Array;
  /** 0 accent, 1 white. */
  colorIdx: Uint8Array;
};

/**
 * Emission points on the rear silhouette of the skull: the right-hand edge of
 * the widest run on each of a handful of rows through the upper head.
 */
const rearSkullPoints = (field: MaskField, n: number): [number, number][] => {
  const h = field.bbox.y1 - field.bbox.y0;
  const top = field.bbox.y0 + h * 0.12;
  const bottom = field.bbox.y0 + h * 0.46;
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const y = Math.round(top + ((bottom - top) * i) / Math.max(1, n - 1));
    const bounds = field.runs[clamp(y, 0, field.h - 1)];
    let bestRight = -1;
    let bestWidth = -1;
    for (let j = 0; j < bounds.length; j += 2) {
      const width = bounds[j + 1] - bounds[j];
      if (width > bestWidth) {
        bestWidth = width;
        bestRight = bounds[j + 1];
      }
    }
    if (bestRight < 0) continue;
    out.push([bestRight * MASK_TO_CANVAS, y * MASK_TO_CANVAS]);
  }
  return out;
};

export const buildStreams = (field: MaskField, seedPrefix: string): StreamField => {
  const origins = rearSkullPoints(field, STREAM_COUNT);
  const streams: Stream[] = origins.map(([x0, y0], i) => {
    const s = `${seedPrefix}:stream:${i}`;
    const dx = CANVAS_W + 320 - x0;
    const fan = (i - (origins.length - 1) / 2) * 210 + rndSigned(`${s}:fan`, 130);
    return {
      x0,
      y0,
      x1: x0 + dx * 0.22,
      y1: y0 + rndSigned(`${s}:c1`, 190),
      x2: x0 + dx * 0.62,
      y2: y0 + fan * 0.55 + rndSigned(`${s}:c2`, 230),
      x3: x0 + dx,
      y3: y0 + fan,
    };
  });

  const count = streams.length * PER_STREAM;
  const field2: StreamField = {
    streams,
    count,
    streamIdx: new Uint8Array(count),
    phase: new Float32Array(count),
    period: new Float32Array(count),
    offset: new Float32Array(count),
    radius: new Float32Array(count),
    bright: new Float32Array(count),
    colorIdx: new Uint8Array(count),
  };

  for (let i = 0; i < count; i++) {
    const s = `${seedPrefix}:sp${i}`;
    field2.streamIdx[i] = Math.floor(i / PER_STREAM);
    field2.phase[i] = rnd(`${s}:ph`);
    field2.period[i] = TRAVEL_PERIODS[rndInt(`${s}:tp`, TRAVEL_PERIODS.length)];
    field2.offset[i] = rndSigned(`${s}:off`, 26);
    field2.radius[i] = 2.6 + Math.pow(rnd(`${s}:r`), 2) * 4;
    field2.bright[i] = rndRange(`${s}:b`, 0.35, 1);
    field2.colorIdx[i] = rnd(`${s}:c`) < 0.2 ? 1 : 0;
  }

  return field2;
};

/** Position on a stream plus the unit normal, for the sideways offset. */
export const streamPoint = (
  s: Stream,
  t: number,
): {x: number; y: number; nx: number; ny: number} => {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  const x = a * s.x0 + b * s.x1 + c * s.x2 + d * s.x3;
  const y = a * s.y0 + b * s.y1 + c * s.y2 + d * s.y3;

  const da = 3 * u * u;
  const db = 6 * u * t;
  const dc = 3 * t * t;
  const tx = da * (s.x1 - s.x0) + db * (s.x2 - s.x1) + dc * (s.x3 - s.x2);
  const ty = da * (s.y1 - s.y0) + db * (s.y2 - s.y1) + dc * (s.y3 - s.y2);
  const len = Math.hypot(tx, ty) || 1;
  return {x, y, nx: -ty / len, ny: tx / len};
};

/** Bright at the skull, gone before the frame edge. */
export const streamFade = (t: number): number =>
  smoothstep(0, 0.05, t) * (1 - smoothstep(0.5, 0.98, t));
