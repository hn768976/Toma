import { Matrix4, PerspectiveCamera, Quaternion, Vector3 } from "three/webgpu";
import type { Ramp, ShotConfig } from "./config";

const DEG = Math.PI / 180;
const AXIS_X = new Vector3(1, 0, 0);
const AXIS_Y = new Vector3(0, 1, 0);
const AXIS_Z = new Vector3(0, 0, 1);

/**
 * Swings the whole rig — camera and sun together — so the shot opens over a
 * chosen place. The Earth meshes stay at identity, which is what lets the
 * shaders treat object space and world space as the same thing.
 *
 * The canonical zenith (0, 0, 1) lands at 90 degrees west in the equirect
 * layout three's SphereGeometry produces, hence the offset.
 */
const groundTrack = (shot: ShotConfig) =>
  new Quaternion()
    .setFromAxisAngle(AXIS_Y, (shot.startLongitude + 90) * DEG)
    .multiply(new Quaternion().setFromAxisAngle(AXIS_X, -shot.startLatitude * DEG));

/** Slow ease that never fully stops, so the drift keeps its momentum. */
const easeDrift = (t: number) => t * t * (3 - 2 * t) * 0.35 + t * 0.65;

const ramp = (r: Ramp, t: number) => r[0] + (r[1] - r[0]) * t;

/**
 * Places the camera in low orbit.
 *
 * The rig is built in a canonical frame first — local zenith on +Z, direction
 * of travel on +X — and then swung into place by the orbit rotation. Pitch is
 * derived from geometry rather than hand-set: at radius r the limb sits
 * `90 - asin(1/r)` degrees below the local horizontal, so aiming that far down
 * puts the limb dead centre and `limbOffset` lifts it from there.
 */
export const placeCamera = (
  camera: PerspectiveCamera,
  shot: ShotConfig,
  progress: number,
) => {
  const eased = easeDrift(progress);

  const radius = 1 + ramp(shot.altitude, eased);
  const limbBelowHorizon = 90 - Math.asin(1 / radius) / DEG;

  const sway = Math.sin(progress * Math.PI * 2 * shot.sway.cycles);
  const pitch = (limbBelowHorizon + ramp(shot.limbOffset, eased) + sway * shot.sway.pitch) * DEG;
  const roll = (ramp(shot.roll, eased) + sway * shot.sway.roll) * DEG;

  const zenith = AXIS_Z;
  const travel = new Vector3(1, 0, 0);
  const forward = travel
    .clone()
    .multiplyScalar(Math.cos(pitch))
    .addScaledVector(zenith, -Math.sin(pitch))
    .normalize();

  const eye = zenith.clone().multiplyScalar(radius);
  const orientation = new Quaternion().setFromRotationMatrix(
    new Matrix4().lookAt(eye, eye.clone().add(forward), zenith),
  );
  orientation.multiply(new Quaternion().setFromAxisAngle(AXIS_Z, roll));

  // Orbit swings the rig along its track; inclination tilts the whole track,
  // so it has to be the outer rotation of the two.
  const rig = groundTrack(shot)
    .multiply(new Quaternion().setFromAxisAngle(AXIS_Z, shot.inclination * DEG))
    .multiply(new Quaternion().setFromAxisAngle(AXIS_Y, ramp(shot.orbit, eased) * DEG));

  camera.position.copy(eye).applyQuaternion(rig);
  camera.quaternion.copy(rig).multiply(orientation);
  camera.fov = ramp(shot.fov, eased);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
};

/** Unit vector towards the sun, in the same orbital frame as the camera. */
export const sunDirection = (shot: ShotConfig, target = new Vector3()) =>
  target
    .set(0, 0, 1)
    .applyAxisAngle(AXIS_X, shot.sunElevation * DEG)
    .applyAxisAngle(AXIS_Y, shot.sunOrbit * DEG)
    .applyAxisAngle(AXIS_Z, shot.inclination * DEG)
    .applyQuaternion(groundTrack(shot))
    .normalize();
