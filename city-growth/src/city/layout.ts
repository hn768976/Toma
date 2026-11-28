/**
 * Procedural city layout. Generated once, at module scope, from a fixed seed:
 * an island with a wavy coast, a bent street grid, blocks with buildings and
 * three elevated roads. Pure data - no three.js objects here.
 */
import { noise2D } from "@remotion/noise";
import { CONFIG, Keys } from "../config";
import { mulberry32 } from "../rng";

export const KIND = {
  concrete: 0,
  glass: 1,
  pad: 2,
  detail: 3,
  pillar: 4,
  park: 5,
  core: 6, // the slim core seen through a glass tower
} as const;

export type Box = {
  x: number;
  z: number;
  y0: number; // base height above ground
  sx: number;
  sy: number;
  sz: number;
  rot: number; // rotation around Y
  birth: number; // second at which it starts to rise
  kind: number;
  color: number; // index into the concrete palette
  seed: number;
  ghost: boolean; // draws construction lines before rising
  total: number; // total height of the building this box belongs to
};

export type RoadQuad = {
  ax: number;
  az: number;
  bx: number;
  bz: number;
  w: number;
  y: number; // height above the ground (each street at a junction gets its own level: no depth ties)
  da: number; // street distance from the centre at a
  db: number; // ... at b
};

export type HighwayPoint = { x: number; y: number; z: number; s: number; d: number }; // d = distance along the deck from where it starts to draw
export type Highway = { points: HighwayPoint[]; start: number; speed: number; length: number };

const rnd = mulberry32(CONFIG.seed);
const R = (a: number, b: number) => a + (b - a) * rnd();

/** Inverse of a monotone keyed curve: the time at which it reaches v. */
export const timeAt = (keys: Keys, v: number) => {
  if (v <= keys[0][1]) return keys[0][0];
  for (let i = 1; i < keys.length; i++) {
    if (v <= keys[i][1]) {
      const [t0, v0] = keys[i - 1];
      const [t1, v1] = keys[i];
      return t0 + ((v - v0) / (v1 - v0)) * (t1 - t0);
    }
  }
  const [ta, va] = keys[keys.length - 2];
  const [tb, vb] = keys[keys.length - 1];
  return tb + ((v - vb) / (vb - va)) * (tb - ta);
};

/** The value of a keyed curve at time t (linear between keys, clamped). */
export const valueAt = (keys: Keys, t: number) => {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const [t0, v0] = keys[i - 1];
      const [t1, v1] = keys[i];
      return v0 + ((t - t0) / (t1 - t0)) * (v1 - v0);
    }
  }
  return keys[keys.length - 1][1];
};

// ------------------------------------------------------------------ coast
export const coastRadius = (theta: number) => {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return (
    CONFIG.landRadius *
    (1 +
      CONFIG.coastWobble * noise2D("coast-a", c * 1.25, s * 1.25) +
      0.035 * noise2D("coast-b", c * 3.6, s * 3.6) +
      0.012 * noise2D("coast-c", c * 9, s * 9))
  );
};
const insideLand = (x: number, z: number, margin: number) => {
  const dx = x - CONFIG.landCentre[0];
  const dz = z - CONFIG.landCentre[1];
  return Math.hypot(dx, dz) < coastRadius(Math.atan2(dz, dx)) - margin;
};

// ----------------------------------------------------------- street grid
const gridLines = () => {
  const out: number[] = [];
  let v = -CONFIG.gridHalfSize;
  while (v < CONFIG.gridHalfSize) {
    out.push(v);
    v += R(CONFIG.blockMin, CONFIG.blockMax);
  }
  // shift so one block is centred on the origin
  let best = 0;
  for (let i = 0; i < out.length - 1; i++) {
    if (out[i] <= 0 && out[i + 1] > 0) best = i;
  }
  const shift = (out[best] + out[best + 1]) / 2;
  return out.map((o) => o - shift);
};
const gx = gridLines();
const gz = gridLines();
const NX = gx.length;
const NZ = gz.length;
const cosG = Math.cos(CONFIG.gridRotation);
const sinG = Math.sin(CONFIG.gridRotation);

const warp = (u: number, v: number): [number, number] => {
  const x0 = u * cosG - v * sinG;
  const z0 = u * sinG + v * cosG;
  const f1 = 0.017;
  const f2 = 0.07;
  // no bending in the very centre, so the first blocks stay tidy
  const k = Math.min(1, Math.hypot(x0, z0) / 14);
  const x =
    x0 + k * (CONFIG.warpLarge * noise2D("wx1", x0 * f1, z0 * f1) + CONFIG.warpSmall * noise2D("wx2", x0 * f2, z0 * f2));
  const z =
    z0 + k * (CONFIG.warpLarge * noise2D("wz1", x0 * f1, z0 * f1) + CONFIG.warpSmall * noise2D("wz2", x0 * f2, z0 * f2));
  return [x, z];
};

type Node = { x: number; z: number; ok: boolean; d: number };
const nodes: Node[] = [];
const nodeAt = (i: number, j: number) => nodes[j * NX + i];
for (let j = 0; j < NZ; j++) {
  for (let i = 0; i < NX; i++) {
    const [x, z] = warp(gx[i], gz[j]);
    nodes.push({ x, z, ok: insideLand(x, z, 0.9), d: Infinity });
  }
}
// Streets only exist where they belong to a complete block (no dead-end stubs).
{
  const used = new Uint8Array(nodes.length);
  for (let j = 0; j < NZ - 1; j++) {
    for (let i = 0; i < NX - 1; i++) {
      const ks = [j * NX + i, j * NX + i + 1, (j + 1) * NX + i, (j + 1) * NX + i + 1];
      if (ks.every((k) => nodes[k].ok)) ks.forEach((k) => (used[k] = 1));
    }
  }
  nodes.forEach((n, k) => {
    if (!used[k]) n.ok = false;
  });
}
export const coast: Array<[number, number]> = [];
for (let i = 0; i < 360; i++) {
  const th = (i / 360) * Math.PI * 2;
  const r = coastRadius(th);
  coast.push([CONFIG.landCentre[0] + Math.cos(th) * r, CONFIG.landCentre[1] + Math.sin(th) * r]);
}
const isMajor = (k: number) => ((k % CONFIG.majorEvery) + CONFIG.majorEvery) % CONFIG.majorEvery === 1;
const widthX = gx.map((_, i) => (isMajor(i) ? CONFIG.roadMajor : CONFIG.roadMinor)); // streets along z at column i
const widthZ = gz.map((_, j) => (isMajor(j) ? CONFIG.roadMajor : CONFIG.roadMinor));

// street distance from the centre (Dijkstra over the grid graph)
{
  let start = 0;
  let bestD = Infinity;
  nodes.forEach((n, k) => {
    const d = Math.hypot(n.x, n.z);
    if (n.ok && d < bestD) {
      bestD = d;
      start = k;
    }
  });
  nodes[start].d = 0;
  const done = new Uint8Array(nodes.length);
  for (;;) {
    let k = -1;
    let dmin = Infinity;
    for (let q = 0; q < nodes.length; q++) {
      if (!done[q] && nodes[q].d < dmin) {
        dmin = nodes[q].d;
        k = q;
      }
    }
    if (k < 0) break;
    done[k] = 1;
    const i = k % NX;
    const j = (k - i) / NX;
    const nb: Array<[number, number]> = [
      [i - 1, j],
      [i + 1, j],
      [i, j - 1],
      [i, j + 1],
    ];
    for (const [a, b] of nb) {
      if (a < 0 || b < 0 || a >= NX || b >= NZ) continue;
      const m = nodeAt(a, b);
      if (!m.ok) continue;
      const nd = dmin + Math.hypot(m.x - nodes[k].x, m.z - nodes[k].z);
      if (nd < m.d) m.d = nd;
    }
  }
}

export const roads: RoadQuad[] = [];
for (let j = 0; j < NZ; j++) {
  for (let i = 0; i < NX; i++) {
    const a = nodeAt(i, j);
    if (!a.ok || !isFinite(a.d)) continue;
    if (i + 1 < NX) {
      const b = nodeAt(i + 1, j);
      if (b.ok && isFinite(b.d)) {
        const late = isMajor(j) ? 0 : CONFIG.minorStreetDelay;
        roads.push({ ax: a.x, az: a.z, bx: b.x, bz: b.z, w: widthZ[j], y: 0.03 + (i % 2) * 0.004, da: a.d + late, db: b.d + late });
      }
    }
    if (j + 1 < NZ) {
      const b = nodeAt(i, j + 1);
      if (b.ok && isFinite(b.d)) {
        const late = isMajor(i) ? 0 : CONFIG.minorStreetDelay;
        roads.push({ ax: a.x, az: a.z, bx: b.x, bz: b.z, w: widthX[i], y: 0.038 + (j % 2) * 0.004, da: a.d + late, db: b.d + late });
      }
    }
  }
}

// --------------------------------------------------------------- highways
const catmull = (pts: Array<[number, number]>, step: number): Array<[number, number]> => {
  const out: Array<[number, number]> = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
};

const makeHighway = (
  ctrl: Array<[number, number]>,
  index: number,
  rampStart: boolean,
  rampEnd: boolean,
  originFraction: number, // where along the curve the draw-on starts (0..1); it spreads both ways
): Highway => {
  const xy = catmull(ctrl, 0.45);
  const pts: HighwayPoint[] = [];
  let s = 0;
  for (let i = 0; i < xy.length; i++) {
    if (i > 0) s += Math.hypot(xy[i][0] - xy[i - 1][0], xy[i][1] - xy[i - 1][1]);
    pts.push({ x: xy[i][0], z: xy[i][1], y: CONFIG.deckHeight, s, d: 0 });
  }
  const ramp = 7;
  const ease = (v: number) => v * v * (3 - 2 * v);
  for (const p of pts) {
    let k = 1;
    if (rampStart) k = Math.min(k, ease(Math.min(1, p.s / ramp)));
    if (rampEnd) k = Math.min(k, ease(Math.min(1, (s - p.s) / ramp)));
    p.y = 0.07 + (CONFIG.deckHeight - 0.07) * k;
    p.d = Math.abs(p.s - s * originFraction);
  }
  return { points: pts, start: CONFIG.highwayStart[index], speed: CONFIG.highwaySpeed[index], length: s };
};

export const highways: Highway[] = [
  // 1. the main elevated road: an S-curve from the bridge (far out over the
  //    water) through the centre and down to the street grid on the other side
  makeHighway(CONFIG.highwayMain as unknown as Array<[number, number]>, 0, false, true, CONFIG.highwayMainOrigin),
  // 2. a second arc that joins it
  makeHighway(CONFIG.highwayLoop as unknown as Array<[number, number]>, 1, true, true, 0.5),
];

/** Distance from (x, z) to the nearest elevated deck that is higher than `above`. */
const deckDistance = (x: number, z: number, above: number) => {
  let best = Infinity;
  for (const h of highways) {
    for (let i = 0; i < h.points.length; i += 2) {
      const p = h.points[i];
      if (p.y < above) continue;
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < best) best = d;
    }
  }
  return best;
};

// --------------------------------------------------------- blocks + boxes
export const boxes: Box[] = [];
const buildBirth = (r: number) => timeAt(CONFIG.buildFront, r) + R(0, CONFIG.buildJitter);
const PAD = 0.06; // height of the block plates

type Block = { cx: number; cz: number; ux: number; uz: number; px: number; pz: number; lu: number; lv: number; rot: number; r: number };
const blocks: Block[] = [];
for (let j = 0; j < NZ - 1; j++) {
  for (let i = 0; i < NX - 1; i++) {
    const c00 = nodeAt(i, j);
    const c10 = nodeAt(i + 1, j);
    const c01 = nodeAt(i, j + 1);
    const c11 = nodeAt(i + 1, j + 1);
    if (!(c00.ok && c10.ok && c01.ok && c11.ok)) continue;
    const cx = (c00.x + c10.x + c01.x + c11.x) / 4;
    const cz = (c00.z + c10.z + c01.z + c11.z) / 4;
    let ux = (c10.x - c00.x + c11.x - c01.x) / 2;
    let uz = (c10.z - c00.z + c11.z - c01.z) / 2;
    const vx = (c01.x - c00.x + c11.x - c10.x) / 2;
    const vz = (c01.z - c00.z + c11.z - c10.z) / 2;
    const lu0 = Math.hypot(ux, uz);
    ux /= lu0;
    uz /= lu0;
    const px = -uz; // perpendicular to u (the box's local z axis)
    const pz = ux;
    const lv0 = Math.abs(vx * px + vz * pz);
    const skew = Math.abs(vx * ux + vz * uz);
    const lTop = Math.hypot(c11.x - c01.x, c11.z - c01.z);
    const lBot = Math.hypot(c10.x - c00.x, c10.z - c00.z);
    const lu = Math.min(lTop, lBot, lu0) - (widthX[i] + widthX[i + 1]) / 2 - 2 * CONFIG.sidewalk - skew * 0.9;
    const lv = lv0 * 0.97 - (widthZ[j] + widthZ[j + 1]) / 2 - 2 * CONFIG.sidewalk;
    if (lu < 0.8 || lv < 0.8) continue;
    blocks.push({ cx, cz, ux, uz, px, pz, lu, lv, rot: Math.atan2(-uz, ux), r: Math.hypot(cx, cz) });
  }
}
// each landmark tower takes the block nearest to its wished position
const heroOf = new Map<number, (typeof CONFIG.heroTowers)[number]>();
for (const h of CONFIG.heroTowers) {
  let best = -1;
  let bd = Infinity;
  blocks.forEach((b, k) => {
    const d = Math.hypot(b.cx - h.x, b.cz - h.z);
    if (d < bd && !heroOf.has(k)) {
      bd = d;
      best = k;
    }
  });
  if (best >= 0) heroOf.set(best, h);
}

blocks.forEach((blk, blockIndex) => {
  const { cx, cz, ux, uz, px, pz, lu, lv, rot, r } = blk;
  const central = Math.exp(-((r / CONFIG.centreFalloff) ** 2));
  const core = r < CONFIG.coreRadius; // the first cluster of towers
  const hero = heroOf.get(blockIndex);
  const seedBlock = rnd();
  const isPark = !core && !hero && rnd() < CONFIG.parkChance;

  // the plate of the block: plates (and streets) lead the buildings
  boxes.push({
    x: cx,
    z: cz,
    y0: 0,
    sx: lu + 2 * CONFIG.sidewalk * 0.7,
    sy: PAD,
    sz: lv + 2 * CONFIG.sidewalk * 0.7,
    rot,
    birth: core ? R(0.8, 1.15) : timeAt(CONFIG.buildFront, r) - 0.7 + R(0, 0.25),
    kind: isPark ? KIND.park : KIND.pad,
    color: 0,
    seed: seedBlock,
    ghost: false,
    total: PAD,
  });

  const place = (a: number, b: number) => [cx + ux * a + px * b, cz + uz * a + pz * b] as const;

  const addBuilding = (a: number, b: number, w: number, d: number, h: number, glass: boolean, style: "tower" | "low", birthAt?: number) => {
    const [x, z] = place(a, b);
    const birth = birthAt ?? buildBirth(Math.hypot(x, z));
    const col = Math.floor(rnd() * 4) + (style === "low" ? 0 : 4); // wallsLow | wallsTower
    const seed = rnd();
    // keep clear of the elevated roads
    const reach = Math.max(w, d) / 2 + CONFIG.deckWidth / 2 + 0.05;
    const dd = deckDistance(x, z, 0.5);
    if (dd < reach) {
      if (dd < reach - 0.45) return; // straight under the deck: leave empty
      h = Math.min(h, CONFIG.deckHeight - 0.45);
      if (h < 0.3) return;
      style = "low";
      glass = false;
    }
    const kind = glass ? KIND.glass : KIND.concrete;
    const tiers: Array<{ y0: number; h: number; fw: number; fd: number; kind: number }> = [];
    if (style === "low") {
      if (h > 0.7 && rnd() < 0.55) {
        const h1 = h * R(0.5, 0.75);
        tiers.push({ y0: 0, h: h1, fw: 1, fd: 1, kind });
        tiers.push({ y0: h1, h: h - h1, fw: R(0.5, 0.8), fd: R(0.5, 0.8), kind });
      } else {
        tiers.push({ y0: 0, h, fw: 1, fd: 1, kind });
      }
    } else if (glass) {
      // a plain glass shaft, sometimes with one setback near the top
      if (rnd() < 0.4) {
        const cut = R(0.74, 0.86);
        tiers.push({ y0: 0, h: h * cut, fw: 1, fd: 1, kind });
        tiers.push({ y0: h * cut, h: h * (1 - cut), fw: R(0.68, 0.82), fd: R(0.68, 0.82), kind });
      } else {
        tiers.push({ y0: 0, h, fw: 1, fd: 1, kind });
      }
      // a slim core that shows through the glass
      boxes.push({ x, z, y0: PAD, sx: w * 0.42, sy: h * 0.93, sz: d * 0.42, rot, birth, kind: KIND.core, color: col, seed, ghost: false, total: h });
    } else {
      const cut = R(0.62, 0.82);
      tiers.push({ y0: 0, h: h * cut, fw: 1, fd: 1, kind });
      tiers.push({ y0: h * cut, h: h * (1 - cut), fw: R(0.7, 0.86), fd: R(0.7, 0.86), kind });
    }
    let top = 0;
    for (const t of tiers) top = Math.max(top, t.y0 + t.h);
    for (const t of tiers) {
      boxes.push({ x, z, y0: t.y0 + PAD, sx: w * t.fw, sy: t.h, sz: d * t.fd, rot, birth, kind: t.kind, color: col, seed, ghost: top > 0.7, total: top + PAD });
    }
    // roof clutter on flat concrete roofs
    const last = tiers[tiers.length - 1];
    if (last.kind === KIND.concrete) {
      const n = style === "tower" ? 1 : 1 + Math.floor(rnd() * 2.4);
      for (let k = 0; k < n; k++) {
        const rw = w * last.fw;
        const rd = d * last.fd;
        const bw = rw * R(0.18, 0.42);
        const bd = rd * R(0.18, 0.42);
        const ox = R(-0.5, 0.5) * (rw - bw) * 0.8;
        const oz = R(-0.5, 0.5) * (rd - bd) * 0.8;
        boxes.push({ x: x + ux * ox + px * oz, z: z + uz * ox + pz * oz, y0: top + PAD, sx: bw, sy: R(0.05, 0.16), sz: bd, rot, birth, kind: KIND.detail, color: col, seed: rnd(), ghost: false, total: top + 0.3 });
      }
    }
  };

  /** A tower on a low podium slab; the slab forms first. */
  const addTower = (H: number, glass: boolean, maxW: number, birth: number) => {
    const f = Math.min(lu, lv, maxW) * R(0.8, 0.95);
    const fa = Math.min(lu - 0.1, f * R(0.92, 1.08));
    const fb = Math.min(lv - 0.1, f * R(0.92, 1.08));
    const a = R(-0.5, 0.5) * (lu - fa) * 0.7;
    const b = R(-0.5, 0.5) * (lv - fb) * 0.7;
    addBuilding(0, 0, lu * 0.96, lv * 0.96, R(0.22, 0.4), false, "low", birth - 0.32); // podium
    addBuilding(a, b, fa, fb, H, glass, "tower", birth);
  };

  if (isPark) {
    if (rnd() < 0.5) addBuilding(R(-0.25, 0.25) * lu, R(-0.25, 0.25) * lv, lu * 0.3, lv * 0.3, R(0.25, 0.5), false, "low");
    return;
  }
  if (hero) {
    addTower(hero.h, true, hero.w, buildBirth(r));
    return;
  }
  if (core) {
    if (rnd() < CONFIG.coreTowerChance) {
      const H = CONFIG.coreMin + (CONFIG.coreMax - CONFIG.coreMin) * rnd();
      addTower(H, rnd() < 0.6, 1.9, R(CONFIG.coreBirth[0], CONFIG.coreBirth[1]));
      return;
    }
  } else if (rnd() < CONFIG.towerChanceEdge + (CONFIG.towerChanceCentre - CONFIG.towerChanceEdge) * central) {
    const H = (CONFIG.towerMin + (CONFIG.towerMax - CONFIG.towerMin) * Math.pow(rnd(), 1.5)) * (0.6 + 0.5 * central);
    addTower(H, rnd() < CONFIG.glassChanceTower, 1.8, buildBirth(r));
    return;
  }
  // a block of low white buildings (a few mid-rise ones near the centre)
  const nu = Math.max(1, Math.min(3, Math.round(lu / R(0.7, 1.1))));
  const nv = Math.max(1, Math.min(3, Math.round(lv / R(0.7, 1.1))));
  for (let b = 0; b < nv; b++) {
    for (let a = 0; a < nu; a++) {
      if (rnd() < 0.04) continue;
      const lw = lu / nu;
      const ld = lv / nv;
      const gap = R(0.025, 0.05);
      const mid = rnd() < 0.06 + 0.16 * central;
      const h = mid ? R(1.6, 2.8) * (0.6 + 0.5 * central) : R(0.7, 1.7);
      const glass = rnd() < (mid ? 0.4 : CONFIG.glassChanceLow);
      addBuilding((a + 0.5) * lw - lu / 2, (b + 0.5) * ld - lv / 2, lw - gap * 2, ld - gap * 2, h, glass, "low", core ? R(CONFIG.coreBirth[0], CONFIG.coreBirth[1]) + 0.2 : undefined);
    }
  }
});

// pillars under the elevated roads
for (const h of highways) {
  let next = CONFIG.pillarEvery * 0.5;
  for (let i = 1; i < h.points.length; i++) {
    const p = h.points[i];
    if (p.s < next) continue;
    next += CONFIG.pillarEvery;
    if (p.y < 0.7) continue;
    const q = h.points[i - 1];
    boxes.push({
      x: p.x,
      z: p.z,
      y0: 0,
      sx: 0.2,
      sy: p.y - 0.12,
      sz: 0.4,
      rot: Math.atan2(-(p.z - q.z), p.x - q.x),
      birth: h.start + p.d / h.speed - 0.05,
      kind: KIND.pillar,
      color: 0,
      seed: 0.5,
      ghost: false,
      total: p.y,
    });
  }
}

export const layoutStats = {
  boxes: boxes.length,
  roads: roads.length,
  ghosts: boxes.filter((b) => b.ghost).length,
};
