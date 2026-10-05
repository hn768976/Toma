import { mulberry32, range } from "../../lib/random";

/*
 * Holo City tile, generated once at module level from a fixed seed.
 * The tile spans z in [0, TILE) and repeats along z; every element carries an
 * "anchor" z (its tower's centre) so whole towers wrap together in the shader.
 */

export const TILE = 80; // tile length (world units); camera travels this per loop
export const STREET = 2.7; // half width of the main street
const LOT = 5; // lot pitch in x and z (divides TILE)

export type Tower = {
  x: number;
  z: number;
  w: number; // x size (or diameter for round)
  d: number; // z size
  h: number;
  round: boolean;
  seed: number;
  sx: number; // horizontal point spacing
  sy: number; // vertical point spacing
  glass: boolean;
  scan: boolean; // has scanning rings
  flicker: boolean;
};

export type CityData = {
  towers: Tower[];
  // points
  pPos: Float32Array; // xyz
  pAnchor: Float32Array; // anchor z
  pInfo: Float32Array; // seed, height frac, brightness, kind (0 base, 1 flicker window, 2 accent)
  // lines: a(xyz) b(xyz) anchor, kind, phase, intensity, extra(4)
  lA: Float32Array;
  lB: Float32Array;
  lP: Float32Array; // anchor, kind, phase, intensity
  lE: Float32Array; // kind-specific
  nPoints: number;
  nLines: number;
};

export const LINE_EDGE = 0;
export const LINE_BASE = 1;
export const LINE_RING = 2;
export const LINE_CROSS = 3;

export const CITY: CityData = (() => {
  const r = mulberry32(1020170812);
  const towers: Tower[] = [];
  const cols = [5.6, 10.6, 15.6, 20.6, 25.6, 30.6, 36, 42, 48];
  for (let iz = 0; iz < TILE / LOT; iz++) {
    const crossStreet = iz % 6 === 3;
    for (const side of [-1, 1]) {
      cols.forEach((cx, ci) => {
        if (crossStreet && r() < 0.85) return;
        const p = ci === 0 ? 0.95 : ci < 3 ? 0.88 : 0.8;
        if (r() > p) return;
        const round = r() < 0.65;
        const maxF = ci === 0 ? 3.6 : 4.2;
        const w = round ? range(r, 2.0, maxF) : range(r, 1.8, maxF);
        const d = round ? w : range(r, 1.8, 4.3);
        const tall = r();
        const h =
          ci === 0
            ? range(r, 16, 24) + tall * 14
            : range(r, 5, 12) + tall * tall * tall * 18;
        const x = side * (cx + range(r, -0.5, 0.5) - (ci === 0 ? 0.6 : 0)) ;
        const dense = r() < 0.25;
        const sx = dense ? range(r, 0.18, 0.21) : range(r, 0.23, 0.31);
        towers.push({
          x: Math.sign(x) * Math.max(Math.abs(x), STREET + w / 2 + 0.4),
          z: iz * LOT + LOT / 2 + range(r, -0.6, 0.6),
          w,
          d,
          h,
          round,
          seed: r(),
          sx,
          sy: dense ? range(r, 0.26, 0.3) : range(r, 0.3, 0.42),
          glass: r() < 0.45,
          scan: r() < 0.6,
          flicker: r() < 0.25,
        });
      });
    }
  }

  const pos: number[] = [];
  const anc: number[] = [];
  const info: number[] = [];
  const la: number[] = [];
  const lb: number[] = [];
  const lp: number[] = [];
  const le: number[] = [];
  const line = (
    a: number[],
    b: number[],
    anchor: number,
    kind: number,
    phase: number,
    inten: number,
    e: number[] = [0, 0, 0, 0],
  ) => {
    la.push(...a);
    lb.push(...b);
    lp.push(anchor, kind, phase, inten);
    le.push(...e);
  };

  for (const t of towers) {
    const bright = range(r, 0.6, 1.25);
    const accentRows = r() < 0.5;
    const rows = Math.max(2, Math.round(t.h / t.sy));
    const addPoint = (x: number, y: number, z: number) => {
      const hf = y / t.h;
      let kind = 0;
      if (t.flicker && r() < 0.05) kind = 1;
      else if (accentRows && Math.floor(y / t.sy) % 7 === 0) kind = 2;
      pos.push(x, y, z);
      anc.push(t.z);
      info.push(t.seed, hf, bright * range(r, 0.75, 1.15), kind);
    };
    if (t.round) {
      const rad = t.w / 2;
      const n = Math.max(8, Math.round((Math.PI * t.w) / t.sx));
      for (let j = 0; j <= rows; j++) {
        const y = j * t.sy;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          addPoint(t.x + Math.cos(a) * rad, y, t.z + Math.sin(a) * rad);
        }
      }
      // vertical light strands
      const strands = Math.round(n / 14);
      for (let i = 0; i < strands; i++) {
        const a = (i / strands) * Math.PI * 2 + 0.2;
        const px = t.x + Math.cos(a) * rad;
        const pz = t.z + Math.sin(a) * rad;
        line([px, 0, pz], [px, t.h, pz], t.z, LINE_EDGE, r(), 0.3);
      }
    } else {
      const hw = t.w / 2;
      const hd = t.d / 2;
      const faces: [number, number, number, number][] = [
        [t.x - hw, t.z - hd, t.x + hw, t.z - hd],
        [t.x + hw, t.z - hd, t.x + hw, t.z + hd],
        [t.x + hw, t.z + hd, t.x - hw, t.z + hd],
        [t.x - hw, t.z + hd, t.x - hw, t.z - hd],
      ];
      for (const [x0, z0, x1, z1] of faces) {
        const len = Math.hypot(x1 - x0, z1 - z0);
        const n = Math.max(2, Math.round(len / t.sx));
        for (let j = 0; j <= rows; j++) {
          const y = j * t.sy;
          for (let i = 0; i < n; i++) {
            const f = i / n;
            addPoint(x0 + (x1 - x0) * f, y, z0 + (z1 - z0) * f);
          }
        }
        // corner edge line
        line([x0, 0, z0], [x0, t.h, z0], t.z, LINE_EDGE, r(), 0.9);
        // roof outline
        line([x0, t.h, z0], [x1, t.h, z1], t.z, LINE_EDGE, r(), 0.5);
        // some vertical light lines on the face
        if (r() < 0.15) {
          const k = 1 + Math.floor(r() * 2);
          for (let i = 1; i <= k; i++) {
            const f = i / (k + 1);
            const px = x0 + (x1 - x0) * f;
            const pz = z0 + (z1 - z0) * f;
            line([px, 0, pz], [px, t.h * range(r, 0.6, 1), pz], t.z, LINE_EDGE, r(), 0.3);
          }
        }
      }
    }
    // glowing outline square at the base (slightly larger than footprint)
    {
      const m = 0.35;
      const hw = t.w / 2 + m;
      const hd = (t.round ? t.w : t.d) / 2 + m;
      const c = [
        [t.x - hw, t.z - hd],
        [t.x + hw, t.z - hd],
        [t.x + hw, t.z + hd],
        [t.x - hw, t.z + hd],
      ];
      for (let i = 0; i < 4; i++) {
        const a = c[i];
        const b = c[(i + 1) % 4];
        line([a[0], 0.02, a[1]], [b[0], 0.02, b[1]], t.z, LINE_BASE, 0, 0.5);
      }
    }
    // scanning rings: rise from the base and fade (cycles per loop in e.x)
    if (t.scan && t.round) {
      const nr = 5;
      const cyc = [2, 3, 4, 5][Math.floor(r() * 4)];
      const top = t.h * range(r, 0.2, 0.45);
      for (let k = 0; k < nr; k++) {
        const ph = k / nr + r() * 0.05;
        const segs = 40;
        const rx = t.w / 2 + 0.12;
        const rz = (t.round ? t.w : t.d) / 2 + 0.12;
        for (let i = 0; i < segs; i++) {
          let a0: number[];
          let a1: number[];
          if (t.round) {
            const q0 = (i / segs) * Math.PI * 2;
            const q1 = ((i + 1) / segs) * Math.PI * 2;
            a0 = [t.x + Math.cos(q0) * rx, 0, t.z + Math.sin(q0) * rz];
            a1 = [t.x + Math.cos(q1) * rx, 0, t.z + Math.sin(q1) * rz];
          } else {
            // rectangle perimeter param
            const per = (q: number) => {
              const P = 2 * (2 * rx + 2 * rz);
              let s = (q / segs) * P;
              if (s < 2 * rx) return [t.x - rx + s, 0, t.z - rz];
              s -= 2 * rx;
              if (s < 2 * rz) return [t.x + rx, 0, t.z - rz + s];
              s -= 2 * rz;
              if (s < 2 * rx) return [t.x + rx - s, 0, t.z + rz];
              s -= 2 * rx;
              return [t.x - rx, 0, t.z + rz - s];
            };
            a0 = per(i);
            a1 = per(i + 1);
          }
          line(a0, a1, t.z, LINE_RING, ph, 1.0, [cyc, top, 0, 0]);
        }
      }
    }
  }

  // long thin bright lines crossing the scene at angles, drawing on and fading
  for (let i = 0; i < 24; i++) {
    const z0 = r() * TILE;
    const len = range(r, 10, 30);
    const ang = range(r, -1.2, 1.2);
    const y0 = r() < 0.5 ? range(r, 0.05, 0.4) : range(r, 1, 18);
    const y1 = y0 + range(r, -2, 6) * (r() < 0.5 ? 1 : 0);
    const x0 = range(r, -4, 4);
    const a = [x0, y0, z0];
    const b = [x0 + Math.sin(ang) * len, Math.max(0.05, y1), z0 - Math.cos(ang) * len];
    const cyc = [1, 2, 3, 4][Math.floor(r() * 4)];
    line(a, b, (a[2] + b[2]) / 2, LINE_CROSS, r(), range(r, 0.8, 1.6), [cyc, range(r, 0.25, 0.5), 0, 0]);
  }
  // thin white traces on the floor, running along the street
  for (let i = 0; i < 36; i++) {
    const z0 = r() * TILE;
    const x0 = range(r, -2.4, 2.4);
    const len = range(r, 4, 14);
    const ang = range(r, -0.5, 0.5);
    const a = [x0, 0.02, z0];
    const b = [x0 + Math.sin(ang) * len, 0.02, z0 - Math.cos(ang) * len];
    line(a, b, (a[2] + b[2]) / 2, LINE_CROSS, r(), range(r, 0.5, 1.0), [[1, 2, 3][Math.floor(r() * 3)], range(r, 0.3, 0.6), 0, 0]);
  }
  // a few tall thin vertical light lines in the gaps
  for (let i = 0; i < 40; i++) {
    const z = r() * TILE;
    const x = r() < 0.5 ? range(r, -1.8, 1.8) : (r() < 0.5 ? -1 : 1) * range(r, STREET + 0.2, 30);
    line([x, 0, z], [x, range(r, 8, 30), z], z, LINE_EDGE, r(), 0.22);
  }

  return {
    towers,
    pPos: new Float32Array(pos),
    pAnchor: new Float32Array(anc),
    pInfo: new Float32Array(info),
    lA: new Float32Array(la),
    lB: new Float32Array(lb),
    lP: new Float32Array(lp),
    lE: new Float32Array(le),
    nPoints: anc.length,
    nLines: lp.length / 4,
  };
})();
