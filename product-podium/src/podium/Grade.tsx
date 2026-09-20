/**
 * The post chain: depth of field, vignette, grain.
 *
 * All three run in image space over the rendered canvas rather than as GPU
 * passes, for two reasons. They are exactly reproducible — no sampling, no
 * temporal accumulation, nothing that could differ between two render
 * threads drawing neighbouring frames. And because the camera is locked, a
 * masked blur over a fixed region of frame *is* a depth-of-field: the far
 * field never moves, so there is nothing a depth buffer would tell us that
 * the mask does not already know.
 *
 * Grain is blended with `overlay` on purpose. Overlay leaves a black pixel
 * black, which is what lets look 2 carry 1.5% grain over its lit areas and
 * still encode true 0,0,0 in the corners for screen-blend use. It also
 * dithers the gradients in looks 1 and 3, which are the two banding risks
 * in the set.
 */
import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { mulberry32 } from "./random";
import type { DofConfig, GradeConfig } from "./types";

/* ------------------------------------------------------------------ */
/* Depth of field                                                      */
/* ------------------------------------------------------------------ */

const svgMask = (
  top: number,
  bottom: number,
  sharp: DofConfig["sharp"],
) => {
  const t = (top * 100).toFixed(3);
  const b = (bottom * 100).toFixed(3);
  const pocket = sharp
    ? `<radialGradient id="p" cx="50%" cy="50%" r="50%">` +
      `<stop offset="0%" stop-color="#000" stop-opacity="1"/>` +
      `<stop offset="${((1 - sharp.feather) * 100).toFixed(1)}%" stop-color="#000" stop-opacity="1"/>` +
      `<stop offset="100%" stop-color="#000" stop-opacity="0"/>` +
      `</radialGradient>`
    : "";
  const pocketShape = sharp
    ? `<ellipse cx="${(sharp.cx * 100).toFixed(3)}" cy="${(sharp.cy * 100).toFixed(3)}" ` +
      `rx="${(sharp.rx * 100).toFixed(3)}" ry="${(sharp.ry * 100).toFixed(3)}" fill="url(#p)"/>`
    : "";

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" ` +
    `viewBox="0 0 100 100" preserveAspectRatio="none">` +
    `<defs>` +
    `<linearGradient id="g" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0%" stop-color="#fff" stop-opacity="1"/>` +
    `<stop offset="${t}%" stop-color="#fff" stop-opacity="1"/>` +
    `<stop offset="${b}%" stop-color="#fff" stop-opacity="0"/>` +
    `<stop offset="100%" stop-color="#fff" stop-opacity="0"/>` +
    `</linearGradient>` +
    pocket +
    `<mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">` +
    `<rect width="100" height="100" fill="url(#g)"/>` +
    pocketShape +
    `</mask>` +
    `</defs>` +
    `<rect width="100" height="100" fill="#fff" mask="url(#m)"/>` +
    `</svg>`;

  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
};

export const DepthOfField: React.FC<{ dof: DofConfig | null }> = ({ dof }) => {
  const { height } = useVideoConfig();
  if (!dof) return null;
  return (
    <>
      {dof.layers.map((layer, i) => {
        const mask = svgMask(layer.top, layer.bottom, dof.sharp);
        const blur = layer.blur * height;
        return (
          <AbsoluteFill
            key={i}
            style={{
              backdropFilter: `blur(${blur}px)`,
              WebkitBackdropFilter: `blur(${blur}px)`,
              maskImage: mask,
              WebkitMaskImage: mask,
              maskSize: "100% 100%",
              WebkitMaskSize: "100% 100%",
              maskRepeat: "no-repeat",
              WebkitMaskRepeat: "no-repeat",
              pointerEvents: "none",
            }}
          />
        );
      })}
    </>
  );
};

/* ------------------------------------------------------------------ */
/* Grain                                                               */
/* ------------------------------------------------------------------ */

const TILE = 128;
/**
 * 12 tiles cycled against a 25-frame offset sequence: the two coprime
 * periods multiply out to exactly 300, so the grain pattern completes one
 * whole cycle over the clip and never repeats visibly within it.
 */
const TILE_COUNT = 12;
const OFFSET_PERIOD = 25;

const tileCache = new Map<number, string[]>();

const grainTiles = (amplitude: number) => {
  const key = Math.round(amplitude * 10000);
  const hit = tileCache.get(key);
  if (hit) return hit;

  // Overlay blending deviates the result by (blend - 0.5), so the stored
  // deviation is the amplitude directly.
  const swing = amplitude * 255;
  const tiles: string[] = [];
  for (let t = 0; t < TILE_COUNT; t++) {
    const c = document.createElement("canvas");
    c.width = TILE;
    c.height = TILE;
    const ctx = c.getContext("2d")!;
    const img = ctx.createImageData(TILE, TILE);
    const rnd = mulberry32(0x9e3779b9 ^ (t * 2654435761));
    for (let i = 0; i < TILE * TILE; i++) {
      // Triangular PDF — a better dither than uniform noise at these levels.
      const n = rnd() + rnd() - 1;
      const v = Math.max(0, Math.min(255, Math.round(128 + n * swing)));
      const o = i * 4;
      img.data[o] = v;
      img.data[o + 1] = v;
      img.data[o + 2] = v;
      img.data[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    tiles.push(c.toDataURL("image/png"));
  }
  tileCache.set(key, tiles);
  return tiles;
};

export const Grain: React.FC<{ amplitude: number }> = ({ amplitude }) => {
  const frame = useCurrentFrame();
  const tiles = useMemo(() => grainTiles(amplitude), [amplitude]);
  if (amplitude <= 0) return null;

  // One noise texel per *output* pixel at whatever --scale the render uses.
  const texel = 1 / (typeof window === "undefined" ? 1 : window.devicePixelRatio || 1);
  const phase = frame % OFFSET_PERIOD;
  const ox = ((phase * 37) % TILE) * texel;
  const oy = ((phase * 53) % TILE) * texel;

  return (
    <AbsoluteFill
      style={{
        backgroundImage: `url(${tiles[frame % TILE_COUNT]})`,
        backgroundRepeat: "repeat",
        backgroundSize: `${TILE * texel}px ${TILE * texel}px`,
        backgroundPosition: `${ox}px ${oy}px`,
        mixBlendMode: "overlay",
        pointerEvents: "none",
      }}
    />
  );
};

/* ------------------------------------------------------------------ */
/* Vignette                                                            */
/* ------------------------------------------------------------------ */

export const Vignette: React.FC<{ strength: number }> = ({ strength }) => {
  if (strength <= 0) return null;
  return (
    <AbsoluteFill
      style={{
        background:
          `radial-gradient(ellipse 72% 78% at 50% 52%, ` +
          `rgba(0,0,0,0) 0%, rgba(0,0,0,0) 46%, ` +
          `rgba(0,0,0,${(strength * 0.45).toFixed(3)}) 76%, ` +
          `rgba(0,0,0,${strength.toFixed(3)}) 100%)`,
        pointerEvents: "none",
      }}
    />
  );
};

/**
 * Grain and vignette only. Depth of field is a WebGL pass now — see
 * DepthOfFieldPass.tsx for why. These two are plain DOM painting rather
 * than filters, and painting does survive the headless capture.
 */
export const Grade: React.FC<{ grade: GradeConfig }> = ({ grade }) => (
  <>
    <Vignette strength={grade.vignette} />
    <Grain amplitude={grade.grain} />
  </>
);
