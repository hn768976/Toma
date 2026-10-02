import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Bake N copies of a geometry into one plain BufferGeometry (no instancing).
 * Software GL has a large per-instance cost, so for thousands of copies this
 * is much faster. Adds `aLocal` (the untransformed position) and one float
 * attribute per entry of `attrs` (one value per copy).
 */
export const bakeInstances = (
  base: THREE.BufferGeometry,
  matrices: THREE.Matrix4[],
  attrs: Record<string, ArrayLike<number>> = {},
) => {
  const g = base.index ? base : mergeVertices(base, 1e-5);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const nrm = g.attributes.normal as THREE.BufferAttribute | undefined;
  const nv = pos.count;
  const idx = g.index!;
  const ni = idx.count;
  const n = matrices.length;
  const P = new Float32Array(n * nv * 3);
  const N = new Float32Array(n * nv * 3);
  const Lc = new Float32Array(n * nv * 3);
  const I = new Uint32Array(n * ni);
  const extra: Record<string, Float32Array> = {};
  for (const k in attrs) extra[k] = new Float32Array(n * nv);
  const v = new THREE.Vector3();
  const nm = new THREE.Matrix3();
  for (let c = 0; c < n; c++) {
    const m = matrices[c];
    nm.getNormalMatrix(m);
    for (let i = 0; i < nv; i++) {
      const o = (c * nv + i) * 3;
      v.fromBufferAttribute(pos, i);
      Lc[o] = v.x;
      Lc[o + 1] = v.y;
      Lc[o + 2] = v.z;
      v.applyMatrix4(m);
      P[o] = v.x;
      P[o + 1] = v.y;
      P[o + 2] = v.z;
      if (nrm) {
        v.fromBufferAttribute(nrm, i).applyMatrix3(nm).normalize();
        N[o] = v.x;
        N[o + 1] = v.y;
        N[o + 2] = v.z;
      }
      for (const k in attrs) extra[k][c * nv + i] = attrs[k][c];
    }
    for (let j = 0; j < ni; j++) I[c * ni + j] = idx.getX(j) + c * nv;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(P, 3));
  if (nrm) out.setAttribute("normal", new THREE.BufferAttribute(N, 3));
  out.setAttribute("aLocal", new THREE.BufferAttribute(Lc, 3));
  for (const k in extra) out.setAttribute(k, new THREE.BufferAttribute(extra[k], 1));
  out.setIndex(new THREE.BufferAttribute(I, 1));
  return out;
};
