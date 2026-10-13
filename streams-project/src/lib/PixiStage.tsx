import { autoDetectRenderer, Renderer } from "pixi.js";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useCurrentFrame, useDelayRender, useVideoConfig } from "remotion";

// PixiJS 8 on WebGL2, driven manually: no Application, no ticker. Each
// Remotion frame re-renders the stage once, synchronously, from the frame.
export type PixiLook = {
  render: (frame: number) => void;
  destroy: () => void;
};

export const PixiStage: React.FC<{
  create: (renderer: Renderer, w: number, h: number) => PixiLook;
}> = ({ create }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lookRef = useRef<PixiLook | null>(null);
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const [handle] = useState(() => delayRender("PixiJS renderer init"));

  useEffect(() => {
    let disposed = false;
    let renderer: Renderer | null = null;
    const dpr = window.devicePixelRatio;
    const w = Math.round(width * dpr);
    const h = Math.round(height * dpr);
    autoDetectRenderer({
      preference: "webgl",
      canvas: canvasRef.current!,
      width: w,
      height: h,
      resolution: 1,
      autoDensity: false,
      antialias: false,
      background: "#000000",
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    })
      .then((r) => {
        renderer = r;
        if (disposed) {
          r.destroy();
          return;
        }
        const look = create(r, w, h);
        lookRef.current = look;
        look.render(frameRef.current);
        continueRender(handle);
      })
      .catch((e) => cancelRender(e));
    return () => {
      disposed = true;
      lookRef.current?.destroy();
      lookRef.current = null;
      renderer?.destroy();
    };
  }, [create, width, height, continueRender, cancelRender, handle]);

  useLayoutEffect(() => {
    lookRef.current?.render(frame);
  }, [frame]);

  return <canvas ref={canvasRef} style={{ width, height, display: "block" }} />;
};
