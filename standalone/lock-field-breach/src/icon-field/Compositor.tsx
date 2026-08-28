import React, { useLayoutEffect } from "react";
import type { FrameState, RenderEnv } from "./env";
import { CANVAS_H, CANVAS_W, LOOP_FRAMES } from "./plane";
import { rand } from "./rng";

/**
 * Last child in the draw order: depth-of-field compositing and finish.
 * Each depth buffer is blurred ONCE with ctx.filter and composited
 * far → mid → near over the background, then bloom, glitch slices,
 * vignette, and grain.
 */
export const Compositor: React.FC<{
  env: RenderEnv;
  fs: FrameState;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}> = ({ env, fs, canvasRef }) => {
  useLayoutEffect(() => {
    const main = canvasRef.current?.getContext("2d");
    if (!main) return;
    const maxBlur = env.cfg.maxBlurPx;
    main.setTransform(1, 0, 0, 1, 0, 0);
    main.globalCompositeOperation = "source-over";

    // Far plane: blurred and already contrast-faded at draw time.
    main.filter = `blur(${Math.round(maxBlur * 0.55)}px)`;
    main.drawImage(env.buffers.far, 0, 0);
    // Focal band: sharp.
    main.filter = "none";
    main.drawImage(env.buffers.mid, 0, 0);
    // Near foreground: the heaviest defocus.
    main.filter = `blur(${maxBlur}px)`;
    main.drawImage(env.buffers.near, 0, 0);
    main.filter = "none";

    // Bloom: brightest icons and highlights, blurred once, added on top.
    main.globalCompositeOperation = "lighter";
    main.globalAlpha = 0.55;
    main.filter = `blur(${Math.round(maxBlur * 0.75)}px)`;
    main.drawImage(env.buffers.bloom, 0, 0);
    main.filter = "none";
    main.globalAlpha = 1;
    main.globalCompositeOperation = "source-over";

    // Glitch: shift a few thin horizontal slices of the composited frame.
    if (fs.glitch) {
      const scratch = env.ctx.scratch;
      scratch.setTransform(1, 0, 0, 1, 0, 0);
      scratch.clearRect(0, 0, CANVAS_W, CANVAS_H);
      scratch.drawImage(canvasRef.current!, 0, 0);
      for (const slice of fs.glitch.slices) {
        const sy = Math.round(slice.yFrac * CANVAS_H);
        const sh = Math.max(8, Math.round(slice.hFrac * CANVAS_H));
        main.drawImage(
          env.buffers.scratch,
          0,
          sy,
          CANVAS_W,
          sh,
          slice.shift,
          sy,
          CANVAS_W,
          sh,
        );
      }
    }

    // Vignette, ~20% at the edges.
    const vg = main.createRadialGradient(
      CANVAS_W / 2,
      CANVAS_H / 2,
      CANVAS_H * 0.42,
      CANVAS_W / 2,
      CANVAS_H / 2,
      CANVAS_W * 0.62,
    );
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.24)");
    main.fillStyle = vg;
    main.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Fine grain: a pre-generated noise tile, offset per frame (mod 450).
    const f = fs.frame % LOOP_FRAMES;
    const ox = Math.floor(rand(`grain-ox-${f}`) * 512);
    const oy = Math.floor(rand(`grain-oy-${f}`) * 512);
    const pat = main.createPattern(env.grainTile, "repeat");
    if (pat) {
      main.save();
      main.globalCompositeOperation = "overlay";
      main.globalAlpha = 0.08;
      main.translate(-ox, -oy);
      main.fillStyle = pat;
      main.fillRect(0, 0, CANVAS_W + 512, CANVAS_H + 512);
      main.restore();
    }
  }, [env, fs, canvasRef]);
  return null;
};
