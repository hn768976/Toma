import { useMemo } from "react";
import { makeCanvas, useDofBuffers, type DofBuffers } from "../lib/dofBuffers";
import { makeGrainTiles, makeScanlineTile } from "../lib/postFx";
import { HEIGHT, WIDTH } from "./constants";

/**
 * Every offscreen surface the piece needs, allocated once: the three
 * depth-of-field bands (from the library), a bloom accumulator, and the two
 * static tiles the finishing passes need.
 *
 * The bloom accumulator is quarter resolution — it is about to be blurred by
 * 34 and 96 pixels, so there is nothing in the detail to keep.
 */
export const GLOW_SCALE = 0.25;

/** Output-space blur radii. The mid band is deliberately left sharp. */
const DOF_BLUR = { far: 20, mid: 0, near: 11 };

export type Surfaces = {
  dof: DofBuffers;
  glow: HTMLCanvasElement;
  scanlines: HTMLCanvasElement;
  grainTiles: HTMLCanvasElement[];
};

export const useSurfaces = (): Surfaces => {
  const dof = useDofBuffers({ width: WIDTH, height: HEIGHT, blur: DOF_BLUR });
  const rest = useMemo(
    () => ({
      glow: makeCanvas(WIDTH * GLOW_SCALE, HEIGHT * GLOW_SCALE),
      scanlines: makeScanlineTile(5, 0.03),
      // Six tiles, cycled on frame % 390. 390 is divisible by 6, so the last
      // frame of the loop draws the same tile as the first.
      grainTiles: makeGrainTiles(6, 512),
    }),
    [],
  );
  return { dof, ...rest };
};
