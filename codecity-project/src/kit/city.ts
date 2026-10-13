import { irange, mulberry32, range } from "../lib/random";

// One box of a building. Buildings are 1-4 boxes (podium, L wing, setback
// tiers, roof box, spire). Coordinates in metres: x across the street
// (road centred on x = 0), z along it, y up. (x, z) is the footprint centre,
// y0 the base.
export type Box = {
  x: number;
  z: number;
  y0: number;
  w: number; // size along x
  d: number; // size along z
  h: number;
  seed: number; // 0..1, per building (window pattern, tint)
  kind: 0 | 1 | 2; // 0 body, 1 roof box / spire (no windows), 2 podium
};

export type CityParams = {
  seed: number;
  period: number; // street length that repeats exactly
  roadHalf: number; // half road width incl. sidewalk
  floorH: number;
  minFloors: number;
  maxFloors: number;
  rows: number; // building rows per side (1 = street front only)
  lotMin: number;
  lotMax: number;
};

// Builds a street-lined block that tiles exactly every `period` metres along z.
// Lots are packed from z = 0 to z = period on each side, so copies placed at
// k * period meet seamlessly.
export function generateStreet(p: CityParams): Box[] {
  const r = mulberry32(p.seed);
  const boxes: Box[] = [];
  for (const side of [-1, 1]) {
    for (let row = 0; row < p.rows; row++) {
      let z = 0;
      const rowStart = p.roadHalf + row * 34 + (row > 0 ? range(r, 0, 6) : 0);
      while (z < p.period - 4) {
        let len = range(r, p.lotMin, p.lotMax);
        if (p.period - z - len < p.lotMin) len = p.period - z - 0.8; // close the period
        const gap = range(r, 0.8, 2.6);
        const lotLen = Math.max(4, len - gap);
        const zc = z + gap / 2 + lotLen / 2;
        const depth = range(r, 10, 24);
        const setback = row === 0 ? range(r, 0, 3.5) : range(r, 0, 8);
        const xNear = rowStart + setback;
        const xc = side * (xNear + depth / 2);
        // Heights: skewed so a few towers dominate; back rows taller.
        const tall = Math.pow(r(), 1.6);
        const floors = Math.round(
          p.minFloors + (p.maxFloors - p.minFloors) * Math.min(1, tall + row * 0.25),
        );
        const h = floors * p.floorH;
        const seed = r();
        const shape = r();
        if (shape < 0.22 && floors > 8) {
          // L-shape: a long low wing plus a narrower tall wing.
          const wingD = lotLen * range(r, 0.4, 0.6);
          boxes.push({ x: xc, z: zc - lotLen / 2 + wingD / 2, y0: 0, w: depth, d: wingD, h, seed, kind: 0 });
          const lowH = Math.round(floors * range(r, 0.3, 0.6)) * p.floorH;
          boxes.push({
            x: xc + side * depth * 0.2,
            z: zc + wingD / 2,
            y0: 0,
            w: depth * 0.6,
            d: lotLen - wingD,
            h: lowH,
            seed: (seed + 0.37) % 1,
            kind: 0,
          });
        } else if (shape < 0.55 && floors > 14) {
          // Podium + setback tower (+ optional second setback).
          const podH = irange(r, 3, 6) * p.floorH;
          boxes.push({ x: xc, z: zc, y0: 0, w: depth, d: lotLen, h: podH, seed, kind: 2 });
          const tw = depth * range(r, 0.6, 0.8);
          const td = lotLen * range(r, 0.6, 0.85);
          const tx = xc - side * (depth - tw) * 0.3;
          if (r() < 0.5 && floors > 24) {
            const midH = h * range(r, 0.55, 0.7);
            boxes.push({ x: tx, z: zc, y0: podH, w: tw, d: td, h: midH - podH, seed, kind: 0 });
            boxes.push({ x: tx, z: zc, y0: midH, w: tw * 0.72, d: td * 0.72, h: h - midH, seed, kind: 0 });
          } else {
            boxes.push({ x: tx, z: zc, y0: podH, w: tw, d: td, h: h - podH, seed, kind: 0 });
          }
        } else {
          boxes.push({ x: xc, z: zc, y0: 0, w: depth, d: lotLen, h, seed, kind: 0 });
        }
        // Roof boxes and spires on the tallest.
        if (floors > p.maxFloors * 0.6) {
          const top = boxes[boxes.length - 1];
          const ty = top.y0 + top.h;
          if (r() < 0.7) {
            boxes.push({ x: top.x, z: top.z, y0: ty, w: top.w * 0.45, d: top.d * 0.45, h: p.floorH * range(r, 1, 2.5), seed, kind: 1 });
          }
          if (r() < 0.55) {
            const sh = range(r, 8, 22);
            boxes.push({
              x: top.x + range(r, -0.2, 0.2) * top.w,
              z: top.z + range(r, -0.2, 0.2) * top.d,
              y0: ty,
              w: 0.5,
              d: 0.5,
              h: sh,
              seed,
              kind: 1,
            });
          }
        }
        z += len;
      }
    }
  }
  return boxes;
}

