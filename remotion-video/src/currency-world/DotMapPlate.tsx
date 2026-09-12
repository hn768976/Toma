import React, { useMemo } from "react";
import type { Palette } from "./palette";
import { DOT_COLS, DOT_ROWS, WORLD_DOTS } from "./world-dots";
import { rngFor } from "./random";

export type PlateSpec = {
  /** Design-px width of the plate at z = 0. */
  width: number;
  /** Depth of the plate at frame 0; the dolly carries it forward. */
  z: number;
  x: number;
  y: number;
  /** 1 = every land cell, 2 = every other, ... — thins distant plates. */
  step: number;
  opacity: number;
  /** Dot edge length as a fraction of the cell pitch. */
  dotRatio: number;
  /** Loose dots sprinkled outside the landmasses, as data noise. */
  scatter: number;
  seed: number;
};

/**
 * One dot-matrix world map, drawn as a flat plane in the 3D field.
 *
 * The markup is built once per plate and injected as a raw string:
 * there are thousands of rects and they never change shape, so handing
 * React a stable HTML string keeps per-frame work down to the single
 * transform on the wrapper.
 */
const buildSvg = (spec: PlateSpec, palette: Palette) => {
  const rand = rngFor(spec.seed, 7717);
  const size = spec.dotRatio;
  const offset = (1 - size) / 2;
  const parts: string[] = [];

  for (let i = 0; i < WORLD_DOTS.length; i++) {
    if (spec.step > 1 && i % spec.step !== 0) continue;
    const dot = WORLD_DOTS[i];
    const roll = rand();
    // Most cells sit at the mid tone; a scattered few are lifted to the
    // bright tone and a few dropped to the dim one, which is what stops
    // the plate reading as a flat halftone screen.
    const fill =
      roll > 0.9 ? palette.dotBright : roll > 0.34 ? palette.dotMid : palette.dotDim;
    const alpha = (0.45 + roll * 0.55).toFixed(2);
    parts.push(
      `<rect x="${(dot.col + offset).toFixed(3)}" y="${(dot.row + offset).toFixed(3)}" width="${size}" height="${size}" fill="${fill}" opacity="${alpha}"/>`,
    );
  }

  const scatterRand = rngFor(spec.seed + 97, 4409);
  for (let i = 0; i < spec.scatter; i++) {
    const col = Math.floor(scatterRand() * DOT_COLS);
    const row = Math.floor(scatterRand() * DOT_ROWS);
    parts.push(
      `<rect x="${(col + offset).toFixed(3)}" y="${(row + offset).toFixed(3)}" width="${size}" height="${size}" fill="${palette.dotDim}" opacity="${(0.16 + scatterRand() * 0.3).toFixed(2)}"/>`,
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${DOT_COLS} ${DOT_ROWS}" width="100%" height="100%" shape-rendering="geometricPrecision">${parts.join("")}</svg>`;
};

export const DotMapPlate: React.FC<{
  spec: PlateSpec;
  palette: Palette;
  transform: string;
  opacity: number;
  blur: number;
}> = ({ spec, palette, transform, opacity, blur }) => {
  const html = useMemo(() => buildSvg(spec, palette), [spec, palette]);
  const height = (spec.width * DOT_ROWS) / DOT_COLS;

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: spec.width,
        height,
        marginLeft: -spec.width / 2,
        marginTop: -height / 2,
        transform,
        transformStyle: "preserve-3d",
        opacity: opacity * spec.opacity,
        filter: blur > 0 ? `blur(${blur.toFixed(2)}px)` : undefined,
        // Dissolve the plate's own rectangular edge — without this the
        // boundary between "map" and "no map" reads as a hard box
        // sliding through the field.
        WebkitMaskImage:
          "radial-gradient(ellipse 68% 78% at 50% 50%, rgba(0,0,0,1) 52%, rgba(0,0,0,0) 100%)",
        maskImage:
          "radial-gradient(ellipse 68% 78% at 50% 50%, rgba(0,0,0,1) 52%, rgba(0,0,0,0) 100%)",
        willChange: "transform",
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};
