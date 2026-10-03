/** Geometry for light streams / fibres: camera-facing ribbons along polylines. */
import * as THREE from "three";

export type StreamLine = {
  pts: THREE.Vector3[];
  /** whole wraps the head travels per loop (integer) */
  speed: number;
  /** wrap length (m) — spacing between heads on the line */
  wrap: number;
  phase: number;
  bright: number;
  trail: number;
};

const subdivide = (pts: THREE.Vector3[], maxSeg: number) => {
  const out: THREE.Vector3[] = [pts[0].clone()];
  for (let k = 1; k < pts.length; k++) {
    const a = pts[k - 1];
    const b = pts[k];
    const n = Math.max(1, Math.ceil(a.distanceTo(b) / maxSeg));
    for (let j = 1; j <= n; j++) out.push(a.clone().lerp(b, j / n));
  }
  return out;
};

export const buildStreamGeometry = (lines: StreamLine[], maxSeg = 0.6) => {
  const pos: number[] = [];
  const side: number[] = [];
  const sArr: number[] = [];
  const dir: number[] = [];
  const line: number[] = [];
  const trail: number[] = [];
  const index: number[] = [];
  let base = 0;
  for (const L of lines) {
    const pts = subdivide(L.pts, maxSeg);
    let s = 0;
    for (let k = 0; k < pts.length; k++) {
      if (k > 0) s += pts[k].distanceTo(pts[k - 1]);
      const a = pts[Math.max(0, k - 1)];
      const b = pts[Math.min(pts.length - 1, k + 1)];
      const d = b.clone().sub(a).normalize();
      for (const sd of [-1, 1]) {
        pos.push(pts[k].x, pts[k].y, pts[k].z);
        side.push(sd);
        sArr.push(s);
        dir.push(d.x, d.y, d.z);
        line.push(L.speed, L.wrap, L.phase, L.bright);
        trail.push(L.trail);
      }
      if (k > 0) {
        const i0 = base + (k - 1) * 2;
        index.push(i0, i0 + 1, i0 + 2, i0 + 1, i0 + 3, i0 + 2);
      }
    }
    base += pts.length * 2;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aSide", new THREE.Float32BufferAttribute(side, 1));
  g.setAttribute("aS", new THREE.Float32BufferAttribute(sArr, 1));
  g.setAttribute("aDir", new THREE.Float32BufferAttribute(dir, 3));
  g.setAttribute("aLine", new THREE.Float32BufferAttribute(line, 4));
  g.setAttribute("aTrail", new THREE.Float32BufferAttribute(trail, 1));
  g.setIndex(index);
  g.computeBoundingSphere();
  return g;
};
