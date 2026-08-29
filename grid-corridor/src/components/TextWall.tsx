import React, { useMemo } from "react";
import {
  DURATION_IN_FRAMES,
  HEIGHT,
  WALL_BLOCK_HEIGHT,
  WALL_ROTATION_DEG,
  WIDTH,
} from "../constants";
import { LAYER, useRegister, type DrawOp } from "../scene";
import { buildWallSprite } from "../sprites";
import type { Bucket, Palette } from "../variants";

type Props = {
  seed: string;
  palette: Palette;
  bucket: Bucket;
  frame: number;
  fontFamily: string;
};

const RAD = (WALL_ROTATION_DEG * Math.PI) / 180;
/** Enough to cover the frame once the wall is rotated. */
const WALL_WIDTH = Math.ceil(
  Math.abs(WIDTH * Math.cos(RAD)) + Math.abs(HEIGHT * Math.sin(RAD)) + 700,
);
const COVER_HEIGHT = Math.ceil(
  Math.abs(WIDTH * Math.sin(RAD)) + Math.abs(HEIGHT * Math.cos(RAD)) + 400,
);

/**
 * The structure mode of the third version: not a space but a surface. One
 * continuous mass of monospace filling the frame edge to edge at a single flat
 * angle, tiling vertically and scrolling by exactly one block over the loop.
 */
export const TextWall: React.FC<Props> = ({
  seed,
  palette,
  bucket,
  frame,
  fontFamily,
}) => {
  const sprite = useMemo(
    () => buildWallSprite(seed, WALL_WIDTH, palette, fontFamily),
    [seed, palette, fontFamily],
  );

  const scroll = (frame / DURATION_IN_FRAMES) * WALL_BLOCK_HEIGHT;
  const copies = Math.ceil(COVER_HEIGHT / WALL_BLOCK_HEIGHT) + 1;

  const ops: DrawOp[] = [
    {
      order: LAYER.wall,
      bucket: bucket.key,
      alpha: 1,
      fn: (ctx, res) => {
        ctx.setTransform(res, 0, 0, res, 0, 0);
        ctx.translate(WIDTH / 2, HEIGHT / 2);
        ctx.rotate(RAD);
        const x = -WALL_WIDTH / 2;
        const top = -COVER_HEIGHT / 2;
        // Scrolls upward; the block height divides the loop exactly.
        const start =
          Math.floor((top + scroll) / WALL_BLOCK_HEIGHT) * WALL_BLOCK_HEIGHT -
          scroll;
        for (let i = 0; i <= copies; i++) {
          ctx.drawImage(sprite, x, start + i * WALL_BLOCK_HEIGHT);
        }
      },
    },
  ];

  return useRegister("textwall", ops);
};
