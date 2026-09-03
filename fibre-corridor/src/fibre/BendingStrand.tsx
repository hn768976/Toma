import React, { useLayoutEffect } from "react";
import { mixHex, rgba } from "./color";
import { bucketWeights, chunksOf, fillTapered, type Ctx } from "./draw";
import { clamp, type Strand } from "./geometry";
import type { Scene } from "./scene";

/** Width multiplier of the soft glow pass, relative to the core. */
const GLOW_W = 4.6;
const GLOW_A = 0.055;
const CORE_A = 0.94;

export type Buffers = {
  ctxs: [Ctx, Ctx, Ctx];
};

/**
 * One strand of the field, drawn as a single continuous curve into the three
 * depth buffers.
 *
 * Two passes, composited with 'lighter': a wide soft glow at low alpha, then
 * a thin bright core. A single thick semi-transparent stroke reads flat; the
 * pair is what gives the fibre-optic look. The halo proper is added once per
 * buffer by <StrandComposite>, not once per strand — at 4K a per-strand
 * shadowBlur is unusably slow.
 *
 * The strand is split into short chunks so width, brightness and depth
 * bucket can all vary along its length in ordinary fills.
 */
export const BendingStrand: React.FC<{
  scene: Scene;
  strand: Strand;
  pos: Float64Array;
  buffers: Buffers;
}> = ({ scene, strand, pos, buffers }) => {
  useLayoutEffect(() => {
    const { palette } = scene.variant;
    const glowCol = mixHex(palette.strandBody, palette.strandPale, 0.22);
    const n = strand.samples.length;

    for (const [a, b] of chunksOf(n)) {
      const mid = strand.samples[(a + b) >> 1];
      const w = bucketWeights(mid.d);
      const bright = mid.b * strand.gain;
      const coreCol = mixHex(
        palette.strandPale,
        palette.strandWhite,
        clamp((bright - 0.35) / 0.75, 0, 1),
      );
      for (let k = 0; k < 3; k++) {
        if (w[k] < 0.004) continue;
        const ctx = buffers.ctxs[k];
        fillTapered(
          ctx,
          strand,
          pos,
          a,
          b,
          GLOW_W,
          rgba(glowCol, GLOW_A * bright * w[k]),
        );
        fillTapered(
          ctx,
          strand,
          pos,
          a,
          b,
          1,
          rgba(coreCol, CORE_A * bright * w[k]),
        );
      }
    }
  });

  return null;
};
