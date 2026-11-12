import { useLayoutEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  cancelRender,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { DnaEngine } from "./engine";
import { PRESETS, type PresetId } from "./presets";

export type DnaHelixSceneProps = { preset: PresetId };

/**
 * Renders one preset with Three.js (WebGL2) into a canvas that is exactly
 * the composition size, so the 4K composition renders natively at 3840x2160.
 */
export const DnaHelixScene: React.FC<DnaHelixSceneProps> = ({ preset }) => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<DnaEngine | null>(null);
  const [handle] = useState(() => delayRender("Building WebGL scene"));

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      engineRef.current = new DnaEngine(canvas, width, height, PRESETS[preset], durationInFrames / fps);
    } catch (err) {
      cancelRender(err);
    }
    continueRender(handle);
    return () => {
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, [width, height, preset, fps, durationInFrames, handle]);

  useLayoutEffect(() => {
    engineRef.current?.render(frame / fps);
  }, [frame, fps, width, height, preset]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <canvas ref={canvasRef} width={width} height={height} style={{ width: "100%", height: "100%" }} />
    </AbsoluteFill>
  );
};
