import React, { useMemo } from "react";
import { AbsoluteFill } from "remotion";
import { cellOffset, traceBlob, TAU, type Cell } from "./geometry";
import { useBuffer, useCanvas2D } from "./useCanvas2D";
import type { Variant } from "./variants";

/**
 * Everything soft is computed at half resolution and upscaled. At this blur
 * level the loss is invisible and it roughly quarters the cost of a 4K frame.
 */
const SCALE = 0.5;

const DEPTHS: readonly (0 | 1 | 2)[] = [0, 1, 2];

/**
 * The cells.
 *
 * Cells are bucketed by depth into three offscreen buffers. Each buffer is
 * blurred exactly once when it is composited — blurring per cell would be
 * unusably slow at 4K. Near cells blur most and drift fastest; far cells blur
 * least and drift slowest, which is where the parallax comes from.
 */
export const CellLayer: React.FC<{
  variant: Variant;
  cells: Cell[];
  t: number;
  width: number;
  height: number;
}> = ({ variant, cells, t, width, height }) => {
  const bufferWidth = Math.round(width * SCALE);
  const bufferHeight = Math.round(height * SCALE);

  const far = useBuffer(bufferWidth, bufferHeight);
  const mid = useBuffer(bufferWidth, bufferHeight);
  const near = useBuffer(bufferWidth, bufferHeight);
  const work = useBuffer(bufferWidth, bufferHeight);
  const bloom = useBuffer(bufferWidth, bufferHeight);
  const buffers = useMemo(() => [far, mid, near], [far, mid, near]);

  const byDepth = useMemo(
    () => DEPTHS.map((d) => cells.filter((cell) => cell.depth === d)),
    [cells],
  );

  const ref = useCanvas2D(
    (ctx) => {
      // A slight ambient camera drift on a closed ellipse — no more than the
      // variant's few px, and periodic, so it loops with everything else.
      const [camAmpX, camAmpY] = variant.drift.camera;
      const camX = camAmpX * Math.cos(TAU * t);
      const camY = camAmpY * Math.sin(TAU * t);

      // 1. Draw each depth bucket into its own buffer, in 4K coordinates but
      //    on a half-resolution surface.
      for (const depth of DEPTHS) {
        const buffer = buffers[depth];
        const bctx = buffer.getContext("2d");
        if (!bctx) {
          continue;
        }
        bctx.setTransform(1, 0, 0, 1, 0, 0);
        bctx.filter = "none";
        bctx.globalCompositeOperation = "source-over";
        bctx.clearRect(0, 0, bufferWidth, bufferHeight);
        // Bright cells on a dark ground have to pool brighter where they
        // overlap, so v2 composites additively inside the bucket as well.
        bctx.globalCompositeOperation = variant.additive
          ? "lighter"
          : "source-over";
        bctx.setTransform(SCALE, 0, 0, SCALE, camX * SCALE, camY * SCALE);

        for (const cell of byDepth[depth]) {
          const [dx, dy] = cellOffset(cell, t, variant.drift.direction);
          const cx = cell.x0 + dx;
          const cy = cell.y0 + dy;
          // Cheap cull: a blob can never reach further than its own radius
          // plus the blur that will be applied to its bucket.
          const reach = cell.radius * 1.45 + variant.blurCeiling * 2;
          if (
            cx < -reach ||
            cy < -reach ||
            cx > width + reach ||
            cy > height + reach
          ) {
            continue;
          }
          bctx.globalAlpha = cell.alpha;
          bctx.fillStyle = cell.fill;
          traceBlob(bctx, cell, cx, cy, t);
          bctx.fill();
        }
        bctx.globalAlpha = 1;
      }

      // 2. Composite the three buffers, blurring each exactly once. Blur is
      //    quoted in 4K px in VARIANTS, so it is halved for this surface.
      const wctx = work.getContext("2d");
      if (!wctx) {
        return;
      }
      wctx.setTransform(1, 0, 0, 1, 0, 0);
      wctx.filter = "none";
      wctx.globalCompositeOperation = "source-over";
      wctx.clearRect(0, 0, bufferWidth, bufferHeight);
      wctx.globalCompositeOperation = variant.additive
        ? "lighter"
        : "source-over";
      for (const depth of DEPTHS) {
        const blurPx = variant.blurCeiling * variant.depthBlur[depth] * SCALE;
        wctx.filter = `blur(${blurPx.toFixed(3)}px)`;
        wctx.drawImage(buffers[depth], 0, 0);
      }
      wctx.filter = "none";
      wctx.globalCompositeOperation = "source-over";

      // 3. Bloom — v2 only. Cells brighter than the background have to read as
      //    emissive, so a wide blur of the composited layer is added back on
      //    top. This is the only bloom in the project.
      if (variant.bloom) {
        const blctx = bloom.getContext("2d");
        if (blctx) {
          blctx.setTransform(1, 0, 0, 1, 0, 0);
          blctx.filter = "none";
          blctx.globalCompositeOperation = "source-over";
          blctx.clearRect(0, 0, bufferWidth, bufferHeight);
          blctx.filter = `blur(${(variant.bloom.radius * SCALE).toFixed(3)}px)`;
          blctx.drawImage(work, 0, 0);
          blctx.filter = "none";
        }
      }

      // 4. Upscale to the 3840x2160 backing store.
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.filter = "none";
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, width, height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(work, 0, 0, width, height);

      if (variant.bloom) {
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = variant.bloom.strength;
        ctx.drawImage(bloom, 0, 0, width, height);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
      }
    },
    [variant, byDepth, t, width, height, bufferWidth, bufferHeight],
  );

  return (
    <AbsoluteFill>
      <canvas
        ref={ref}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </AbsoluteFill>
  );
};
