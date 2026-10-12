import { mulberry32 } from "./random";

/**
 * Seeded 2D value noise on a lattice of cellsX × cellsY cells that wraps in x
 * (and, if wrapY, in y), so anything sampled across the full lattice tiles.
 */
export const periodicNoise = (seed: number, cellsX: number, cellsY: number, wrapY = false) => {
  const r = mulberry32(seed);
  const rows = wrapY ? cellsY : cellsY + 1;
  const lat = Float32Array.from({ length: cellsX * rows }, () => r());
  return (x: number, y: number) => {
    const xi = Math.floor(x);
    let yi = Math.floor(y);
    let fy = y - yi;
    if (!wrapY) {
      if (yi < 0) (yi = 0), (fy = 0);
      if (yi > cellsY - 1) (yi = cellsY - 1), (fy = 1);
    }
    const fx = x - xi;
    const x0 = ((xi % cellsX) + cellsX) % cellsX;
    const x1 = (x0 + 1) % cellsX;
    const y0 = wrapY ? ((yi % cellsY) + cellsY) % cellsY : yi;
    const y1 = wrapY ? (y0 + 1) % cellsY : yi + 1;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = lat[y0 * cellsX + x0];
    const b = lat[y0 * cellsX + x1];
    const c = lat[y1 * cellsX + x0];
    const d = lat[y1 * cellsX + x1];
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
};
