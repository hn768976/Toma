import React, { useLayoutEffect, useMemo, useRef } from "react";
import { random } from "remotion";
import { createBuffer } from "../lib/canvas";
import { mulberry32 } from "../lib/rng";

export interface PostFxProps {
  width: number;
  height: number;
  frame: number;
  duration: number;
  /** Peak darkening at the corners. */
  vignetteStrength?: number;
  grainAlpha?: number;
}

// The grain tile is half the frame's resolution and upscaled without
// smoothing: 2px grain at 4K, ~1px in the 1080p preview. Generating noise at
// the full 8.3M pixels every frame would dominate the render.
const GRAIN_SCALE = 0.5;

/**
 * Vignette and film grain. The grain is reseeded from `frame % duration`, so
 * it is a pure function of the frame number and identical across renders —
 * and frame 450 gets exactly frame 0's noise, closing the loop.
 */
export const PostFx: React.FC<PostFxProps> = ({
  width,
  height,
  frame,
  duration,
  vignetteStrength = 0.22,
  grainAlpha = 0.04,
}) => {
  const vignetteRef = useRef<HTMLCanvasElement>(null);
  const grainRef = useRef<HTMLCanvasElement>(null);

  const grainBuffer = useMemo(
    () => createBuffer(width * GRAIN_SCALE, height * GRAIN_SCALE),
    [width, height],
  );
  const grainImage = useMemo(() => {
    if (!grainBuffer) return null;
    const ctx = grainBuffer.getContext("2d");
    if (!ctx) return null;
    return ctx.createImageData(grainBuffer.width, grainBuffer.height);
  }, [grainBuffer]);

  useLayoutEffect(() => {
    const canvas = vignetteRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const cx = width / 2;
    const cy = height / 2;
    const outer = Math.sqrt(cx * cx + cy * cy);
    const g = ctx.createRadialGradient(cx, cy, outer * 0.36, cx, cy, outer);
    g.addColorStop(0, "rgba(0, 0, 0, 0)");
    g.addColorStop(0.62, `rgba(0, 0, 0, ${vignetteStrength * 0.34})`);
    g.addColorStop(1, `rgba(0, 0, 0, ${vignetteStrength})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  });

  useLayoutEffect(() => {
    const canvas = grainRef.current;
    if (!canvas || !grainBuffer || !grainImage) return;
    const out = canvas.getContext("2d");
    const bufCtx = grainBuffer.getContext("2d");
    if (!out || !bufCtx) return;

    // Seeded through Remotion's random() on the looped frame index; the fast
    // integer PRNG below only expands that one seed into pixels.
    const rng = mulberry32(
      Math.floor(random(`grain-${frame % duration}`) * 0xffffffff),
    );
    const data = grainImage.data;
    for (let i = 0; i < data.length; i += 4) {
      const v = (rng() * 255) | 0;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
    bufCtx.putImageData(grainImage, 0, 0);

    out.setTransform(1, 0, 0, 1, 0, 0);
    out.imageSmoothingEnabled = false;
    out.clearRect(0, 0, width, height);
    out.drawImage(grainBuffer, 0, 0, width, height);
  });

  return (
    <>
      <canvas
        ref={vignetteRef}
        width={width}
        height={height}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      />
      <canvas
        ref={grainRef}
        width={width}
        height={height}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          mixBlendMode: "overlay",
          opacity: grainAlpha * 1.6,
        }}
      />
    </>
  );
};
