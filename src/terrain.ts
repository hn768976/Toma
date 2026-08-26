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
  const {noiseScale, octaves, amp} = CONFIG.terrain;

  return (x: number, z: number, t: number): number => {
    let sum = 0;
    let norm = 0;
    let freq = noiseScale;
    let a = 1;
    for (let o = 0; o < octaves; o++) {
      // Offset each octave so their features don't align.
      sum += a * noise3D(x * freq + o * 37.7, z * freq - o * 51.3, t + o * 11.1);
      norm += a;
      a *= 0.5;
      freq *= 2.1;
    }
    return (sum / norm) * amp;
  };
};

/**
 * Marching squares over the height grid: for each iso-height level, emit the
 * line segments where the terrain crosses that height. Output is a flat
 * "segment soup" (pairs of xyz points), ideal for LineSegmentsGeometry.
 *
 * `pushSegment` receives world-space endpoints; the y of every point is the
 * level itself (an iso-height line lies in its own horizontal plane).
 */
export type SegmentSink = (
  x1: number,
  y1: number,
  z1: number,
  x2: number,
  y2: number,
  z2: number,
) => void;

export const marchContours = (
  heights: Float32Array, // row-major [j * nx + i], j along z, i along x
  nx: number,
  nz: number,
  originX: number,
  originZ: number,
  cell: number,
  levels: readonly number[],
  pushSegment: SegmentSink,
): void => {
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

      for (const L of levels) {
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
          pushSegment(p[0], L, p[1], q[0], L, q[1]);

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
