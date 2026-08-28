import React, { useLayoutEffect } from "react";
import { separationOffset, type FrameState, type RenderEnv } from "./env";
import type { DotBlockSpec } from "./layout";
import {
  BLOCK,
  CANVAS_H,
  CANVAS_W,
  LOOP_FRAMES,
  depth01,
  depthAlpha,
  depthBucket,
  localToScreen,
  tileDepthScale,
} from "./plane";
import { rand } from "./rng";

const CULL = 450;

/**
 * A small grid of tiny squares — a data patch. Which cells are lit rerolls
 * every `period` frames; periods divide 450 so the loop closes.
 */
export const DotBlock: React.FC<{
  env: RenderEnv;
  fs: FrameState;
  spec: DotBlockSpec;
}> = ({ env, fs, spec }) => {
  useLayoutEffect(() => {
    const { geom, frame } = fs;
    const d = depth01(spec.x, env.cfg.tileScale);
    const bucket = depthBucket(d);
    const ctx =
      bucket === "near"
        ? env.ctx.near
        : bucket === "mid"
          ? env.ctx.mid
          : env.ctx.far;
    const ds = tileDepthScale(d);
    const seg = Math.floor(((frame + spec.phase) % LOOP_FRAMES) / spec.period);
    const cell = spec.cell * ds;
    const pitch = cell * (1 + spec.gap);
    const w = spec.cols * pitch;
    const h = spec.rows * pitch;
    const alpha = depthAlpha(d);

    ctx.setTransform(geom.a, geom.b, geom.c, geom.d, geom.tx, geom.ty);
    for (let k = fs.kMin; k <= fs.kMax; k++) {
      const y = spec.y + k * BLOCK - fs.driftY;
      const [sx, sy] = localToScreen(geom, spec.x, y);
      if (
        sx < -CULL ||
        sx > CANVAS_W + CULL ||
        sy < -CULL ||
        sy > CANVAS_H + CULL
      ) {
        continue;
      }
      const [ox, oy] = separationOffset(fs, sx, sy, spec.sepAmp, spec.sepAngle);
      const x0 = spec.x + ox - w / 2;
      const y0 = y + oy - h / 2;
      for (let i = 0; i < spec.cols; i++) {
        for (let j = 0; j < spec.rows; j++) {
          const idx = j * spec.cols + i;
          const lit =
            rand(`dot-${env.key}-${spec.id}-${seg}-${idx}`) < spec.litFrac;
          ctx.fillStyle = lit
            ? env.cfg.palette.iconWhite
            : env.cfg.palette.iconPale;
          ctx.globalAlpha = (lit ? 0.85 : 0.22) * alpha;
          ctx.fillRect(x0 + i * pitch, y0 + j * pitch, cell, cell);
        }
      }
    }
    ctx.globalAlpha = 1;
  }, [env, fs, spec]);
  return null;
};
