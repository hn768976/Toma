import type { Strand } from "./geometry";
import type { Variant } from "./variants";
import type { Ctx } from "../lib";

/** Everything a layer needs to draw one frame. Rebuilt per frame, cheaply. */
export type Scene = {
  main: Ctx;
  variant: Variant;
  frame: number;
  /** Normalised loop position, frame / LOOP, in [0, 1). */
  p: number;
  /** Ambient camera drift, already folded into every drawn position. */
  camX: number;
  camY: number;
  vpx: number;
  vpy: number;
  /** The frame edge the strands' plane runs out to. */
  nearEdgeY: number;
  spread: number;
  strands: Strand[];
  /** Lateral strand density across the frame, 0..1 per bin. */
  density: number[];
};
