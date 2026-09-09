import {DURATION} from '../config';
import {rnd, rndInt, rndRange, wrap} from '../rand';
import type {DrawCtx} from './types';

/** Dust that persists reads as dirt on the lens, not on the film. */
const MAX_LIFE = 3;

/**
 * Dust and specks.
 *
 * Rather than keeping a particle list (which cannot survive out-of-order frame
 * rendering), each frame looks *backwards* over the last `MAX_LIFE` spawn
 * frames and re-derives what was spawned there. The look-back index is wrapped
 * modulo the duration, so frame 0 inherits the tail of frames 598-599 exactly
 * as frame 600 would.
 */
export const drawDust = (d: DrawCtx): void => {
  const {ctx, w, h, s, frame, v} = d;
  if (v.dustSpawnMax <= 0) {
    return;
  }

  for (let age = 0; age < MAX_LIFE; age++) {
    const spawn = wrap(frame - age, DURATION);
    const count = rndInt(v.dustSpawnMin, v.dustSpawnMax, v.seed, spawn, 0xd05);

    for (let i = 0; i < count; i++) {
      const life = rndInt(1, MAX_LIFE, v.seed, spawn, i, 0xd11);
      if (age >= life) {
        continue;
      }

      const x = rnd(v.seed, spawn, i, 0xd22) * w;
      const y = rnd(v.seed, spawn, i, 0xd33) * h;
      // 2-12px in design space, floored at one whole output pixel so a speck
      // never dissolves into a grey smudge at lower resolutions.
      const size = Math.max(1, rndRange(2, 12, v.seed, spawn, i, 0xd44) * s);
      const grey = rndInt(10, 128, v.seed, spawn, i, 0xd55);

      ctx.fillStyle = `rgb(${grey},${grey},${grey})`;
      ctx.globalAlpha = rndRange(0.72, 1, v.seed, spawn, i, 0xd66);

      if (size < 2) {
        // Snap to the pixel grid; an anti-aliased sub-pixel blob would be grey.
        ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
        continue;
      }

      // Small ragged polygons, never circles.
      const verts = rndInt(4, 7, v.seed, spawn, i, 0xd77);
      const r = size / 2;
      ctx.beginPath();
      for (let k = 0; k < verts; k++) {
        const a =
          (k / verts) * Math.PI * 2 +
          rndRange(-0.45, 0.45, v.seed, spawn, i, k, 0xd88);
        const rk = r * rndRange(0.4, 1.25, v.seed, spawn, i, k, 0xd99);
        const px = x + Math.cos(a) * rk;
        const py = y + Math.sin(a) * rk;
        if (k === 0) {
          ctx.moveTo(px, py);
        } else {
          ctx.lineTo(px, py);
        }
      }
      ctx.closePath();
      ctx.fill();
    }
  }

  ctx.globalAlpha = 1;
};
