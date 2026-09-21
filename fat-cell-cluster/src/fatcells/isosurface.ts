/**
 * Marching cubes over the cluster field, run once at build time.
 *
 * The mesh is never rebuilt: deflation, drift and surface noise all happen in
 * the vertex shader, driven by per-vertex attributes written here. Alongside
 * position and normal each vertex carries
 *
 *   cellA / cellB  the two cells whose smooth-min weights dominate at it
 *   weightA        cellA's share of the pair, so the crease between two cells
 *                  blends between their deflations instead of cracking
 *   ao             ambient occlusion, sampled from the field along the normal
 *
 * The marching-cubes tables come from three's own MarchingCubes addon, which
 * exports them; corner and edge numbering below is the convention that addon
 * uses (and the canonical Bourke one).
 */

import {
  edgeTable as edgeTableRaw,
  triTable as triTableRaw,
} from "three/examples/jsm/objects/MarchingCubes.js";
import { Cell, fieldAt, influenceRadius, weightsAt } from "./field";

// @types/three declares these as Int32Array[]; they are flat Int32Arrays.
const EDGE_TABLE = edgeTableRaw as unknown as Int32Array;
const TRI_TABLE = triTableRaw as unknown as Int32Array;

/** Corner offsets, in grid steps, for the canonical numbering. */
const CORNER: readonly (readonly [number, number, number])[] = [
  [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
  [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1],
];

/** For each of the 12 edges: the corner that owns it, and the axis it runs along. */
const EDGE_OWNER: readonly (readonly [number, number, number, number])[] = [
  [0, 0, 0, 0], [1, 0, 0, 1], [0, 1, 0, 0], [0, 0, 0, 1],
  [0, 0, 1, 0], [1, 0, 1, 1], [0, 1, 1, 0], [0, 0, 1, 1],
  [0, 0, 0, 2], [1, 0, 0, 2], [1, 1, 0, 2], [0, 1, 0, 2],
];

/** The two corners each edge connects. */
const EDGE_CORNERS: readonly (readonly [number, number])[] = [
  [0, 1], [1, 2], [2, 3], [3, 0],
  [4, 5], [5, 6], [6, 7], [7, 4],
  [0, 4], [1, 5], [2, 6], [3, 7],
];

/**
 * Cells to subtract from the subject, and how softly. Used by the shrinking
 * look: each cell becomes its own closed surface, dished where its neighbours
 * press into it, instead of all of them merging into one mesh. A merged mesh
 * cannot come apart — as two cells empty toward their own centres, the crease
 * between them stretches into a long flat strip rather than letting them
 * separate.
 */
export type CarveOptions = {
  neighbours: readonly Cell[];
  /** Softness of the dished contact, in world units. */
  soften: number;
};

export type IsosurfaceOptions = {
  /** Crease size at a contact, in world units. Small keeps cells countable. */
  blend: number;
  /** Voxels along the longest axis of the cluster's bounding box. */
  resolution: number;
  /**
   * Distance offset of the surface. 0 is the cells themselves; a small
   * positive value inflates it into the membrane that stretches over the mass.
   */
  iso?: number;
  /** How far AO rays reach, as a multiple of the mean cell radius. */
  aoRadius?: number;
  /** 0 disables occlusion, 1 is the default depth of the crevices. */
  aoStrength?: number;
  /** Subtract the neighbouring cells instead of merging with them. */
  carve?: CarveOptions;
  /** Shift every vertex by this, after the surface is found. */
  origin?: [number, number, number];
};

export type Isosurface = {
  position: Float32Array;
  normal: Float32Array;
  cellPair: Float32Array; // vec2: cellA, cellB
  weightA: Float32Array;
  ao: Float32Array;
  index: Uint32Array;
  vertexCount: number;
  triangleCount: number;
};

const AO_STEPS = 5;

export const buildIsosurface = (
  cells: readonly Cell[],
  opts: IsosurfaceOptions,
): Isosurface => {
  const { blend, resolution } = opts;
  const iso = opts.iso ?? 0;
  const aoStrength = opts.aoStrength ?? 1;
  const meanR = cells.reduce((s, c) => s + c.r, 0) / Math.max(1, cells.length);
  const aoRadius = (opts.aoRadius ?? 0.9) * meanR;

  // --- bounding box, padded by the widest influence radius ------------------
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (const c of cells) {
    const R = influenceRadius(c, blend, iso);
    minX = Math.min(minX, c.cx - R); maxX = Math.max(maxX, c.cx + R);
    minY = Math.min(minY, c.cy - R); maxY = Math.max(maxY, c.cy + R);
    minZ = Math.min(minZ, c.cz - R); maxZ = Math.max(maxZ, c.cz + R);
  }
  const spanX = maxX - minX, spanY = maxY - minY, spanZ = maxZ - minZ;
  const step = Math.max(spanX, spanY, spanZ) / resolution;
  const nx = Math.ceil(spanX / step) + 3;
  const ny = Math.ceil(spanY / step) + 3;
  const nz = Math.ceil(spanZ / step) + 3;
  const originX = minX - step, originY = minY - step, originZ = minZ - step;
  const strideY = nx, strideZ = nx * ny;

  // --- accumulate exp(-f_i / blend) over each cell's own neighbourhood ------
  const acc = new Float32Array(nx * ny * nz);
  for (const c of cells) {
    const R = influenceRadius(c, blend, iso);
    const i0 = Math.max(0, Math.floor((c.cx - R - originX) / step));
    const i1 = Math.min(nx - 1, Math.ceil((c.cx + R - originX) / step));
    const j0 = Math.max(0, Math.floor((c.cy - R - originY) / step));
    const j1 = Math.min(ny - 1, Math.ceil((c.cy + R - originY) / step));
    const k0 = Math.max(0, Math.floor((c.cz - R - originZ) / step));
    const k1 = Math.min(nz - 1, Math.ceil((c.cz + R - originZ) / step));
    for (let k = k0; k <= k1; k++) {
      const pz = originZ + k * step - c.cz;
      for (let j = j0; j <= j1; j++) {
        const py = originY + j * step - c.cy;
        const rowBase = k * strideZ + j * strideY;
        const yz = py * py + pz * pz;
        for (let i = i0; i <= i1; i++) {
          const px = originX + i * step - c.cx;
          const d = Math.sqrt(px * px + yz) - c.r;
          if (d > R) continue;
          acc[rowBase + i] += Math.exp(-d / blend);
        }
      }
    }
  }

  // --- convert to a signed distance, shifted by the isosurface offset -------
  const field = new Float32Array(nx * ny * nz);
  for (let i = 0; i < field.length; i++) {
    const a = acc[i];
    field[i] = a > 0 ? -blend * Math.log(a) - iso : 1e3;
  }

  // --- marching cubes, sharing vertices along grid edges --------------------
  const edgeCache = new Int32Array(nx * ny * nz * 3).fill(-1);
  const positions: number[] = [];
  const normals: number[] = [];
  const pairs: number[] = [];
  const weightAs: number[] = [];
  const aos: number[] = [];
  const indices: number[] = [];

  const candidates: number[] = [];
  const weights = new Float64Array(cells.length);
  const corners = new Float64Array(8);
  const edgeVerts = new Int32Array(12);

  const emitVertex = (px: number, py: number, pz: number): number => {
    // Cells close enough to matter here — reused for the gradient and for AO.
    candidates.length = 0;
    for (let ci = 0; ci < cells.length; ci++) {
      const c = cells[ci];
      const dx = px - c.cx, dy = py - c.cy, dz = pz - c.cz;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) - c.r;
      if (d < aoRadius + blend * 9 + iso) candidates.push(ci);
    }
    if (candidates.length === 0) candidates.push(0);

    weightsAt(cells, candidates, blend, px, py, pz, weights);

    // Gradient of the smooth minimum: the weighted mean of each cell's radial
    // direction. Unit length up to rounding, so it needs only a light rescale.
    let gx = 0, gy = 0, gz = 0;
    let bestI = 0, bestW = -1, secondI = -1, secondW = -1;
    for (let k = 0; k < candidates.length; k++) {
      const c = cells[candidates[k]];
      const dx = px - c.cx, dy = py - c.cy, dz = pz - c.cz;
      const len = Math.max(1e-6, Math.sqrt(dx * dx + dy * dy + dz * dz));
      const w = weights[k];
      gx += (w * dx) / len; gy += (w * dy) / len; gz += (w * dz) / len;
      if (w > bestW) {
        secondW = bestW; secondI = bestI;
        bestW = w; bestI = candidates[k];
      } else if (w > secondW) {
        secondW = w; secondI = candidates[k];
      }
    }
    const glen = Math.max(1e-6, Math.sqrt(gx * gx + gy * gy + gz * gz));
    gx /= glen; gy /= glen; gz /= glen;

    if (secondI < 0) { secondI = bestI; secondW = 0; }
    const pairSum = bestW + secondW;
    const wA = pairSum > 0 ? bestW / pairSum : 1;

    // Ambient occlusion: march the field outward along the normal. Where the
    // surface is open, F(p + n*t) tracks t; in a crevice it falls short, and
    // the shortfall is the occlusion. This is what darkens the contacts.
    let occ = 0, norm = 0;
    for (let s = 1; s <= AO_STEPS; s++) {
      const t = (s / AO_STEPS) * aoRadius;
      const f = fieldAt(cells, candidates, blend, px + gx * t, py + gy * t, pz + gz * t) - iso;
      const w = 1 / s;
      occ += w * Math.max(0, t - f);
      norm += w * t;
    }
    const ao = Math.max(0, Math.min(1, 1 - aoStrength * (occ / Math.max(1e-6, norm))));

    positions.push(px, py, pz);
    normals.push(gx, gy, gz);
    pairs.push(bestI, secondI);
    weightAs.push(wA);
    aos.push(ao);
    return positions.length / 3 - 1;
  };

  for (let k = 0; k < nz - 1; k++) {
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        let cubeIndex = 0;
        for (let c = 0; c < 8; c++) {
          const [ox, oy, oz] = CORNER[c];
          const v = field[(k + oz) * strideZ + (j + oy) * strideY + (i + ox)];
          corners[c] = v;
          if (v < 0) cubeIndex |= 1 << c;
        }
        const bits = EDGE_TABLE[cubeIndex];
        if (bits === 0) continue;

        for (let e = 0; e < 12; e++) {
          if ((bits & (1 << e)) === 0) continue;
          const [ox, oy, oz, axis] = EDGE_OWNER[e];
          const key = ((k + oz) * strideZ + (j + oy) * strideY + (i + ox)) * 3 + axis;
          let vi = edgeCache[key];
          if (vi < 0) {
            const [ca, cb] = EDGE_CORNERS[e];
            const va = corners[ca], vb = corners[cb];
            const t = Math.abs(vb - va) < 1e-9 ? 0.5 : va / (va - vb);
            const [ax, ay, az] = CORNER[ca];
            const [bx, by, bz] = CORNER[cb];
            vi = emitVertex(
              originX + (i + ax + (bx - ax) * t) * step,
              originY + (j + ay + (by - ay) * t) * step,
              originZ + (k + az + (bz - az) * t) * step,
            );
            edgeCache[key] = vi;
          }
          edgeVerts[e] = vi;
        }

        const base = cubeIndex * 16;
        for (let t = 0; TRI_TABLE[base + t] !== -1 && t < 15; t += 3) {
          indices.push(
            edgeVerts[TRI_TABLE[base + t]],
            edgeVerts[TRI_TABLE[base + t + 2]],
            edgeVerts[TRI_TABLE[base + t + 1]],
          );
        }
      }
    }
  }

  return {
    position: new Float32Array(positions),
    normal: new Float32Array(normals),
    cellPair: new Float32Array(pairs),
    weightA: new Float32Array(weightAs),
    ao: new Float32Array(aos),
    index: new Uint32Array(indices),
    vertexCount: positions.length / 3,
    triangleCount: indices.length / 3,
  };
};

/**
 * One cell as its own closed surface, dished where its neighbours press in.
 *
 * The field is the smooth maximum of the cell's own sphere and the negated
 * spheres of its neighbours — a smooth subtraction, so the contact is a
 * rounded groove rather than a hard intersection curve, and the two cells
 * either side of a contact each carry half of the crease. Positions come back
 * relative to the cell's own centre, so the mesh can be shrunk and tumbled as
 * a rigid body.
 */
export const buildCellSurface = (
  cell: Cell,
  neighbours: readonly Cell[],
  opts: { soften: number; resolution: number; aoStrength?: number },
): Isosurface => {
  const { soften } = opts;
  const aoStrength = opts.aoStrength ?? 1;
  const aoRadius = cell.r * 0.85;

  const pad = cell.r * 0.35;
  const span = 2 * (cell.r + pad);
  const step = span / opts.resolution;
  const n = Math.ceil(span / step) + 3;
  const origin = cell.cx - cell.r - pad - step;
  const originY = cell.cy - cell.r - pad - step;
  const originZ = cell.cz - cell.r - pad - step;
  const strideY = n, strideZ = n * n;

  // Only the neighbours that actually reach this cell can carve it. They are
  // flattened into a typed array because this field is evaluated a few hundred
  // thousand times per cell.
  const nearList: number[] = [];
  for (const o of neighbours) {
    if (o === cell) continue;
    const d = Math.hypot(o.cx - cell.cx, o.cy - cell.cy, o.cz - cell.cz);
    if (d < cell.r + o.r + soften * 6 + pad) nearList.push(o.cx, o.cy, o.cz, o.r);
  }
  const near = Float64Array.from(nearList);
  const invSoften = 1 / soften;
  const { cx, cy, cz, r } = cell;

  const at = (px: number, py: number, pz: number): number => {
    const dx = px - cx, dy = py - cy, dz = pz - cz;
    let acc = Math.exp((Math.sqrt(dx * dx + dy * dy + dz * dz) - r) * invSoften);
    for (let i = 0; i < near.length; i += 4) {
      const ox = px - near[i], oy = py - near[i + 1], oz = pz - near[i + 2];
      const d = Math.sqrt(ox * ox + oy * oy + oz * oz) - near[i + 3];
      acc += Math.exp(-d * invSoften);
    }
    return soften * Math.log(acc);
  };

  const field = new Float32Array(n * n * n);
  for (let k = 0; k < n; k++) {
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        field[k * strideZ + j * strideY + i] =
          at(origin + i * step, originY + j * step, originZ + k * step);
      }
    }
  }

  const edgeCache = new Int32Array(n * n * n * 3).fill(-1);
  const positions: number[] = [];
  const normals: number[] = [];
  const aos: number[] = [];
  const indices: number[] = [];
  const corners = new Float64Array(8);
  const edgeVerts = new Int32Array(12);

  const emit = (px: number, py: number, pz: number): number => {
    const e = step * 0.5;
    const gx = at(px + e, py, pz) - at(px - e, py, pz);
    const gy = at(px, py + e, pz) - at(px, py - e, pz);
    const gz = at(px, py, pz + e) - at(px, py, pz - e);
    const len = Math.max(1e-9, Math.hypot(gx, gy, gz));
    const nx = gx / len, ny = gy / len, nz = gz / len;

    let occ = 0, denom = 0;
    for (let sIdx = 1; sIdx <= AO_STEPS; sIdx++) {
      const t = (sIdx / AO_STEPS) * aoRadius;
      const f = at(px + nx * t, py + ny * t, pz + nz * t);
      const w = 1 / sIdx;
      occ += w * Math.max(0, t - f);
      denom += w * t;
    }
    const ao = Math.max(0, Math.min(1, 1 - aoStrength * (occ / Math.max(1e-6, denom))));

    positions.push(px - cell.cx, py - cell.cy, pz - cell.cz);
    normals.push(nx, ny, nz);
    aos.push(ao);
    return positions.length / 3 - 1;
  };

  for (let k = 0; k < n - 1; k++) {
    for (let j = 0; j < n - 1; j++) {
      for (let i = 0; i < n - 1; i++) {
        let cubeIndex = 0;
        for (let c = 0; c < 8; c++) {
          const [ox, oy, oz] = CORNER[c];
          const v = field[(k + oz) * strideZ + (j + oy) * strideY + (i + ox)];
          corners[c] = v;
          if (v < 0) cubeIndex |= 1 << c;
        }
        const bits = EDGE_TABLE[cubeIndex];
        if (bits === 0) continue;
        for (let e = 0; e < 12; e++) {
          if ((bits & (1 << e)) === 0) continue;
          const [ox, oy, oz, axis] = EDGE_OWNER[e];
          const key = ((k + oz) * strideZ + (j + oy) * strideY + (i + ox)) * 3 + axis;
          let vi = edgeCache[key];
          if (vi < 0) {
            const [ca, cb] = EDGE_CORNERS[e];
            const va = corners[ca], vb = corners[cb];
            const t = Math.abs(vb - va) < 1e-9 ? 0.5 : va / (va - vb);
            const [ax, ay, az] = CORNER[ca];
            const [bx, by, bz] = CORNER[cb];
            vi = emit(
              origin + (i + ax + (bx - ax) * t) * step,
              originY + (j + ay + (by - ay) * t) * step,
              originZ + (k + az + (bz - az) * t) * step,
            );
            edgeCache[key] = vi;
          }
          edgeVerts[e] = vi;
        }
        const base = cubeIndex * 16;
        for (let t = 0; TRI_TABLE[base + t] !== -1 && t < 15; t += 3) {
          indices.push(
            edgeVerts[TRI_TABLE[base + t]],
            edgeVerts[TRI_TABLE[base + t + 2]],
            edgeVerts[TRI_TABLE[base + t + 1]],
          );
        }
      }
    }
  }

  const vertexCount = positions.length / 3;
  return {
    position: new Float32Array(positions),
    normal: new Float32Array(normals),
    cellPair: new Float32Array(vertexCount * 2),
    weightA: new Float32Array(vertexCount).fill(1),
    ao: new Float32Array(aos),
    index: new Uint32Array(indices),
    vertexCount,
    triangleCount: indices.length / 3,
  };
};
