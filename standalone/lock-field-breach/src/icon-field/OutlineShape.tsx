import React, { useLayoutEffect } from "react";
import { separationOffset, type FrameState, type RenderEnv } from "./env";
import type { OutlineSpec } from "./layout";
import {
  BLOCK,
  CANVAS_H,
  CANVAS_W,
  depth01,
  depthAlpha,
  depthBucket,
  localToScreen,
  tileDepthScale,
} from "./plane";

const CULL = 900;

/**
 * A thin unfilled rounded rectangle or large ellipse, drawn across several
 * tiles at once.
 */
export const OutlineShape: React.FC<{
  env: RenderEnv;
  fs: FrameState;
  spec: OutlineSpec;
}> = ({ env, fs, spec }) => {
  useLayoutEffect(() => {
    const { geom } = fs;
    const d = depth01(spec.x, env.cfg.tileScale);
    const bucket = depthBucket(d);
    const ctx =
      bucket === "near"
        ? env.ctx.near
        : bucket === "mid"
          ? env.ctx.mid
          : env.ctx.far;
    const ds = tileDepthScale(d);
    const w = spec.w * ds;
    const h = spec.h * ds;

    ctx.setTransform(geom.a, geom.b, geom.c, geom.d, geom.tx, geom.ty);
    ctx.strokeStyle = env.cfg.palette.outlinePale;
    ctx.lineWidth = spec.lineWidth * ds;
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
      ctx.globalAlpha = spec.alpha * depthAlpha(d);
      ctx.beginPath();
      if (spec.kind === "rect") {
        ctx.roundRect(spec.x + ox - w / 2, y + oy - h / 2, w, h, 26 * ds);
      } else {
        ctx.ellipse(spec.x + ox, y + oy, w / 2, h / 2, 0, 0, Math.PI * 2);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }, [env, fs, spec]);
  return null;
};
