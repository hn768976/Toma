import React, { useMemo } from "react";
import { AbsoluteFill } from "remotion";
import { DURATION_IN_FRAMES } from "./constants";
import { hash4, mulberry32 } from "./lib/random";

const TILE = 256;

let cachedTile: string | null = null;

/**
 * Fine monochrome grain, tiled and re-offset every frame. The gradient in the
 * background would band badly in H.264 without it — check the encoded file,
 * the studio preview does not show the banding.
 */
const grainTile = () => {
  if (cachedTile) return cachedTile;
  const canvas = document.createElement("canvas");
  canvas.width = TILE;
  canvas.height = TILE;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(TILE, TILE);
  const rand = mulberry32(0x5eed11);
  for (let i = 0; i < TILE * TILE; i++) {
    // Centred on mid grey so `overlay` dithers both directions.
    const v = 128 + Math.round((rand() - 0.5) * 168);
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  cachedTile = canvas.toDataURL("image/png");
  return cachedTile;
};

export const Grain: React.FC<{ frame: number; opacity?: number }> = ({
  frame,
  opacity = 0.021,
}) => {
  const url = useMemo(() => grainTile(), []);
  const f = ((frame % DURATION_IN_FRAMES) + DURATION_IN_FRAMES) % DURATION_IN_FRAMES;
  const x = Math.floor(hash4(f, 3, 7, 11) * TILE);
  const y = Math.floor(hash4(f, 13, 17, 19) * TILE);

  return (
    <AbsoluteFill
      style={{
        backgroundImage: `url(${url})`,
        backgroundRepeat: "repeat",
        backgroundPosition: `${x}px ${y}px`,
        opacity,
        mixBlendMode: "overlay",
        pointerEvents: "none",
      }}
    />
  );
};

export const Vignette: React.FC<{ strength?: number }> = ({ strength = 0.24 }) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(120% 92% at 50% 46%, rgba(0,0,0,0) 42%, rgba(0,0,0,${strength}) 100%)`,
      pointerEvents: "none",
    }}
  />
);
