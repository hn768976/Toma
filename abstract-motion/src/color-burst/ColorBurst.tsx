import { useEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { smoothstep } from "../lib/random";
import { createBurstRenderer } from "./burst-gl";
import { ColorBurstVariant, PALETTES } from "./palettes";

// Expansion of the burst over time (world units). As in the reference it
// erupts from a small clump, fills the frame by ~3 s and keeps billowing until
// it peaks at 8.0 s; it then recedes, slowly at first and accelerating, back
// to the opening clump on the last frame so the clip loops.
const START = 0.4;
const PEAK_SECONDS = 8.0;
const growth = (s: number) => START + 1.8 * (1 - Math.exp(-s / 0.65)) + 0.13 * s;
// 0 until the peak, rising to 1 on the last frame (ease-in).
const recedeAt = (s: number, duration: number) =>
  Math.pow(Math.min(1, Math.max(0, (s - PEAK_SECONDS) / (duration - PEAK_SECONDS))), 3);
const expansionAt = (s: number, duration: number) => {
  const r = recedeAt(s, duration);
  return growth(Math.min(s, PEAK_SECONDS)) * (1 - r) + START * r;
};

export const ColorBurst: React.FC<{ variant: ColorBurstVariant }> = ({
  variant,
}) => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<ReturnType<typeof createBurstRenderer> | null>(null);
  const [ready, setReady] = useState(false);
  const [initHandle] = useState(() => delayRender("Building WebGL 2 particles"));
  const palette = PALETTES[variant];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    rendererRef.current = createBurstRenderer(canvas, palette);
    setReady(true);
    continueRender(initHandle);
    return () => {
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, [palette, initHandle]);

  useEffect(() => {
    const r = rendererRef.current;
    if (!ready || !r) return;
    const handle = delayRender(`Rendering frame ${frame}`);
    const s = frame / fps;
    // Last frame lands exactly on the loop point.
    const duration = (durationInFrames - 1) / fps;
    const expand = expansionAt(s, duration);
    // Slow tumble of the cloud plus a gentle push-in.
    const loop = recedeAt(s, duration);
    r.render({
      expand,
      yaw: 0.22 * Math.sin((s / duration) * Math.PI * 0.9) * (1 - loop),
      pitch: -0.12 + 0.06 * Math.sin(s * 0.7) * (1 - loop),
      cameraZ: 6.2 - 0.6 * smoothstep(0, PEAK_SECONDS, s) * (1 - loop),
      centerY: 0.14 * (1 - smoothstep(0.0, 2.5, s) * (1 - loop)),
      seed: (frame % 89) * 1.73,
    });
    continueRender(handle);
  }, [frame, ready, fps, durationInFrames]);

  const bg = palette.background.map((v) => Math.round(v * 255));
  return (
    <AbsoluteFill style={{ backgroundColor: `rgb(${bg.join(",")})` }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%" }}
      />
    </AbsoluteFill>
  );
};
