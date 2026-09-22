import React from "react";
import { useCurrentFrame } from "remotion";
import { mulberry32 } from "./random";

/**
 * Grain / dither overlay.
 *
 * Banding is the main risk in this batch: large smooth dark gradients with a
 * bright glow over them is the worst case for 8-bit H.264. A per-pixel noise
 * layer at ~2% breaks the plateaus up into dither.
 *
 * The noise tiles are generated ONCE at module level from a seeded PRNG and
 * baked into data URIs. Nothing is random at render time, and cycling
 * `frame % TILE_COUNT` makes the grain periodic with period 6 — which divides
 * both 600 and 300, so it closes on every composition in this project.
 */
const TILE = 256;
const TILE_COUNT = 6;

const buildTiles = (): string[] => {
  if (typeof document === "undefined") return [];
  const out: string[] = [];
  for (let t = 0; t < TILE_COUNT; t++) {
    const canvas = document.createElement("canvas");
    canvas.width = TILE;
    canvas.height = TILE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return out;
    const img = ctx.createImageData(TILE, TILE);
    const rnd = mulberry32(0x5eed01 + t * 7717);
    for (let i = 0; i < TILE * TILE; i++) {
      // Centred on mid-grey so `overlay` pushes symmetrically either way.
      const v = 96 + Math.floor(rnd() * 64);
      img.data[i * 4] = v;
      img.data[i * 4 + 1] = v;
      img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    out.push(canvas.toDataURL("image/png"));
  }
  return out;
};

const TILES = buildTiles();

export const Grain: React.FC<{
  /** 0.015 - 0.025 is the useful band; push toward 0.025 if bands survive. */
  opacity?: number;
  /**
   * Texel size in composition px. 2 means one noise texel lands on exactly one
   * output pixel at --scale=0.5 (the 1080p preview), and two at --scale=1.
   */
  texel?: number;
}> = ({ opacity = 0.02, texel = 2 }) => {
  const frame = useCurrentFrame();
  if (TILES.length === 0) return null;
  const src = TILES[((frame % TILE_COUNT) + TILE_COUNT) % TILE_COUNT];
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundImage: `url(${src})`,
        backgroundRepeat: "repeat",
        backgroundSize: `${TILE * texel}px ${TILE * texel}px`,
        imageRendering: "pixelated",
        mixBlendMode: "overlay",
        opacity,
        pointerEvents: "none",
      }}
    />
  );
};

/**
 * A second, much finer pass used underneath bright glow halos where the ramp is
 * steepest. Uses a different tile phase so it does not correlate with `Grain`.
 */
export const DitherPatch: React.FC<{ opacity?: number }> = ({ opacity = 0.018 }) => {
  const frame = useCurrentFrame();
  if (TILES.length === 0) return null;
  const src = TILES[((frame + 3) % TILE_COUNT + TILE_COUNT) % TILE_COUNT];
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundImage: `url(${src})`,
        backgroundRepeat: "repeat",
        backgroundSize: `${TILE * 2}px ${TILE * 2}px`,
        imageRendering: "pixelated",
        mixBlendMode: "soft-light",
        opacity,
        pointerEvents: "none",
      }}
    />
  );
};
