// The wave field every layer of the scene is displaced by.
//
// Two properties make the piece loop and tile cleanly, and both come from
// keeping the harmonics on integer multiples:
//
//  * Spatially, each term uses an integer multiple of TAU / WAVE_PERIOD, so
//    the field repeats exactly every WAVE_PERIOD world units along X. That is
//    what lets a particle drift one full period and wrap without popping.
//  * Temporally, each term uses an integer multiple of TAU per loop, so the
//    field at loopT = 1 is identical to loopT = 0.
//
// These are plain TypeScript helpers that compose TSL nodes rather than
// `Fn()` wrappers, so each call site inlines the maths into its own shader
// and the whole thing stays type-checked.

import { add, cos, float, sin } from "three/tsl";
import type { Node } from "three/webgpu";
import { WAVE_PERIOD } from "./constants";

export const TAU = Math.PI * 2;

/** Base spatial frequency: one full wave every WAVE_PERIOD world units. */
export const WAVE_K = TAU / WAVE_PERIOD;

/** A float-valued shader input: either a node or a plain JS number. */
export type FloatInput = Node<"float"> | number;

/** Lifts a plain number into a node so the two forms can be used interchangeably. */
const asFloat = (value: FloatInput): Node<"float"> =>
  typeof value === "number" ? float(value) : value;

/**
 * One harmonic of the field.
 *
 * @param a         along-band phase, i.e. x * WAVE_K
 * @param loopPhase loop phase in radians, i.e. loopT * TAU
 * @param amplitude world-unit height of this term
 * @param spatial   integer number of wavelengths per WAVE_PERIOD
 * @param temporal  integer number of cycles this term completes per loop.
 *                  Positive values travel in -X, negative in +X.
 * @param offset    constant phase offset, to stop the harmonics stacking
 *                  their crests in the same place
 */
const harmonic = (
  a: Node<"float">,
  loopPhase: Node<"float">,
  amplitude: number,
  spatial: number,
  temporal: number,
  offset: number,
  extraPhase?: Node<"float">,
): Node<"float"> => {
  let phase = a.mul(spatial).add(loopPhase.mul(temporal)).add(offset);
  if (extraPhase !== undefined) {
    phase = phase.add(extraPhase);
  }
  return sin(phase).mul(amplitude);
};

export type WaveSample = {
  /** Vertical displacement of the surface, in world units. */
  y: Node<"float">;
  /** Depth displacement of the surface, in world units. */
  z: Node<"float">;
  /** d(y)/d(x), used to build surface tangents without finite differences. */
  dydx: Node<"float">;
};

/**
 * Samples the field.
 *
 * @param x        position along the band, in world units
 * @param lag      per-strand phase lag in radians; shifts the whole field so
 *                 the strand bundle fans apart and gathers as it flows
 * @param loopT    normalised loop time in [0, 1)
 */
export const sampleWave = (
  x: FloatInput,
  lag: FloatInput,
  loopT: FloatInput,
): WaveSample => {
  const a = asFloat(x).mul(WAVE_K);
  const loopPhase = asFloat(loopT).mul(TAU);
  const l = asFloat(lag);

  // Height. The negative temporal signs make the dominant crests travel in
  // +X, matching the reference's left-to-right drift; the one positive term
  // counter-travels so the silhouette morphs rather than merely sliding.
  const y = add(
    harmonic(a, loopPhase, 0.95, 1, -1, 0, l),
    harmonic(a, loopPhase, 0.34, 2, -2, 1.7, l.mul(1.35)),
    harmonic(a, loopPhase, 0.14, 3, 2, 4.1, l.mul(0.6)),
    harmonic(a, loopPhase, 0.05, 5, -3, 2.2, l.mul(0.3)),
  );

  // Analytic derivative of the terms above. d/dx sin(k*s*x + ...) =
  // k*s*cos(...), so each term picks up its own spatial multiple.
  const dydx = add(
    cos(a.mul(1).add(loopPhase.mul(-1)).add(0).add(l)).mul(0.95 * WAVE_K * 1),
    cos(a.mul(2).add(loopPhase.mul(-2)).add(1.7).add(l.mul(1.35))).mul(
      0.34 * WAVE_K * 2,
    ),
    cos(a.mul(3).add(loopPhase.mul(2)).add(4.1).add(l.mul(0.6))).mul(
      0.14 * WAVE_K * 3,
    ),
    cos(a.mul(5).add(loopPhase.mul(-3)).add(2.2).add(l.mul(0.3))).mul(
      0.05 * WAVE_K * 5,
    ),
  );

  // Depth. Lower frequency than the height so the band reads as one sheet
  // turning through space rather than a corrugation.
  const z = add(
    harmonic(a, loopPhase, 0.62, 1, -1, 2.4, l.mul(0.8)),
    harmonic(a, loopPhase, 0.26, 2, 2, 0.8, l.mul(0.45)),
  );

  return { y, z, dydx };
};
