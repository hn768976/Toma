import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, useCurrentFrame, useVideoConfig } from "remotion";
import { createRainStage, RainPalette, RainStage } from "./rainPipeline";

export const ParticleRain: React.FC<{ palette: RainPalette }> = ({ palette }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stage, setStage] = useState<RainStage | null>(null);
  const [handle] = useState(() => delayRender("Initialising PixiJS"));

  useEffect(() => {
    let cancelled = false;
    let made: RainStage | null = null;
    createRainStage(canvasRef.current!, palette, window.devicePixelRatio).then((s) => {
      if (cancelled) {
        s.app.destroy();
        return;
      }
      made = s;
      setStage(s);
    });
    return () => {
      cancelled = true;
      made?.app.destroy();
    };
  }, [palette]);

  // Draw synchronously for the current frame; positions depend only on `frame`.
  useLayoutEffect(() => {
    if (!stage) return;
    stage.render(frame);
    continueRender(handle);
  }, [stage, frame, handle]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <canvas ref={canvasRef} style={{ width, height, position: "absolute", inset: 0 }} />
    </AbsoluteFill>
  );
};
