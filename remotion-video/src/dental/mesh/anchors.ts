// Finds a point on a named tooth.
//
// Version 2 drills into a single molar, so it needs a real anchor on the
// mesh rather than a hand-typed coordinate: the occlusal high point of one
// tooth island, plus the surface normal there to orient the lesion.

import { BufferAttribute, BufferGeometry } from "three";

export type ToothAnchor = {
  position: [number, number, number];
  normal: [number, number, number];
  /** How many vertices the island has; 0 means the id was not found. */
  size: number;
};

export const toothAnchor = (
  geometry: BufferGeometry,
  toothId: number,
): ToothAnchor => {
  const position = geometry.getAttribute("position") as BufferAttribute;
  const normal = geometry.getAttribute("normal") as BufferAttribute;
  const tid = geometry.getAttribute("aTid") as BufferAttribute;

  let best = -1;
  let bestY = -Infinity;
  let size = 0;
  for (let i = 0; i < position.count; i++) {
    if (tid.getX(i) !== toothId) {
      continue;
    }
    size++;
    const y = position.getY(i);
    if (y > bestY) {
      bestY = y;
      best = i;
    }
  }
  if (best < 0) {
    return { position: [0, 0, 0], normal: [0, 1, 0], size: 0 };
  }
  return {
    position: [position.getX(best), position.getY(best), position.getZ(best)],
    normal: [normal.getX(best), normal.getY(best), normal.getZ(best)],
    size,
  };
};

/** Mean position of a tooth island, a steadier look-at target than its cusp. */
export const toothCentroid = (
  geometry: BufferGeometry,
  toothId: number,
): [number, number, number] => {
  const position = geometry.getAttribute("position") as BufferAttribute;
  const tid = geometry.getAttribute("aTid") as BufferAttribute;
  let x = 0;
  let y = 0;
  let z = 0;
  let n = 0;
  for (let i = 0; i < position.count; i++) {
    if (tid.getX(i) !== toothId) {
      continue;
    }
    x += position.getX(i);
    y += position.getY(i);
    z += position.getZ(i);
    n++;
  }
  return n === 0 ? [0, 0, 0] : [x / n, y / n, z / n];
};
