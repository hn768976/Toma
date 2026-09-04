import React, { useLayoutEffect, useRef } from "react";
import { mulberry32 } from "../random";

// Fine grain, drawn at a fraction of output resolution and scaled up - which
// is both cheaper and closer to how real grain sits on an image than
// per-pixel noise. Seeded from the frame, so the loop repeats exactly.
const GRAIN_W = 480;
const GRAIN_H = 270;

export const Grain: React.FC<{ frame: number; opacity: number }> = ({
  frame,
  opacity,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rand = mulberry32(frame * 2654435761 + 1);
    const img = ctx.createImageData(GRAIN_W, GRAIN_H);
    const data = img.data;
    for (let i = 0; i < data.length; i += 4) {
      const v = rand() * 255;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }, [frame]);

  return (
    <canvas
      ref={canvasRef}
      width={GRAIN_W}
      height={GRAIN_H}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        opacity,
        mixBlendMode: "overlay",
        pointerEvents: "none",
      }}
    />
  );
};
