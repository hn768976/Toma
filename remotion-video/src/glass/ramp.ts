import * as THREE from "three";

/**
 * Samples a multi-stop colour ramp in linear space.
 *
 * Interpolating in linear rather than sRGB keeps the violet-to-magenta run
 * from going muddy in the middle, which is exactly where the reference is
 * most saturated.
 */
export const sampleRamp = (stops: readonly string[], t: number): THREE.Color => {
  const clamped = Math.min(1, Math.max(0, t));
  const scaled = clamped * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.floor(scaled));
  const local = scaled - index;

  const a = new THREE.Color(stops[index]).convertSRGBToLinear();
  const b = new THREE.Color(stops[index + 1]).convertSRGBToLinear();
  return a.lerp(b, local).convertLinearToSRGB();
};
