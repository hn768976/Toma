import {DURATION} from '../config';
import {rndInt, rndRange, wrap} from '../rand';
import {laneSpans} from './spans';
import type {DrawCtx} from './types';

const MIN_LIFE = 3;
const MAX_LIFE = 8;
/** Hair lanes turn over fast, so each lane is chopped into many short spans. */
const SALT = 0xa17e;

/**
 * Hairs caught in the gate: thin curved lines that outlast dust and flutter
 * very slightly while they are there.
 *
 * Each lane carries at most one hair, so `hairLanes` is a hard ceiling on how
 * many are ever on screen at once. A hair occupies only part of its span, which
 * is where the gaps come from.
 */
export const drawHairs = (d: DrawCtx): void => {
  const {ctx, w, h, s, frame, v} = d;
  if (v.hairLanes <= 0) {
    return;
  }

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let lane = 0; lane < v.hairLanes; lane++) {
    const spans = laneSpans(v, lane, 70, 100, v.hairOccupancy, SALT);
    for (const span of spans) {
      if (!span.occupied) {
        continue;
      }
      const id = span.id;
      const life = Math.min(
        span.length,
        rndInt(MIN_LIFE, MAX_LIFE, v.seed, id, 0xa11),
      );
      const offset = rndInt(0, span.length - life, v.seed, id, 0xa12);
      const age = wrap(frame - span.start, DURATION) - offset;
      if (age < 0 || age >= life) {
        continue;
      }

      const len = Math.max(14, rndRange(60, 200, v.seed, id, 0xa22) * s);
      const dir = rndRange(0, Math.PI * 2, v.seed, id, 0xa33);
      const x0 = rndRange(0.04, 0.96, v.seed, id, 0xa44) * w;
      const y0 = rndRange(0.04, 0.96, v.seed, id, 0xa55) * h;

      // Flutter: a steady drift plus a small per-frame twitch.
      const driftX = rndRange(-0.8, 0.8, v.seed, id, 0xa66) * age;
      const driftY = rndRange(-0.8, 0.8, v.seed, id, 0xa77) * age;
      const twitch = rndRange(-0.6, 0.6, v.seed, id, age, 0xa88);
      const rot = dir + rndRange(-0.02, 0.02, v.seed, id, age, 0xa99);

      // Curl: a perpendicular sine along the hair's length.
      const curls = rndRange(0.25, 1.15, v.seed, id, 0xaaa);
      const amp = len * rndRange(0.08, 0.34, v.seed, id, 0xabb);
      const phase = rndRange(0, Math.PI * 2, v.seed, id, 0xacc);

      const grey = rndInt(15, 90, v.seed, id, 0xadd);
      ctx.strokeStyle = `rgb(${grey},${grey},${grey})`;
      ctx.lineWidth = rndRange(1, 2, v.seed, id, 0xaee);
      // Fade the outer frames of life so a hair does not simply blink out.
      const edge = Math.min(age + 1, life - age) / 2;
      ctx.globalAlpha =
        rndRange(0.45, 0.85, v.seed, id, 0xaff) * Math.min(1, edge);

      const steps = 26;
      ctx.beginPath();
      for (let k = 0; k <= steps; k++) {
        const t = k / steps;
        const along = t * len;
        const perp = amp * Math.sin(t * Math.PI * 2 * curls + phase);
        const px =
          x0 + driftX + twitch + Math.cos(rot) * along - Math.sin(rot) * perp;
        const py = y0 + driftY + Math.sin(rot) * along + Math.cos(rot) * perp;
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
