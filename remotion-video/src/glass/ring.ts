import * as THREE from "three";
import { TAU } from "./constants";

/** Where panel `index` of `count` sits around the ring, once `spin` is applied. */
export const ringAngle = (index: number, count: number, spin: number) =>
  (index / count) * TAU + spin;

/**
 * Places a panel at `angle` around a vertical axis, with its face tangent to
 * the circle (its +Z normal pointing radially outward) and then turned
 * `pivot` about its own vertical axis.
 *
 * Equal angular spacing is the point: because every panel sits on the same
 * circle at the same step, neighbours cannot interpenetrate no matter how the
 * ring is spun, which a linear stack with an animated splay could not
 * guarantee.
 */
export const placeOnRing = (
  object: THREE.Object3D,
  angle: number,
  radius: number,
  pivot: number,
) => {
  object.position.set(radius * Math.sin(angle), 0, radius * Math.cos(angle));
  object.rotation.set(0, angle + pivot, 0);
};

/**
 * A travelling wave of pivot, written against the panel's *angle* rather than
 * its index.
 *
 * This matters for looping. Keyed to index, a spinning ring would end the loop
 * with every panel carrying the pivot of the panel that used to be eight
 * places away, so the final pose would not match frame 0 however tidy the
 * spin. Keyed to angle, the wave is a property of the space the panels move
 * through: with whole numbers of cycles in both terms it is identical at the
 * start and end of the loop no matter where the panels have travelled to.
 */
export const pivotWave = (
  angle: number,
  phase: number,
  amplitude: number,
  spatialCycles: number,
  temporalCycles: number,
) => amplitude * Math.sin(temporalCycles * phase + spatialCycles * angle);

/**
 * The smallest radius at which `count` panels still leave `gap` of clear arc
 * between neighbours, given how far each is pivoted off tangent.
 *
 * The pivot matters a lot. A panel turned `pivot` off tangent occupies only
 * `w*cos(pivot) + depth*sin(pivot)` of arc, so packing against its full width
 * instead would push the ring out to nearly twice the radius it needs and
 * leave the panels visibly marooned from each other. Pass the *widest* pivot
 * the animation reaches, so the clearance holds for every frame.
 */
export const radiusForGap = (
  count: number,
  panelWidth: number,
  panelDepth: number,
  pivot: number,
  gap: number,
) => {
  const footprint =
    Math.abs(panelWidth * Math.cos(pivot)) + Math.abs(panelDepth * Math.sin(pivot));
  return (count * (footprint + gap)) / TAU;
};
