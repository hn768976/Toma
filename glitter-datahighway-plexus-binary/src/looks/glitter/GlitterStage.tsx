import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AbsoluteFill, useCurrentFrame, useDelayRender, useVideoConfig } from "remotion";
import { loopFrame } from "../../lib/random";
import { createGlitterEngine, GlitterEngine } from "./engine";
import type { GlitterVersion } from "./particles";

// PixiJS stage rendered manually once per Remotion frame (no ticker).
export const GlitterStage: React.FC<{ v: GlitterVersion }> = ({ v }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [engine, setEngine] = useState<GlitterEngine | null>(null);
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const [handle] = useState(() => delayRender("Initialising PixiJS"));
  // Device pixels: --scale=1/3 gives a 1280x720 drawing buffer.
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  const bw = Math.round(width * dpr), bh = Math.round(height * dpr);

  useEffect(() => {
    let alive = true;
    let created: GlitterEngine | null = null;
    createGlitterEngine(canvasRef.current!, bw, bh, v)
      .then((e) => {
        created = e;
        if (!alive) return e.destroy();
        setEngine(e);
        continueRender(handle);
      })
      .catch((err) => cancelRender(err));
    return () => {
      alive = false;
      created?.destroy();
    };
  }, [bw, bh, v, handle, continueRender, cancelRender]);

  useLayoutEffect(() => {
    engine?.render(loopFrame(frame));
  }, [engine, frame]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <canvas ref={canvasRef} width={bw} height={bh} style={{ width, height }} />
    </AbsoluteFill>
  );
};
