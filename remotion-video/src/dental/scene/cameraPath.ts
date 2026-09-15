// Camera keyframing.
//
// Stock medical animation moves are smooth, slow and continuous -- never
// linear, never handheld. Every move in the nine versions is a short list
// of keys interpolated with the same ease, so the set feels like one shoot.

import { Easing, interpolate } from "remotion";
import { CameraState } from "./DentalStage";

export type Vec3 = [number, number, number];

export type CameraKey = {
  /** Progress through the shot, 0..1. */
  at: number;
  position: Vec3;
  target: Vec3;
  fov: number;
  roll?: number;
};

const EASE = Easing.bezier(0.4, 0, 0.25, 1);

const track = (progress: number, stops: number[], values: number[]) =>
  interpolate(progress, stops, values, {
    easing: EASE,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

export const cameraAt = (progress: number, keys: CameraKey[]): CameraState => {
  if (keys.length === 0) {
    throw new Error("cameraAt needs at least one key");
  }
  if (keys.length === 1) {
    const only = keys[0];
    return {
      position: only.position,
      target: only.target,
      fov: only.fov,
      roll: only.roll ?? 0,
    };
  }
  const stops = keys.map((k) => k.at);
  const axis = (pick: (k: CameraKey) => number) =>
    track(progress, stops, keys.map(pick));

  return {
    position: [
      axis((k) => k.position[0]),
      axis((k) => k.position[1]),
      axis((k) => k.position[2]),
    ],
    target: [
      axis((k) => k.target[0]),
      axis((k) => k.target[1]),
      axis((k) => k.target[2]),
    ],
    fov: axis((k) => k.fov),
    roll: axis((k) => k.roll ?? 0),
  };
};

/** Position on a circle around the arch centre, for orbiting shots. */
export const orbit = (
  angleInDegrees: number,
  radius: number,
  height: number,
): Vec3 => {
  const a = (angleInDegrees * Math.PI) / 180;
  return [Math.sin(a) * radius, height, Math.cos(a) * radius];
};

/**
 * A point just outside the buccal surface at a given arch angle. Used to
 * park the camera in front of one region of the arch for macro shots.
 *
 * The arch is a U opening towards -Z, so angle 0 is the front midline and
 * +/-90 degrees are the left and right molars.
 */
export const buccal = (
  angleInDegrees: number,
  distance: number,
  height: number,
): Vec3 => {
  const a = (angleInDegrees * Math.PI) / 180;
  return [Math.sin(a) * distance, height, Math.cos(a) * distance * 0.86];
};

/** Interpolate a scalar along the shot with the house ease. */
export const ramp = (
  progress: number,
  stops: number[],
  values: number[],
): number => track(progress, stops, values);
