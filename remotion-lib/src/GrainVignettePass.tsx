import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { LayerCanvas } from "./useLayerCanvas";
import { mulberry32, rnd } from "./random";

/**
 * A finishing overlay: a radial vignette, then fine film grain.
 *
 * The grain tile is regenerated per frame but seeded on `frame % loopFrames`,
 * so in a looping composition the last frame's grain is byte-identical to the
 * first frame's and the loop stays closed. Grain seeded on the raw frame
 * number is the most common reason an otherwise perfect loop still ticks.
 *
 * A tile is generated and repeated rather than filling the frame directly: at
 * 4K that is 8.3M random samples per frame versus ~590k, and at the alphas
 * grain is used at the repeat is not detectable.
 */
export const GrainVignettePass: React.FC<{
  /** 0..1. Alpha of the vignette at the corners. */
  vignetteStrength: number;
  /** 0..1. Alpha the grain is composited at. 0.02-0.05 is a usual range. */
  grainAlpha: number;
  /** Edge length of the repeating noise tile, in pixels. */
  tileSize?: number;
  /** Seed prefix, so two compositions do not share a grain sequence. */
  seed?: string;
  /** Vignette centre, as fractions of the frame. */
  centerX?: number;
  centerY?: number;
  /**
   * Frames in one loop. Defaults to the composition's own duration, which is
   * the usual case; set it when the loop is shorter than the composition —
   * a 120-frame cycle played twice in a 240-frame comp, or a composition
   * given one extra frame so that frame N can be compared against frame 0.
   */
  loopFrames?: number;
}> = ({
  vignetteStrength,
  grainAlpha,
  tileSize = 768,
  seed = "grain",
  centerX = 0.5,
  centerY = 0.46,
  loopFrames,
}) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();

  const tile = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = tileSize;
    c.height = tileSize;
    return c;
  }, [tileSize]);

  const draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    if (vignetteStrength > 0) {
      const outer = Math.hypot(w, h) * 0.58;
      const vig = ctx.createRadialGradient(
        w * centerX,
        h * centerY,
        outer * 0.28,
        w * centerX,
        h * centerY,
        outer,
      );
      vig.addColorStop(0, "rgba(0, 0, 0, 0)");
      vig.addColorStop(0.62, `rgba(0, 0, 0, ${vignetteStrength * 0.34})`);
      vig.addColorStop(1, `rgba(0, 0, 0, ${vignetteStrength})`);
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, w, h);
    }

    if (grainAlpha <= 0) return;
    const tctx = tile.getContext("2d");
    if (!tctx) return;
    const loopFrame = frame % (loopFrames ?? durationInFrames);
    const prng = mulberry32(
      Math.floor(rnd(`${seed}-${loopFrame}`) * 0x7fffffff),
    );
    const img = tctx.createImageData(tileSize, tileSize);
    const data = img.data;
    for (let i = 0; i < data.length; i += 4) {
      const v = (prng() * 255) | 0;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
    tctx.putImageData(img, 0, 0);

    const pattern = ctx.createPattern(tile, "repeat");
    if (!pattern) return;
    ctx.save();
    ctx.globalAlpha = grainAlpha;
    ctx.globalCompositeOperation = "overlay";
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  };

  return <LayerCanvas width={width} height={height} draw={draw} />;
};
