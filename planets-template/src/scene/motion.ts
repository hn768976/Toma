// Everything that moves is a pure function of (row, frame). Nothing is
// carried between frames, so Remotion can render frames in any order.
import * as THREE from "three";
import { VersionRow } from "../data/versions";

export const FOV_DEG = 18;
const DEG = Math.PI / 180;

export type FrameState = {
  camPos: THREE.Vector3;
  camQuat: THREE.Quaternion;
  shiftX: number; // NDC lens shift
  shiftY: number;
  bodyQuat: THREE.Quaternion;
  light: THREE.Vector3; // world, unit, toward the sun
  loopFrame: number; // frame used to seed grain (wraps on loops)
};

const easeInOutSine = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * t);

// Camera distance for a sphere of radius 1 to span `frac` of the frame height.
export function distanceForDisc(frac: number) {
  const tanA = frac * Math.tan((FOV_DEG * DEG) / 2);
  return 1 / Math.sin(Math.atan(tanA));
}

export function frameState(row: VersionRow, frame: number): FrameState {
  const N = row.durationInFrames;
  const isSpin = row.shot === "spin";
  // Spin: the clip is an exact loop, so everything is a function of the
  // wrapped phase; frame N renders exactly like frame 0.
  const loopFrame = isSpin ? ((frame % N) + N) % N : frame;
  const t = loopFrame / N;
  const hero = isSpin ? 300 : 400;

  // ---- body rotation: spin about the pole, then present the tilt.
  const faceTheta = (-90 - row.rotation.faceLonDeg) * DEG;
  const turn = row.rotation.turnDeg * DEG;
  let theta: number;
  if (isSpin) {
    theta = faceTheta + row.rotation.direction * turn * ((loopFrame - hero) / N);
  } else {
    theta = faceTheta + row.rotation.direction * turn * ((frame - hero) / N);
  }
  const qSpin = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), theta);
  const qRoll = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -row.tilt.rollDeg * DEG);
  const qPitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), row.tilt.pitchDeg * DEG);
  const bodyQuat = qPitch.multiply(qRoll).multiply(qSpin);

  // ---- camera
  let disc = row.framing.discHeightFrac;
  let yaw = 0, pitch = 0;
  if (isSpin) {
    // Very slight closed drift: one lap of a +-0.5 deg circle per loop.
    yaw = 0.5 * DEG * Math.cos(2 * Math.PI * t);
    pitch = 0.5 * DEG * Math.sin(2 * Math.PI * t);
  } else {
    disc *= 1 + row.framing.pushIn * easeInOutSine(Math.min(1, frame / (N - 1)));
  }
  const D = distanceForDisc(disc);
  const camPos = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(D);
  const m = new THREE.Matrix4().lookAt(camPos, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0));
  const camQuat = new THREE.Quaternion().setFromRotationMatrix(m);
  const shiftX = (row.framing.centerX - 0.5) * 2;
  const shiftY = (0.5 - row.framing.centerY) * 2;

  // ---- sun
  let angle = row.light.angleDeg;
  if (!isSpin) angle -= row.light.swingDeg * easeInOutSine(Math.min(1, frame / (N - 1)));
  const a = angle * DEG, e = row.light.elevationDeg * DEG;
  const light = new THREE.Vector3(row.light.side * Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)).normalize();

  return { camPos, camQuat, shiftX, shiftY, bodyQuat, light, loopFrame };
}
