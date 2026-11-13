import { mulberry32 } from "./util";

// Procedural motherboard population: positions/sizes/colours of every
// component box, and the fan-out traces that leave the CPU socket.

export type Part = {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  color: [number, number, number];
  spec: number;
};

const BLACK: [number, number, number] = [0.028, 0.03, 0.036];
const DARK: [number, number, number] = [0.05, 0.054, 0.062];
const SILVER: [number, number, number] = [0.5, 0.52, 0.56];
const STEEL: [number, number, number] = [0.3, 0.32, 0.36];
const NAVY: [number, number, number] = [0.04, 0.07, 0.16];

export const buildParts = (): Part[] => {
  const rand = mulberry32(8811);
  const parts: Part[] = [];
  const EXT = 44;
  const RES = 0.25;
  const N = Math.ceil((EXT * 2) / RES);
  const occ = new Uint8Array(N * N);
  const cell = (v: number) => Math.floor((v + EXT) / RES);
  const free = (x: number, z: number, w: number, d: number, pad: number) => {
    const x0 = cell(x - w / 2 - pad);
    const x1 = cell(x + w / 2 + pad);
    const z0 = cell(z - d / 2 - pad);
    const z1 = cell(z + d / 2 + pad);
    if (x0 < 0 || z0 < 0 || x1 >= N || z1 >= N) return false;
    for (let j = z0; j <= z1; j++)
      for (let i = x0; i <= x1; i++) if (occ[j * N + i]) return false;
    return true;
  };
  const mark = (x: number, z: number, w: number, d: number) => {
    const x0 = cell(x - w / 2);
    const x1 = cell(x + w / 2);
    const z0 = cell(z - d / 2);
    const z1 = cell(z + d / 2);
    for (let j = z0; j <= z1; j++)
      for (let i = x0; i <= x1; i++) occ[j * N + i] = 1;
  };
  const box = (
    x: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: [number, number, number],
    spec: number,
    y0 = 0,
  ) => {
    parts.push({ x, y: y0 + h / 2, z, sx: w, sy: h, sz: d, color, spec });
  };
  // keep the socket area clear
  mark(0, 0, 9.4, 9.4);

  const ic = (x: number, z: number, w: number, d: number, h = 0.34) => {
    box(x, z, w, h, d, BLACK, 0.12);
    box(x, z, w * 0.99, 0.02, d * 0.99, DARK, 0.3, h); // lighter top skin
    mark(x, z, w, d);
  };
  // ring of large memory / power ICs around the socket
  for (let k = 0; k < 4; k++) ic(-7.4, -4.05 + k * 2.7, 2.3, 2.3);
  for (let k = 0; k < 5; k++) ic(-4.6 + k * 2.3, -7.4, 1.95, 1.9);
  for (let k = 0; k < 3; k++) ic(7.3, -3.2 + k * 2.9, 2.4, 2.4);
  ic(6.2, 7.6, 2.0, 2.0);
  // long connectors / heat sinks at the back
  box(-17, -15.5, 15, 1.3, 3.2, BLACK, 0.2);
  mark(-17, -15.5, 15, 3.2);
  box(9, -17, 12, 1.0, 2.6, BLACK, 0.2);
  mark(9, -17, 12, 2.6);
  box(-24, 4, 2.6, 0.9, 13, BLACK, 0.2);
  mark(-24, 4, 2.6, 13);
  box(24, -2, 2.4, 1.1, 10, BLACK, 0.2);
  mark(24, -2, 2.4, 10);

  const smd = (x: number, z: number, rot: boolean, dark: boolean) => {
    const w = rot ? 0.52 : 0.26;
    const d = rot ? 0.26 : 0.52;
    box(x, z, w, 0.16, d, dark ? DARK : NAVY, 0.25);
    const ex = rot ? 0.2 : 0;
    const ez = rot ? 0 : 0.2;
    box(x - ex, z - ez, rot ? 0.13 : 0.28, 0.17, rot ? 0.28 : 0.13, SILVER, 0.8);
    box(x + ex, z + ez, rot ? 0.13 : 0.28, 0.17, rot ? 0.28 : 0.13, SILVER, 0.8);
  };

  for (let a = 0; a < 20000; a++) {
    const x = (rand() * 2 - 1) * (EXT - 3);
    const z = (rand() * 2 - 1) * (EXT - 3);
    const r = Math.hypot(x, z);
    const kind = rand();
    const keep = rand();
    // leave room for the glowing traces close to the socket
    if (r < 10 && keep > 0.8) continue;
    if (kind < 0.07) {
      const w = 1.0 + rand() * 1.8;
      const d = 1.0 + rand() * 1.8;
      if (!free(x, z, w, d, 0.3)) continue;
      ic(x, z, w, d, 0.24 + rand() * 0.25);
    } else if (kind < 0.11) {
      if (r < 15) continue;
      // silver capacitor / crystal can
      const w = 0.5 + rand() * 0.35;
      const d = 0.4 + rand() * 0.25;
      if (!free(x, z, w, d, 0.2)) continue;
      box(x, z, w, 0.28 + rand() * 0.15, d, SILVER, 0.9);
      mark(x, z, w, d);
    } else if (kind < 0.15) {
      if (r < 15) continue;
      // steel inductor block
      const w = 0.7 + rand() * 0.5;
      if (!free(x, z, w, w, 0.2)) continue;
      box(x, z, w, 0.35 + rand() * 0.2, w, STEEL, 0.5);
      mark(x, z, w, w);
    } else if (kind < 0.72) {
      // row of SMD passives
      const n = 2 + Math.floor(rand() * 6);
      const alongX = rand() < 0.5;
      const w = alongX ? n * 0.42 : 0.6;
      const d = alongX ? 0.6 : n * 0.42;
      if (!free(x, z, w, d, 0.15)) continue;
      const dark = rand() < 0.6;
      for (let k = 0; k < n; k++) {
        const o = (k - (n - 1) / 2) * 0.42;
        smd(alongX ? x + o : x, alongX ? z : z + o, !alongX, dark);
      }
      mark(x, z, w, d);
    } else {
      // grid of bare test pads
      const nx = 2 + Math.floor(rand() * 4);
      const nz = 1 + Math.floor(rand() * 3);
      const w = nx * 0.3;
      const d = nz * 0.3;
      if (!free(x, z, w, d, 0.15)) continue;
      for (let i = 0; i < nx; i++)
        for (let j = 0; j < nz; j++)
          box(
            x + (i - (nx - 1) / 2) * 0.3,
            z + (j - (nz - 1) / 2) * 0.3,
            0.15,
            0.025,
            0.15,
            SILVER,
            1.0,
          );
      mark(x, z, w, d);
    }
  }
  return parts;
};

export type TracePath = { pts: [number, number][]; seed: number };

/** Classic fan-out: traces leave each socket edge, bend 45° and run out. */
export const buildTraces = (): TracePath[] => {
  const rand = mulberry32(551);
  const paths: TracePath[] = [];
  const EDGE = 2.42;
  const PER_SIDE = 46;
  for (let side = 0; side < 4; side++) {
    const ca = Math.cos((side * Math.PI) / 2);
    const sa = Math.sin((side * Math.PI) / 2);
    // local frame: u along the edge, v outward
    const toWorld = (u: number, v: number): [number, number] => [
      u * ca - v * sa,
      u * sa + v * ca,
    ];
    for (let k = 0; k < PER_SIDE; k++) {
      const s = ((k + 0.5) / PER_SIDE) * 2 - 1; // -1..1 along the edge
      if (rand() < 0.12) continue;
      let u = s * 2.05;
      let v = EDGE;
      const pts: [number, number][] = [toWorld(u, v)];
      const sgn = s >= 0 ? 1 : -1;
      const l1 = 0.25 + (1 - Math.abs(s)) * 1.7;
      v += l1;
      pts.push(toWorld(u, v));
      const l2 = 0.5 + Math.abs(s) * 2.6 + rand() * 0.2;
      u += sgn * l2;
      v += l2;
      pts.push(toWorld(u, v));
      const l3 = 0.8 + rand() * 6.5;
      v += l3;
      pts.push(toWorld(u, v));
      if (rand() < 0.55) {
        const l4 = 0.4 + rand() * 1.6;
        const d = rand() < 0.75 ? sgn : -sgn;
        u += d * l4;
        v += l4;
        pts.push(toWorld(u, v));
        v += 0.6 + rand() * 5;
        pts.push(toWorld(u, v));
      }
      paths.push({ pts, seed: rand() });
    }
  }
  return paths;
};
