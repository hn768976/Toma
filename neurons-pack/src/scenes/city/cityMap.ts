// An invented city street map, generated once from a seed: a warped grid
// of streets graded by size, curving highways, a river and parks. Drawn
// flat on the ground plane (y = 0) as coloured ribbons, layer by layer.
import * as THREE from "three";
import { makeNoise3 } from "../../lib/noise";
import { mulberry32, range } from "../../lib/random";

// Street classes (index into the palette uniform).
export const CLS = {
  block: 0,
  lot: 1,
  minor: 2,
  small: 3,
  mid: 4,
  major: 5,
  highway: 6,
  river: 7,
  park: 8,
} as const;

export const MAP_HALF = 320;
const SPACING = 5; // between grid streets
const ANGLE = 0.42; // grid rotation (rad)

type P2 = [number, number];

class RibbonBuilder {
  pos: number[] = [];
  cls: number[] = [];
  side: number[] = [];
  idx: number[] = [];
  /** Flat ribbon along a polyline on the ground. */
  line(pts: P2[], width: number, cls: number) {
    const n = pts.length;
    if (n < 2) return;
    const base = this.pos.length / 3;
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(n - 1, i + 1)];
      let tx = b[0] - a[0];
      let tz = b[1] - a[1];
      const tl = Math.hypot(tx, tz) || 1;
      tx /= tl;
      tz /= tl;
      const nx = -tz;
      const nz = tx;
      for (const s of [-1, 1]) {
        this.pos.push(pts[i][0] + nx * s * width * 0.5, 0, pts[i][1] + nz * s * width * 0.5);
        this.cls.push(cls);
        this.side.push(s);
      }
    }
    for (let i = 0; i < n - 1; i++) {
      const a = base + 2 * i;
      this.idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  /** Convex polygon (fan). */
  poly(pts: P2[], cls: number) {
    const base = this.pos.length / 3;
    for (const p of pts) {
      this.pos.push(p[0], 0, p[1]);
      this.cls.push(cls);
      this.side.push(0);
    }
    for (let i = 1; i < pts.length - 1; i++) this.idx.push(base, base + i + 1, base + i);
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("aCls", new THREE.Float32BufferAttribute(this.cls, 1));
    g.setAttribute("aSide", new THREE.Float32BufferAttribute(this.side, 1));
    g.setIndex(this.idx);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    return g;
  }
}

export type CityMap = {
  /** Fills: lots, parks, river. */
  fills: THREE.BufferGeometry;
  /** Street ribbons, in draw order (minor first, highways last). */
  streets: THREE.BufferGeometry;
  /** Wider copies of the streets for the night glow. */
  glow: THREE.BufferGeometry;
};

const build = (): CityMap => {
  const rng = mulberry32(0xc17_1a9);
  const noise = makeNoise3(0x3a9);
  const ca = Math.cos(ANGLE);
  const sa = Math.sin(ANGLE);
  // Grid space (u, v) -> world (x, z), with a gentle warp.
  const warp = (u: number, v: number): P2 => {
    const wu = u + 5 * noise(u / 110, v / 110, 0.5);
    const wv = v + 5 * noise(u / 110, v / 110, 7.5);
    return [wu * ca - wv * sa, wu * sa + wv * ca];
  };
  const R = MAP_HALF * 1.45;
  const fills = new RibbonBuilder();
  const streets = new RibbonBuilder();
  const glow = new RibbonBuilder();
  const N = Math.ceil(R / SPACING);

  // Lots (building footprints) and parks in the grid cells.
  for (let i = -N; i < N; i++) {
    for (let j = -N; j < N; j++) {
      const u0 = i * SPACING;
      const v0 = j * SPACING;
      const c = warp(u0 + SPACING / 2, v0 + SPACING / 2);
      if (Math.abs(c[0]) > MAP_HALF || Math.abs(c[1]) > MAP_HALF) continue;
      const parkN = noise(u0 / 90, v0 / 90, 3.3);
      if (parkN > 0.55 && rng() < 0.5) {
        fills.poly([warp(u0 + 0.6, v0 + 0.6), warp(u0 + SPACING - 0.6, v0 + 0.6), warp(u0 + SPACING - 0.6, v0 + SPACING - 0.6), warp(u0 + 0.6, v0 + SPACING - 0.6)], CLS.park);
        continue;
      }
      const nLots = Math.floor(range(rng, 1, 5));
      for (let k = 0; k < nLots; k++) {
        const a = range(rng, 0.7, SPACING - 2);
        const b = range(rng, 0.7, SPACING - 2);
        const w = range(rng, 0.5, 1.4);
        const h = range(rng, 0.5, 1.4);
        fills.poly([warp(u0 + a, v0 + b), warp(u0 + a + w, v0 + b), warp(u0 + a + w, v0 + b + h), warp(u0 + a, v0 + b + h)], CLS.lot);
      }
    }
  }
  // River: a meandering band.
  const river: P2[] = [];
  for (let s = -R; s <= R; s += 4) river.push([s * 0.95, 40 + 55 * Math.sin(s / 120 + 1) + 20 * noise(s / 60, 1.5, 0)]);
  fills.line(river, 3.2, CLS.river);

  // Streets: two families of grid lines; size grades by index.
  const gridLines = (axis: 0 | 1) => {
    for (let i = -N; i <= N; i++) {
      const pts: P2[] = [];
      for (let s = -R; s <= R; s += 6) pts.push(axis === 0 ? warp(i * SPACING, s) : warp(s, i * SPACING));
      const clip = pts.filter((p) => Math.abs(p[0]) < MAP_HALF + 20 && Math.abs(p[1]) < MAP_HALF + 20);
      if (clip.length < 2) continue;
      const m = ((i % 10) + 10) % 10;
      const cls = m === 0 ? CLS.major : m === 5 ? CLS.mid : m % 3 === 1 ? CLS.small : CLS.minor;
      const width = cls === CLS.major ? 0.95 : cls === CLS.mid ? 0.75 : cls === CLS.small ? 0.55 : 0.36;
      lines.push({ pts: clip, cls, width });
    }
  };
  const lines: { pts: P2[]; cls: number; width: number }[] = [];
  gridLines(0);
  gridLines(1);
  // Minor side streets inside some blocks.
  for (let i = -N; i < N; i++) {
    for (let j = -N; j < N; j++) {
      if (rng() > 0.35) continue;
      const u = i * SPACING + SPACING / 2;
      const a = warp(u, j * SPACING);
      const b = warp(u, (j + 1) * SPACING);
      if (Math.abs(a[0]) > MAP_HALF || Math.abs(a[1]) > MAP_HALF) continue;
      lines.push({ pts: [a, b], cls: CLS.minor, width: 0.28 });
    }
  }
  // Highways: smooth curves across the city, double carriageway.
  for (let h = 0; h < 9; h++) {
    const pts: P2[] = [];
    const ang = range(rng, 0, Math.PI);
    const off = range(rng, -140, 140);
    const amp = range(rng, 25, 70);
    const ph = rng() * 6;
    for (let s = -R; s <= R; s += 4) {
      const x = s;
      const z = off + amp * Math.sin(s / 95 + ph) + 30 * noise(s / 70, h, 2);
      pts.push([x * Math.cos(ang) - z * Math.sin(ang), x * Math.sin(ang) + z * Math.cos(ang)]);
    }
    const clip = pts.filter((p) => Math.abs(p[0]) < MAP_HALF + 20 && Math.abs(p[1]) < MAP_HALF + 20);
    lines.push({ pts: clip, cls: CLS.highway, width: h < 3 ? 1.5 : 0.8 });
  }
  lines.sort((a, b) => a.cls - b.cls);
  for (const l of lines) {
    streets.line(l.pts, l.width, l.cls);
    glow.line(l.pts, l.width * 4, l.cls);
  }
  return { fills: fills.build(), streets: streets.build(), glow: glow.build() };
};

let cache: CityMap | null = null;
export const cityMap = () => (cache ??= build());

export type Palette = Record<
  "block" | "lot" | "streetMinor" | "streetSmall" | "streetMid" | "streetMajor" | "highway" | "river" | "park" | "haze",
  string
>;
