import React, { useLayoutEffect } from "react";
import type { FrameState, RenderEnv } from "./env";
import { CANVAS_H, CANVAS_W } from "./plane";

/**
 * First child in the draw order: begins the frame by clearing the depth
 * buffers and painting the background onto the visible canvas.
 */
export const BackgroundWash: React.FC<{
  env: RenderEnv;
  fs: FrameState;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}> = ({ env, fs, canvasRef }) => {
  useLayoutEffect(() => {
    const main = canvasRef.current?.getContext("2d");
    if (!main) return;
    for (const c of [env.ctx.near, env.ctx.mid, env.ctx.far, env.ctx.bloom]) {
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, CANVAS_W, CANVAS_H);
    }
    const { palette } = env.cfg;
    main.setTransform(1, 0, 0, 1, 0, 0);
    main.globalAlpha = 1;
    main.globalCompositeOperation = "source-over";
    main.filter = "none";
    main.fillStyle = palette.bgDeep;
    main.fillRect(0, 0, CANVAS_W, CANVAS_H);
    // Soft wash biased toward the far upper-right, echoing the plane depth.
    const g1 = main.createRadialGradient(
      CANVAS_W * 0.68,
      CANVAS_H * 0.3,
      200,
      CANVAS_W * 0.68,
      CANVAS_H * 0.3,
      CANVAS_W * 0.75,
    );
    g1.addColorStop(0, palette.bgWash);
    g1.addColorStop(1, `${palette.bgWash}00`);
    main.globalAlpha = 0.55;
    main.fillStyle = g1;
    main.fillRect(0, 0, CANVAS_W, CANVAS_H);
    // Dimmer counter-wash near the lower-left so the near field isn't flat.
    const g2 = main.createRadialGradient(
      CANVAS_W * 0.18,
      CANVAS_H * 0.85,
      100,
      CANVAS_W * 0.18,
      CANVAS_H * 0.85,
      CANVAS_W * 0.5,
    );
    g2.addColorStop(0, palette.bgWash);
    g2.addColorStop(1, `${palette.bgWash}00`);
    main.globalAlpha = 0.22;
    main.fillStyle = g2;
    main.fillRect(0, 0, CANVAS_W, CANVAS_H);
    main.globalAlpha = 1;
  }, [env, fs, canvasRef]);
  return null;
};
