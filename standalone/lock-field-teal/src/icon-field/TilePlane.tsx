import React, { useLayoutEffect } from "react";
import { separationOffset, type FrameState, type RenderEnv } from "./env";
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

const CULL = 700;

/**
 * The translucent tile field itself, plus the small plane furniture that
 * lives between the tiles: dashed runs and tiny bright highlight points.
 * Everything is drawn into the three depth buffers under the one plane
 * transform, twice-plus offset by exact BLOCK multiples so the loop closes.
 */
export const TilePlane: React.FC<{ env: RenderEnv; fs: FrameState }> = ({
  env,
  fs,
}) => {
  useLayoutEffect(() => {
    const { geom } = fs;
    const { palette } = env.cfg;
    const buckets = [env.ctx.near, env.ctx.mid, env.ctx.far] as const;
    for (const c of buckets) {
      c.setTransform(geom.a, geom.b, geom.c, geom.d, geom.tx, geom.ty);
      c.globalCompositeOperation = "source-over";
    }
    const pick = (d: number) =>
      depthBucket(d) === "near"
        ? env.ctx.near
        : depthBucket(d) === "mid"
          ? env.ctx.mid
          : env.ctx.far;

    for (let k = fs.kMin; k <= fs.kMax; k++) {
      for (const tile of env.layout.tiles) {
        const y = tile.y + k * BLOCK - fs.driftY;
        const [sx, sy] = localToScreen(geom, tile.x, y);
        if (
          sx < -CULL ||
          sx > CANVAS_W + CULL ||
          sy < -CULL ||
          sy > CANVAS_H + CULL
        ) {
          continue;
        }
        const d = depth01(tile.x, env.cfg.tileScale);
        const ds = tileDepthScale(d);
        const [ox, oy] = separationOffset(fs, sx, sy, tile.sepAmp, tile.sepAngle);
        const ctx = pick(d);
        const w = tile.w * ds;
        const h = tile.h * ds;
        const x0 = tile.x + ox - w / 2;
        const y0 = y + oy - h / 2;
        ctx.globalAlpha = tile.alpha * depthAlpha(d);
        ctx.fillStyle = palette[tile.color];
        ctx.fillRect(x0, y0, w, h);
        if (tile.edges) {
          ctx.globalAlpha = Math.min(1, tile.alpha * 1.9) * depthAlpha(d);
          ctx.strokeStyle = palette.tileLight;
          ctx.lineWidth = 2.6;
          ctx.beginPath();
          if (tile.edges & 1) {
            ctx.moveTo(x0, y0);
            ctx.lineTo(x0 + w, y0);
          }
          if (tile.edges & 2) {
            ctx.moveTo(x0 + w, y0);
            ctx.lineTo(x0 + w, y0 + h);
          }
          if (tile.edges & 4) {
            ctx.moveTo(x0, y0 + h);
            ctx.lineTo(x0 + w, y0 + h);
          }
          if (tile.edges & 8) {
            ctx.moveTo(x0, y0);
            ctx.lineTo(x0, y0 + h);
          }
          ctx.stroke();
        }
      }

      // Dashed runs: short horizontal-reading strokes along the depth axis.
      for (const dash of env.layout.dashes) {
        const y = dash.y + k * BLOCK - fs.driftY;
        const [sx, sy] = localToScreen(geom, dash.x, y);
        if (
          sx < -CULL ||
          sx > CANVAS_W + CULL ||
          sy < -CULL ||
          sy > CANVAS_H + CULL
        ) {
          continue;
        }
        const d = depth01(dash.x, env.cfg.tileScale);
        const ds = tileDepthScale(d);
        const [ox, oy] = separationOffset(fs, sx, sy, dash.sepAmp, dash.sepAngle);
        const ctx = pick(d);
        ctx.globalAlpha = dash.alpha * depthAlpha(d);
        ctx.strokeStyle = env.cfg.palette.outlinePale;
        ctx.lineWidth = dash.lineWidth * ds;
        ctx.setLineDash([dash.dash * ds, dash.dash * 0.8 * ds]);
        ctx.beginPath();
        ctx.moveTo(dash.x + ox - (dash.len * ds) / 2, y + oy);
        ctx.lineTo(dash.x + ox + (dash.len * ds) / 2, y + oy);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Tiny bright points, also fed to the bloom buffer.
      const bloom = env.ctx.bloom;
      bloom.setTransform(geom.a, geom.b, geom.c, geom.d, geom.tx, geom.ty);
      for (const hl of env.layout.highlights) {
        const y = hl.y + k * BLOCK - fs.driftY;
        const [sx, sy] = localToScreen(geom, hl.x, y);
        if (
          sx < -CULL ||
          sx > CANVAS_W + CULL ||
          sy < -CULL ||
          sy > CANVAS_H + CULL
        ) {
          continue;
        }
        const d = depth01(hl.x, env.cfg.tileScale);
        const ds = tileDepthScale(d);
        const [ox, oy] = separationOffset(fs, sx, sy, hl.sepAmp, hl.sepAngle);
        const ctx = pick(d);
        ctx.globalAlpha = hl.alpha * depthAlpha(d);
        ctx.fillStyle = env.cfg.palette.iconWhite;
        ctx.beginPath();
        ctx.arc(hl.x + ox, y + oy, hl.r * ds, 0, Math.PI * 2);
        ctx.fill();
        bloom.globalAlpha = hl.alpha * 0.5 * depthAlpha(d);
        bloom.fillStyle = env.cfg.palette.iconWhite;
        bloom.beginPath();
        bloom.arc(hl.x + ox, y + oy, hl.r * ds * 1.4, 0, Math.PI * 2);
        bloom.fill();
      }
    }
    for (const c of [...buckets, env.ctx.bloom]) c.globalAlpha = 1;
  }, [env, fs]);
  return null;
};
