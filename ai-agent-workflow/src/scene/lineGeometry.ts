import type { V2 } from "../layout";

// Builds flat triangle soup on the floor plane for dashed/solid lines,
// arrowheads and junction dots. Floor (u, v) maps to world (x=u, y=-v).

/** Replaces sharp polyline corners with sampled quadratic fillets. */
export const roundCorners = (pts: V2[], radius: number, steps = 8): V2[] => {
  if (pts.length < 3) return pts;
  const out: V2[] = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1];
    const [cx, cy] = pts[i];
    const [nx, ny] = pts[i + 1];
    const l1 = Math.hypot(cx - px, cy - py);
    const l2 = Math.hypot(nx - cx, ny - cy);
    const c = Math.min(radius, l1 / 2, l2 / 2);
    const a: V2 = [cx - ((cx - px) / l1) * c, cy - ((cy - py) / l1) * c];
    const b: V2 = [cx + ((nx - cx) / l2) * c, cy + ((ny - cy) / l2) * c];
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const it = 1 - t;
      out.push([
        it * it * a[0] + 2 * it * t * cx + t * t * b[0],
        it * it * a[1] + 2 * it * t * cy + t * t * b[1],
      ]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
};

export type Polyline = { pts: V2[]; cum: number[]; length: number };

export const toPolyline = (pts: V2[]): Polyline => {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(
      cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]),
    );
  }
  return { pts, cum, length: cum[cum.length - 1] };
};

/** Position + unit direction at arc length `s`. */
export const sampleAt = (pl: Polyline, s: number): { p: V2; d: V2 } => {
  const { pts, cum } = pl;
  const sc = Math.min(Math.max(s, 0), pl.length);
  let i = 1;
  while (i < cum.length - 1 && cum[i] < sc) i++;
  const seg = cum[i] - cum[i - 1] || 1;
  const t = (sc - cum[i - 1]) / seg;
  const [ax, ay] = pts[i - 1];
  const [bx, by] = pts[i];
  const dx = (bx - ax) / seg;
  const dy = (by - ay) / seg;
  return { p: [ax + (bx - ax) * t, ay + (by - ay) * t], d: [dx, dy] };
};

/** Points of the polyline between arc lengths a and b (inclusive ends). */
const slice = (pl: Polyline, a: number, b: number): V2[] => {
  const out: V2[] = [sampleAt(pl, a).p];
  for (let i = 1; i < pl.pts.length - 1; i++) {
    if (pl.cum[i] > a && pl.cum[i] < b) out.push(pl.pts[i]);
  }
  out.push(sampleAt(pl, b).p);
  return out;
};

export class FloorMeshBuilder {
  positions: number[] = [];
  colors: number[] = [];

  constructor(private z: number) {}

  private tri(a: V2, b: V2, c: V2, col: [number, number, number]) {
    const z = this.z;
    this.positions.push(a[0], -a[1], z, b[0], -b[1], z, c[0], -c[1], z);
    for (let k = 0; k < 3; k++) this.colors.push(col[0], col[1], col[2]);
  }

  /** Thick polyline as quads. */
  strip(pts: V2[], width: number, col: [number, number, number]) {
    const h = width / 2;
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1];
      const [bx, by] = pts[i];
      const l = Math.hypot(bx - ax, by - ay);
      if (l < 1e-5) continue;
      const nx = (-(by - ay) / l) * h;
      const ny = ((bx - ax) / l) * h;
      // Extend slightly so consecutive quads overlap at bends.
      const ex = ((bx - ax) / l) * h * 0.5;
      const ey = ((by - ay) / l) * h * 0.5;
      const a1: V2 = [ax + nx - ex, ay + ny - ey];
      const a2: V2 = [ax - nx - ex, ay - ny - ey];
      const b1: V2 = [bx + nx + ex, by + ny + ey];
      const b2: V2 = [bx - nx + ex, by - ny + ey];
      this.tri(a1, a2, b1, col);
      this.tri(a2, b2, b1, col);
    }
  }

  /**
   * Dashes along `pl` up to arc length `reveal`. `phase` scrolls the dash
   * pattern so data appears to flow; `brightness(s)` modulates per dash.
   */
  dashes(
    pl: Polyline,
    reveal: number,
    dash: number,
    gap: number,
    width: number,
    phase: number,
    col: [number, number, number],
    brightness: (s: number) => number,
  ) {
    const period = dash + gap;
    const start = -(((phase % period) + period) % period);
    for (let s = start; s < reveal; s += period) {
      const a = Math.max(0, s);
      const b = Math.min(reveal, s + dash);
      if (b - a < 0.01) continue;
      const k = brightness((a + b) / 2);
      this.strip(slice(pl, a, b), width, [col[0] * k, col[1] * k, col[2] * k]);
    }
  }

  solid(pl: Polyline, reveal: number, width: number, col: [number, number, number]) {
    if (reveal <= 0.001) return;
    this.strip(slice(pl, 0, Math.min(reveal, pl.length)), width, col);
  }

  arrow(p: V2, d: V2, size: number, col: [number, number, number]) {
    const [dx, dy] = d;
    const nx = -dy;
    const ny = dx;
    const tip: V2 = [p[0] + dx * size * 0.35, p[1] + dy * size * 0.35];
    const back: V2 = [p[0] - dx * size * 0.65, p[1] - dy * size * 0.65];
    this.tri(
      tip,
      [back[0] + nx * size * 0.42, back[1] + ny * size * 0.42],
      [back[0] - nx * size * 0.42, back[1] - ny * size * 0.42],
      col,
    );
  }

  disc(p: V2, r: number, col: [number, number, number], segs = 18) {
    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * Math.PI * 2;
      const a1 = ((i + 1) / segs) * Math.PI * 2;
      this.tri(
        p,
        [p[0] + Math.cos(a0) * r, p[1] + Math.sin(a0) * r],
        [p[0] + Math.cos(a1) * r, p[1] + Math.sin(a1) * r],
        col,
      );
    }
  }

  build() {
    return {
      positions: new Float32Array(this.positions),
      colors: new Float32Array(this.colors),
    };
  }
}
