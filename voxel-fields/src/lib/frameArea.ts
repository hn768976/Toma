// Ground-plane footprint of the frame, worked out once from the camera path.
// Used to draw only the columns that can appear on screen (plus a margin).

import * as THREE from "three";
import { CAM, cameraFrame } from "./camera";

type P = { x: number; z: number };

const hull = (pts: P[]): P[] => {
  const s = [...pts].sort((a, b) => a.x - b.x || a.z - b.z);
  const cross = (o: P, a: P, b: P) => (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);
  const lower: P[] = [];
  for (const p of s) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: P[] = [];
  for (const p of s.reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
};

const footprint = (planes: number[], inset: number): P[] => {
  const cam = new THREE.PerspectiveCamera();
  cam.filmGauge = 35;
  cam.aspect = 16 / 9;
  cam.setFocalLength(CAM.focalLength);
  const pts: P[] = [];
  const e = 1 - inset;
  for (let f = 0; f < 600; f += 25) {
    const { position, target } = cameraFrame(f);
    cam.position.copy(position);
    cam.lookAt(target);
    cam.updateMatrixWorld();
    cam.updateProjectionMatrix();
    for (const [sx, sy] of [[-e, -e], [e, -e], [e, e], [-e, e]]) {
      const dir = new THREE.Vector3(sx, sy, 0.5).unproject(cam).sub(cam.position).normalize();
      for (const py of planes) {
        const t = (py - cam.position.y) / dir.y;
        const p = cam.position.clone().addScaledVector(dir, t);
        pts.push({ x: p.x, z: p.z });
      }
    }
  }
  return hull(pts);
};

/** Signed distance from p to a convex CCW polygon (negative inside). */
const polyDistance = (poly: P[], p: P) => {
  let inside = true;
  let best = Infinity;
  for (let k = 0; k < poly.length; k++) {
    const a = poly[k];
    const b = poly[(k + 1) % poly.length];
    const ex = b.x - a.x;
    const ez = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * ex + (p.z - a.z) * ez) / (ex * ex + ez * ez)));
    best = Math.min(best, Math.hypot(p.x - a.x - t * ex, p.z - a.z - t * ez));
    if (ex * (p.z - a.z) - ez * (p.x - a.x) < 0) inside = false;
  }
  return inside ? -best : best;
};

// Everything that can be on screen: frame edges hitting raised tops and the
// canyon floor, over the whole drift path.
const FULL = footprint([4, -14], 0);
// The middle of the frame, for placing floating cubes where they'll be seen.
const CORE = footprint([0], 0.3);

/** Columns are drawn within this many cells of the visible footprint. */
export const DRAW_MARGIN = 4;

export const inDrawArea = (x: number, z: number) => polyDistance(FULL, { x, z }) <= DRAW_MARGIN;
export const inFrameCore = (x: number, z: number) => polyDistance(CORE, { x, z }) <= 0;
