/**
 * HUD ring definitions (seeded, module level) and line-geometry builders.
 * All rings rotate a whole number of turns (or swing with integer frequency) per loop.
 */
import * as THREE from "three";
import { mulberry32 } from "./random";
import { SEED } from "./constants";

export type Arc = { r: number; hw: number; a0: number; a1: number; i: number };
export type Tick = { r0: number; r1: number; a: number; hw: number; i: number };
export type RingLayer = {
  name: string;
  z: number;
  turns: number; // whole turns per loop (sign = direction)
  swing: number; // extra oscillation amplitude (rad), frequency 1 per loop
  phase: number; // swing phase
  angle0: number; // start angle (rad)
  white: number; // 0 = cyan glow colour, 1 = pale core colour
  layer: "sharp" | "far";
  arcs: Arc[];
  ticks: Tick[];
};

const TAU = Math.PI * 2;
const deg = (d: number) => (d * Math.PI) / 180;

const build = (): RingLayer[] => {
  const rand = mulberry32(SEED ^ 0x51ed270b);
  const dashes = (r: number, hw: number, i: number, cover: number, minD: number, maxD: number) => {
    const arcs: Arc[] = [];
    let a = rand() * TAU;
    const end = a + TAU;
    while (a < end) {
      const len = deg(minD + rand() * (maxD - minD));
      const gap = (len * (1 - cover)) / cover * (0.4 + rand() * 1.2);
      arcs.push({ r, hw, a0: a, a1: Math.min(a + len, end - deg(1)), i: i * (0.7 + rand() * 0.3) });
      a += len + gap;
    }
    return arcs;
  };
  const longArcs = (r: number, hw: number, i: number, spans: [number, number][]) =>
    spans.map(([s, l]) => ({ r, hw, a0: deg(s), a1: deg(s + l), i }));
  const ticks = (r0: number, r1: number, hw: number, i: number, from: number, to: number, step: number) => {
    const out: Tick[] = [];
    for (let a = from; a <= to; a += step) {
      const major = Math.round((a - from) / step) % 5 === 0;
      out.push({ r0, r1: major ? r1 + (r1 - r0) * 0.8 : r1, a: deg(a), hw, i });
    }
    return out;
  };

  return [
    {
      name: "inner", z: 0, turns: 0, swing: 0, phase: 0, angle0: 0, white: 0.85, layer: "sharp",
      arcs: [
        { r: 1.0, hw: 0.005, a0: 0, a1: TAU, i: 1.3 },
        { r: 0.958, hw: 0.0022, a0: 0, a1: TAU, i: 1.5 },
      ],
      ticks: [],
    },
    {
      name: "midA", z: 0.09, turns: 1, swing: 0, phase: rand(), angle0: rand() * TAU, white: 0.55, layer: "sharp",
      arcs: dashes(1.07, 0.0055, 2.0, 0.62, 2, 26),
      ticks: [],
    },
    {
      name: "midB", z: -0.07, turns: -1, swing: 0, phase: rand(), angle0: rand() * TAU, white: 0.45, layer: "sharp",
      arcs: [
        ...longArcs(1.13, 0.017, 2.2, [[10, 62], [118, 34], [200, 85], [312, 22]]),
        ...longArcs(1.185, 0.0028, 1.2, [[80, 110], [260, 70]]),
      ],
      ticks: [
        ...ticks(1.215, 1.235, 0.002, 0.45, 20, 70, 2.5),
      ],
    },
    {
      name: "midC", z: 0.04, turns: 0, swing: 0.5, phase: rand(), angle0: rand() * TAU, white: 0.4, layer: "sharp",
      arcs: Array.from({ length: 96 }, (_, k) => ({ r: 0.9, hw: 0.0055, a0: (k / 96) * TAU, a1: (k / 96) * TAU + deg(0.35), i: k % 7 === 3 ? 0 : 1.1 })),
      ticks: [],
    },
    {
      name: "outer1", z: 1.25, turns: 0, swing: 0.22, phase: rand(), angle0: 0, white: 0.3, layer: "far",
      arcs: [
        ...longArcs(1.42, 0.01, 0.55, [[-40, 75], [212, 16]]),
        ...longArcs(1.38, 0.004, 0.45, [[-25, 55], [215, 20]]),
      ],
      ticks: [],
    },
    {
      name: "outer2", z: 0.95, turns: 0, swing: 0.18, phase: rand(), angle0: 0, white: 0.25, layer: "far",
      arcs: [
        ...longArcs(1.6, 0.008, 0.3, [[-30, 50], [200, 18]]),
              ],
      ticks: [],
    },
  ];
};

export const RINGS = build();

/** Anti-aliasing margin added around every line quad (world units). */
const MARGIN = 0.012;

/**
 * Line quad buffers. Each vertex carries the signed distance across the line
 * (`aSide`), the true half-width (`aHalf`) and an intensity (`aI`); the fragment
 * shader anti-aliases analytically with fwidth.
 */
export class LineBuilder {
  pos: number[] = [];
  side: number[] = [];
  half: number[] = [];
  inten: number[] = [];
  along: number[] = [];
  idx: number[] = [];

  private vert(x: number, y: number, s: number, h: number, i: number, al: number) {
    this.pos.push(x, y, 0);
    this.side.push(s);
    this.half.push(h);
    this.inten.push(i);
    this.along.push(al);
    return this.pos.length / 3 - 1;
  }

  segment(ax: number, ay: number, bx: number, by: number, hw: number, i: number, sa = 0, sb = 0, cap = 0) {
    const dx = bx - ax;
    const dy = by - ay;
    const L = Math.hypot(dx, dy) || 1;
    const tx = dx / L;
    const ty = dy / L;
    const nx = -ty;
    const ny = tx;
    const w = hw + MARGIN;
    const ex = tx * cap;
    const ey = ty * cap;
    const v0 = this.vert(ax - ex + nx * w, ay - ey + ny * w, w, hw, i, sa);
    const v1 = this.vert(ax - ex - nx * w, ay - ey - ny * w, -w, hw, i, sa);
    const v2 = this.vert(bx + ex + nx * w, by + ey + ny * w, w, hw, i, sb);
    const v3 = this.vert(bx + ex - nx * w, by + ey - ny * w, -w, hw, i, sb);
    this.idx.push(v0, v1, v2, v1, v3, v2);
  }

  arc(cx: number, cy: number, r: number, a0: number, a1: number, hw: number, i: number) {
    const n = Math.max(2, Math.ceil(((a1 - a0) / TAU) * 720));
    const w = hw + MARGIN;
    let prev: [number, number] | null = null;
    for (let k = 0; k <= n; k++) {
      const a = a0 + ((a1 - a0) * k) / n;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const o = this.vert(cx + c * (r + w), cy + s * (r + w), w, hw, i, 0);
      const inn = this.vert(cx + c * (r - w), cy + s * (r - w), -w, hw, i, 0);
      if (prev) this.idx.push(prev[0], prev[1], o, prev[1], inn, o);
      prev = [o, inn];
    }
  }

  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("aSide", new THREE.Float32BufferAttribute(this.side, 1));
    g.setAttribute("aHalf", new THREE.Float32BufferAttribute(this.half, 1));
    g.setAttribute("aI", new THREE.Float32BufferAttribute(this.inten, 1));
    g.setAttribute("aAlong", new THREE.Float32BufferAttribute(this.along, 1));
    g.setIndex(this.idx);
    return g;
  }
}

export const ringGeometry = (ring: RingLayer) => {
  const b = new LineBuilder();
  for (const a of ring.arcs) b.arc(0, 0, a.r, a.a0, a.a1, a.hw, a.i);
  for (const t of ring.ticks) {
    const c = Math.cos(t.a);
    const s = Math.sin(t.a);
    b.segment(c * t.r0, s * t.r0, c * t.r1, s * t.r1, t.hw, t.i);
  }
  return b.geometry();
};
