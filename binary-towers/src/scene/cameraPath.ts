import * as THREE from "three";

/**
 * A closed, near-circular loop that threads between the towers.
 *
 * The radius varies only slightly on purpose. Any closed loop walked once in
 * 12s turns a full 360 degrees, so the heading rate is fixed at 30 deg/s and
 * cannot be lowered; what *can* be controlled is where that turning happens.
 * Spreading it evenly around a near-circle reads as a slow drift, where the
 * lobed path this replaced concentrated it into three swerves and felt busy.
 * Keeping the loop short then holds the travel speed down to a walking pace.
 *
 * Because the curve is closed and sampled with `getPointAt` (arc-length
 * parameterised), frame 0 and frame 360 are the same pose and the speed is
 * constant.
 */
const CONTROL_POINTS: [number, number, number][] = [
  [7.60, 4.35, 0.00],
  [4.67, 4.85, 4.67],
  [0.00, 5.15, 7.40],
  [-4.60, 4.60, 4.60],
  [-7.50, 4.30, 0.00],
  [-4.74, 4.75, -4.74],
  [-0.00, 5.10, -7.30],
  [4.53, 4.55, -4.53],
];

export const CAMERA_CURVE = new THREE.CatmullRomCurve3(
  CONTROL_POINTS.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
  true,
  "catmullrom",
  0.5,
);

/** Look direction is the path tangent, pitched down by a fixed angle. */
const PITCH_DEGREES = 8.5;
const AIM_DISTANCE = 20;

const _pos = new THREE.Vector3();
const _tan = new THREE.Vector3();

export type CameraPose = {
  position: [number, number, number];
  lookAt: [number, number, number];
  roll: number;
};

export const cameraPoseAt = (progress: number): CameraPose => {
  const u = ((progress % 1) + 1) % 1;
  CAMERA_CURVE.getPointAt(u, _pos);
  CAMERA_CURVE.getTangentAt(u, _tan);

  // Flatten the tangent, then drop the aim point by a fixed pitch so the floor
  // holds the bottom of the frame no matter where on the loop we are.
  const flat = Math.hypot(_tan.x, _tan.z) || 1;
  const ax = _pos.x + (_tan.x / flat) * AIM_DISTANCE;
  const az = _pos.z + (_tan.z / flat) * AIM_DISTANCE;
  const ay = _pos.y - Math.tan((PITCH_DEGREES * Math.PI) / 180) * AIM_DISTANCE;

  // A very small roll, phased so it closes exactly over the loop.
  const roll = Math.sin(u * Math.PI * 2) * 0.016 + Math.sin(u * Math.PI * 4) * 0.007;

  return {
    position: [_pos.x, _pos.y, _pos.z],
    lookAt: [ax, ay, az],
    roll,
  };
};

/** XZ samples of the path, used to keep towers out of the camera's way. */
export const PATH_SAMPLES: [number, number][] = (() => {
  const out: [number, number][] = [];
  const v = new THREE.Vector3();
  for (let i = 0; i < 240; i++) {
    CAMERA_CURVE.getPointAt(i / 240, v);
    out.push([v.x, v.z]);
  }
  return out;
})();

export const distanceToPathXZ = (x: number, z: number) => {
  let best = Infinity;
  for (const [px, pz] of PATH_SAMPLES) {
    const d = Math.hypot(x - px, z - pz);
    if (d < best) best = d;
  }
  return best;
};
