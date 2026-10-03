import { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { useAssets } from "../common/assets";
import { CANDLE_PALETTES } from "../common/palettes";
import { buildMapLayer, drawFrame, Layers } from "./draw";

export const CandleChartFlow: React.FC<{ paletteId: string }> = ({ paletteId }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const world = useAssets("110m");
  const palette = CANDLE_PALETTES.find((p) => p.id === paletteId)!;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio;
  const pw = Math.floor(width * dpr);
  const ph = Math.floor(height * dpr);

  // Static layers (pure functions of palette + size), built once.
  const layers = useMemo<Layers | null>(() => {
    if (!world) return null;
    const glow = document.createElement("canvas");
    glow.width = pw;
    glow.height = ph;
    return { map: buildMapLayer(world, palette, dpr), glow };
  }, [world, palette, dpr, pw, ph]);

  useLayoutEffect(() => {
    const c = canvasRef.current;
    if (!c || !layers) return;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    drawFrame(ctx, layers, palette, frame, dpr);
  }, [frame, layers, palette, dpr]);

  return (
    <AbsoluteFill style={{ backgroundColor: palette.bgEdge }}>
      <canvas ref={canvasRef} width={pw} height={ph} style={{ width, height }} />
    </AbsoluteFill>
  );
};
