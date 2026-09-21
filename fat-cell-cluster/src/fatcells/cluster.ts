/**
 * Cell packing.
 *
 * Cells are scattered inside a spheroid and then relaxed until they sit in
 * contact rather than through one another. The relaxation is a fixed number of
 * deterministic passes over a seeded starting layout — no solver, no time step,
 * and it runs once at module level.
 *
 * The references are lumpy, not neat balls, so a share of the cells is biased
 * outward after relaxation to break the silhouette.
 */

import { Cell } from "./field";
import { bell, inBall, Rng, range } from "./random";

export type ClusterSpec = {
  /** How many cells to pack. */
  count: number;
  /** Mean cell radius. */
  radius: number;
  /** Radius spread, as a fraction of the mean. The references sit around 0.25. */
  radiusJitter?: number;
  /**
   * The cluster's shape, as relative half-axes. Only the ratio matters: the
   * absolute size is derived from the cell count so the packing density comes
   * out the same whatever shape is asked for. [1,1,1] is a ball, [6,3,1] a
   * wide shallow slab.
   */
  extent?: [number, number, number];
  /**
   * How far two cells push into each other at rest, as a fraction of the sum
   * of their radii. 0.12 leaves a clear flattened contact face without the
   * cells losing their individual identity.
   */
  overlap?: number;
  /** Fraction of cells nudged outward to make the silhouette lumpy. */
  lumpiness?: number;
  /**
   * Packing density. Random close packing of equal spheres is about 0.64;
   * these cells interpenetrate, so the tissue looks run higher than that to
   * close the gaps between them.
   */
  density?: number;
  /** Relaxation passes. Fixed, so the result is reproducible. */
  passes?: number;
};

const PASSES_DEFAULT = 160;
/** Default density. Random close packing is about 0.64; this leaves some air. */
const PACKING_FRACTION = 0.58;

export const packCluster = (rng: Rng, spec: ClusterSpec): Cell[] => {
  const {
    count,
    radius,
    radiusJitter = 0.25,
    extent = [1, 1, 1],
    overlap = 0.12,
    lumpiness = 0.22,
    density = PACKING_FRACTION,
    passes = PASSES_DEFAULT,
  } = spec;

  // Target ellipsoid. Its volume is set by the cell count at a packing
  // fraction a little under random-close-packing, so `extent` carries the
  // shape and nothing else — doubling the count grows the cluster rather than
  // cramming the same space.
  const shape = Math.cbrt(extent[0] * extent[1] * extent[2]);
  const k = (radius * Math.cbrt(count / density)) / shape;
  const half: [number, number, number] = [
    extent[0] * k, extent[1] * k, extent[2] * k,
  ];

  const cells: Cell[] = [];
  for (let i = 0; i < count; i++) {
    const [ux, uy, uz] = inBall(rng);
    cells.push({
      cx: ux * half[0],
      cy: uy * half[1],
      cz: uz * half[2],
      r: radius * (1 + bell(rng) * radiusJitter * 0.8),
      seed: range(rng, 0, 1000),
    });
  }

  // Relax: separate overlapping pairs, and pull back anything that has been
  // pushed outside the target ellipsoid. Confining rather than contracting is
  // what keeps a slab a slab — a uniform inward pull crushes the short axis.
  const target = 1 - overlap;
  for (let pass = 0; pass < passes; pass++) {
    const strength = 0.5;
    for (let i = 0; i < cells.length; i++) {
      for (let j = i + 1; j < cells.length; j++) {
        const a = cells[i], b = cells[j];
        let dx = b.cx - a.cx, dy = b.cy - a.cy, dz = b.cz - a.cz;
        let d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d < 1e-5) {
          // Coincident centres have no separation direction; offset by index
          // so the nudge is still deterministic.
          dx = 1e-3 * ((i % 3) - 1); dy = 1e-3 * ((j % 3) - 1); dz = 1e-3;
          d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        }
        const want = (a.r + b.r) * target;
        if (d >= want) continue;
        const push = ((want - d) / d) * strength * 0.5;
        a.cx -= dx * push; a.cy -= dy * push; a.cz -= dz * push;
        b.cx += dx * push; b.cy += dy * push; b.cz += dz * push;
      }
    }
    for (const c of cells) {
      const q =
        (c.cx / half[0]) ** 2 + (c.cy / half[1]) ** 2 + (c.cz / half[2]) ** 2;
      if (q <= 1) continue;
      // Nearly a hard clamp back onto the ellipsoid. A soft pull lets the
      // separation forces inflate the cluster well past its target volume, and
      // the packing comes out far looser than the density asked for.
      const pull = 1 - 0.9 * (1 - 1 / Math.sqrt(q));
      c.cx *= pull; c.cy *= pull; c.cz *= pull;
    }
  }

  // Lumpiness: push a minority of cells outward so the cluster edge is uneven.
  const lumpCount = Math.round(cells.length * lumpiness);
  const byDistance = cells
    .map((c, i) => ({ i, d: c.cx * c.cx + c.cy * c.cy + c.cz * c.cz }))
    .sort((p, q) => q.d - p.d);
  for (let n = 0; n < lumpCount; n++) {
    const c = cells[byDistance[n].i];
    const len = Math.max(1e-5, Math.sqrt(c.cx * c.cx + c.cy * c.cy + c.cz * c.cz));
    const push = radius * range(rng, 0.18, 0.5);
    c.cx += (c.cx / len) * push;
    c.cy += (c.cy / len) * push;
    c.cz += (c.cz / len) * push;
  }

  // Re-centre so the cluster rotates about itself.
  let mx = 0, my = 0, mz = 0;
  for (const c of cells) { mx += c.cx; my += c.cy; mz += c.cz; }
  mx /= cells.length; my /= cells.length; mz /= cells.length;
  for (const c of cells) { c.cx -= mx; c.cy -= my; c.cz -= mz; }

  return cells;
};

/** Radius of the sphere that encloses every cell, for framing and drift scaling. */
export const clusterRadius = (cells: readonly Cell[]): number => {
  let m = 0;
  for (const c of cells) {
    m = Math.max(m, Math.sqrt(c.cx * c.cx + c.cy * c.cy + c.cz * c.cz) + c.r);
  }
  return m;
};
