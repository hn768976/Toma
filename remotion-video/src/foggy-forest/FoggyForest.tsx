import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  cancelRender,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";
import { loadTrees } from "./assets";
import { getGrainTiles } from "./noise";
import { PALETTES } from "./palettes";
import { drawScene, warmFogTextures } from "./render";

export const foggyForestSchema = z.object({
  palette: z.enum(["teal", "amber", "mono"]),
});

export type FoggyForestProps = z.infer<typeof foggyForestSchema>;

export const FoggyForest: React.FC<FoggyForestProps> = ({ palette }) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [handle] = useState(() => delayRender("Keying tree silhouettes"));
  const [ready, setReady] = useState(false);

  // The silhouettes are keyed to alpha once, and the fog and grain textures are
  // baked once, before the first frame is allowed through.
  useEffect(() => {
    let cancelled = false;
    loadTrees()
      .then(() => {
        warmFogTextures();
        getGrainTiles();
        if (!cancelled) setReady(true);
      })
      .catch((err) => cancelRender(err));
    return () => {
      cancelled = true;
    };
  }, []);

  // Draw synchronously before paint, so the captured frame is always the frame
  // that was asked for.
  useLayoutEffect(() => {
    if (!ready) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawScene(ctx, {
      width,
      height,
      frame,
      duration: durationInFrames,
      palette: PALETTES[palette],
    });
  });

  // Released only after the first real draw has landed.
  useEffect(() => {
    if (ready) continueRender(handle);
  }, [ready, handle]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </AbsoluteFill>
  );
};
