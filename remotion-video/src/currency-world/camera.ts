import {
  BOB_AMPLITUDE_X,
  BOB_AMPLITUDE_Y,
  DOLLY_SPEED,
  PAN_SPEED,
  ROLL_DEGREES,
  YAW_DEGREES,
} from "./constants";

export type CameraDirection = "ltr" | "rtl";

export type CameraState = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  roll: number;
  /** +1 when the camera travels left-to-right, -1 the other way. */
  sign: number;
};

/**
 * The shot's only move: a steady lateral track plus a forward dolly,
 * with a slow bob on both axes so it reads as a camera rather than a
 * linear tween. `direction` flips the lateral track and the yaw lead;
 * the dolly is unchanged, so both versions push into the field.
 */
export const cameraAt = (
  seconds: number,
  direction: CameraDirection,
): CameraState => {
  const sign = direction === "ltr" ? 1 : -1;
  return {
    x:
      sign * (seconds * PAN_SPEED + Math.sin(seconds * 0.52) * BOB_AMPLITUDE_X),
    y: Math.sin(seconds * 0.37 + 1.1) * BOB_AMPLITUDE_Y,
    z: seconds * DOLLY_SPEED,
    yaw: sign * Math.sin(seconds * 0.29) * YAW_DEGREES,
    roll: sign * Math.sin(seconds * 0.21 + 0.6) * ROLL_DEGREES,
    sign,
  };
};

/**
 * World transform for the camera. A camera that moves +x is the same as
 * a world that moves -x, so every term is negated; the yaw/roll are
 * applied outside the translation so the whole field swings about the
 * eye rather than about the world origin.
 */
export const worldTransform = (cam: CameraState) =>
  [
    `rotateZ(${cam.roll.toFixed(3)}deg)`,
    `rotateY(${(-cam.yaw).toFixed(3)}deg)`,
    `translate3d(${(-cam.x).toFixed(2)}px, ${(-cam.y).toFixed(2)}px, ${cam.z.toFixed(2)}px)`,
  ].join(" ");
