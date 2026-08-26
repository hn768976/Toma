import {random} from 'remotion';
import {createNoise3D} from 'simplex-noise';
import {CONFIG} from './config';

/**
 * The terrain height field: layered 3D simplex noise sampled at (x, z, t).
 * The third axis is time, so the field "breathes" without sliding laterally.
 * Deterministic: the permutation table is seeded from Remotion's random()
 * with stable string seeds, so every render worker builds the same field.
 */
export type HeightField = (x: number, z: number, t: number) => number;

export const makeHeightField = (): HeightField => {
  let i = 0;
  const noise3D = createNoise3D(() => random(`terrain-perm-${i++}`));
  const {noiseScale, octaves, amp, anisoX} = CONFIG.terrain;

  return (x: number, z: number, t: number): number => {
    let sum = 0;
    let norm = 0;
    let freq = noiseScale;
    let a = 1;
    for (let o = 0; o < octaves; o++) {
      // Offset each octave so their features don't align. Features are
      // stretched along x (anisoX < 1) so iso-lines flow across the frame.
      sum += a * noise3D(x * freq * anisoX + o * 37.7, z * freq - o * 51.3, t + o * 11.1);
      norm += a;
      a *= 0.5;
      freq *= 2.1;
    }
    return (sum / norm) * amp;
  };
};

/** A chained contour line: flat [x0,z0, x1,z1, ...]; closed = it's a loop. */
export type Polyline = {pts: number[]; closed: boolean};

type Seg = [number, number, number, number];

/**
 * Marching squares over the height grid, one segment soup per level.
 * Endpoints on a shared cell edge are computed from the same two corner
 * heights in both neighboring cells, so they match bit-for-bit — which is
 * what lets `chainSegments` stitch the soup into polylines afterwards.
 */
const marchSegments = (
  heights: Float32Array, // row-major [j * nx + i], j along z, i along x
  nx: number,
  nz: number,
  originX: number,
  originZ: number,
  cell: number,
  levels: readonly number[],
): Seg[][] => {
  const perLevel: Seg[][] = levels.map(() => []);
  // Edge order per cell: a=(i,j) b=(i+1,j) c=(i+1,j+1) d=(i,j+1)
  // ab = south edge, bc = east, cd = north, da = west.
  for (let j = 0; j < nz - 1; j++) {
    const z0 = originZ + j * cell;
    const z1 = z0 + cell;
    for (let i = 0; i < nx - 1; i++) {
      const x0 = originX + i * cell;
      const x1 = x0 + cell;
      const ha = heights[j * nx + i];
      const hb = heights[j * nx + i + 1];
      const hc = heights[(j + 1) * nx + i + 1];
      const hd = heights[(j + 1) * nx + i];
      const lo = Math.min(ha, hb, hc, hd);
      const hi = Math.max(ha, hb, hc, hd);

      for (let li = 0; li < levels.length; li++) {
        const L = levels[li];
        if (L < lo || L >= hi) continue;

        const inside =
          (ha > L ? 1 : 0) | (hb > L ? 2 : 0) | (hc > L ? 4 : 0) | (hd > L ? 8 : 0);
        if (inside === 0 || inside === 15) continue;

        // Interpolated crossing points on each edge (computed lazily below).
        // ab: between a(x0,z0) and b(x1,z0)
        const pAB = (): [number, number] => [x0 + ((L - ha) / (hb - ha)) * cell, z0];
        // bc: between b(x1,z0) and c(x1,z1)
        const pBC = (): [number, number] => [x1, z0 + ((L - hb) / (hc - hb)) * cell];
        // cd: between d(x0,z1) and c(x1,z1)
        const pCD = (): [number, number] => [x0 + ((L - hd) / (hc - hd)) * cell, z1];
        // da: between a(x0,z0) and d(x0,z1)
        const pDA = (): [number, number] => [x0, z0 + ((L - ha) / (hd - ha)) * cell];

        const emit = (p: [number, number], q: [number, number]) =>
          perLevel[li].push([p[0], p[1], q[0], q[1]]);

        switch (inside) {
          case 1:
          case 14:
            emit(pDA(), pAB());
            break;
          case 2:
          case 13:
            emit(pAB(), pBC());
            break;
          case 3:
          case 12:
            emit(pDA(), pBC());
            break;
          case 4:
          case 11:
            emit(pBC(), pCD());
            break;
          case 6:
          case 9:
            emit(pAB(), pCD());
            break;
          case 7:
          case 8:
            emit(pCD(), pDA());
            break;
          case 5: {
            // Saddle: a & c above. Disambiguate with the cell centre.
            const centreAbove = (ha + hb + hc + hd) / 4 > L;
            if (centreAbove) {
              emit(pDA(), pCD());
              emit(pAB(), pBC());
            } else {
              emit(pDA(), pAB());
              emit(pBC(), pCD());
            }
            break;
          }
          case 10: {
            // Saddle: b & d above.
            const centreAbove = (ha + hb + hc + hd) / 4 > L;
            if (centreAbove) {
              emit(pDA(), pAB());
              emit(pBC(), pCD());
            } else {
              emit(pDA(), pCD());
              emit(pAB(), pBC());
            }
            break;
          }
        }
      }
    }
  }
  return perLevel;
};

const q4 = (v: number) => {
  const s = v.toFixed(4);
  return s === '-0.0000' ? '0.0000' : s;
};
const ptKey = (x: number, z: number) => `${q4(x)},${q4(z)}`;

/** Stitch a segment soup into polylines by matching shared endpoints. */
const chainSegments = (segs: Seg[]): Polyline[] => {
  const used = new Uint8Array(segs.length);
  // point key -> [segIndex * 2 + endBit, ...]  (endBit 0 = (x1,z1), 1 = (x2,z2))
  const map = new Map<string, number[]>();
  segs.forEach((s, idx) => {
    for (const end of [0, 1]) {
      const k = ptKey(s[end * 2], s[end * 2 + 1]);
      const list = map.get(k);
      if (list) list.push(idx * 2 + end);
      else map.set(k, [idx * 2 + end]);
    }
  });

  const takeNext = (x: number, z: number): [number, number] | null => {
    const cands = map.get(ptKey(x, z));
    if (!cands) return null;
    for (const c of cands) {
      const si = c >> 1;
      if (used[si]) continue;
      used[si] = 1;
      const other = (c & 1) === 0 ? 2 : 0;
      return [segs[si][other], segs[si][other + 1]];
    }
    return null;
  };

  const out: Polyline[] = [];
  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue;
    used[i] = 1;
    const s = segs[i];
    const startKey = ptKey(s[0], s[1]);
    const fwd: number[] = [s[0], s[1], s[2], s[3]];
    let closed = false;

    // Extend forward from the tail.
    for (;;) {
      const next = takeNext(fwd[fwd.length - 2], fwd[fwd.length - 1]);
      if (!next) break;
      if (ptKey(next[0], next[1]) === startKey) {
        closed = true;
        break;
      }
      fwd.push(next[0], next[1]);
    }

    if (!closed) {
      // Extend backward from the head.
      const back: number[] = [];
      for (;;) {
        const hx = back.length ? back[back.length - 2] : fwd[0];
        const hz = back.length ? back[back.length - 1] : fwd[1];
        const next = takeNext(hx, hz);
        if (!next) break;
        back.push(next[0], next[1]);
      }
      if (back.length) {
        const pts: number[] = [];
        for (let b = back.length - 2; b >= 0; b -= 2) pts.push(back[b], back[b + 1]);
        pts.push(...fwd);
        out.push({pts, closed: nearlyClosed(pts)});
        continue;
      }
    }
    out.push({pts: fwd, closed: closed || nearlyClosed(fwd)});
  }
  return out;
};

/** Catch-all: an "open" line whose ends nearly meet is a loop in disguise. */
const nearlyClosed = (pts: number[]): boolean => {
  const n = pts.length;
  if (n < 8) return false;
  const dx = pts[0] - pts[n - 2];
  const dz = pts[1] - pts[n - 1];
  return dx * dx + dz * dz < 9;
};

/**
 * Laplacian smoothing: rounds off the little marching-squares corners
 * without adding points. Endpoints of open lines stay pinned; loops wrap.
 */
const smoothPolyline = (p: Polyline, passes: number): Polyline => {
  const n = p.pts.length / 2;
  if (n < 3) return p;
  let cur = p.pts.slice();
  let next = p.pts.slice();
  for (let pass = 0; pass < passes; pass++) {
    for (let i = 0; i < n; i++) {
      if (!p.closed && (i === 0 || i === n - 1)) {
        next[i * 2] = cur[i * 2];
        next[i * 2 + 1] = cur[i * 2 + 1];
        continue;
      }
      const im = ((i - 1 + n) % n) * 2;
      const ip = ((i + 1) % n) * 2;
      next[i * 2] = cur[i * 2] * 0.5 + (cur[im] + cur[ip]) * 0.25;
      next[i * 2 + 1] = cur[i * 2 + 1] * 0.5 + (cur[im + 1] + cur[ip + 1]) * 0.25;
    }
    [cur, next] = [next, cur];
  }
  return {pts: cur, closed: p.closed};
};

/**
 * The full contour extraction: marching squares → chained polylines →
 * smoothed curves, one polyline list per level. No little corners survive.
 */
export const extractContours = (
  heights: Float32Array,
  nx: number,
  nz: number,
  originX: number,
  originZ: number,
  cell: number,
  levels: readonly number[],
  smoothingPasses: number,
): Polyline[][] => {
  const perLevel = marchSegments(heights, nx, nz, originX, originZ, cell, levels);
  return perLevel.map((segs) =>
    chainSegments(segs).map((p) => smoothPolyline(p, smoothingPasses)),
  );
};

/**
 * The evenly spaced iso-height levels. Even GROUND spacing between ropes
 * comes from the level count + low terrain amplitude combination (gentle,
 * near-constant slopes), not from redistributing the levels — noise heights
 * cluster around zero, so the middle levels carry most of the picture.
 */
export const contourLevels = (): number[] => {
  const {levels} = CONFIG.contours;
  const {amp} = CONFIG.terrain;
  const top = amp * 0.95;
  const out: number[] = [];
  for (let k = 0; k < levels; k++) {
    out.push(-top + (2 * top * k) / (levels - 1));
  }
  return out;
};
