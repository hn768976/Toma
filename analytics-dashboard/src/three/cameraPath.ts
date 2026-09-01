/**
 * The camera move, as a pure function of the frame number.
 *
 * Nothing here reads a clock, a delta or r3f's `useFrame` timing: the rig and
 * the depth-of-field settings both call this with Remotion's frame, so the move
 * is identical on every render and every worker renders the same picture for
 * the same frame.
 */

import { Easing, interpolate } from "remotion";
import * as THREE from "three";
import { CAMERA_FAR, PLANE_NORMAL } from "./scene";

export type CameraState = {
  position: THREE.Vector3;
  target: THREE.Vector3;
  /** Normalised (0..1 of the far plane) distance to what the camera is aimed at. */
  focusDistance: number;
};

const EASE_INOUT = Easing.inOut(Easing.cubic);

/**
 * Distance from the camera to the point where its view ray meets the tilted
 * plane. The plane passes through the origin, so this reduces to a single dot
 * product ratio. Feeding this to the DOF effect keeps the mid-distance of the
 * plane sharp while both the near and the far edge fall off.
 */
const distanceToPlane = (position: THREE.Vector3, target: THREE.Vector3): number => {
  const direction = target.clone().sub(position).normalize();
  const denominator = PLANE_NORMAL.dot(direction);
  if (Math.abs(denominator) < 1e-6) return position.length();
  return Math.abs(-PLANE_NORMAL.dot(position) / denominator);
};

export const getCameraState = (frame: number, durationInFrames: number): CameraState => {
  const span: [number, number] = [0, durationInFrames];

  // Slow left-to-right drift, easing in and out, so different regions of the
  // dashboard come into view: the chart early, the counters and donut later.
  const x = interpolate(frame, span, [-2.05, 2.6], {
    easing: EASE_INOUT,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Drifting down as it travels right, following the layout from the chart to
  // the counter row.
  const y = interpolate(frame, span, [1.25, -1.05], {
    easing: EASE_INOUT,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // A very slight push in across the duration.
  const z = interpolate(frame, span, [12.0, 10.2], {
    easing: Easing.inOut(Easing.quad),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Handheld wobble: a few incommensurate sines, so it never repeats within the
  // shot and never resolves into a visible rhythm.
  const wobbleX = Math.sin(frame * 0.047) * 0.085 + Math.sin(frame * 0.0191 + 2.1) * 0.05;
  const wobbleY = Math.sin(frame * 0.0331 + 1.2) * 0.072 + Math.sin(frame * 0.0113) * 0.038;
  const wobbleZ = Math.sin(frame * 0.0257 + 0.6) * 0.05;

  const position = new THREE.Vector3(x + wobbleX, y + wobbleY, z + wobbleZ);
  // The aim point travels with the camera, so the move reads as a translation
  // across the panel rather than an orbit around it.
  const target = new THREE.Vector3(
    x * 0.82 + Math.sin(frame * 0.0217 + 0.4) * 0.04,
    y * 0.55 + Math.sin(frame * 0.0173 + 2.6) * 0.035,
    0,
  );

  return {
    position,
    target,
    focusDistance: distanceToPlane(position, target) / CAMERA_FAR,
  };
};
