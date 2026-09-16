// Fine specks embedded in the band's surfaces.
//
// The obvious way to do this - hashing a smooth varying per fragment - gives
// specks with no defined size: they are pixel noise, so they change with the
// output resolution and shimmer from frame to frame. Instead the surface
// parameter space is divided into cells of a fixed size, each holding one dot
// at a hashed position with a hashed radius. The dots then have a real
// footprint in surface space, so 1080p and 4K resolve the same specks in the
// same places and the pattern is stable under motion.

import { float, floor, fract, length, sin, smoothstep, step, vec2 } from "three/tsl";
import type { Node } from "three/webgpu";

/** Scalar hash of a cell coordinate, in [0, 1). */
const hash = (cell: Node<"vec2">, salt: number): Node<"float"> =>
  fract(
    sin(cell.x.mul(127.1).add(cell.y.mul(311.7)).add(salt)).mul(43758.5453),
  );

export type SpeckOptions = {
  /** Cell counts across the two surface parameters. */
  cells: [number, number];
  /** Fraction of cells that contain a speck, in [0, 1]. */
  density: number;
  /** Dot radius as a fraction of a cell. */
  size: number;
};

/**
 * Samples the speck field at surface coordinates `u`, `v` (both in [0, 1]).
 * Returns a soft-edged mask, 0 between specks and 1 at their centres.
 */
export const surfaceSpecks = (
  u: Node<"float">,
  v: Node<"float">,
  { cells, density, size }: SpeckOptions,
): Node<"float"> => {
  const p = vec2(u.mul(cells[0]), v.mul(cells[1]));
  const cell = floor(p);
  const local = fract(p);

  // Present only in the sparse subset of cells, at a hashed offset inside the
  // cell so the field does not read as a grid.
  const present = step(float(1 - density), hash(cell, 0));
  const centre = vec2(
    hash(cell, 1.7).mul(0.7).add(0.15),
    hash(cell, 3.1).mul(0.7).add(0.15),
  );
  const radius = hash(cell, 5.3).mul(0.55).add(0.45).mul(size);

  const d = length(local.sub(centre));
  return smoothstep(radius, 0, d).mul(present);
};
