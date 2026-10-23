// Procedural layout of the CPU close-up: an LGA package lying on a dark
// board, its gold contact pads, the circuit traces leaving its right edge and
// the glowing "data" particles. All generated from a fixed seed.
//
// World units: the board is the XZ plane (y up). The package occupies
// x in [-PKG, 0], z in [-PKG, 0], so its right edge is x = 0, its front edge
// z = 0 and its back edge z = -PKG; traces fan out from those three sides.

import { mulberry32 } from "./random";

export const PKG = 6; // package size
export const PKG_H = 0.22; // substrate thickness
export const PAD_PITCH = 0.19;

export type Vec2 = [number, number];
export type Trace = { pts: Vec2[]; len: number; cum: number[] };

export type Pad = { x: number; z: number };

export const makePads = (): Pad[] => {
  const pads: Pad[] = [];
  const rnd = mulberry32(3);
  const n = Math.floor((PKG - 0.5) / PAD_PITCH);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      // Staggered rows, like a real LGA land grid.
      const x = -PKG + 0.45 + i * PAD_PITCH + (j % 2) * PAD_PITCH * 0.5;
      const z = -PKG + 0.45 + j * PAD_PITCH;
      if (x > -0.25) continue;
      // Central cavity with the small capacitors.
      if (x > -4.0 && x < -2.0 && z > -4.0 && z < -2.0) continue;
      // Key notches cut into the grid.
      if (x > -1.25 && x < -0.85 && z > -4.9 && z < -3.3) continue;
      if (x > -4.6 && x < -3.2 && z > -1.0 && z < -0.6) continue;
      if (rnd() < 0.004) continue;
      pads.push({ x, z });
    }
  }
  return pads;
};

// Small surface-mount parts in the cavity (x, z, w, d, rotated).
export const makeCaps = () => {
  const rnd = mulberry32(5);
  const caps: { x: number; z: number; w: number; d: number }[] = [];
  for (let i = 0; i < 22; i++) {
    const horiz = rnd() < 0.5;
    caps.push({
      x: -3.8 + rnd() * 1.6,
      z: -3.8 + rnd() * 1.6,
      w: horiz ? 0.16 : 0.08,
      d: horiz ? 0.08 : 0.16,
    });
  }
  return caps;
};

const finishTrace = (pts: Vec2[]): Trace => {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i - 1][0];
    const dz = pts[i][1] - pts[i - 1][1];
    cum.push(cum[i - 1] + Math.hypot(dx, dz));
  }
  return { pts, cum, len: cum[cum.length - 1] };
};

// Each package side the traces leave from: map local (u = distance out from
// the edge, v = position along the edge) to world (x, z).
type Side = { map: (u: number, v: number) => Vec2; vFrom: number; vTo: number };
export const SIDES: Side[] = [
  { map: (u, v) => [u, v], vFrom: 1.6, vTo: -PKG - 2.5 }, // right edge, x > 0
  { map: (u, v) => [v, u], vFrom: -0.15, vTo: -PKG }, // front edge, z > 0
  { map: (u, v) => [v, -PKG - u], vFrom: -0.15, vTo: -PKG }, // back edge
];

// Traces leave the package edge in bundles, run outward, jog by 45 degrees
// and fold into the nested L / U shapes seen on real boards.
export const makeTraces = (): Trace[] => {
  const rnd = mulberry32(21);
  const traces: Trace[] = [];
  for (const side of SIDES) {
    let v = side.vFrom;
    while (v > side.vTo) {
      const bundle = 3 + Math.floor(rnd() * 6);
      const pitch = 0.07 + rnd() * 0.06;
      const dir = rnd() < 0.5 ? -1 : 1;
      const run1 = 0.5 + rnd() * 1.8;
      const jog = 0.3 + rnd() * 1.2;
      const run2 = 0.8 + rnd() * 4.0;
      const fold = rnd();
      const tail = rnd();
      for (let b = 0; b < bundle; b++) {
        const v0 = v - b * pitch;
        const u0 = 1.0 + rnd() * 0.3;
        const loc: Vec2[] = [[u0, v0]];
        const off = (dir > 0 ? b : bundle - b) * pitch * 0.42;
        let u = u0 + run1 + off;
        loc.push([u, v0]);
        const v1 = v0 + dir * jog;
        u += jog;
        loc.push([u, v1]);
        u += run2 - off * 2;
        loc.push([u, v1]);
        if (fold < 0.45) {
          const v2 = v1 + dir * (0.4 + b * pitch * 1.4);
          loc.push([u, v2]);
          if (fold < 0.22) loc.push([u - 0.6 - tail * 1.2, v2]);
        } else if (fold < 0.75) {
          const j2 = 0.25 + tail * 0.7;
          loc.push([u + j2, v1 - dir * j2]);
          loc.push([u + j2 + 0.8 + tail * 3, v1 - dir * j2]);
        }
        traces.push(finishTrace(loc.map(([a, c]) => side.map(a, c))));
      }
      v -= bundle * pitch + 0.12 + rnd() * 0.4;
    }
  }
  return traces;
};

export const pointOnTrace = (tr: Trace, s: number): Vec2 => {
  const d = Math.max(0, Math.min(tr.len, s));
  let i = 1;
  while (i < tr.cum.length - 1 && tr.cum[i] < d) i++;
  const seg = tr.cum[i] - tr.cum[i - 1];
  const k = seg > 0 ? (d - tr.cum[i - 1]) / seg : 0;
  return [
    tr.pts[i - 1][0] + (tr.pts[i][0] - tr.pts[i - 1][0]) * k,
    tr.pts[i - 1][1] + (tr.pts[i][1] - tr.pts[i - 1][1]) * k,
  ];
};

// --- Particles ---------------------------------------------------------------

export type Particle = {
  kind: 0 | 1; // 0 = rides a trace, 1 = static contact light at the edge
  trace: number;
  s0: number;
  speed: number;
  x: number;
  z: number;
  y: number;
  amber: boolean;
  size: number;
  phase: number;
};

export const makeParticles = (traces: Trace[]): Particle[] => {
  const rnd = mulberry32(99);
  const out: Particle[] = [];
  // Dense bands of tiny lit contacts right along the package edges.
  for (const side of SIDES) {
    const span = side.vFrom - side.vTo;
    const count = Math.round(span * 62);
    for (let i = 0; i < count; i++) {
      const [x, z] = side.map(
        0.12 + Math.pow(rnd(), 1.9) * 0.9,
        side.vFrom - rnd() * span,
      );
      out.push({
        kind: 1,
        trace: -1,
        s0: 0,
        speed: 0,
        x,
        z,
        y: 0.01 + rnd() * 0.04,
        amber: rnd() < 0.4,
        size: 0.02 + rnd() * 0.024,
        phase: rnd() * 100,
      });
    }
  }
  // Data pulses riding the traces.
  traces.forEach((tr, ti) => {
    const count = Math.max(1, Math.round(tr.len * (0.5 + rnd() * 0.7)));
    for (let k = 0; k < count; k++) {
      out.push({
        kind: 0,
        trace: ti,
        s0: rnd() * tr.len,
        speed: (0.25 + rnd() * 0.6) * (rnd() < 0.15 ? -1 : 1),
        x: 0,
        z: 0,
        y: 0.012,
        amber: rnd() < 0.38,
        size: 0.02 + rnd() * 0.022,
        phase: rnd() * 100,
      });
    }
  });
  return out;
};

// Floating dust motes catching the light.
export const makeDust = () => {
  const rnd = mulberry32(1234);
  const d: {
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
  }[] = [];
  for (let i = 0; i < 160; i++) {
    d.push({
      x: -4 + rnd() * 16,
      y: 0.2 + rnd() * 3.5,
      z: -14 + rnd() * 18,
      vx: (rnd() - 0.5) * 0.06,
      vy: (rnd() - 0.3) * 0.04,
      vz: (rnd() - 0.5) * 0.06,
    });
  }
  return d;
};
