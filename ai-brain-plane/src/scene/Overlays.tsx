import { useMemo } from "react";
import { AbsoluteFill } from "remotion";
import { hash1, mulberry32 } from "../lib/random";
import type { Theme } from "../theme";

/**
 * DOM layers that sit over the 3D canvas: the selective bloom halos, the
 * vignette, and the film grain.
 */

/** Grain amplitude as a fraction of full range, roughly. */
const GRAIN_OPACITY = 0.05;
const GRAIN_TILE = 256;

const buildGrain = (): string => {
  const canvas = document.createElement("canvas");
  canvas.width = GRAIN_TILE;
  canvas.height = GRAIN_TILE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const img = ctx.createImageData(GRAIN_TILE, GRAIN_TILE);
  const rng = mulberry32(0x6a1c0ffe);
  for (let i = 0; i < GRAIN_TILE * GRAIN_TILE; i++) {
    // Centred on mid grey so an `overlay` blend leaves the average untouched.
    const v = 128 + Math.round((rng() - 0.5) * 100);
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL("image/png");
};

let grainUrl: string | null = null;
const getGrainUrl = () => {
  if (grainUrl === null) grainUrl = buildGrain();
  return grainUrl;
};

export const Grain: React.FC<{ frame: number }> = ({ frame }) => {
  const url = useMemo(() => getGrainUrl(), []);
  // Jump the tile to a new offset every frame so the grain never crawls.
  const ox = Math.floor(hash1(frame * 2 + 1) * GRAIN_TILE);
  const oy = Math.floor(hash1(frame * 2 + 977) * GRAIN_TILE);
  return (
    <AbsoluteFill
      style={{
        backgroundImage: `url(${url})`,
        backgroundRepeat: "repeat",
        backgroundPosition: `${ox}px ${oy}px`,
        opacity: GRAIN_OPACITY,
        mixBlendMode: "overlay",
        pointerEvents: "none",
      }}
    />
  );
};

export const Vignette: React.FC = () => (
  <AbsoluteFill
    style={{
      background:
        "radial-gradient(ellipse 76% 68% at 50% 47%, rgba(0,0,0,0) 34%, rgba(0,0,0,0.5) 74%, rgba(0,0,0,0.93) 100%)",
      pointerEvents: "none",
    }}
  />
);

export const Backdrop: React.FC<{ theme: Theme }> = ({ theme }) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(ellipse 135% 105% at 60% 88%, ${theme.bgInner} 0%, ${theme.bgOuter} 52%, #000000 92%)`,
    }}
  />
);

/**
 * The brain's bloom. Screen-blended halos placed over the projected position
 * of the brain and the contact point — the two things the reference blooms —
 * so the plane keeps its contrast and the binary strings stay legible.
 */
export const BloomHalo: React.FC<{
  theme: Theme;
  /** Centre, as a fraction of frame width / height. */
  x: number;
  y: number;
  /** Diameter in pixels of the composition. */
  size: number;
  opacity: number;
  /** Inner hardness: higher keeps more energy near the centre. */
  falloff?: number;
}> = ({ theme, x, y, size, opacity, falloff = 62 }) => {
  if (opacity <= 0.001 || size <= 0) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "screen" }}>
      <div
        style={{
          position: "absolute",
          left: `${x * 100}%`,
          top: `${y * 100}%`,
          width: size,
          height: size,
          transform: "translate(-50%, -50%)",
          borderRadius: "50%",
          opacity,
          background: `radial-gradient(circle, ${theme.bloom} 0%, rgba(0,0,0,0) ${falloff}%)`,
        }}
      />
    </AbsoluteFill>
  );
};
