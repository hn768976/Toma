import { autoDetectRenderer, Renderer } from "pixi.js";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AbsoluteFill, useCurrentFrame, useDelayRender, useVideoConfig } from "remotion";
import { getRenderScale } from "./useRenderScale";

/**
 * A look drawn with PixiJS 8 on WebGL2. There is no ticker: the stage is drawn
 * manually exactly once per Remotion frame, from that frame number only.
 */
export type PixiLookImpl = {
  render: (frame: number) => void;
  destroy: () => void;
};

export type PixiLookFactory = (renderer: Renderer, pxW: number, pxH: number) => PixiLookImpl | Promise<PixiLookImpl>;

export const PixiLook: React.FC<{ create: PixiLookFactory; background?: string }> = ({ create, background = "#000" }) => {
  const { width, height } = useVideoConfig();
  const frame = useCurrentFrame();
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const implRef = useRef<PixiLookImpl | null>(null);
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const [handle] = useState(() => delayRender("Initialising PixiJS"));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let disposed = false;
    let renderer: Renderer | null = null;
    const scale = getRenderScale();
    const pxW = Math.round(width * scale);
    const pxH = Math.round(height * scale);
    (async () => {
      renderer = await autoDetectRenderer({
        preference: "webgl",
        canvas: canvasRef.current!,
        width: pxW,
        height: pxH,
        resolution: 1,
        autoDensity: false,
        antialias: false,
        preserveDrawingBuffer: true,
        backgroundAlpha: 1,
        background: 0x000000,
        hello: false,
      });
      const impl = await create(renderer, pxW, pxH);
      if (disposed) {
        impl.destroy();
        return;
      }
      implRef.current = impl;
      // draw the first frame before releasing the render
      impl.render(frameRef.current);
      setReady(true);
      continueRender(handle);
    })().catch((e) => cancelRender(e));
    return () => {
      disposed = true;
      implRef.current?.destroy();
      implRef.current = null;
      renderer?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    if (ready && implRef.current) implRef.current.render(frame);
  }, [frame, ready]);

  return (
    <AbsoluteFill style={{ backgroundColor: background }}>
      <canvas ref={canvasRef} style={{ width, height, display: "block" }} />
    </AbsoluteFill>
  );
};
