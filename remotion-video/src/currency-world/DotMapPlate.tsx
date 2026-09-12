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

// Edge falloff, baked into each dot's alpha rather than applied as a
// CSS mask. The plate is a few thousand rects; a mask (or a blur) on a
// layer that size forces Chromium to re-rasterise the whole thing on
// every frame, where an unfiltered plate rasterises once and is only
// re-composited as the camera moves. Same picture, a fraction of the
// render time.
const EDGE_RX = 1.36; // normalised radii of the falloff ellipse
const EDGE_RY = 1.56;
const EDGE_SOLID = 0.52; // fully opaque inside this fraction of it

const edgeAlpha = (col: number, row: number) => {
  const u = ((col + 0.5) / DOT_COLS) * 2 - 1;
  const v = ((row + 0.5) / DOT_ROWS) * 2 - 1;
  const d = Math.hypot(u / EDGE_RX, v / EDGE_RY);
  if (d <= EDGE_SOLID) return 1;
  return Math.max(0, (1 - d) / (1 - EDGE_SOLID));
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
    const alpha = ((0.45 + roll * 0.55) * edgeAlpha(dot.col, dot.row)).toFixed(
      3,
    );
    if (Number(alpha) < 0.02) continue;
    parts.push(
      `<rect x="${(dot.col + offset).toFixed(3)}" y="${(dot.row + offset).toFixed(3)}" width="${size}" height="${size}" fill="${fill}" opacity="${alpha}"/>`,
    );
  }

  const scatterRand = rngFor(spec.seed + 97, 4409);
  for (let i = 0; i < spec.scatter; i++) {
    const col = Math.floor(scatterRand() * DOT_COLS);
    const row = Math.floor(scatterRand() * DOT_ROWS);
    const alpha = (0.16 + scatterRand() * 0.3) * edgeAlpha(col, row);
    if (alpha < 0.02) continue;
    parts.push(
      `<rect x="${(col + offset).toFixed(3)}" y="${(row + offset).toFixed(3)}" width="${size}" height="${size}" fill="${palette.dotDim}" opacity="${alpha.toFixed(3)}"/>`,
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${DOT_COLS} ${DOT_ROWS}" width="100%" height="100%">${parts.join("")}</svg>`;
};

export const DotMapPlate: React.FC<{
  spec: PlateSpec;
  palette: Palette;
  transform: string;
  opacity: number;
}> = ({ spec, palette, transform, opacity }) => {
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
        willChange: "transform",
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};
