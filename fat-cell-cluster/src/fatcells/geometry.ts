/**
 * Turning a built isosurface into a BufferGeometry.
 *
 * Every cluster in the project is generated at module level and reused across
 * all 300 frames, so these geometries are created once and only ever read.
 */

import * as THREE from "three";
import { Cell } from "./field";
import { Isosurface } from "./isosurface";

export const toBufferGeometry = (
  iso: Isosurface,
  cells: readonly Cell[],
): THREE.BufferGeometry => {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(iso.position, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(iso.normal, 3));
  g.setAttribute("cellPair", new THREE.BufferAttribute(iso.cellPair, 2));
  g.setAttribute("weightA", new THREE.BufferAttribute(iso.weightA, 1));
  g.setAttribute("ao", new THREE.BufferAttribute(iso.ao, 1));

  // The two owning centres travel with the vertex rather than being looked up
  // from a uniform array, which keeps the uniform budget to the three
  // per-frame deflation arrays.
  const centerA = new Float32Array(iso.vertexCount * 3);
  const centerB = new Float32Array(iso.vertexCount * 3);
  for (let v = 0; v < iso.vertexCount; v++) {
    const a = cells[iso.cellPair[v * 2]] ?? cells[0];
    const b = cells[iso.cellPair[v * 2 + 1]] ?? cells[0];
    centerA[v * 3] = a.cx; centerA[v * 3 + 1] = a.cy; centerA[v * 3 + 2] = a.cz;
    centerB[v * 3] = b.cx; centerB[v * 3 + 1] = b.cy; centerB[v * 3 + 2] = b.cz;
  }
  g.setAttribute("centerA", new THREE.BufferAttribute(centerA, 3));
  g.setAttribute("centerB", new THREE.BufferAttribute(centerB, 3));
  g.setIndex(new THREE.BufferAttribute(iso.index, 1));
  g.computeBoundingSphere();
  return g;
};
