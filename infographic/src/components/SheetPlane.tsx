import React, { useLayoutEffect, useMemo, useRef } from "react";
import { random } from "remotion";
import type { Variant } from "../theme";
import {
  applyMatrix,
  blurForBucket,
  CANVAS_H,
  CANVAS_W,
  DEPTH_BUCKETS,
  type DepthBucket,
  type Matrix,
} from "../plane";
import { makeCanvas, withAlpha, type Ctx } from "../draw/primitives";
import { PlaneContext, type PlaneApi } from "./PlaneContext";

const GRAIN_TILE = 512;

/**
 * Runs before every sibling's layout effect: wipes the depth buffers and lays
 * the ground in. The paper's tonal variation is painted in sheet space so it
 * drifts with the document, and the ground fills the whole canvas so no page
 * edge is ever visible.
 */
const PlaneReset: React.FC<{
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  buffers: Record<DepthBucket, Ctx>;
  variant: Variant;
  matrix: Matrix;
}> = ({ canvasRef, buffers, variant, matrix }) => {
  useLayoutEffect(() => {
    for (const b of DEPTH_BUCKETS) {
      buffers[b].setTransform(1, 0, 0, 1, 0, 0);
      buffers[b].clearRect(0, 0, CANVAS_W, CANVAS_H);
    }
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) {
      return;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.filter = "none";
    ctx.fillStyle = variant.palette.background;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.save();
    applyMatrix(ctx, matrix);
    const grad = ctx.createLinearGradient(-3600, -2400, 3200, 2400);
    grad.addColorStop(0, withAlpha(variant.palette.paperShade, 0));
    grad.addColorStop(
      0.42,
      withAlpha(variant.palette.paperShade, variant.finish.paperShadeAlpha),
    );
    grad.addColorStop(0.72, withAlpha(variant.palette.paperShade, 0));
    grad.addColorStop(
      1,
      withAlpha(
        variant.palette.paperShade,
        variant.finish.paperShadeAlpha * 0.7,
      ),
    );
    ctx.fillStyle = grad;
    ctx.fillRect(-6000, -4000, 12000, 8000);

    const blot = ctx.createRadialGradient(1500, -900, 100, 1500, -900, 2600);
    blot.addColorStop(
      0,
      withAlpha(
        variant.palette.paperShade,
        variant.finish.paperShadeAlpha * 0.55,
      ),
    );
    blot.addColorStop(1, withAlpha(variant.palette.paperShade, 0));
    ctx.fillStyle = blot;
    ctx.fillRect(-6000, -4000, 12000, 8000);
    ctx.restore();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  });
  return null;
};


/**
 * The sheet itself: one canvas, one affine transform, and three offscreen
 * depth buffers.
 *
 * Panels register their paint through usePanelPainter into the buffer for
 * their depth bucket. Each buffer is then blurred ONCE on its way to the main
 * canvas — blurring 21 panels individually would be unusably slow at 4K.
 */
export const SheetPlane: React.FC<{
  variant: Variant;
  matrix: Matrix;
  t: number;
  tPrev: number;
  frame: number;
  fps: number;
  children: React.ReactNode;
}> = ({ variant, matrix, t, tPrev, frame, fps, children }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const buffers = useMemo(() => {
    const make = () => {
      const c = makeCanvas(CANVAS_W, CANVAS_H);
      return c.getContext("2d") as Ctx;
    };
    return { far: make(), mid: make(), near: make() };
  }, []);

  /** Fine grain, generated once and tiled. */
  const grain = useMemo(() => {
    const c = makeCanvas(GRAIN_TILE, GRAIN_TILE);
    const g = c.getContext("2d") as Ctx;
    const img = g.createImageData(GRAIN_TILE, GRAIN_TILE);
    for (let i = 0; i < GRAIN_TILE * GRAIN_TILE; i++) {
      const v = Math.floor(random(`grain-${i}`) * 256);
      img.data[i * 4] = v;
      img.data[i * 4 + 1] = v;
      img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c;
  }, []);

  /** Scanline pattern tile — a single dark row every 5px. */
  const scanTile = useMemo(() => {
    const c = makeCanvas(4, 5);
    const g = c.getContext("2d") as Ctx;
    g.fillStyle = variant.finish.scanlineColor;
    g.fillRect(0, 0, 4, 1);
    return c;
  }, [variant.finish.scanlineColor]);

  const api: PlaneApi = { variant, matrix, t, tPrev, frame, fps, buffers };

  /** Composites the three buffers, then the finish passes. */
  useLayoutEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) {
      return;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;

    // Far behind, near in front. One blur per buffer.
    for (const bucket of DEPTH_BUCKETS) {
      const blur = blurForBucket(bucket, variant.depth);
      ctx.filter = blur > 0 ? `blur(${blur}px)` : "none";
      ctx.drawImage(buffers[bucket].canvas, 0, 0);
    }
    ctx.filter = "none";

    const f = variant.finish;

    // A very slight brightness lift at the sheet's upper-left, as if lit from
    // that side. No bloom anywhere — this is a document, not a light source.
    const lift = ctx.createRadialGradient(
      CANVAS_W * 0.18,
      CANVAS_H * 0.13,
      40,
      CANVAS_W * 0.18,
      CANVAS_H * 0.13,
      CANVAS_W * 0.95,
    );
    lift.addColorStop(0, `rgba(255, 255, 255, ${f.lightLiftAlpha})`);
    lift.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = lift;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // The dark variant reads as a display rather than as paper.
    if (f.screenGlowAlpha > 0) {
      const glow = ctx.createRadialGradient(
        CANVAS_W / 2,
        CANVAS_H / 2,
        60,
        CANVAS_W / 2,
        CANVAS_H / 2,
        CANVAS_W * 0.62,
      );
      glow.addColorStop(0, withAlpha(f.screenGlowColor, f.screenGlowAlpha));
      glow.addColorStop(1, withAlpha(f.screenGlowColor, 0));
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.globalCompositeOperation = "source-over";
    }

    if (f.scanlines) {
      const pattern = ctx.createPattern(scanTile, "repeat");
      if (pattern) {
        ctx.globalAlpha = f.scanlineAlpha;
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        ctx.globalAlpha = 1;
      }
    }

    // Vignette: very light, and warm rather than dark on the paper variants.
    if (f.vignetteAlpha > 0) {
      const vig = ctx.createRadialGradient(
        CANVAS_W / 2,
        CANVAS_H / 2,
        CANVAS_H * 0.42,
        CANVAS_W / 2,
        CANVAS_H / 2,
        CANVAS_W * 0.72,
      );
      vig.addColorStop(0, withAlpha(f.vignetteColor, 0));
      vig.addColorStop(1, withAlpha(f.vignetteColor, f.vignetteAlpha));
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }

    // Fine grain. The tile is fixed; only its offset moves, deterministically.
    const ox = Math.floor(random(`grain-x-${frame}`) * GRAIN_TILE);
    const oy = Math.floor(random(`grain-y-${frame}`) * GRAIN_TILE);
    const pattern = ctx.createPattern(grain, "repeat");
    if (pattern) {
      ctx.save();
      ctx.globalAlpha = f.grainAlpha;
      ctx.globalCompositeOperation = "overlay";
      ctx.translate(-ox, -oy);
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, CANVAS_W + GRAIN_TILE, CANVAS_H + GRAIN_TILE);
      ctx.restore();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }
  });

  return (
    <>
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
      <PlaneContext.Provider value={api}>
        <PlaneReset
          canvasRef={canvasRef}
          buffers={buffers}
          variant={variant}
          matrix={matrix}
        />
        {children}
      </PlaneContext.Provider>
    </>
  );
};
