import React, { useCallback, useMemo } from "react";
import { random, useCurrentFrame } from "remotion";
import type { Variant } from "../variants";
import { CanvasLayer, makeOffscreen } from "./CanvasLayer";

/** Edge of the noise tile that is tiled across the frame. */
const GRAIN_TILE = 1024;

/**
 * Vignette and grain, the last thing over the image.
 *
 * The grain tile is built once from seeded noise; each frame offsets it by a
 * seeded amount taken from `frame % loopLength`, so the grain differs every
 * frame and repeats exactly once per loop. Generating a fresh 4K noise field
 * per frame would cost more than the rest of the project put together.
 */
export const FilmFinish: React.FC<{ readonly variant: Variant }> = ({
  variant,
}) => {
  const frame = useCurrentFrame();

  const grainTile = useMemo(() => {
    const canvas = makeOffscreen(GRAIN_TILE, GRAIN_TILE);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return canvas;
    }
    const image = ctx.createImageData(GRAIN_TILE, GRAIN_TILE);
    const data = image.data;
    const base = Math.floor(random(`${variant.id}-grain`) * 1e6);
    for (let i = 0; i < GRAIN_TILE * GRAIN_TILE; i++) {
      const value = 90 + random(base + i) * 165;
      const offset = i * 4;
      data[offset] = value;
      data[offset + 1] = value;
      data[offset + 2] = value;
      data[offset + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    return canvas;
  }, [variant]);

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      // Vignette.
      const cx = w / 2;
      const cy = h / 2;
      const inner = Math.min(w, h) * 0.32;
      const outer = Math.hypot(w, h) * 0.62;
      const gradient = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
      gradient.addColorStop(0, "rgba(0,0,0,0)");
      gradient.addColorStop(0.62, `rgba(0,0,0,${variant.vignette * 0.32})`);
      gradient.addColorStop(1, `rgba(0,0,0,${variant.vignette})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);

      // Grain, shifted by a seeded offset that repeats once per loop.
      const key = frame % variant.loopLength;
      const offsetX = Math.floor(random(`${variant.id}-gx-${key}`) * GRAIN_TILE);
      const offsetY = Math.floor(random(`${variant.id}-gy-${key}`) * GRAIN_TILE);
      const pattern = ctx.createPattern(grainTile, "repeat");
      if (pattern) {
        ctx.save();
        ctx.globalAlpha = variant.grain;
        ctx.translate(-offsetX, -offsetY);
        ctx.fillStyle = pattern;
        ctx.fillRect(offsetX, offsetY, w + GRAIN_TILE, h + GRAIN_TILE);
        ctx.restore();
      }
    },
    [variant, frame, grainTile],
  );

  return <CanvasLayer draw={draw} />;
};
