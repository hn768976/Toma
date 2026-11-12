import * as THREE from "three";

export const FOV = 40;

export type Pose = { pos: THREE.Vector3; quat: THREE.Quaternion };

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Travel speed in world units / second (1 unit = one soma radius). */
function speed(t: number) {
  return 2.6 + 6.6 * smoothstep(0.9, 2.5, t) + 1.4 * Math.sin(0.9 * t + 0.5);
}

/**
 * The reference is a single continuous macro shot: the camera drifts backwards
 * through the tissue (so cell bodies emerge next to the lens, out of focus,
 * then recede into the focal plane) while slowly panning and rolling.
 * The camera looks down -Z and travels towards +Z.
 */
export function buildCameraTrack(frames: number, fps: number): Pose[] {
  const poses: Pose[] = [];
  const sub = 8;
  let z = 0;
  const euler = new THREE.Euler(0, 0, 0, "YXZ");
  for (let f = 0; f < frames; f++) {
    const t = f / fps;
    const x = 5.0 * Math.sin(0.33 * t + 0.6) + 1.5 * Math.sin(0.9 * t + 2.0);
    const y = 3.0 * Math.sin(0.27 * t + 1.9) + 1.2 * Math.sin(0.7 * t);
    const yaw = 0.23 * Math.sin(0.42 * t + 0.4) + 0.08 * Math.sin(1.1 * t + 1.0);
    const pitch = 0.15 * Math.sin(0.36 * t + 2.2) + 0.05 * Math.sin(0.95 * t);
    const roll = 0.2 * Math.sin(0.25 * t + 1.0) + 0.05 * Math.sin(0.8 * t);
    euler.set(pitch, yaw, roll);
    poses.push({
      pos: new THREE.Vector3(x, y, z),
      quat: new THREE.Quaternion().setFromEuler(euler),
    });
    for (let s = 0; s < sub; s++) {
      z += speed(t + s / (sub * fps)) / (sub * fps);
    }
  }
  return poses;
}

/** World position that appears at the given NDC + distance in a pose. */
export function placeInView(
  pose: Pose,
  ndcX: number,
  ndcY: number,
  dist: number,
  aspect: number,
) {
  const th = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  const v = new THREE.Vector3(ndcX * dist * th * aspect, ndcY * dist * th, -dist);
  return v.applyQuaternion(pose.quat).add(pose.pos);
}
