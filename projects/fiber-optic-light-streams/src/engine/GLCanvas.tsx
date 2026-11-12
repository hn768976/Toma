import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, cancelRender, continueRender, delayRender, useCurrentFrame, useVideoConfig } from "remotion";

export interface FrameRenderer {
  renderFrame(frame: number): void;
  dispose(): void;
}

/**
 * Hosts a WebGL canvas at the full composition resolution and synchronously
 * renders the requested frame, holding Remotion's screenshot until done.
 */
export const GLCanvas: React.FC<{
  create: (canvas: HTMLCanvasElement, width: number, height: number) => FrameRenderer;
}> = ({ create }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<FrameRenderer | null>(null);

  useLayoutEffect(() => {
    rendererRef.current = create(canvasRef.current!, width, height);
    return () => {
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, [create, width, height]);

  useLayoutEffect(() => {
    const handle = delayRender(`Rendering WebGL frame ${frame}`);
    try {
      rendererRef.current?.renderFrame(frame);
      continueRender(handle);
    } catch (err) {
      cancelRender(err);
    }
  }, [frame, create, width, height]);

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <canvas ref={canvasRef} width={width} height={height} style={{ width: "100%", height: "100%", display: "block" }} />
    </AbsoluteFill>
  );
};
