import React, { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  cancelRender,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BlackHoleRenderer } from "./shader/renderer";
import type { Look } from "./presets";

export const BlackHole: React.FC<{
  look: Look;
  /** Rays per pixel per axis. 2 => 4x supersampling. */
  aa?: number;
}> = ({ look, aa = 2 }) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<BlackHoleRenderer | null>(null);

  // One handle per frame, taken during render: Remotion must not screenshot
  // the canvas before the GL draw for this frame has landed in it.
  const handle = useMemo(
    () => delayRender(`black-hole frame ${frame}`),
    [frame],
  );

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      if (!rendererRef.current) {
        // Remotion's --scale arrives as the device pixel ratio, so sizing the
        // backing store this way renders natively at 1920x1080 for
        // --scale=0.5 and 3840x2160 for --scale=1, with no resampling. It is
        // clamped at 1 so a retina Studio preview does not silently ask for a
        // 4x-area render.
        const dpr = Math.min(window.devicePixelRatio || 1, 1);
        canvas.width = Math.max(1, Math.round(width * dpr));
        canvas.height = Math.max(1, Math.round(height * dpr));
        rendererRef.current = new BlackHoleRenderer(canvas, aa);
      }
      // Loop phase: frame / durationInFrames runs 0 -> 1 across the
      // composition and never touches a wall clock, so every render of a
      // given frame is identical.
      rendererRef.current.render(look, frame / durationInFrames, frame * 17.13);
      continueRender(handle);
    } catch (err) {
      cancelRender(err as Error);
    }
  }, [handle, frame, durationInFrames, look, aa, width, height]);

  useEffect(() => {
    return () => {
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
};
