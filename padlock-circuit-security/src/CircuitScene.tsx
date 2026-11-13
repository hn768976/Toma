import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, useCurrentFrame, useVideoConfig } from "remotion";
import { CamKey } from "./engine/camera";
import { Palette } from "./engine/palettes";
import { Engine, Variant } from "./engine/scene";

export type CircuitSceneProps = {
  variant: Variant;
  palette: Palette;
  camera: CamKey[];
  lockYaw?: number;
};

/**
 * Hosts the Three.js engine in a canvas. Every frame is rendered synchronously
 * as a pure function of the Remotion frame number, so renders are deterministic
 * and frames can be rendered in any order / in parallel.
 */
export const CircuitScene: React.FC<CircuitSceneProps> = ({ variant, palette, camera, lockYaw }) => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const canvas = useRef<HTMLCanvasElement>(null);
  const engine = useRef<Engine | null>(null);
  const [handle] = useState(() => delayRender("Building circuit board scene"));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!canvas.current) return;
    const e = new Engine(canvas.current, { variant, palette, camera, lockYaw, duration: durationInFrames / fps });
    engine.current = e;
    setReady(true);
    continueRender(handle);
    return () => {
      engine.current = null;
      e.dispose();
    };
  }, [variant, palette, camera, lockYaw, durationInFrames, fps, handle]);

  useLayoutEffect(() => {
    if (!ready || !engine.current) return;
    // The composition is authored at 3840x2160; `--scale` changes devicePixelRatio,
    // so the drawing buffer follows the requested output resolution.
    const dpr = window.devicePixelRatio || 1;
    engine.current.render(frame / fps, Math.round(width * dpr), Math.round(height * dpr));
  }, [frame, fps, width, height, ready]);

  return (
    <AbsoluteFill style={{ backgroundColor: palette.fog }}>
      <canvas ref={canvas} style={{ width, height, display: "block" }} />
    </AbsoluteFill>
  );
};
