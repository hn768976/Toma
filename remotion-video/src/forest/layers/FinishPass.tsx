import React, { useMemo } from "react";
import { useCurrentFrame } from "remotion";
import { DURATION_IN_FRAMES } from "../constants";
import { LayerCanvas } from "../useLayerCanvas";
import { mulberry32, rnd } from "../rand";

const GRAIN_TILE = 768;

/**
 * Vignette and film grain, over everything.
 *
 * The grain tile is regenerated per frame and seeded on `frame % 240`, so
 * frame 240's grain is byte-identical to frame 0's and the loop stays closed.
 * A 768px tile is generated and repeated rather than filling 8.3M pixels
 * directly — at 5% alpha the repeat is not detectable and it is ~14x cheaper.
 */
export const FinishPass: React.FC<{
  width: number;
  height: number;
  vignetteStrength: number;
  grainAlpha: number;
}> = ({ width, height, vignetteStrength, grainAlpha }) => {
  const frame = useCurrentFrame();

  const tile = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = GRAIN_TILE;
    c.height = GRAIN_TILE;
    return c;
  }, []);

  const draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    // ── Vignette ──
    const outer = Math.hypot(w, h) * 0.58;
    const vig = ctx.createRadialGradient(
      w * 0.5,
      h * 0.46,
      outer * 0.28,
      w * 0.5,
      h * 0.46,
      outer,
    );
    vig.addColorStop(0, "rgba(0, 0, 0, 0)");
    vig.addColorStop(0.62, `rgba(0, 0, 0, ${vignetteStrength * 0.34})`);
    vig.addColorStop(1, `rgba(0, 0, 0, ${vignetteStrength})`);
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);

    // ── Grain ──
    const tctx = tile.getContext("2d");
    if (!tctx) return;
    const loopFrame = frame % DURATION_IN_FRAMES;
    const prng = mulberry32(Math.floor(rnd(`grain-${loopFrame}`) * 0x7fffffff));
    const img = tctx.createImageData(GRAIN_TILE, GRAIN_TILE);
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
