import React, { useLayoutEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  BakeSpec,
  PostSettings,
  Renderer,
  UniformMap,
} from "./renderer";

export type FrameDescription = {
  uniforms: UniformMap;
  post: PostSettings;
};

type Props = {
  sceneFrag: string;
  bakes: BakeSpec[];
  /**
   * Super-sampling factor for the scene pass (1 = shade at output resolution).
   * 2 gives 4 samples per pixel - only recommended with a real GPU.
   */
  supersample?: number;
  /** Pure function of the frame number -> everything the shader needs */
  describeFrame: (frame: number) => FrameDescription;
};

/**
 * Frame-accurate WebGL 2 canvas for Remotion.
 *
 * The canvas backing store follows the output scale: the 4K compositions are
 * shaded at 3840x2160 by default and `--scale=0.5` renders the very same
 * composition at 1920x1080. Everything in the shaders is resolution
 * independent (procedural / distance-field based).
 */
export const ShaderCanvas: React.FC<Props> = ({
  sceneFrag,
  bakes,
  supersample = 1,
  describeFrame,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const [handle] = useState(() => delayRender("Initialising WebGL scene"));

  // Output scale (Remotion's --scale sets the device pixel ratio).
  const dpr =
    typeof window === "undefined" ? 1 : Math.min(window.devicePixelRatio, 1);
  const outW = Math.max(2, Math.round(width * dpr));
  const outH = Math.max(2, Math.round(height * dpr));
  // Scene shading resolution: output size x optional super-sampling factor.
  const ss = Math.min(Math.max(supersample, 0.25), 4);
  const internalW = Math.max(2, Math.round(outW * ss));
  const internalH = Math.max(2, Math.round(outH * ss));

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new Renderer(canvas, {
      internalWidth: internalW,
      internalHeight: internalH,
      sceneFrag,
      bakes,
    });
    rendererRef.current = renderer;
    continueRender(handle);
    return () => {
      rendererRef.current = null;
      renderer.dispose();
    };
  }, [bakes, handle, internalH, internalW, sceneFrag]);

  useLayoutEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    const d = describeFrame(frame);
    renderer.render(d.uniforms, d.post, frame);
  }, [describeFrame, frame, internalW, internalH, sceneFrag, bakes]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <canvas
        ref={canvasRef}
        width={outW}
        height={outH}
        style={{ width, height, display: "block" }}
      />
    </AbsoluteFill>
  );
};
