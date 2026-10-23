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

// Expansion of the burst over time (world units). It erupts from a small
// clump, fills the frame by ~3 s and keeps billowing slowly; in the last
// ~0.65 s it collapses back to the opening clump so the clip loops, exactly
// like the reference.
const START = 0.16;
const growth = (s: number) => START + 1.8 * (1 - Math.exp(-s / 0.65)) + 0.13 * s;
const expansionAt = (s: number, duration: number) => {
  const collapse = smoothstep(duration - 0.7, duration, s);
  const eased = collapse * collapse * (3 - 2 * collapse);
  return growth(s) * (1 - eased) + START * eased;
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
    const duration = durationInFrames / fps;
    const expand = expansionAt(s, duration);
    // Slow tumble of the cloud plus a gentle push-in.
    const loop = smoothstep(duration - 0.7, duration, s);
    r.render({
      expand,
      yaw: 0.22 * Math.sin((s / duration) * Math.PI * 0.9) * (1 - loop),
      pitch: -0.12 + 0.06 * Math.sin(s * 0.7) * (1 - loop),
      cameraZ: 6.2 - 0.6 * smoothstep(0, duration - 0.7, s) * (1 - loop),
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
