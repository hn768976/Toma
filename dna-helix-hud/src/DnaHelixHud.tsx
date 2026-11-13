import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";
import { loadFonts } from "./lib/fonts";
import { createEngine, type Engine } from "./scene/engine";

export const dnaSchema = z.object({
  variant: z.enum(["reference", "orbit"]),
});

/**
 * Three.js (WebGL 2) DNA helix over holographic HUD layers.
 * The WebGL drawing buffer follows the composition size times the device
 * pixel ratio, so the 4K composition renders natively at 3840 x 2160 and a
 * `--scale=0.5` render produces a true 1920 x 1080 frame.
 */
export const DnaHelixHud: React.FC<z.infer<typeof dnaSchema>> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender("Initialising WebGL scene"));
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;

  useEffect(() => {
    let cancelled = false;
    loadFonts().then(() => {
      if (cancelled || !canvasRef.current) return;
      engineRef.current = createEngine(canvasRef.current, width, height, dpr, variant);
      setReady(true);
    });
    return () => {
      cancelled = true;
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, [width, height, dpr, variant]);

  useLayoutEffect(() => {
    if (!ready || !engineRef.current) return;
    engineRef.current.render(frame / fps);
    continueRender(handle);
  }, [frame, fps, ready, handle]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <canvas ref={canvasRef} style={{ width, height }} />
    </AbsoluteFill>
  );
};
