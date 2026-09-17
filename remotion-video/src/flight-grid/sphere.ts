import * as THREE from "three";

export const DEG = Math.PI / 180;

// Geographic (lat/long, radians) -> cartesian, with +Y through the north
// pole and lon = 0 through +Z. `radius` lets callers place points above
// the surface without a second normalisation step.
export const geoToVec3 = (
  latRad: number,
  lonRad: number,
  radius: number,
): THREE.Vector3 => {
  const cosLat = Math.cos(latRad);
  return new THREE.Vector3(
    radius * cosLat * Math.sin(lonRad),
    radius * Math.sin(latRad),
    radius * cosLat * Math.cos(lonRad),
  );
};

// Orthonormal frame at a surface point: `up` is the local vertical,
// `north`/`east` span the tangent plane. Used to point both the camera rig
// and the aircraft along a compass heading.
export type SurfaceFrame = {
  up: THREE.Vector3;
  north: THREE.Vector3;
  east: THREE.Vector3;
};

export const surfaceFrame = (latRad: number, lonRad: number): SurfaceFrame => {
  const up = geoToVec3(latRad, lonRad, 1);
  // d(position)/d(lat) normalised -> points toward the north pole along
  // the surface.
  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const north = new THREE.Vector3(
    -sinLat * Math.sin(lonRad),
    cosLat,
    -sinLat * Math.cos(lonRad),
  ).normalize();
  const east = new THREE.Vector3().crossVectors(north, up).normalize();
  return { up, north, east };
};

// Unit tangent for a compass heading (0 = due north, +90deg = due east).
export const headingVector = (
  frame: SurfaceFrame,
  headingRad: number,
): THREE.Vector3 =>
  new THREE.Vector3()
    .copy(frame.north)
    .multiplyScalar(Math.cos(headingRad))
    .addScaledVector(frame.east, Math.sin(headingRad))
    .normalize();

// Slerp between two unit vectors — used to walk great-circle route arcs.
export const slerpUnit = (
  a: THREE.Vector3,
  b: THREE.Vector3,
  t: number,
): THREE.Vector3 => {
  const dot = THREE.MathUtils.clamp(a.dot(b), -1, 1);
  const omega = Math.acos(dot);
  if (omega < 1e-6) return a.clone();
  const sinOmega = Math.sin(omega);
  return new THREE.Vector3()
    .addScaledVector(a, Math.sin((1 - t) * omega) / sinOmega)
    .addScaledVector(b, Math.sin(t * omega) / sinOmega);
};
