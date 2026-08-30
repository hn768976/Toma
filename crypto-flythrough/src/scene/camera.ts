import { Euler, Quaternion, Vector3 } from "three";
import { TAU } from "../field";
import type { VariantConfig } from "../variants";

export type CameraState = {
  readonly position: Vector3;
  readonly euler: Euler;
  readonly quaternion: Quaternion;
  /** Orientation of the field group — the camera's nominal (unwobbled) frame. */
  readonly fieldQuaternion: Quaternion;
};

/**
 * Every camera value is a pure function of the loop phase `t`. The wobble is
 * built from sines whose periods divide 270 frames, and `t` is exactly 0 on
 * both frame 0 and frame 270, so the loop closes on the nose.
 *
 * The camera never translates monotonically forward: a monotonic dolly cannot
 * close a 270 frame loop. Forward travel is expressed in the field instead
 * (see `placeElement`), which is indistinguishable on screen because nothing
 * in the scene is anchored to world space.
 */
export const cameraState = (t: number, config: VariantConfig): CameraState => {
  const handheld = config.cameraMode === "forward" ? 1 : 0.75;

  const x =
    (0.34 * Math.sin(TAU * t) + 0.13 * Math.sin(TAU * 3 * t + 1.1)) * handheld;
  const y =
    (0.26 * Math.cos(TAU * 2 * t) + 0.09 * Math.sin(TAU * 5 * t + 0.4)) *
    handheld;
  const z = 0.22 * Math.sin(TAU * 2 * t + 0.7) * handheld;

  const pitch =
    config.cameraPitch + 0.005 * Math.sin(TAU * 3 * t + 0.25) * handheld;
  const yaw = 0.006 * Math.cos(TAU * t) * handheld;
  const roll = 0.008 * Math.sin(TAU * 2 * t + 0.9) * handheld;

  const euler = new Euler(pitch, yaw, roll, "YXZ");
  const quaternion = new Quaternion().setFromEuler(euler);
  const fieldQuaternion = new Quaternion().setFromEuler(
    new Euler(config.cameraPitch, 0, 0, "YXZ"),
  );

  return {
    position: new Vector3(x, y, z),
    euler,
    quaternion,
    fieldQuaternion,
  };
};
