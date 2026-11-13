import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";
import { DESIGN_H, DESIGN_W, drawHud } from "./hud/draw";
import { loadFonts } from "./lib/fonts";
import { NEON, REFERENCE } from "./lib/palettes";

export const hudSchema = z.object({
  palette: z.enum(["reference", "neon"]),
});

/**
 * Canvas 2D sci-fi "Data Sequence Analysis" HUD.
 * Rendered natively at the composition resolution (3840 x 2160): the whole
 * layout is authored in a 768 x 432 design grid and scaled by width / 768.
 */
export const DataSequenceHud: React.FC<z.infer<typeof hudSchema>> = ({ palette }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glowRef = useRef<HTMLCanvasElement | null>(null);
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender("Drawing HUD frame"));
  const p = palette === "neon" ? NEON : REFERENCE;

  useEffect(() => {
    loadFonts().then(() => setReady(true));
  }, []);

  useLayoutEffect(() => {
    if (!ready) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D context unavailable");

    const s = width / DESIGN_W;
    ctx.setTransform(s, 0, 0, height / DESIGN_H, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    drawHud(ctx, frame, p);

    // Soft phosphor glow: blur a quarter-res copy and add it back.
    if (p.glow > 0) {
      if (!glowRef.current) glowRef.current = document.createElement("canvas");
      const g = glowRef.current;
      g.width = Math.round(width / 4);
      g.height = Math.round(height / 4);
      const gctx = g.getContext("2d")!;
      gctx.filter = `blur(${(width / 3840) * 4}px)`;
      gctx.clearRect(0, 0, g.width, g.height);
      gctx.drawImage(canvas, 0, 0, g.width, g.height);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = p.glow;
      ctx.drawImage(g, 0, 0, width, height);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    }
    continueRender(handle);
  }, [frame, ready, p, width, height, handle]);

  return (
    <AbsoluteFill style={{ backgroundColor: p.bg }}>
      <canvas ref={canvasRef} width={width} height={height} style={{ width, height }} />
    </AbsoluteFill>
  );
};
