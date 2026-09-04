import React from 'react';
import { useCurrentFrame } from 'remotion';
import { Layer } from './Layer';

type Props = {
  /** Roughly 0.02 — enough to dither the gradients, not enough to see. */
  amount?: number;
  res?: number;
};

/**
 * Fine grain over the whole frame.
 *
 * Large smooth nebula gradients band badly in H.264; a couple of percent of
 * per-pixel noise dithers the steps away. Judge this on the encoded file, not
 * on the studio preview — the preview never shows the banding it fixes.
 */
export const Grain: React.FC<Props> = ({ amount = 0.022, res = 1 / 2 }) => {
  const frame = useCurrentFrame();

  return (
    <Layer
      res={res}
      opacity={amount}
      blend="overlay"
      draw={(ctx, w, h) => {
        const bw = Math.max(1, Math.round(w * res));
        const bh = Math.max(1, Math.round(h * res));
        const image = ctx.createImageData(bw, bh);
        // One 32-bit store per pixel rather than four byte stores.
        const words = new Uint32Array(image.data.buffer);

        // Inline xorshift, re-seeded from the frame number: deterministic, and
        // fast enough to fill the buffer every frame.
        let s = (frame * 2654435761 + 1013904223) >>> 0;
        for (let i = 0; i < words.length; i++) {
          s ^= s << 13;
          s >>>= 0;
          s ^= s >>> 17;
          s ^= s << 5;
          s >>>= 0;
          const v = 64 + ((s >>> 8) & 127);
          words[i] = 0xff000000 | (v << 16) | (v << 8) | v;
        }

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.putImageData(image, 0, 0);
        ctx.setTransform(bw / w, 0, 0, bh / h, 0, 0);
      }}
    />
  );
};
