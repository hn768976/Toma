import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AbsoluteFill, cancelRender, continueRender, delayRender, useCurrentFrame, useVideoConfig } from "remotion";
import { FrameState, Look, NeuronRenderer } from "./renderer";

export type SceneDef = {
  /** builds the (deterministic) capsule buffer once */
  build: () => Float32Array;
  look: Look;
  /** camera / animation state as a pure function of time */
  state: (frame: number, fps: number, durationInFrames: number) => FrameState;
};

/**
 * Hosts the WebGL canvas and redraws it for the current Remotion frame.
 * The drawing buffer follows `devicePixelRatio`, so `--scale=0.5` renders the
 * 3840x2160 composition straight to a 1920x1080 buffer.
 */
export const NeuronCanvas: React.FC<{ scene: SceneDef }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<NeuronRenderer | null>(null);
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender("Building neuron geometry"));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const capsules = scene.build();
      const r = new NeuronRenderer(canvas, capsules, scene.look, width, height, window.devicePixelRatio || 1);
      rendererRef.current = r;
      setReady(true);
      continueRender(handle);
      return () => {
        rendererRef.current = null;
        r.dispose();
      };
    } catch (err) {
      cancelRender(err);
    }
  }, [scene, width, height, handle]);

  useLayoutEffect(() => {
    const r = rendererRef.current;
    if (!r || !ready) return;
    r.render(scene.state(frame, fps, durationInFrames), frame);
  }, [frame, fps, durationInFrames, ready, scene]);

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <canvas ref={canvasRef} width={width} height={height} style={{ width, height, display: "block" }} />
    </AbsoluteFill>
  );
};
