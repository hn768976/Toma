import React, { useCallback } from "react";
import { CanvasLayer, makeBuffer } from "./CanvasLayer";
import { rgba, rgbCss, type Palette } from "./palettes";
import { seeded } from "./rng";
import type { CompositionSpec } from "./types";

/** The wash and mottling are built at 1/8 scale and upscaled — cheap, and
 *  the resampling is itself part of how soft the gradient reads. */
const DOWNSCALE = 8;
const MOTTLE_BLOBS = 26;
/** Padding on the low-res buffer so blurring it does not fade the frame edges. */
const PAD = 18;

/**
 * Deep base colour, one broad radial wash brightest near the sphere, a very
 * subtle large-scale mottling, and nothing else. No grid, no particles: the
 * rings are the image.
 */
export const BackgroundWash: React.FC<{
  spec: CompositionSpec;
  palette: Palette;
}> = ({ spec, palette }) => {
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      const bg = spec.background;

      ctx.fillStyle = rgbCss(palette.bgDeep);
      ctx.fillRect(0, 0, width, height);

      const sw = Math.round(width / DOWNSCALE);
      const sh = Math.round(height / DOWNSCALE);
      const small = makeBuffer(sw + PAD * 2, sh + PAD * 2);
      const sctx = small.getContext("2d");
      if (!sctx) return;
      sctx.translate(PAD, PAD);

      const cx = bg.x * sw;
      const cy = bg.y * sh;
      const spread = bg.spread * sw;

      const wash = sctx.createRadialGradient(cx, cy, 0, cx, cy, spread);
      wash.addColorStop(0, rgba(palette.bgWash, 0.95 * bg.strength));
      wash.addColorStop(0.4, rgba(palette.bgWash, 0.36 * bg.strength));
      wash.addColorStop(1, rgba(palette.bgWash, 0));
      sctx.fillStyle = wash;
      sctx.fillRect(-PAD, -PAD, sw + PAD * 2, sh + PAD * 2);

      // Large, slow mottling — placed with the composition's own seed so the
      // same composition always produces the same field.
      sctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < MOTTLE_BLOBS; i++) {
        const bx = seeded(spec.id, "mottle-x", i) * sw;
        const by = seeded(spec.id, "mottle-y", i) * sh;
        const br = (0.14 + seeded(spec.id, "mottle-r", i) * 0.34) * sw;
        const strength =
          (0.05 + seeded(spec.id, "mottle-a", i) * 0.09) * bg.mottle;
        const blob = sctx.createRadialGradient(bx, by, 0, bx, by, br);
        blob.addColorStop(0, rgba(palette.bgWash, strength));
        blob.addColorStop(1, rgba(palette.bgWash, 0));
        sctx.fillStyle = blob;
        sctx.fillRect(bx - br, by - br, br * 2, br * 2);
      }
      sctx.globalCompositeOperation = "source-over";

      // Heavy blur at 1/8 scale is an enormous blur at full scale.
      const blurred = makeBuffer(sw + PAD * 2, sh + PAD * 2);
      const bctx = blurred.getContext("2d");
      if (!bctx) return;
      bctx.filter = "blur(7px)";
      bctx.drawImage(small, 0, 0);
      bctx.filter = "none";

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.globalCompositeOperation = "lighter";
      ctx.drawImage(blurred, PAD, PAD, sw, sh, 0, 0, width, height);
      ctx.globalCompositeOperation = "source-over";

      // Fall away to near-black with distance from the wash, so whichever
      // corner is furthest from the sphere is the darkest part of the frame.
      const fx = bg.x * width;
      const fy = bg.y * height;
      const fall = ctx.createRadialGradient(
        fx,
        fy,
        0,
        fx,
        fy,
        Math.hypot(width, height) * 0.95,
      );
      fall.addColorStop(0, "rgba(0, 0, 0, 0)");
      fall.addColorStop(0.4, "rgba(0, 0, 0, 0.1)");
      fall.addColorStop(1, "rgba(0, 0, 0, 0.8)");
      ctx.fillStyle = fall;
      ctx.fillRect(0, 0, width, height);
    },
    [spec, palette],
  );

  return <CanvasLayer draw={draw} />;
};
