import React from 'react';
import { Layer } from './Layer';
import { fbm, orbit, ridge } from '../lib/noise';
import { clamp, smoothstep } from '../lib/rng';
import { ramp, Stop } from '../lib/palette';

type Props = {
  seed: number;
  /** Loop phase in [0,1). */
  t: number;
  /** Density → colour. Put black at t=0 so thin cloud fades out under `screen`. */
  stops: Stop[];
  /** Noise frequency across the frame. Higher = finer, busier cloud. */
  scale?: number;
  /** Domain-warp strength; this is what turns even fog into curling filaments. */
  warp?: number;
  /** How far the sampling window travels on its circle — the billow amount. */
  drift?: number;
  gain?: number;
  contrast?: number;
  /** Strength of the dark dust lanes cut through the cloud. */
  lanes?: number;
  /** Shapes where cloud may exist at all, given normalised coordinates. */
  mask?: (u: number, v: number) => number;
  res?: number;
  opacity?: number;
  blend?: React.CSSProperties['mixBlendMode'];
};

/**
 * Layered stretched noise: bright cores, dark dust lanes, wispy filaments.
 * Entirely procedural — there is no photographic space imagery anywhere in this
 * project.
 *
 * The whole field drifts and billows by orbiting the sampling window around a
 * circle in the noise domain, so it returns exactly to its start at the end of
 * the loop with no cross-fade.
 */
export const NebulaField: React.FC<Props> = ({
  seed,
  t,
  stops,
  scale = 2.6,
  warp = 0.9,
  drift = 0.17,
  gain = 1,
  contrast = 1.5,
  lanes = 0.55,
  mask,
  res = 1 / 8,
  opacity = 1,
  blend = 'screen',
}) => (
  <Layer
    res={res}
    opacity={opacity}
    blend={blend}
    draw={(ctx, w, h) => {
      const bw = Math.max(1, Math.round(w * res));
      const bh = Math.max(1, Math.round(h * res));
      const image = ctx.createImageData(bw, bh);
      const px = image.data;
      const aspect = w / h;

      // Three orbits at different radii and phases: the layers slide over one
      // another instead of translating as a block.
      const o1 = orbit(t, drift, 0);
      const o2 = orbit(t, drift * 0.62, 0.37);
      const o3 = orbit(t, drift * 0.38, 0.71);

      for (let y = 0; y < bh; y++) {
        const v = y / bh;
        const ny = v * scale;
        for (let x = 0; x < bw; x++) {
          const u = x / bw;
          const nx = u * scale * aspect;

          const m = mask ? mask(u, v) : 1;
          let i = (y * bw + x) * 4;
          if (m <= 0.001) {
            px[i] = 0;
            px[i + 1] = 0;
            px[i + 2] = 0;
            px[i + 3] = 255;
            continue;
          }

          // Warp the domain with a coarse field, then read the fine detail from
          // the warped position — the standard way to get filaments rather than
          // isotropic blobs.
          const wx = fbm(nx + o1.x, ny + o1.y, seed, 3) - 0.5;
          const wy = fbm(nx + 5.2 + o2.x, ny + 1.3 + o2.y, seed + 77, 3) - 0.5;

          const fx = nx + wx * warp + o3.x;
          const fy = ny + wy * warp + o3.y;

          const fil = ridge(fx, fy, seed + 31, 4);
          const body = fbm(fx * 0.45 + o1.x * 0.5, fy * 0.45 + o1.y * 0.5, seed + 404, 3);
          const lane = fbm(fx * 1.35 + o2.x, fy * 1.35 + o2.y, seed + 909, 3);

          let d = fil * (0.35 + body * 1.15) * gain * m;
          d *= 1 - lanes * (1 - smoothstep(0.3, 0.62, lane));
          d = clamp(Math.pow(clamp(d), contrast));

          const c = ramp(stops, d);
          px[i] = c[0];
          px[i + 1] = c[1];
          px[i + 2] = c[2];
          px[i + 3] = 255;
        }
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.putImageData(image, 0, 0);
      ctx.setTransform(bw / w, 0, 0, bh / h, 0, 0);
    }}
  />
);
