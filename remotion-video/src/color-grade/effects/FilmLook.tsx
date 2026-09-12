import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill } from "remotion";
import { mulberry32 } from "../noise";

// Screen-space finishing: vignette, lens falloff, chromatic fringing and
// grain. These sit outside the 3D plane because they belong to the
// camera, not to the monitor being photographed.

const GRAIN_W = 480;
const GRAIN_H = 270;

const Grain: React.FC<{ frame: number; opacity: number }> = ({ frame, opacity }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = ctx.createImageData(GRAIN_W, GRAIN_H);
    // Seeded per frame: grain must be different every frame but identical
    // on re-render, since Remotion may render a frame more than once.
    const rand = mulberry32(frame * 2654435761 + 12345);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 110 + (rand() - 0.5) * 235;
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }, [frame]);

  return (
    <canvas
      ref={ref}
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

export const FilmLook: React.FC<{
  frame: number;
  /** 0..1, how heavy the vignette is. */
  vignette?: number;
  grain?: number;
  /** Extra crush in a corner, matching the reference's falloff. */
  corner?: "bottom-left" | "bottom-right" | "none";
}> = ({ frame, vignette = 1, grain = 0.12, corner = "bottom-left" }) => {
  const cornerPos =
    corner === "bottom-left" ? "8% 96%" : corner === "bottom-right" ? "92% 96%" : null;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* Chromatic fringing, edge-weighted the way a fast lens actually
          misbehaves: nothing in the centre, warm/cool split at the
          corners. */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(120% 120% at 50% 50%, rgba(255,90,60,0) 55%, rgba(255,90,60,0.1) 88%, rgba(255,120,70,0.16) 100%)",
          mixBlendMode: "screen",
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(126% 126% at 50% 50%, rgba(60,140,255,0) 52%, rgba(60,140,255,0.09) 86%, rgba(70,160,255,0.15) 100%)",
          mixBlendMode: "screen",
          transform: "scale(1.012)",
        }}
      />
      {/* Vignette */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(112% 104% at 46% 44%, rgba(2,4,8,0) 30%, rgba(2,4,8,${
            0.40 * vignette
          }) 78%, rgba(1,2,5,${0.78 * vignette}) 100%)`,
        }}
      />
      {cornerPos ? (
        <AbsoluteFill
          style={{
            background: `radial-gradient(62% 52% at ${cornerPos}, rgba(0,0,0,${
              0.6 * vignette
            }), rgba(0,0,0,0) 72%)`,
          }}
        />
      ) : null}
      {/* Halation: a touch of warm bleed lifted off the bright panels. */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(58% 46% at 30% 22%, rgba(255,180,120,0.055), rgba(255,180,120,0) 70%)",
          mixBlendMode: "screen",
        }}
      />
      <Grain frame={frame} opacity={grain} />
    </AbsoluteFill>
  );
};
