import React, { useLayoutEffect } from "react";
import { separationOffset, type FrameState, type RenderEnv } from "./env";
import { getSprite } from "./icons";
import type { IconSpec } from "./layout";
import {
  BLOCK,
  CANVAS_H,
  CANVAS_W,
  LOOP_FRAMES,
  depth01,
  depthAlpha,
  depthBucket,
  iconDepthScale,
  localToScreen,
} from "./plane";
import type { IconName, IconState } from "./variants";

const CULL = 550;

/**
 * One icon placement. Takes an icon NAME and a STATE and blits the matching
 * pre-rendered silhouette sprite — the variant decides both, never this
 * component. Handles its own flicker envelope, depth bucketing, brightness
 * boost for bloom, and glitch white-flash.
 */
export const SecurityIcon: React.FC<{
  env: RenderEnv;
  fs: FrameState;
  spec: IconSpec;
  index: number;
  name: IconName;
  state: IconState;
}> = ({ env, fs, spec, index, name, state }) => {
  useLayoutEffect(() => {
    const { geom, frame } = fs;
    const pale = getSprite(env.sprites, name, state, spec.tier);
    const white = getSprite(env.sprites, name, state, "white");
    if (!pale || !white) return;

    // Brief brightening, seeded events wrapped modulo the loop.
    let flick = 0;
    for (const ev of spec.flickers) {
      const dt = (frame - ev.start + LOOP_FRAMES) % LOOP_FRAMES;
      if (dt < ev.dur) flick += Math.sin((Math.PI * dt) / ev.dur);
    }
    if (fs.glitchFlash.has(index)) flick = 1;
    flick = Math.min(1, flick);

    const d = depth01(spec.x, env.cfg.tileScale);
    const bucket = depthBucket(d);
    const ctx =
      bucket === "near"
        ? env.ctx.near
        : bucket === "mid"
          ? env.ctx.mid
          : env.ctx.far;
    const bloom = env.ctx.bloom;
    const size = spec.size * iconDepthScale(d);
    const baseAlpha = depthAlpha(d);
    const bright = spec.tier === "white" || flick > 0.25;

    ctx.setTransform(geom.a, geom.b, geom.c, geom.d, geom.tx, geom.ty);
    bloom.setTransform(geom.a, geom.b, geom.c, geom.d, geom.tx, geom.ty);
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
      const x0 = spec.x + ox - size / 2;
      const y0 = y + oy - size / 2;
      ctx.globalAlpha = baseAlpha * 0.92;
      ctx.drawImage(pale, x0, y0, size, size);
      if (flick > 0) {
        // Crossfade toward the white sprite while flickering.
        ctx.globalAlpha = baseAlpha * flick;
        ctx.drawImage(white, x0, y0, size, size);
      }
      if (bright && bucket !== "mid") {
        // Boost brightness of out-of-focus bright icons so the blur blooms
        // them into soft shapes instead of dimming them.
        ctx.globalAlpha = baseAlpha * 0.35;
        ctx.drawImage(white, x0, y0, size, size);
      }
      if (bright) {
        bloom.globalAlpha = Math.min(1, 0.3 + flick * 0.7) * baseAlpha;
        bloom.drawImage(white, x0, y0, size, size);
      }
    }
    ctx.globalAlpha = 1;
    bloom.globalAlpha = 1;
  }, [env, fs, spec, index, name, state]);
  return null;
};
