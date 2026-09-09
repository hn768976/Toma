import {DURATION} from '../config';
import {loopNoise, rnd, rndInt, rndRange, wrap} from '../rand';
import {laneSpans, smoothstep} from './spans';
import type {DrawCtx} from './types';

/** Scratch lanes hold long-lived artifacts, so each lane gets few spans. */
const SALT = 0x51ca;

/**
 * Vertical scratches: physical damage, so unlike dust they persist for many
 * frames, jitter horizontally by a pixel or two, and fade in and out over
 * their life. A few run only part of the frame height.
 */
export const drawScratches = (d: DrawCtx): void => {
  const {ctx, w, h, s, frame, v} = d;
  if (v.scratchLanes <= 0) {
    return;
  }

  for (let lane = 0; lane < v.scratchLanes; lane++) {
    const spans = laneSpans(v, lane, 3, 6, v.scratchOccupancy, SALT);
    for (const span of spans) {
      if (!span.occupied) {
        continue;
      }
      const age = wrap(frame - span.start, DURATION);
      if (age >= span.length) {
        continue;
      }

      const id = span.id;
      const t = age / span.length;
      // Zero at both ends of the span, so nothing pops in or out.
      const env =
        smoothstep(t / 0.16) *
        smoothstep((1 - t) / 0.16) *
        (0.55 +
          0.45 * loopNoise(v.seed ^ (id * 2654435761), frame, DURATION, 4));

      const alpha = rndRange(0.22, 0.8, v.seed, id, 0x5c11) * env;
      if (alpha <= 0.004) {
        continue;
      }

      const jitterAmp = rndRange(1, 2, v.seed, id, 0x5c12);
      const jitter = Math.round(
        (loopNoise(v.seed ^ (id * 40503), frame, DURATION, 2) * 2 - 1) *
          jitterAmp,
      );
      const x = rndRange(0.02, 0.98, v.seed, id, 0x5c13) * w + jitter;
      // Scratches are rarely perfectly plumb; a slow lean down the frame.
      const tilt = rndRange(-30, 30, v.seed, id, 0x5c14) * s;

      // Roughly a third run only part of the frame height.
      const partial = rnd(v.seed, id, 0x5c15) < 0.34;
      const y0 = partial ? rndRange(0, 0.45, v.seed, id, 0x5c16) * h : 0;
      const y1 = partial ? y0 + rndRange(0.25, 0.7, v.seed, id, 0x5c17) * h : h;

      const grey = rndInt(20, 140, v.seed, id, 0x5c18);
      ctx.strokeStyle = `rgb(${grey},${grey},${grey})`;
      // 1-3 device pixels at every output resolution: this is physical damage.
      ctx.lineWidth = rndRange(1, 3, v.seed, id, 0x5c19);
      ctx.globalAlpha = alpha;

      ctx.beginPath();
      const steps = 8;
      for (let k = 0; k <= steps; k++) {
        const ty = k / steps;
        const py = y0 + (y1 - y0) * ty;
        const px = x + tilt * (py / h);
        if (k === 0) {
          ctx.moveTo(px, py);
        } else {
          ctx.lineTo(px, py);
        }
      }
      ctx.stroke();
    }
  }

  ctx.globalAlpha = 1;
};
