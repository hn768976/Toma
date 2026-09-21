/**
 * The scalar field the cells are surfaced from.
 *
 * Each cell is a sphere SDF, f_i(p) = |p - c_i| - r_i. The cluster surface is
 * their exponential smooth minimum:
 *
 *   A(p) = sum_i exp( -f_i(p) / blend )
 *   F(p) = -blend * ln A(p)
 *
 * The exponential form is accumulative and order-independent, which is what
 * makes the build cheap: a cell whose f_i is far outside contributes a term so
 * small it can be skipped outright, so the accumulation only ever touches
 * voxels near a cell. `blend` is in world units and doubles as the size of the
 * crease at a contact — small values keep the cells countable.
 */

export type Cell = {
  /** Centre in cluster-local space. */
  cx: number;
  cy: number;
  cz: number;
  /** Radius before any deflation. */
  r: number;
  /** Per-cell seed, used to decorrelate surface noise in the shader. */
  seed: number;
};

/** Terms below exp(-CUTOFF_SIGMAS) are dropped; 9 leaves them under 1.3e-4. */
const CUTOFF_SIGMAS = 9;

export const influenceRadius = (cell: Cell, blend: number, iso: number) =>
  cell.r + iso + blend * CUTOFF_SIGMAS;

/** Distance to the smooth-min surface at `p`, positive outside. */
export const fieldAt = (
  cells: readonly Cell[],
  candidates: readonly number[],
  blend: number,
  px: number,
  py: number,
  pz: number,
): number => {
  let acc = 0;
  for (let k = 0; k < candidates.length; k++) {
    const c = cells[candidates[k]];
    const dx = px - c.cx;
    const dy = py - c.cy;
    const dz = pz - c.cz;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz) - c.r;
    acc += Math.exp(-d / blend);
  }
  return acc > 0 ? -blend * Math.log(acc) : 1e3;
};

/**
 * Normalised weight of every candidate cell at `p`, written into `out`.
 *
 * These weights are the derivative of the smooth minimum with respect to each
 * cell, so they sum to 1 and vary smoothly across a crease. Two things are
 * built from them: the surface gradient (a weighted mean of the cells' radial
 * directions, which is already unit length to within rounding) and the pair of
 * cells each vertex is bound to for deflation.
 */
export const weightsAt = (
  cells: readonly Cell[],
  candidates: readonly number[],
  blend: number,
  px: number,
  py: number,
  pz: number,
  out: Float64Array,
): number => {
  let acc = 0;
  for (let k = 0; k < candidates.length; k++) {
    const c = cells[candidates[k]];
    const dx = px - c.cx;
    const dy = py - c.cy;
    const dz = pz - c.cz;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz) - c.r;
    const w = Math.exp(-d / blend);
    out[k] = w;
    acc += w;
  }
  if (acc <= 0) return 0;
  for (let k = 0; k < candidates.length; k++) out[k] /= acc;
  return acc;
};
