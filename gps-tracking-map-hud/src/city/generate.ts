// Procedural, invented coastal city. No real-world map data is used anywhere.
// Units: metres. Map extent W x H; generation runs a little past the edges so
// every camera framing has streets out to the frame border.
import { mulberry32, makeNoise2D, range, irange, pick, type Rng } from '../lib/rng';
import {
  PolySet, SegIndex, pointInPoly, catmullRom, simplifyPolyline, circlePoly, offsetPolyline, bboxOf, type Pt,
} from './geom';

export const MAP_W = 12000;
export const MAP_H = 7000;
const EXT = 2200; // generate this far past the 12 x 7 km core so wide, moving frames never see an edge

export type RoadClass = 'highway' | 'avenue' | 'street' | 'lane' | 'rail';
export interface Road { cls: RoadClass; pts: number[] }
export type PolyKind = 'sea' | 'river' | 'park' | 'block' | 'yard' | 'airport' | 'runway' | 'pier';
export interface Poly { kind: PolyKind; pts: number[] }
export type DistrictType = 'core' | 'grid' | 'wide' | 'suburb' | 'industrial';
export interface District {
  id: number; seed: Pt; type: DistrictType; angle: number; bx: number; by: number; skew: number;
  warpA: number; warpL: number; warpP: number[]; cell: number[]; avEvery: number; avOff: number;
  pDrop: number; pLane: number; jit: number;
}
export interface CityRaw {
  seed: number; roads: Road[]; polys: Poly[]; districts: District[]; center: Pt;
  riverLine: number[]; coastLine: number[]; airport: Pt; port: Pt;
  landAt: (x: number, y: number) => boolean;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function generateCity(seed: number): CityRaw {
  const rng: Rng = mulberry32(seed);
  const { fbm } = makeNoise2D(seed * 31 + 7);
  const roads: Road[] = [];
  const polys: Poly[] = [];
  const XMIN = -EXT, XMAX = MAP_W + EXT, YMIN = -EXT, YMAX = MAP_H + EXT;
  const inExt = (x: number, y: number) => x >= XMIN && x <= XMAX && y >= YMIN && y <= YMAX;

  // ---------------------------------------------------------------- coast
  const coastAng = ((30 + range(rng, -5, 5)) * Math.PI) / 180;
  const D = { x: Math.cos(coastAng), y: Math.sin(coastAng) };
  const N = { x: D.y, y: -D.x }; // points inland (up-right)
  const O = { x: 0, y: 2700 + range(rng, -200, 200) };
  const toUV = (x: number, y: number) => {
    const dx = x - O.x, dy = y - O.y;
    return { u: dx * D.x + dy * D.y, v: dx * N.x + dy * N.y };
  };
  const fromUV = (u: number, v: number) => ({ x: O.x + u * D.x + v * N.x, y: O.y + u * D.y + v * N.y });
  const uBay = range(rng, 3900, 4700);
  const bayDepth = range(rng, 1250, 1550);
  const uHead = uBay - range(rng, 2200, 2700);
  const nOff = range(rng, 0, 100);
  const coastSmooth = (u: number) => 170 * fbm(u / 2600 + nOff, 3.3, 3) - 420 * Math.exp(-(((u - uHead) / 480) ** 2));
  const coastV = (u: number) => {
    const bay = bayDepth * Math.exp(-(((u - uBay) / (u < uBay ? 650 : 1050)) ** 2));
    const cove = 380 * Math.exp(-(((u - uBay - 2900) / 380) ** 2));
    return coastSmooth(u) + bay + cove + 70 * fbm(u / 300 + nOff, 9.1, 3) + 22 * fbm(u / 70, 2.2, 2);
  };
  const seaPts: number[] = [];
  const coastLine: number[] = [];
  for (let u = -4000; u <= 17000; u += 15) {
    const p = fromUV(u, coastV(u));
    seaPts.push(p.x, p.y);
    if (inExt(p.x, p.y) || (u > -1500 && u < 12000)) coastLine.push(p.x, p.y);
  }
  { const a = fromUV(17000, -30000), b = fromUV(-4000, -30000); seaPts.push(a.x, a.y, b.x, b.y); }
  polys.push({ kind: 'sea', pts: seaPts });

  // ---------------------------------------------------------------- piers (port)
  const piers = new PolySet();
  const pierRoads: Road[] = [];
  const portU0 = uBay + 420, portU1 = uBay + 1650;
  {
    let u = portU0;
    while (u < portU1) {
      const v0 = coastV(u);
      const len = range(rng, 380, 600), w = range(rng, 70, 115);
      // local coast direction
      const cs = (uu: number) => coastSmooth(uu) + bayDepth * Math.exp(-(((uu - uBay) / (uu < uBay ? 650 : 1050)) ** 2));
      const pA = fromUV(u - 120, cs(u - 120)), pB = fromUV(u + 120, cs(u + 120));
      let tx = pB.x - pA.x, ty = pB.y - pA.y;
      const tl = Math.hypot(tx, ty); tx /= tl; ty /= tl;
      const nx = ty, ny = -tx; // inland normal approx
      const base = fromUV(u, v0 + 110);
      const corners = [
        [base.x - tx * w / 2, base.y - ty * w / 2], [base.x + tx * w / 2, base.y + ty * w / 2],
        [base.x + tx * w / 2 - nx * len, base.y + ty * w / 2 - ny * len], [base.x - tx * w / 2 - nx * len, base.y - ty * w / 2 - ny * len],
      ].flat();
      piers.add(corners, 'pier');
      polys.push({ kind: 'pier', pts: corners });
      pierRoads.push({ cls: 'lane', pts: [base.x - nx * 60, base.y - ny * 60, base.x - nx * (len - 25), base.y - ny * (len - 25)] });
      u += w + range(rng, 140, 260);
    }
  }
  const isSea = (x: number, y: number, margin = 0) => {
    const { u, v } = toUV(x, y);
    if (v >= coastV(u) + margin) return false;
    return !piers.contains(x, y);
  };
  const landAt = (x: number, y: number) => !isSea(x, y);

  // ---------------------------------------------------------------- river
  const riverPts: number[] = [];
  {
    const head = fromUV(uBay, coastV(uBay) - 80);
    let x = head.x, y = head.y;
    let h = Math.atan2(N.y, N.x) + range(rng, -0.3, 0.3);
    const target = { x: range(rng, 7600, 8800), y: -600 };
    const ph = [range(rng, 0, 6.28), range(rng, 0, 6.28), range(rng, 0, 6.28)];
    for (let s = 0; s < 16000; s += 18) {
      riverPts.push(x, y);
      if (!inExt(x, y) && s > 500) break;
      const tAng = Math.atan2(target.y - y, target.x - x);
      let dA = tAng - h;
      while (dA > Math.PI) dA -= 2 * Math.PI;
      while (dA < -Math.PI) dA += 2 * Math.PI;
      const k = 0.0021 * Math.sin(s / 560 + ph[0]) + 0.0012 * Math.sin(s / 230 + ph[1]) + 0.0005 * Math.sin(s / 97 + ph[2]);
      h += (k + dA * 0.00055) * 18;
      x += Math.cos(h) * 18;
      y += Math.sin(h) * 18;
    }
  }
  const riverS: number[] = [0];
  for (let i = 2; i < riverPts.length; i += 2) riverS.push(riverS[riverS.length - 1] + Math.hypot(riverPts[i] - riverPts[i - 2], riverPts[i + 1] - riverPts[i - 1]));
  const riverHalfW = (s: number) => 52 + 70 * (1 - smooth(0, 4200, s));
  const riverIdx = new SegIndex(150);
  riverIdx.addPolyline(riverPts, 0);
  const riverDist = (x: number, y: number) => {
    const q = riverIdx.nearest(x, y, 300);
    if (q.seg < 0) return { d: Infinity, hw: 40 };
    const sub = riverIdx.segs[q.seg * 6 + 5];
    const s = riverS[sub] + (riverS[sub + 1] - riverS[sub]) * q.t;
    return { d: q.d, hw: riverHalfW(s) };
  };
  {
    const L = offsetPolyline(riverPts, (i) => riverHalfW(riverS[i]));
    const R = offsetPolyline(riverPts, (i) => -riverHalfW(riverS[i]));
    const pts = [...L];
    for (let i = R.length - 2; i >= 0; i -= 2) pts.push(R[i], R[i + 1]);
    polys.push({ kind: 'river', pts });
  }
  const riverAt = (s: number) => {
    let i = 0;
    while (i < riverS.length - 2 && riverS[i + 1] < s) i++;
    return { x: riverPts[i * 2], y: riverPts[i * 2 + 1] };
  };
  const center0 = riverAt(900);
  // the central plaza sits just off the river bank
  const center = (() => {
    const q = riverAt(1000);
    const nx = -(q.y - center0.y), ny = q.x - center0.x, L = Math.hypot(nx, ny) || 1;
    const a = { x: center0.x + (nx / L) * 330, y: center0.y + (ny / L) * 330 };
    const b = { x: center0.x - (nx / L) * 330, y: center0.y - (ny / L) * 330 };
    return toUV(a.x, a.y).v > toUV(b.x, b.y).v ? a : b;
  })();
  const riverDistNear = (p: Pt) => riverDist(p.x, p.y).d < riverDist(p.x, p.y).hw + 100;

  // ---------------------------------------------------------------- masks
  const blockers = new PolySet(); // parks, dark blocks, yard, islands, airport
  const airportSet = new PolySet();
  // airport on the inland east edge
  const airport = { x: MAP_W - range(rng, 1500, 1800), y: range(rng, 1700, 2600) };
  const apAng = range(rng, -0.55, -0.2);
  const rot = (cx: number, cy: number, a: number, lx: number, ly: number) => ({
    x: cx + lx * Math.cos(a) - ly * Math.sin(a), y: cy + lx * Math.sin(a) + ly * Math.cos(a),
  });
  const rectPoly = (cx: number, cy: number, a: number, hw: number, hh: number) =>
    [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].flatMap(([lx, ly]) => { const p = rot(cx, cy, a, lx, ly); return [p.x, p.y]; });
  {
    // irregular airport boundary: a rounded rectangle with a notch
    const pts: number[] = [];
    const hw = 1500, hh = 720;
    for (let i = 0; i < 64; i++) {
      const t = (i / 64) * Math.PI * 2;
      const c = Math.cos(t), s = Math.sin(t);
      const ex = 9;
      const lx = hw * Math.sign(c) * Math.abs(c) ** (2 / ex) * (1 + 0.04 * fbm(i * 0.3, 5));
      const ly = hh * Math.sign(s) * Math.abs(s) ** (2 / ex) * (1 + 0.05 * fbm(i * 0.3, 8));
      const p = rot(airport.x, airport.y, apAng, lx, ly);
      pts.push(p.x, p.y);
    }
    airportSet.add(pts, 'airport');
    polys.push({ kind: 'airport', pts });
    // runways + taxiways + apron
    const rw = [
      { ly: -330, len: 1300, w: 30 },
      { ly: 220, len: 1180, w: 26 },
    ];
    for (const r of rw) {
      const c = rot(airport.x, airport.y, apAng, 0, r.ly);
      polys.push({ kind: 'runway', pts: rectPoly(c.x, c.y, apAng, r.len, r.w) });
      const t0 = rot(airport.x, airport.y, apAng, -r.len, r.ly + (r.ly < 0 ? 95 : -95));
      const t1 = rot(airport.x, airport.y, apAng, r.len, r.ly + (r.ly < 0 ? 95 : -95));
      roads.push({ cls: 'lane', pts: [t0.x, t0.y, t1.x, t1.y] });
      for (let k = -4; k <= 4; k += 2) {
        const a = rot(airport.x, airport.y, apAng, k * 300, r.ly), b = rot(airport.x, airport.y, apAng, k * 300 + 60, r.ly + (r.ly < 0 ? 95 : -95));
        roads.push({ cls: 'lane', pts: [a.x, a.y, b.x, b.y] });
      }
    }
    // crosswind runway
    {
      const c = rot(airport.x, airport.y, apAng, -700, -20);
      polys.push({ kind: 'runway', pts: rectPoly(c.x, c.y, apAng + 1.05, 520, 22) });
    }
    const apron = rot(airport.x, airport.y, apAng, 500, -40);
    polys.push({ kind: 'runway', pts: rectPoly(apron.x, apron.y, apAng, 420, 70) });
    const term = rot(airport.x, airport.y, apAng, 500, 70);
    polys.push({ kind: 'block', pts: rectPoly(term.x, term.y, apAng, 380, 28) });
    // perimeter road
    const per = airportSet.items[0].pts.map((v, i) => v + (i % 2 === 0 ? (v - airport.x) : (v - airport.y)) * 0.012);
    roads.push({ cls: 'street', pts: [...per, per[0], per[1]] });
  }

  // container yard behind the port + rail yard
  const yardPts: number[] = [];
  {
    for (let u = portU0 - 100; u <= portU1 + 100; u += 40) { const p = fromUV(u, coastV(u) + 45); yardPts.push(p.x, p.y); }
    for (let u = portU1 + 100; u >= portU0 - 100; u -= 40) { const p = fromUV(u, coastV(u) + 480 + 60 * fbm(u / 300, 4)); yardPts.push(p.x, p.y); }
    blockers.add(yardPts, 'yard');
    // container rows (lanes)
    for (let u = portU0 - 60; u <= portU1 + 60; u += 46) {
      const a = fromUV(u, coastV(u) + 70), b = fromUV(u, coastV(u) + 420);
      roads.push({ cls: 'lane', pts: [a.x, a.y, b.x, b.y] });
    }
    const along = (vOff: number) => {
      const p: number[] = [];
      for (let u = portU0 - 90; u <= portU1 + 90; u += 30) { const q = fromUV(u, coastV(u) + vOff); p.push(q.x, q.y); }
      return p;
    };
    roads.push({ cls: 'street', pts: along(250) });
    roads.push({ cls: 'lane', pts: along(140) });
    roads.push({ cls: 'lane', pts: along(360) });
  }
  roads.push(...pierRoads);

  // rail lines from the port yard inland
  const railYardC = fromUV(portU1 + 900, coastV(portU1 + 900) + 900);
  const railLines: number[][] = [];
  {
    const toward = [
      { x: MAP_W + 600, y: range(rng, 4200, 6200) },
      { x: range(rng, 9000, 11000), y: -600 },
      { x: range(rng, 2000, 4000), y: -600 },
    ];
    for (const t of toward) {
      const ctrl: Pt[] = [fromUV(portU0, coastV(portU0) + 300), railYardC];
      const n = 5;
      for (let i = 1; i <= n; i++) {
        const f = i / n;
        ctrl.push({
          x: railYardC.x + (t.x - railYardC.x) * f + (i < n ? range(rng, -400, 400) : 0),
          y: railYardC.y + (t.y - railYardC.y) * f + (i < n ? range(rng, -400, 400) : 0),
        });
      }
      railLines.push(catmullRom(ctrl, 25));
    }
    // rail yard: lens of parallel tracks
    const ya = Math.atan2(railLines[0][9] - railLines[0][3], railLines[0][8] - railLines[0][2]);
    const yl = 750;
    const lens: number[] = [];
    for (let i = 0; i <= 24; i++) { const f = i / 24; const lx = -yl + 2 * yl * f; const p = rot(railYardC.x, railYardC.y, ya, lx, -95 * Math.sin(Math.PI * f) - 4); lens.push(p.x, p.y); }
    for (let i = 24; i >= 0; i--) { const f = i / 24; const lx = -yl + 2 * yl * f; const p = rot(railYardC.x, railYardC.y, ya, lx, 95 * Math.sin(Math.PI * f) + 4); lens.push(p.x, p.y); }
    blockers.add(lens, 'yard');
    polys.push({ kind: 'yard', pts: lens });
    for (let k = -4; k <= 4; k++) {
      const pts: number[] = [];
      for (let i = 0; i <= 30; i++) {
        const f = i / 30; const lx = -yl + 2 * yl * f;
        const p = rot(railYardC.x, railYardC.y, ya, lx, k * 16 * Math.sin(Math.PI * f) ** 0.5);
        pts.push(p.x, p.y);
      }
      roads.push({ cls: 'rail', pts });
    }
  }

  // ---------------------------------------------------------------- districts (Voronoi)
  const seeds: Pt[] = [];
  {
    let tries = 0;
    while (tries++ < 9000 && seeds.length < 80) {
      const x = range(rng, XMIN + 200, XMAX - 200), y = range(rng, YMIN + 200, YMAX - 200);
      if (!landAt(x, y)) continue;
      const r = Math.hypot(x - center.x, y - center.y) < 2200 ? 1150 : 1650;
      if (seeds.every((s) => Math.hypot(s.x - x, s.y - y) > r)) seeds.push({ x, y });
    }
  }
  const clipHalf = (poly: number[], ax: number, ay: number, nx: number, ny: number, c: number) => {
    // keep points with n.p <= c
    const out: number[] = [];
    const n = poly.length / 2;
    for (let i = 0; i < n; i++) {
      const px = poly[i * 2], py = poly[i * 2 + 1];
      const j = (i + 1) % n;
      const qx = poly[j * 2], qy = poly[j * 2 + 1];
      const dp = nx * px + ny * py - c, dq = nx * qx + ny * qy - c;
      if (dp <= 0) out.push(px, py);
      if (dp <= 0 !== dq <= 0) {
        const t = dp / (dp - dq);
        out.push(px + (qx - px) * t, py + (qy - py) * t);
      }
    }
    void ax; void ay;
    return out;
  };
  const districts: District[] = [];
  seeds.forEach((s, i) => {
    let cell = [XMIN - 300, YMIN - 300, XMAX + 300, YMIN - 300, XMAX + 300, YMAX + 300, XMIN - 300, YMAX + 300];
    seeds.forEach((o, j) => {
      if (i === j) return;
      const nx = o.x - s.x, ny = o.y - s.y;
      const mx = (o.x + s.x) / 2, my = (o.y + s.y) / 2;
      cell = clipHalf(cell, mx, my, nx, ny, nx * mx + ny * my);
    });
    const dC = Math.hypot(s.x - center.x, s.y - center.y);
    const dA = Math.hypot(s.x - airport.x, s.y - airport.y);
    const dPort = Math.hypot(s.x - railYardC.x, s.y - railYardC.y);
    let type: DistrictType;
    if (dC < 1500) type = 'core';
    else if (dPort < 1300 || dA < 1900) type = 'industrial';
    else if (dC < 3300) type = rng() < 0.75 ? 'grid' : 'wide';
    else type = pick(rng, ['suburb', 'suburb', 'wide', 'grid', 'industrial'] as const);
    const baseAngles = [coastAng, coastAng + Math.PI / 2, 0, Math.PI / 2, coastAng + 0.35, coastAng - 0.4];
    void baseAngles;
    // orientation varies smoothly across the city, so neighbouring districts mostly agree
    const field = coastAng + 1.25 * fbm(s.x / 6500 + 3.7, s.y / 6500 + 1.3, 2) + (rng() - 0.5) * 0.22;
    let angle = type === 'core' ? coastAng + range(rng, -0.05, 0.05) : field;
    if (type !== 'core' && rng() < 0.12) angle += Math.PI / 4;
    const P = {
      core: { bx: [54, 66], by: [58, 74], jit: 0.14, pDrop: 0.05, pLane: 0.08, av: [6, 8] },
      grid: { bx: [66, 86], by: [86, 125], jit: 0.08, pDrop: 0.05, pLane: 0.14, av: [6, 9] },
      wide: { bx: [95, 130], by: [130, 190], jit: 0.07, pDrop: 0.08, pLane: 0.35, av: [5, 8] },
      suburb: { bx: [85, 115], by: [110, 160], jit: 0.1, pDrop: 0.14, pLane: 0.1, av: [6, 9] },
      industrial: { bx: [150, 240], by: [130, 220], jit: 0.12, pDrop: 0.16, pLane: 0.35, av: [3, 5] },
    }[type];
    districts.push({
      id: i, seed: s, type, angle,
      bx: 0.8 * range(rng, P.bx[0], P.bx[1]) * (1 + Math.max(0, dC - 3500) / 7000), by: 0.8 * range(rng, P.by[0], P.by[1]) * (1 + Math.max(0, dC - 3500) / 6000),
      skew: type === 'core' ? range(rng, -0.04, 0.04) : range(rng, -0.09, 0.09),
      warpA: type === 'suburb' ? range(rng, 60, 150) : type === 'wide' && rng() < 0.4 ? range(rng, 20, 60) : 0,
      warpL: range(rng, 450, 1000), warpP: [range(rng, 0, 6.3), range(rng, 0, 6.3), range(rng, 0, 6.3)],
      cell, avEvery: irange(rng, P.av[0], P.av[1]), avOff: irange(rng, 0, 9),
      pDrop: P.pDrop + Math.max(0, dC - 4000) / 40000, pLane: P.pLane * (dC > 4500 ? 0.6 : 1), jit: P.jit,
    });
  });
  const districtOf = (x: number, y: number) => {
    let bi = -1, bd = Infinity;
    for (let i = 0; i < seeds.length; i++) {
      const d = (x - seeds[i].x) ** 2 + (y - seeds[i].y) ** 2;
      if (d < bd) { bd = d; bi = i; }
    }
    return bi;
  };

  // district local frame helpers
  const F = (d: District, a: number, b: number) => {
    let lx = a + b * Math.tan(d.skew), ly = b;
    if (d.warpA > 0) {
      lx += d.warpA * Math.sin(b / d.warpL + d.warpP[0]) + d.warpA * 0.4 * Math.sin(b / (d.warpL * 0.45) + d.warpP[2]);
      ly += d.warpA * 0.8 * Math.sin(a / (d.warpL * 1.2) + d.warpP[1]);
    }
    const c = Math.cos(d.angle), s = Math.sin(d.angle);
    return { x: d.seed.x + lx * c - ly * s, y: d.seed.y + lx * s + ly * c };
  };
  const toLocal = (d: District, x: number, y: number) => {
    const c = Math.cos(d.angle), s = Math.sin(d.angle);
    const dx = x - d.seed.x, dy = y - d.seed.y;
    const lx = dx * c + dy * s, ly = -dx * s + dy * c;
    return { a: lx - ly * Math.tan(d.skew), b: ly };
  };
  const gridX = (d: District, k: number) => k * d.bx - d.bx * 0.55 * Math.cos(k * 0.41 + d.warpP[0]) + d.bx * d.jit * (hashK(d.id, k, 1) - 0.5);
  const gridY = (d: District, m: number) => m * d.by - d.by * 0.45 * Math.cos(m * 0.37 + d.warpP[1]) + d.by * d.jit * (hashK(d.id, m, 2) - 0.5);

  // ---------------------------------------------------------------- parks & dark blocks
  const parkPolys: number[][] = [];
  const organicParks: number[][] = [];
  {
    let tries = 0;
    const centers: Pt[] = [];
    const okSite = (x: number, y: number, r: number, minSep: number) => {
      const { u, v } = toUV(x, y);
      if (!inExt(x, y) || v < coastV(u) + r + 120) return false;
      if (riverDist(x, y).d < r * 0.6 + 80) return false;
      if (airportSet.contains(x, y) || Math.hypot(x - airport.x, y - airport.y) < 1900) return false;
      if (Math.hypot(x - railYardC.x, y - railYardC.y) < 1200) return false;
      if (centers.some((c) => Math.hypot(c.x - x, c.y - y) < minSep)) return false;
      return true;
    };
    const addPark = (pts: number[], x: number, y: number) => {
      centers.push({ x, y });
      blockers.add(pts, 'park');
      parkPolys.push(pts);
      polys.push({ kind: 'park', pts });
    };
    // (a) organic parks of varied size and shape
    const organic = [520, 330, 260, 210, 170, 140];
    for (const r0 of organic) {
      for (let t = 0; t < 400; t++) {
        const big = r0 === organic[0];
        const x = big ? center.x + range(rng, -1100, 1100) : range(rng, 0, MAP_W);
        const y = big ? center.y + range(rng, -1100, 1100) : range(rng, 0, MAP_H);
        const r = r0 * range(rng, 0.85, 1.15);
        if (!okSite(x, y, r, 1300)) continue;
        const pts: number[] = [];
        const n = 72, ph = range(rng, 0, 100), elong = range(rng, 0.6, 0.95), ang = range(rng, 0, Math.PI);
        for (let i = 0; i < n; i++) {
          const th = (i / n) * Math.PI * 2;
          const rr = r * (1 + 0.55 * fbm(Math.cos(th) * 0.9 + ph, Math.sin(th) * 0.9 + ph, 2) + 0.12 * fbm(Math.cos(th) * 3 + ph, Math.sin(th) * 3, 2));
          const lx = Math.cos(th) * rr, ly = Math.sin(th) * rr * elong;
          pts.push(x + lx * Math.cos(ang) - ly * Math.sin(ang), y + lx * Math.sin(ang) + ly * Math.cos(ang));
        }
        addPark(pts, x, y);
        organicParks.push(pts);
        break;
      }
    }
    // (b) parks laid out on the district street grid: rectangles and L-shapes of whole blocks
    while (centers.length < 22 && tries++ < 4000) {
      const d = districts[Math.floor(rng() * districts.length)];
      if (d.type === 'industrial') continue;
      const bb = bboxOf(d.cell);
      const px = range(rng, bb.x0, bb.x1), py = range(rng, bb.y0, bb.y1);
      if (!pointInPoly(px, py, d.cell)) continue;
      const pocket = centers.length > 15;
      const ka = pocket ? 1 : irange(rng, 2, 5), mb = pocket ? 1 : irange(rng, 1, 3);
      if (!okSite(px, py, Math.max(ka * d.bx, mb * d.by), pocket ? 700 : 1100)) continue;
      const l = toLocal(d, px, py);
      const k0 = Math.floor(l.a / d.bx), m0 = Math.floor(l.b / d.by);
      const rectLocal = (a0: number, a1: number, b0: number, b1: number) => {
        const x0 = gridX(d, a0) + 2.5, x1 = gridX(d, a1) - 2.5, y0 = gridY(d, b0) + 2.5, y1 = gridY(d, b1) - 2.5;
        const pts: number[] = [];
        const edge = (ax: number, ay: number, bx2: number, by2: number) => {
          for (let i = 0; i < 10; i++) { const f = i / 10; const p = F(d, ax + (bx2 - ax) * f, ay + (by2 - ay) * f); pts.push(p.x, p.y); }
        };
        edge(x0, y0, x1, y0); edge(x1, y0, x1, y1); edge(x1, y1, x0, y1); edge(x0, y1, x0, y0);
        return pts;
      };
      const main = rectLocal(k0, k0 + ka, m0, m0 + mb);
      const c = F(d, (gridX(d, k0) + gridX(d, k0 + ka)) / 2, (gridY(d, m0) + gridY(d, m0 + mb)) / 2);
      if (!pointInPoly(c.x, c.y, d.cell)) continue;
      addPark(main, c.x, c.y);
      if (!pocket && rng() < 0.45) {
        const ext = rectLocal(k0, k0 + 1, m0 + mb, m0 + mb + irange(rng, 1, 2));
        blockers.add(ext, 'park'); parkPolys.push(ext); polys.push({ kind: 'park', pts: ext });
      }
    }
  }
  // aligned dark blocks (factories, cemeteries, rail depots, stadiums)
  for (const d of districts) {
    const cellArea = Math.abs(polyArea(d.cell));
    const dens = { core: 0.6, grid: 1.1, wide: 1.3, suburb: 0.9, industrial: 1.5 }[d.type];
    const count = Math.round((cellArea / 1e6) * dens + rng() * 0.8);
    for (let n = 0; n < count; n++) {
      const sx = range(rng, d.cell[0], d.cell[0]);
      void sx;
      // pick a random point in the cell
      const bb = bboxOf(d.cell);
      let px = 0, py = 0, ok = false;
      for (let t = 0; t < 30 && !ok; t++) {
        px = range(rng, bb.x0, bb.x1); py = range(rng, bb.y0, bb.y1);
        ok = pointInPoly(px, py, d.cell) && landAt(px, py) && !isSea(px, py, 200) && Math.hypot(px - railYardC.x, py - railYardC.y) > 1000 && !blockers.contains(px, py);
      }
      if (!ok) continue;
      const l = toLocal(d, px, py);
      const k0 = Math.floor(l.a / d.bx), m0 = Math.floor(l.b / d.by);
      const k1 = k0 + irange(rng, 1, d.type === 'industrial' ? 3 : 2), m1 = m0 + irange(rng, 1, d.type === 'industrial' ? 3 : 2);
      const x0 = gridX(d, k0) + 2.5, x1 = gridX(d, k1) - 2.5, y0 = gridY(d, m0) + 2.5, y1 = gridY(d, m1) - 2.5;
      const pts: number[] = [];
      const edge = (ax: number, ay: number, bx: number, by: number) => {
        for (let i = 0; i < 8; i++) { const f = i / 8; const p = F(d, ax + (bx - ax) * f, ay + (by - ay) * f); pts.push(p.x, p.y); }
      };
      edge(x0, y0, x1, y0); edge(x1, y0, x1, y1); edge(x1, y1, x0, y1); edge(x0, y1, x0, y0);
      blockers.add(pts, 'block');
      polys.push({ kind: 'block', pts });
    }
  }

  // ---------------------------------------------------------------- long avenues + roundabouts
  type Line = { p: Pt; dir: Pt; t0: number; t1: number };
  const avLines: Line[] = [];
  {
    const inl = Math.atan2(N.y, N.x);
    const spokes = [-1.1, -0.2, 0.75];
    for (const s of spokes) {
      const a = inl + s + range(rng, -0.12, 0.12);
      avLines.push({ p: { x: center.x, y: center.y }, dir: { x: Math.cos(a), y: Math.sin(a) }, t0: 0, t1: range(rng, 2600, 5200) });
    }
    for (let i = 0; i < 3; i++) {
      let p: Pt = { x: 0, y: 0 };
      for (let t = 0; t < 40; t++) {
        p = { x: range(rng, 1000, MAP_W - 1000), y: range(rng, 800, MAP_H - 800) };
        if (landAt(p.x, p.y) && Math.hypot(p.x - center.x, p.y - center.y) > 1800) break;
      }
      const d = districts[districtOf(p.x, p.y)];
      const a = d.angle + pick(rng, [0, Math.PI / 2]) + range(rng, -0.05, 0.05);
      avLines.push({ p, dir: { x: Math.cos(a), y: Math.sin(a) }, t0: -range(rng, 3000, 6000), t1: range(rng, 3000, 6000) });
    }
  }
  const islands: Pt[] = [];
  const islandR: number[] = [];
  if (!riverDistNear(center)) { islands.push({ ...center }); islandR.push(78); }
  for (let i = 0; i < avLines.length; i++)
    for (let j = i + 1; j < avLines.length; j++) {
      const A = avLines[i], B = avLines[j];
      const den = A.dir.x * B.dir.y - A.dir.y * B.dir.x;
      if (Math.abs(den) < 0.3) continue;
      const dx = B.p.x - A.p.x, dy = B.p.y - A.p.y;
      const t = (dx * B.dir.y - dy * B.dir.x) / den;
      const s = (dx * A.dir.y - dy * A.dir.x) / den;
      if (t < A.t0 || t > A.t1 || s < B.t0 || s > B.t1) continue;
      const x = A.p.x + A.dir.x * t, y = A.p.y + A.dir.y * t;
      if (Math.hypot(x - center.x, y - center.y) < 400) continue;
      if (!inExt(x, y) || isSea(x, y, 150) || riverDist(x, y).d < 200 || blockers.contains(x, y) || airportSet.contains(x, y)) continue;
      if (islands.some((q) => Math.hypot(q.x - x, q.y - y) < 700)) continue;
      if (rng() < 0.6) { islands.push({ x, y }); islandR.push(range(rng, 34, 58)); }
    }
  islands.forEach((q, qi) => {
    const r = islandR[qi];
    const pts = circlePoly(q.x, q.y, r, 48);
    blockers.add(pts, 'island');
    polys.push({ kind: 'park', pts });
  });

  // ---------------------------------------------------------------- clipping helper
  type OkFn = (x: number, y: number) => boolean;
  const okBase = (cls: RoadClass): OkFn => (x, y) => {
    if (!inExt(x, y)) return false;
    if (cls === 'highway') return !airportSet.contains(x, y);
    if (cls === 'rail') return !airportSet.contains(x, y) && !isSea(x, y, 10);
    if (isSea(x, y, 22)) return false;
    if (piers.contains(x, y)) return false;
    if (airportSet.contains(x, y)) return false;
    if (blockers.contains(x, y)) return false;
    if (cls === 'street' || cls === 'lane') {
      const r = riverDist(x, y);
      if (r.d < r.hw + 18) return false;
    }
    return true;
  };
  const clipParam = (P: (t: number) => Pt, t0: number, t1: number, ok: OkFn, straight: boolean, step = 12): [number, number][] => {
    const runs: [number, number][] = [];
    const n = Math.max(2, Math.ceil((t1 - t0) / step));
    const okAt = (t: number) => { const p = P(t); return ok(p.x, p.y); };
    let prevT = t0, prevOk = okAt(t0), start = prevOk ? t0 : NaN;
    const refine = (a: number, b: number, aOk: boolean) => {
      for (let i = 0; i < 16; i++) {
        const m = (a + b) / 2;
        if (okAt(m) === aOk) a = m; else b = m;
      }
      return aOk ? a : b;
    };
    for (let i = 1; i <= n; i++) {
      const t = t0 + ((t1 - t0) * i) / n;
      const o = okAt(t);
      if (o !== prevOk) {
        const e = refine(prevT, t, prevOk);
        if (o) start = e;
        else { runs.push([start, e]); start = NaN; }
      }
      prevT = t; prevOk = o;
    }
    if (prevOk) runs.push([start, t1]);
    void straight;
    return runs.filter(([a, b]) => b - a > 6);
  };
  const emit = (cls: RoadClass, P: (t: number) => Pt, a: number, b: number, straight: boolean, step = 10) => {
    const pts: number[] = [];
    if (straight) {
      const p = P(a), q = P(b);
      pts.push(p.x, p.y, q.x, q.y);
    } else {
      const n = Math.max(1, Math.ceil((b - a) / step));
      for (let i = 0; i <= n; i++) { const p = P(a + ((b - a) * i) / n); pts.push(p.x, p.y); }
    }
    roads.push({ cls, pts: straight ? pts : simplifyPolyline(pts, 0.35) });
  };
  const polyParam = (pts: number[]) => {
    const S: number[] = [0];
    for (let i = 2; i < pts.length; i += 2) S.push(S[S.length - 1] + Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]));
    const P = (t: number) => {
      let lo = 0, hi = S.length - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (S[m] <= t) lo = m; else hi = m; }
      const f = S[hi] > S[lo] ? (t - S[lo]) / (S[hi] - S[lo]) : 0;
      return { x: pts[lo * 2] + (pts[hi * 2] - pts[lo * 2]) * f, y: pts[lo * 2 + 1] + (pts[hi * 2 + 1] - pts[lo * 2 + 1]) * f };
    };
    return { P, L: S[S.length - 1] };
  };
  const emitPolyline = (cls: RoadClass, pts: number[], ok: OkFn) => {
    const { P, L } = polyParam(pts);
    for (const [a, b] of clipParam(P, 0, L, ok, false, 10)) emit(cls, P, a, b, false, 8);
  };

  // ---------------------------------------------------------------- emit long avenues
  for (const A of avLines) {
    const P = (t: number) => ({ x: A.p.x + A.dir.x * t, y: A.p.y + A.dir.y * t });
    for (const [a, b] of clipParam(P, A.t0, A.t1, okBase('avenue'), true)) emit('avenue', P, a, b, true);
  }
  islands.forEach((q, i) => {
    const pts = circlePoly(q.x, q.y, islandR[i] + 0.4, 40);
    roads.push({ cls: 'avenue', pts: [...pts, pts[0], pts[1]] });
  });

  // ---------------------------------------------------------------- Voronoi boundary roads
  for (let i = 0; i < districts.length; i++) {
    const c = districts[i].cell;
    const n = c.length / 2;
    for (let e = 0; e < n; e++) {
      const ax = c[e * 2], ay = c[e * 2 + 1], bx = c[((e + 1) % n) * 2], by = c[((e + 1) % n) * 2 + 1];
      const mx = (ax + bx) / 2, my = (ay + by) / 2;
      const di = Math.hypot(mx - seeds[i].x, my - seeds[i].y);
      let nb = -1;
      for (let j = 0; j < seeds.length; j++) if (j !== i && Math.abs(Math.hypot(mx - seeds[j].x, my - seeds[j].y) - di) < 0.5) nb = j;
      if (nb < i) continue;
      const len = Math.hypot(bx - ax, by - ay);
      const P = (t: number) => ({ x: ax + ((bx - ax) * t) / len, y: ay + ((by - ay) * t) / len });
      const cls: RoadClass = hashK(i, nb, 5) < 0.55 ? 'avenue' : 'street';
      for (const [a, b] of clipParam(P, 0, len, okBase(cls), true)) emit(cls, P, a, b, true);
    }
  }

  // ---------------------------------------------------------------- district street grids
  for (const d of districts) {
    const inCell: OkFn = (x, y) => pointInPoly(x, y, d.cell);
    const base = okBase('street');
    const ok: OkFn = (x, y) => inCell(x, y) && base(x, y);
    // param ranges from cell vertices
    let amin = Infinity, amax = -Infinity, bmin = Infinity, bmax = -Infinity;
    for (let i = 0; i < d.cell.length; i += 2) {
      const l = toLocal(d, d.cell[i], d.cell[i + 1]);
      amin = Math.min(amin, l.a); amax = Math.max(amax, l.a); bmin = Math.min(bmin, l.b); bmax = Math.max(bmax, l.b);
    }
    const pad = d.warpA * 1.6 + 60;
    amin -= pad; amax += pad; bmin -= pad; bmax += pad;
    const k0 = Math.floor(amin / d.bx), k1 = Math.ceil(amax / d.bx);
    const m0 = Math.floor(bmin / d.by), m1 = Math.ceil(bmax / d.by);
    const straight = d.warpA === 0;
    const family = (dirX: boolean) => {
      const [i0, i1, j0, j1] = dirX ? [k0, k1, m0, m1] : [m0, m1, k0, k1];
      for (let i = i0; i <= i1; i++) {
        const fixed = dirX ? gridX(d, i) : gridY(d, i);
        const P = dirX ? (t: number) => F(d, fixed, t) : (t: number) => F(d, t, fixed);
        const isAv = dirX && ((i - d.avOff) % d.avEvery + d.avEvery) % d.avEvery === 0;
        const isAvY = !dirX && ((i - d.avOff) % (d.avEvery + 2) + d.avEvery + 2) % (d.avEvery + 2) === 0;
        const cls: RoadClass = isAv || isAvY ? 'avenue' : 'street';
        const crosses: number[] = [];
        for (let j = j0; j <= j1; j++) crosses.push(dirX ? gridY(d, j) : gridX(d, j));
        const runs = clipParam(P, crosses[0], crosses[crosses.length - 1], cls === 'avenue' ? (x, y) => inCell(x, y) && okBase('avenue')(x, y) : ok, straight);
        for (const [a, b] of runs) {
          // split run at crossings and randomly drop interior pieces (T-junctions)
          const cuts = [a, ...crosses.filter((c) => c > a + 1 && c < b - 1), b];
          let segStart = cuts[0];
          for (let q = 0; q < cuts.length - 1; q++) {
            const interior = q > 0 && q < cuts.length - 2;
            const drop = cls !== 'avenue' && interior && hashK(d.id * 7 + (dirX ? 1 : 2), i * 1000 + q, 9) < d.pDrop;
            if (drop) {
              if (cuts[q] - segStart > 1) emit(cls, P, segStart, cuts[q], straight);
              segStart = cuts[q + 1];
            }
          }
          if (cuts[cuts.length - 1] - segStart > 1) emit(cls, P, segStart, cuts[cuts.length - 1], straight);
        }
        // culs-de-sac in suburbs
        if (d.type === 'suburb' && i < i1) {
          const next = dirX ? gridX(d, i + 1) : gridY(d, i + 1);
          for (let j = 0; j < crosses.length - 1; j++) {
            if (hashK(d.id * 17 + (dirX ? 5 : 6), i * 1000 + j, 13) > 0.22) continue;
            const tm = (crosses[j] + crosses[j + 1]) / 2;
            const depth = (next - fixed) * 0.42;
            const PC = dirX ? (t: number) => F(d, fixed + t, tm) : (t: number) => F(d, tm, fixed + t);
            const runs = clipParam(PC, 0, depth, ok, false, 6);
            if (runs.length === 1 && runs[0][0] < 1 && runs[0][1] > depth - 1) {
              emit('lane', PC, 0, depth, false, 8);
              const e = PC(depth + 9);
              const cp = circlePoly(e.x, e.y, 9, 16);
              roads.push({ cls: 'lane', pts: [...cp, cp[0], cp[1]] });
            }
          }
        }
        // mid-block lanes
        if (i < i1 && dirX === (d.by >= d.bx)) {
          const next = dirX ? gridX(d, i + 1) : gridY(d, i + 1);
          const mid = (fixed + next) / 2;
          const PL = dirX ? (t: number) => F(d, mid, t) : (t: number) => F(d, t, mid);
          for (let j = 0; j < crosses.length - 1; j++) {
            const h = hashK(d.id * 13 + (dirX ? 3 : 4), i * 1000 + j, 11);
            if (h > d.pLane) continue;
            const ta = crosses[j], tb = crosses[j + 1];
            const half = h < d.pLane * 0.35;
            const tEnd = half ? (ta + tb) / 2 : tb;
            for (const [a, b] of clipParam(PL, ta, tEnd, ok, straight, 8)) emit('lane', PL, a, b, straight);
          }
        }
      }
    };
    family(true);
    family(false);
  }

  // ---------------------------------------------------------------- coast road, embankments, park rings
  {
    const pts: number[] = [];
    for (let u = -1500; u <= 13000; u += 15) { const p = fromUV(u, coastV(u) + 22.5); pts.push(p.x, p.y); }
    emitPolyline('avenue', pts, (x, y) => inExt(x, y) && !airportSet.contains(x, y) && !blockers.contains(x, y));
    const L = offsetPolyline(riverPts, (i) => riverHalfW(riverS[i]) + 18.5);
    const R = offsetPolyline(riverPts, (i) => -riverHalfW(riverS[i]) - 18.5);
    const okEmb: OkFn = (x, y) => inExt(x, y) && !isSea(x, y, 22) && !airportSet.contains(x, y) && !blockers.contains(x, y);
    emitPolyline('avenue', L, okEmb);
    emitPolyline('street', R, okEmb);
    for (const pp of parkPolys) {
      if (!organicParks.includes(pp)) {
        // formal park: two diagonal walks
        const n = pp.length / 2, q = Math.floor(n / 4);
        roads.push({ cls: 'lane', pts: [pp[0], pp[1], pp[2 * q * 2], pp[2 * q * 2 + 1]] });
        roads.push({ cls: 'lane', pts: [pp[q * 2], pp[q * 2 + 1], pp[3 * q * 2], pp[3 * q * 2 + 1]] });
        continue;
      }
      const cx = pp.reduce((s, v, i) => (i % 2 === 0 ? s + v : s), 0) / (pp.length / 2);
      const cy = pp.reduce((s, v, i) => (i % 2 === 1 ? s + v : s), 0) / (pp.length / 2);
      const ring = pp.map((v, i) => v + (v - (i % 2 === 0 ? cx : cy)) * 0.004);
      ring.push(ring[0], ring[1]);
      emitPolyline('street', ring, (x, y) => inExt(x, y) && !isSea(x, y, 22) && riverDist(x, y).d > riverDist(x, y).hw + 18);
      // a couple of footpaths through the park
      for (let k = 0; k < 3; k++) {
        const n = pp.length / 2;
        const a = Math.floor(hashK(cx, cy, k) * n), b = (a + Math.floor(n * (0.35 + 0.3 * hashK(cy, cx, k + 4)))) % n;
        const mx = cx + (hashK(k, cx, 1) - 0.5) * 120, my = cy + (hashK(k, cy, 2) - 0.5) * 120;
        const path = catmullRom([{ x: pp[a * 2], y: pp[a * 2 + 1] }, { x: mx, y: my }, { x: pp[b * 2], y: pp[b * 2 + 1] }], 15);
        roads.push({ cls: 'lane', pts: path });
      }
    }
  }

  // ---------------------------------------------------------------- highways
  const hwLines: number[][] = [];
  {
    // coastal expressway (bridges across the bay mouth)
    const c1: Pt[] = [];
    for (let u = -2500; u <= 14000; u += 1400) c1.push(fromUV(u, coastSmooth(u) + 520 + range(rng, -120, 120)));
    hwLines.push(catmullRom(c1, 20));
    // radial to the airport
    const c3: Pt[] = [];
    const term = rot(airport.x, airport.y, apAng, 500, 160);
    for (let i = 0; i <= 6; i++) {
      const f = i / 6;
      const st = fromUV(portU1 + 700, coastSmooth(portU1 + 700) + 520);
      c3.push({ x: st.x + (term.x - st.x) * f + (i > 0 && i < 6 ? range(rng, -300, 300) : 0), y: st.y + (term.y - st.y) * f + (i > 0 && i < 6 ? range(rng, -300, 300) : 0) });
    }
    hwLines.push(catmullRom(c3, 20));
    // northern cross-town
    const c4: Pt[] = [];
    const y4 = range(rng, 600, 1100);
    for (let x = -1200; x <= MAP_W + 1200; x += 1500) c4.push({ x, y: y4 + range(rng, -350, 350) });
    hwLines.push(catmullRom(c4, 20));
    // north-south
    const c5: Pt[] = [];
    const x5 = range(rng, 8300, 8800);
    for (let y = -1200; y <= MAP_H + 1200; y += 1600) c5.push({ x: x5 + range(rng, -200, 200) + (y - 3500) * 0.1, y });
    hwLines.push(catmullRom(c5, 20));
  }
  for (const h of hwLines) {
    // drop parts far out at sea (but keep bay bridges)
    emitPolyline('highway', h, (x, y) => inExt(x, y) && !airportSet.contains(x, y) && !isSea(x, y, 40) && !piers.contains(x, y));
  }
  // cloverleaf loops at highway crossings
  {
    const segsOf = (p: number[]) => p;
    const clovers: Pt[] = [];
    for (let i = 0; i < hwLines.length; i++)
      for (let j = i + 1; j < hwLines.length; j++) {
        const A = segsOf(hwLines[i]), B = segsOf(hwLines[j]);
        for (let a = 0; a + 3 < A.length; a += 2)
          for (let b = 0; b + 3 < B.length; b += 2) {
            const hit = segInt(A[a], A[a + 1], A[a + 2], A[a + 3], B[b], B[b + 1], B[b + 2], B[b + 3]);
            if (!hit) continue;
            const { x, y } = hit;
            if (!inExt(x, y) || isSea(x, y, 120) || riverDist(x, y).d < 150) continue;
            if (clovers.some((q) => Math.hypot(q.x - x, q.y - y) < 400)) continue;
            clovers.push({ x, y });
            let ux = A[a + 2] - A[a], uy = A[a + 3] - A[a + 1]; const ul = Math.hypot(ux, uy); ux /= ul; uy /= ul;
            let vx = B[b + 2] - B[b], vy = B[b + 3] - B[b + 1]; const vl = Math.hypot(vx, vy); vx /= vl; vy /= vl;
            for (const [sa, sb] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
              let dx = sa * ux + sb * vx, dy = sa * uy + sb * vy; const dl = Math.hypot(dx, dy); dx /= dl; dy /= dl;
              const ccx = x + dx * 78, ccy = y + dy * 78, a0 = Math.atan2(-dy, -dx);
              const arc: number[] = [];
              for (let q = -27; q <= 27; q++) { const ang = a0 + Math.PI + (q / 27) * 2.1; arc.push(ccx + Math.cos(ang) * 46, ccy + Math.sin(ang) * 46); }
              roads.push({ cls: 'street', pts: arc });
            }
          }
      }
  }
  // rail lines (double track)
  for (const r of railLines) {
    emitPolyline('rail', offsetPolyline(r, 4), okBase('rail'));
    emitPolyline('rail', offsetPolyline(r, -4), okBase('rail'));
  }

  return {
    seed, roads, polys, districts, center, riverLine: riverPts, coastLine,
    airport, port: fromUV((portU0 + portU1) / 2, coastV((portU0 + portU1) / 2)), landAt,
  };
}

function hashK(a: number, b: number, c: number) {
  let h = 2166136261 ^ Math.floor(a * 997);
  h = Math.imul(h ^ Math.floor(b * 131 + 17), 16777619);
  h = Math.imul(h ^ Math.floor(c * 7919 + 3), 16777619);
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

function polyArea(p: number[]) {
  let s = 0;
  const n = p.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) s += (p[j * 2] + p[i * 2]) * (p[j * 2 + 1] - p[i * 2 + 1]);
  return s / 2;
}

export function segInt(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number, eps = 0) {
  const rx = bx - ax, ry = by - ay, sx = dx - cx, sy = dy - cy;
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-9) return null;
  const qx = cx - ax, qy = cy - ay;
  const t = (qx * sy - qy * sx) / den;
  const u = (qx * ry - qy * rx) / den;
  if (t < -eps || t > 1 + eps || u < -eps || u > 1 + eps) return null;
  return { x: ax + rx * t, y: ay + ry * t, t, u };
}
