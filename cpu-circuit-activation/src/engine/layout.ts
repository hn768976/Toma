import { mulberry32, range, Rng } from "./rng";

export const BOARD_HALF = 46;
export const SOCKET_HALF = 1.42;

export type Trace = {
  pts: [number, number][];
  width: number;
  /** 1 = main (lit by the chip), 0 = background routing */
  kind: number;
  seed: number;
  /** path distance already travelled when the trace starts (drives the reveal wave) */
  startDist: number;
  via: boolean;
};

export type Box = {
  x: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  rot: number;
  /** 0 dark, 1 mid, 2 light, 3 LED (emissive), 4 pad row (emissive), 5 glass */
  tone: number;
  y?: number;
};

const DIRS: [number, number][] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

/** The glowing traces fanning out of the four sides of the socket. */
export const buildMainTraces = (rng: Rng): Trace[] => {
  const traces: Trace[] = [];
  const N = 14;
  const pitch = 0.15;
  const kmax = (N - 1) / 2;
  for (let s = 0; s < 4; s++) {
    const [ox, oz] = DIRS[s];
    const tx = -oz;
    const tz = ox;
    for (const sigma of [-1, 1]) {
      // per half-side monotone tables so that neighbouring traces never cross
      const half = N / 2;
      const l1: number[] = [];
      const l2: number[] = [];
      let acc1 = 0.3 + rng() * 0.3;
      for (let j = half - 1; j >= 0; j--) {
        l1[j] = acc1;
        acc1 += pitch * (0.55 + rng() * 0.5) + (rng() < 0.22 ? 0.35 : 0);
      }
      let acc2 = 0;
      const straight = 1 + Math.floor(rng() * 2); // innermost traces run straight out
      for (let j = 0; j < half; j++) {
        if (j >= straight) acc2 += 0.16 + rng() * 0.3 + (rng() < 0.3 ? 0.7 + rng() * 1.2 : 0);
        l2[j] = acc2;
      }
      const cut = straight + 1 + Math.floor(rng() * (half - straight - 1));
      const bend2At = 2.2 + rng() * 3.5;
      let accM = 0.6 + rng();
      for (let j = 0; j < half; j++) {
        const k = j + 0.5;
        const u = sigma * k * pitch;
        const pts: [number, number][] = [];
        let x = ox * SOCKET_HALF + tx * u;
        let z = oz * SOCKET_HALF + tz * u;
        pts.push([x, z]);
        const adv = (dx: number, dz: number, len: number) => {
          x += dx * len;
          z += dz * len;
          pts.push([x, z]);
        };
        const dgx = (ox + sigma * tx) * Math.SQRT1_2;
        const dgz = (oz + sigma * tz) * Math.SQRT1_2;
        adv(ox, oz, l1[j]);
        if (l2[j] > 0) adv(dgx, dgz, l2[j]);
        if (j >= cut) {
          adv(ox, oz, bend2At + (kmax - k) * 0.3);
          accM += 0.3 + rng() * 0.9;
          adv(dgx, dgz, accM);
        }
        adv(ox, oz, range(rng, 3, 9) + (rng() < 0.55 ? range(rng, 6, 34) : 0));
        // clamp the last point to the board
        const last = pts[pts.length - 1];
        const inside = Math.abs(last[0]) < BOARD_HALF - 1 && Math.abs(last[1]) < BOARD_HALF - 1;
        traces.push({ pts, width: 0.017 + 0.012 * rng(), kind: 1, seed: rng(), startDist: 0, via: inside });
      }
    }
  }
  return traces;
};

/** Dim background routing all over the board (bundles of parallel traces). */
export const buildBackgroundTraces = (rng: Rng): Trace[] => {
  const out: Trace[] = [];
  for (let n = 0; n < 420; n++) {
    let x = range(rng, -BOARD_HALF, BOARD_HALF);
    let z = range(rng, -BOARD_HALF, BOARD_HALF);
    if (Math.hypot(x, z) < 4.2) continue;
    let d = Math.floor(rng() * 8); // 8 directions, 45 degrees apart
    const segs = 2 + Math.floor(rng() * 4);
    const base: [number, number][] = [[x, z]];
    let ok = true;
    for (let i = 0; i < segs; i++) {
      const len = i % 2 === 0 ? range(rng, 1.0, 6.0) : range(rng, 0.3, 1.6);
      const a = (d * Math.PI) / 4;
      x += Math.cos(a) * len;
      z += Math.sin(a) * len;
      if (Math.hypot(x, z) < 4.0) {
        ok = false;
        break;
      }
      base.push([x, z]);
      d = (d + (rng() < 0.5 ? 1 : 7)) % 8;
    }
    if (!ok || base.length < 2) continue;
    const count = 1 + Math.floor(rng() * 5);
    const gap = 0.085;
    const startDist = Math.hypot(base[0][0], base[0][1]);
    for (let c = 0; c < count; c++) {
      out.push({
        pts: offsetPolyline(base, (c - (count - 1) / 2) * gap),
        width: 0.026,
        kind: 0,
        seed: rng(),
        startDist,
        via: rng() < 0.7,
      });
    }
  }
  return out;
};

/** Parallel offset of a polyline with mitred corners. */
export const offsetPolyline = (pts: [number, number][], off: number): [number, number][] => {
  const n = pts.length;
  const res: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[i];
    const c = pts[Math.min(n - 1, i + 1)];
    let d0x = b[0] - a[0];
    let d0z = b[1] - a[1];
    let d1x = c[0] - b[0];
    let d1z = c[1] - b[1];
    const l0 = Math.hypot(d0x, d0z) || 1;
    const l1 = Math.hypot(d1x, d1z) || 1;
    d0x /= l0;
    d0z /= l0;
    d1x /= l1;
    d1z /= l1;
    if (i === 0) {
      d0x = d1x;
      d0z = d1z;
    }
    if (i === n - 1) {
      d1x = d0x;
      d1z = d0z;
    }
    let nx = -(d0z + d1z);
    let nz = d0x + d1x;
    const nl = Math.hypot(nx, nz) || 1;
    nx /= nl;
    nz /= nl;
    // miter length
    const cos = nx * -d0z + nz * d0x;
    const m = off / Math.max(0.35, cos);
    res.push([b[0] + nx * m, b[1] + nz * m]);
  }
  return res;
};

export type TraceGeometry = {
  position: Float32Array;
  uv: Float32Array;
  /** x = path distance, y = seed, z = kind, w = 0 ribbon / 1 via */
  info: Float32Array;
  index: Uint32Array;
};

export const buildTraceGeometry = (traces: Trace[]): TraceGeometry => {
  const pos: number[] = [];
  const uv: number[] = [];
  const info: number[] = [];
  const idx: number[] = [];
  for (const tr of traces) {
    const y = tr.kind === 1 ? 0.016 : 0.01;
    const L = offsetPolyline(tr.pts, tr.width * 0.5);
    const R = offsetPolyline(tr.pts, -tr.width * 0.5);
    let dist = tr.startDist;
    const base = pos.length / 3;
    for (let i = 0; i < tr.pts.length; i++) {
      if (i > 0) dist += Math.hypot(tr.pts[i][0] - tr.pts[i - 1][0], tr.pts[i][1] - tr.pts[i - 1][1]);
      pos.push(L[i][0], y, L[i][1], R[i][0], y, R[i][1]);
      uv.push(1, 0, -1, 0);
      info.push(dist, tr.seed, tr.kind, 0, dist, tr.seed, tr.kind, 0);
      if (i > 0) {
        const a = base + (i - 1) * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    if (tr.via) {
      const [cx, cz] = tr.pts[tr.pts.length - 1];
      const r = tr.width * (tr.kind === 1 ? 2.4 : 2.0);
      const b = pos.length / 3;
      const corners: [number, number][] = [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ];
      for (const [ux, uz] of corners) {
        pos.push(cx + ux * r, y + 0.002, cz + uz * r);
        uv.push(ux, uz);
        info.push(dist, tr.seed, tr.kind, 1);
      }
      idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
    }
  }
  return {
    position: new Float32Array(pos),
    uv: new Float32Array(uv),
    info: new Float32Array(info),
    index: new Uint32Array(idx),
  };
};

const distToSeg = (px: number, pz: number, a: [number, number], b: [number, number]) => {
  const vx = b[0] - a[0];
  const vz = b[1] - a[1];
  const wx = px - a[0];
  const wz = pz - a[1];
  const l2 = vx * vx + vz * vz || 1;
  const t = Math.max(0, Math.min(1, (wx * vx + wz * vz) / l2));
  return Math.hypot(px - (a[0] + vx * t), pz - (a[1] + vz * t));
};

/**
 * Electronic components. `camSamples` are [x, y, z] camera positions; anything
 * tall enough to poke into the lens along the flight path is rejected.
 */
export const buildComponents = (
  rng: Rng,
  mains: Trace[],
  camSamples: [number, number, number][],
): Box[] => {
  const boxes: Box[] = [];
  // coarse segment grid for trace avoidance
  const cell = 2;
  const grid = new Map<string, [[number, number], [number, number]][]>();
  for (const tr of mains) {
    for (let i = 1; i < tr.pts.length; i++) {
      const a = tr.pts[i - 1];
      const b = tr.pts[i];
      const steps = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / cell) + 1;
      const seen = new Set<string>();
      for (let s = 0; s <= steps; s++) {
        const x = a[0] + ((b[0] - a[0]) * s) / steps;
        const z = a[1] + ((b[1] - a[1]) * s) / steps;
        for (let dx = -1; dx <= 1; dx++)
          for (let dz = -1; dz <= 1; dz++) {
            const key = `${Math.floor(x / cell) + dx},${Math.floor(z / cell) + dz}`;
            if (seen.has(key)) continue;
            seen.add(key);
            if (!grid.has(key)) grid.set(key, []);
            grid.get(key)!.push([a, b]);
          }
      }
    }
  }
  const nearTrace = (x: number, z: number, margin: number) => {
    const segs = grid.get(`${Math.floor(x / cell)},${Math.floor(z / cell)}`);
    if (!segs) return false;
    for (const [a, b] of segs) if (distToSeg(x, z, a, b) < margin) return true;
    return false;
  };
  // occupancy grid so components do not overlap
  const oc = 0.2;
  const occ = new Set<number>();
  const okey = (ix: number, iz: number) => (ix + 600) * 2048 + (iz + 600);
  const tryPlace = (b: Box, pad: number, avoidTraces = true): boolean => {
    const hx = (Math.abs(Math.cos(b.rot)) * b.sx + Math.abs(Math.sin(b.rot)) * b.sz) / 2 + pad;
    const hz = (Math.abs(Math.sin(b.rot)) * b.sx + Math.abs(Math.cos(b.rot)) * b.sz) / 2 + pad;
    if (Math.abs(b.x) + hx > BOARD_HALF || Math.abs(b.z) + hz > BOARD_HALF) return false;
    if (Math.max(Math.abs(b.x) - hx, Math.abs(b.z) - hz) < SOCKET_HALF + 0.9) return false;
    if (avoidTraces) {
      const r = Math.max(hx, hz);
      if (nearTrace(b.x, b.z, r + 0.03)) return false;
      if (r > 0.3) {
        for (const [cx, cz] of [
          [hx, hz],
          [-hx, hz],
          [hx, -hz],
          [-hx, -hz],
        ])
          if (nearTrace(b.x + cx, b.z + cz, 0.12)) return false;
      }
    }
    // keep the lens corridor clear
    for (const [cx, cy, cz] of camSamples) {
      if (b.sy + (b.y ?? 0) > cy - 0.3 && Math.abs(b.x - cx) < hx + 0.5 + hx && Math.abs(b.z - cz) < hz + 0.5 + hz)
        return false;
    }
    const x0 = Math.floor((b.x - hx) / oc);
    const x1 = Math.floor((b.x + hx) / oc);
    const z0 = Math.floor((b.z - hz) / oc);
    const z1 = Math.floor((b.z + hz) / oc);
    for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) if (occ.has(okey(ix, iz))) return false;
    for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) occ.add(okey(ix, iz));
    boxes.push(b);
    return true;
  };
  const rot90 = () => (rng() < 0.5 ? 0 : Math.PI / 2);
  // density falls off away from the chip so that the hero area is the busiest
  const pos = (minR: number): [number, number] => {
    for (;;) {
      const x = range(rng, -BOARD_HALF, BOARD_HALF);
      const z = range(rng, -BOARD_HALF, BOARD_HALF);
      const r = Math.hypot(x, z);
      if (r < minR) continue;
      if (rng() < 0.3 + 0.7 * Math.exp(-r / 12)) return [x, z];
    }
  };

  // DIMM-like slots with glassy teeth and long connectors
  const slots: [number, number, number, number][] = [
    [-9.5, -6.0, 9, 0],
    [-9.5, -7.4, 9, 0],
    [10.5, 3.5, 7, Math.PI / 2],
    [12.0, 3.5, 7, Math.PI / 2],
    [-18.5, 6.5, 10, 0.0],
    [-3.5, -15.5, 11, 0],
    [-3.5, -17.0, 11, 0],
    [3.0, 14.5, 8, 0],
    [-24, -2, 9, Math.PI / 2],
    [20, -14, 10, 0],
    [16, 18, 9, Math.PI / 2],
    [-14, 22, 10, 0],
  ];
  for (const [x, z, len, rot] of slots) {
    if (!tryPlace({ x, z, sx: len, sy: 0.3, sz: 0.5, rot, tone: 1 }, 0.1, false)) continue;
    const n = Math.floor(len / 0.14);
    for (let i = 0; i < n; i++) {
      const u = (i - (n - 1) / 2) * 0.14;
      for (const side of [-1, 1]) {
        const lx = u;
        const lz = side * 0.2;
        boxes.push({
          x: x + Math.cos(rot) * lx - Math.sin(rot) * lz,
          z: z + Math.sin(rot) * lx + Math.cos(rot) * lz,
          sx: 0.07,
          sy: 0.62,
          sz: 0.05,
          rot,
          tone: 5,
        });
      }
    }
  }
  // rows of glowing pads / status LEDs
  for (let n = 0; n < 34; n++) {
    const [x, z] = pos(5.5);
    const rot = rot90();
    const count = 6 + Math.floor(rng() * 12);
    const step = 0.26;
    if (!tryPlace({ x, z, sx: count * step + 0.2, sy: 0.06, sz: 0.34, rot, tone: 0 }, 0.08)) continue;
    for (let i = 0; i < count; i++) {
      const u = (i - (count - 1) / 2) * step;
      boxes.push({
        x: x + Math.cos(rot) * u,
        z: z + Math.sin(rot) * u,
        sx: 0.15,
        sy: 0.05,
        sz: 0.2,
        rot,
        tone: 4,
        y: 0.06,
      });
    }
  }
  // large ICs
  for (let n = 0; n < 1100; n++) {
    const [x, z] = pos(3.4);
    const s = range(rng, 0.45, 1.7);
    const b: Box = {
      x,
      z,
      sx: s,
      sy: range(rng, 0.08, 0.2),
      sz: rng() < 0.5 ? s : s * range(rng, 0.45, 1),
      rot: rot90(),
      tone: rng() < 0.75 ? 0 : 1,
    };
    if (tryPlace(b, 0.1)) {
      // IC legs
      const legs = Math.floor(b.sx / 0.11);
      for (let i = 0; i < legs; i++) {
        const u = (i - (legs - 1) / 2) * 0.11;
        for (const side of [-1, 1]) {
          const lz = side * (b.sz / 2 + 0.035);
          boxes.push({
            x: b.x + Math.cos(b.rot) * u - Math.sin(b.rot) * lz,
            z: b.z + Math.sin(b.rot) * u + Math.cos(b.rot) * lz,
            sx: 0.045,
            sy: 0.035,
            sz: 0.09,
            rot: b.rot,
            tone: 2,
          });
        }
      }
    }
  }
  // tall parts (capacitors, inductors, headers)
  for (let n = 0; n < 1300; n++) {
    const [x, z] = pos(5.2);
    const s = range(rng, 0.28, 0.75);
    tryPlace(
      { x, z, sx: s * 1.3, sy: range(rng, 0.3, 1.1), sz: s * range(rng, 0.9, 1.6), rot: rot90(), tone: rng() < 0.6 ? 0 : 1 },
      0.08,
    );
  }
  // small SMD passives
  for (let n = 0; n < 26000; n++) {
    const [x, z] = pos(2.9);
    const big = rng() < 0.25;
    tryPlace(
      {
        x,
        z,
        sx: big ? range(rng, 0.2, 0.36) : range(rng, 0.11, 0.18),
        sy: big ? range(rng, 0.07, 0.13) : range(rng, 0.04, 0.07),
        sz: big ? range(rng, 0.12, 0.2) : range(rng, 0.06, 0.1),
        rot: rot90(),
        tone: rng() < 0.2 ? 2 : rng() < 0.4 ? 1 : 0,
      },
      0.04,
    );
  }
  // LEDs
  for (let n = 0; n < 420; n++) {
    const [x, z] = pos(3.2);
    tryPlace({ x, z, sx: 0.12, sy: 0.07, sz: 0.09, rot: rot90(), tone: 3 }, 0.05);
  }
  return boxes;
};

export const makeRng = (seed: number) => mulberry32(seed);
