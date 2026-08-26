import React, { useLayoutEffect, useMemo, useRef } from "react";
import { useCurrentFrame } from "remotion";
import { HEIGHT, WIDTH } from "./config";
import { buildLedTexture } from "./textures";
import type { Variant } from "./theme";

const LAYER_STYLE: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
};

/**
 * The LED panel and its dark centre. Nothing here moves, so the whole layer is
 * rendered once into an offscreen canvas and blitted on every frame.
 */
export const LedBackground: React.FC<{ variant: Variant }> = ({ variant }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const texture = useMemo(() => buildLedTexture(variant), [variant]);

  // Read the frame so the blit happens once per rendered frame, exactly like
  // the layers above it.
  useCurrentFrame();

  useLayoutEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(texture, 0, 0);
  });

  return (
    <canvas
      ref={canvasRef}
      width={WIDTH}
      height={HEIGHT}
      style={LAYER_STYLE}
    />
  );
};
