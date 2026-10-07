import * as THREE from "three";
import { irange, mulberry32, pick, range, type Rng } from "../lib/random";

// ---------------------------------------------------------------------------------------------
// Data Wall layout.
//
// The wall is the plane z = 0 (facing +z). x runs along the bands, y across them.
// Content is a stack of bands STACK_H tall; each stack j has its own seeded template that repeats
// every BLOCK_L along x. The camera tracks sideways along the bands (aimed slightly upward) by
// exactly one block in 600 frames, so frame 600 == frame 0. Every element's behaviour is seeded
// by its template id, i.e. by its position modulo the block, so each copy behaves identically.
// Above the top stack (y > TOP_EDGE_Y) the structure ends against dark space.
// ---------------------------------------------------------------------------------------------

export const LOOP_FRAMES = 600;
export const BLOCK_L = 48;
export const STACK_H = 11.2;
// Direction of travel along x (the camera moves MOVE_X * BLOCK_L per loop).
export const MOVE_X = -1;

// Glyph cell: 5x7 dots at ~0.037 pitch.
export const DOT = 0.05;
export const GLYPH_W = 0.23;
export const GLYPH_H = 0.32;
export const GLYPH_ADV = 0.3;

export const KIND = { glyph: 0, bar: 1, dot: 2, glow: 3, rule: 4 } as const;

// ---------------------------------------------------------------- camera
export const CAM = {
  fov: 30, // vertical, degrees (long lens)
  graze: 35, // angle between the view direction and the wall surface
  azimuth: 56, // in-plane direction, degrees from +y toward +x
  focusDist: 20,
  roll: -3, // degrees
  start: new THREE.Vector3(0, 3.2, 0), // point on the wall the camera looks at, frame 0
};

// Top of the wall (top of stack 1).
export const TOP_STACK = 1;
export const TOP_EDGE_Y = (TOP_STACK + 1) * STACK_H;

export const viewDir = () => {
  const g = THREE.MathUtils.degToRad(CAM.graze);
  const a = THREE.MathUtils.degToRad(CAM.azimuth);
  return new THREE.Vector3(Math.sin(a) * Math.cos(g), Math.cos(a) * Math.cos(g), -Math.sin(g)).normalize();
};

// Camera pose at loop phase u in [0, 1).
export const cameraPose = (u: number, cam: THREE.PerspectiveCamera) => {
  const d = viewDir();
  const target = CAM.start.clone().add(new THREE.Vector3(MOVE_X * BLOCK_L * u, 0, 0));
  const pos = target.clone().addScaledVector(d, -CAM.focusDist);
  cam.position.copy(pos);
  // Up: wall +y with a slight roll so the bands rise toward the right as in the reference.
  const r = THREE.MathUtils.degToRad(CAM.roll);
  const right = new THREE.Vector3().crossVectors(d, new THREE.Vector3(0, 1, 0)).normalize();
  const up0 = new THREE.Vector3().crossVectors(right, d).normalize();
  cam.up.copy(up0.multiplyScalar(Math.cos(r)).addScaledVector(right, Math.sin(r)));
  cam.lookAt(target);
  cam.updateMatrixWorld(true);
};

// ---------------------------------------------------------------- template
export type Element = {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: number;
  seed: number;
  base: number; // base brightness 0..1
  rateA: number; // whole cycles per loop
  rateB: number;
  phase: number; // 0..1
  nb: [number, number, number, number]; // neighbour glow block: seed, rate, phase, valid
};

export type LineSeg = {
  a: [number, number, number];
  b: [number, number, number];
  seed: number;
  rate: number;
  phase: number;
  delay: number; // frames
};

const GLOW_P = { rates: [2, 3, 4, 5, 6] };

type Band = (rng: Rng, t0: number, t1: number, yl: number, out: Element[]) => void;

let seedCounter = 1;
const nextSeed = () => seedCounter++;

const el = (x: number, y: number, w: number, h: number, kind: number, rng: Rng, base: number): Element => ({
  x,
  y,
  w,
  h,
  kind,
  seed: nextSeed(),
  base,
  rateA: irange(rng, 1, 30),
  rateB: irange(rng, 1, 12),
  phase: rng(),
  nb: [0, 0, 0, 0],
});

const glyphRow =
  (minRun: number, maxRun: number, minGap: number, maxGap: number, fill: number, bright: [number, number]): Band =>
  (rng, t0, t1, yl, out) => {
    let t = t0 + range(rng, 0, maxGap);
    while (t < t1) {
      const n = irange(rng, minRun, maxRun);
      const b = range(rng, bright[0], bright[1]);
      for (let i = 0; i < n; i++) {
        if (rng() < fill) {
          const e = el(t + i * GLYPH_ADV, yl, GLYPH_W, GLYPH_H, KIND.glyph, rng, b * range(rng, 0.75, 1));
          e.rateA = irange(rng, 2, 40); // character changes per loop
          e.rateB = irange(rng, 6, 60); // flicker slots per loop
          out.push(e);
        }
      }
      t += n * GLYPH_ADV + range(rng, minGap, maxGap);
    }
  };

const dotStrip =
  (size: number, pitch: number, bright: [number, number]): Band =>
  (rng, t0, t1, yl, out) => {
    let t = t0 + range(rng, 0, 4);
    while (t < t1) {
      const n = irange(rng, 4, 40);
      const b = range(rng, bright[0], bright[1]);
      for (let i = 0; i < n; i++) {
        if (rng() < 0.85) out.push(el(t + i * pitch, yl, size, size, KIND.dot, rng, b));
      }
      t += n * pitch + range(rng, 0.4, 6);
    }
  };

const BAR_WIDTHS = [0.1, 0.12, 0.15, 0.18, 0.22, 0.26];
const barBand =
  (h: number): Band =>
  (rng, t0, t1, yl, out) => {
    let t = t0 + range(rng, 0, 2);
    while (t < t1) {
      // A run of bars, sometimes inside an outline frame.
      const runLen = range(rng, 2, 9);
      const framed = rng() < 0.2;
      const start = t;
      while (t < start + runLen) {
        const w = pick(rng, BAR_WIDTHS);
        const partial = rng() < 0.15;
        const bh = partial ? h * range(rng, 0.35, 0.8) : h * (framed ? 0.82 : 1);
        const by = partial ? yl + h - bh : yl + (h - bh) / 2;
        const bright = rng() < 0.55 ? range(rng, 0.75, 1) : range(rng, 0.3, 0.6);
        const e = el(t, by, w, bh, KIND.bar, rng, bright);
        e.rateA = irange(rng, 1, 8); // brightness drift cycles per loop
        e.rateB = irange(rng, 4, 24); // brightness step slots per loop
        out.push(e);
        t += w + range(rng, 0.25, 0.6);
      }
      if (framed) {
        const fw = t - start + 0.12;
        const fx = start - 0.08;
        const th = 0.025;
        const b = range(rng, 0.35, 0.6);
        out.push(el(fx, yl, fw, th, KIND.rule, rng, b));
        out.push(el(fx, yl + h - th, fw, th, KIND.rule, rng, b));
        out.push(el(fx, yl, th, h, KIND.rule, rng, b));
        out.push(el(fx + fw - th, yl, th, h, KIND.rule, rng, b));
      }
      t += range(rng, 0.25, 3.5);
    }
  };

const rule =
  (h: number, bright: [number, number]): Band =>
  (rng, t0, t1, yl, out) => {
    let t = t0;
    while (t < t1) {
      const len = range(rng, 4, 30);
      out.push(el(t, yl, len, h, KIND.rule, rng, range(rng, bright[0], bright[1])));
      t += len + range(rng, 0.3, 3);
    }
  };

const glowBand =
  (h: number): Band =>
  (rng, t0, t1, yl, out) => {
    let t = t0 + range(rng, 0, 2);
    while (t < t1) {
      const n = irange(rng, 2, 6);
      for (let i = 0; i < n; i++) {
        const w = range(rng, 1.4, 4.2);
        const live = rng() < 0.9;
        const e = el(t, yl, w, h, KIND.glow, rng, live ? 1 : 0);
        e.rateA = pick(rng, GLOW_P.rates); // on/off slots per loop
        // rateB stores the probability of "on" per slot (x100).
        e.rateB = Math.round(range(rng, 65, 95));
        out.push(e);
        t += w + range(rng, 0.1, 0.35);
      }
      t += range(rng, 1.5, 9);
    }
  };

// Mixed field: a grid of large dots in clumpy patches, with clusters of tiny glyphs.
const mixedField =
  (rows: number, pitch: number, dotSize: number): Band =>
  (rng, t0, t1, yl, out) => {
    for (let r = 0; r < rows; r++) {
      const y = yl + r * pitch;
      let t = t0 + range(rng, 0, pitch);
      while (t < t1) {
        const segLen = range(rng, 1.2, 7);
        const mode = rng();
        const density = mode < 0.1 ? 0.0 : mode < 0.25 ? 0.6 : 0.95;
        const glyphy = rng() < 0.1;
        const b = range(rng, 0.2, 0.55);
        const end = Math.min(t + segLen, t1);
        while (t < end) {
          if (glyphy && rng() < 0.7) {
            const e = el(t, y - 0.06, GLYPH_W, GLYPH_H, KIND.glyph, rng, range(rng, 0.65, 1));
            e.rateA = irange(rng, 2, 40);
            e.rateB = irange(rng, 6, 60);
            out.push(e);
            t += GLYPH_ADV;
          } else {
            if (rng() < density) out.push(el(t, y, dotSize, dotSize, KIND.dot, rng, b * range(rng, 0.6, 1.1)));
            t += pitch;
          }
        }
      }
    }
  };

// Band stack (y-local positions inside one STACK_H block).
const STACK: { y: number; band: Band }[] = [
  { y: 0.0, band: rule(0.025, [0.35, 0.6]) },
  { y: 0.1, band: glowBand(1.8) },
  { y: 2.0, band: rule(0.025, [0.45, 0.7]) },
  { y: 2.15, band: dotStrip(0.06, 0.16, [0.3, 0.6]) },
  { y: 2.45, band: glyphRow(10, 40, 0.8, 5, 0.6, [0.55, 1]) },
  { y: 2.9, band: mixedField(10, 0.22, 0.13) },
  { y: 5.25, band: rule(0.025, [0.45, 0.7]) },
  { y: 5.4, band: barBand(1.9) },
  { y: 7.45, band: glyphRow(4, 16, 1.5, 8, 0.7, [0.5, 1]) },
  { y: 7.85, band: rule(0.025, [0.45, 0.7]) },
  { y: 8.0, band: barBand(2.4) },
  { y: 10.55, band: glyphRow(10, 40, 0.6, 4, 0.7, [0.55, 1]) },
  { y: 10.95, band: dotStrip(0.06, 0.16, [0.25, 0.55]) },
  { y: 11.15, band: rule(0.03, [0.45, 0.7]) },
];

// Template for stack j over one block [0, BLOCK_L). Elements that would cross the block end are
// dropped, so copies tile without overlap.
export const buildTemplate = (j: number) => {
  const t0 = 0;
  const t1 = BLOCK_L;
  seedCounter = 1 + (j + 64) * 100000;
  const rng = mulberry32(643909 + (j + 64) * 7919);
  const raw: Element[] = [];
  for (const s of STACK) s.band(rng, t0, t1, s.y, raw);
  const out = raw.filter((e) => e.x >= t0 && e.x + e.w <= t1 - 0.05);
  if (j === TOP_STACK) {
    // A few loose specks in the dark space above the wall.
    const frng = mulberry32(31173);
    for (let k = 0; k < 120; k++) {
      const sz = range(frng, 0.05, 0.14);
      const e = el(range(frng, t0, t1 - 0.2), range(frng, STACK_H + 0.4, STACK_H + 7), sz, sz, KIND.dot, frng, range(frng, 0.2, 0.6));
      out.push(e);
    }
  }

  // Elements near a glow block dim a little while it is on: link each to the glow block
  // directly beneath it in the same stack (glow band is y 0.1..1.8).
  const glows = out.filter((e) => e.kind === KIND.glow && e.base > 0).sort((a, b) => a.x - b.x);
  for (const e of out) {
    if (e.kind === KIND.glow) continue;
    if (e.y < 1.8 || e.y > 4.0) continue;
    const cx = e.x + e.w / 2;
    // binary search
    let lo = 0;
    let hi = glows.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (glows[mid].x <= cx) lo = mid;
      else hi = mid - 1;
    }
    const g = glows[lo];
    if (g && cx >= g.x && cx <= g.x + g.w + 0.6) e.nb = [g.seed, g.rateA, g.phase, g.rateB];
  }

  // Network line groups: a hub just off the wall fanning out to several wall points.
  // Only the top stack has them: hubs float just above the wall's top edge.
  const lines: LineSeg[] = [];
  const lrng = mulberry32(90412);
  let t = t0 + range(lrng, 0, 10);
  while (j === TOP_STACK && t < t1) {
    const hub: [number, number, number] = [t - TOP_STACK * 0, TOP_EDGE_Y - TOP_STACK * STACK_H + range(lrng, 2, 4.5), range(lrng, 1.2, 2.8)];
    const n = irange(lrng, 7, 11);
    const seed = nextSeed();
    const rate = pick(lrng, [2, 3]);
    const phase = lrng();
    for (let i = 0; i < n; i++) {
      const ang = range(lrng, -Math.PI * 0.8, -Math.PI * 0.2);
      const len = range(lrng, 9, 22);
      lines.push({
        a: hub,
        b: [hub[0] + Math.cos(ang) * len * 1.3, hub[1] + Math.sin(ang) * len * 0.7, 0.02],
        seed: seed * 16 + i,
        rate,
        phase,
        delay: Math.floor(range(lrng, 0, 6)),
      });
    }
    t += range(lrng, 14, 22);
  }
  return { elements: out, lines };
};

// Visible wall region over the whole loop, so only needed copies are instantiated.
export const visibleBounds = (aspect: number, maxDist: number) => {
  const cam = new THREE.PerspectiveCamera(CAM.fov, aspect, 0.1, 1000);
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  const steps = 12;
  for (const u of [0, 0.25, 0.5, 0.75, 1]) {
    cameraPose(u, cam);
    cam.updateProjectionMatrix();
    for (let i = 0; i <= steps; i++) {
      for (let j = 0; j <= steps; j++) {
        const ndc = new THREE.Vector3((i / steps) * 2.4 - 1.2, (j / steps) * 2.4 - 1.2, 0.5);
        const p = ndc.unproject(cam);
        const dir = p.sub(cam.position).normalize();
        let tt = dir.z < -1e-4 ? -cam.position.z / dir.z : maxDist;
        tt = Math.min(tt, maxDist);
        const hit = cam.position.clone().addScaledVector(dir, tt);
        x0 = Math.min(x0, hit.x);
        x1 = Math.max(x1, hit.x);
        y0 = Math.min(y0, hit.y);
        y1 = Math.max(y1, hit.y);
      }
    }
  }
  return { x0: x0 - 4, x1: x1 + 4, y0: y0 - 4, y1: y1 + 4 };
};
