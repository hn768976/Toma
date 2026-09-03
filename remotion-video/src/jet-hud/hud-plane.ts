import { HEIGHT, PLANE_TILE, WIDTH, cameraDrift, loopPhase } from "./constants";
import type { Plane, TiltedPlaneConfig } from "../lib/TiltedPlane";
import type { Variant } from "./variants";

/**
 * The project's reading of the library's generic <TiltedPlane>: the plane
 * config for a variant, and the two per-frame quantities the HUD layers need
 * that the library has no business knowing about.
 */

export const planeConfig = (v: Variant, frame: number): TiltedPlaneConfig => ({
  width: WIDTH,
  height: HEIGHT,
  rotationDeg: v.planeRotationDeg,
  skewDeg: v.planeSkewDeg,
  scaleX: v.planeScaleX,
  offset: cameraDrift(frame),
});

export type HudPlane = Plane & {
  /**
   * Plane-space scroll offset, opposite to the jet's travel. Advances by
   * exactly one PLANE_TILE over the loop, so tiling content (grid, strips,
   * code column) drifts continuously and still closes at frame 390.
   */
  drift: number;
  /**
   * The anchored panels cannot tile, so they cannot drift monotonically and
   * still land back on frame 0. They get a small closed sway in the same
   * direction sense instead — enough to keep the plane alive against the jet.
   */
  sway: number;
  /** The bloom accumulator, already in plane space. */
  glow: CanvasRenderingContext2D;
  variant: Variant;
};

export const asHudPlane = (
  plane: Plane,
  variant: Variant,
  frame: number,
): HudPlane => ({
  ...plane,
  drift: -variant.flightDir * PLANE_TILE * loopPhase(frame),
  sway: -variant.flightDir * 14 * Math.sin(loopPhase(frame) * Math.PI * 2),
  glow: plane.extra.glow,
  variant,
});
