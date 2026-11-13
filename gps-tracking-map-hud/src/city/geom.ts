export type Pt = { x: number; y: number };

export function pointInPoly(px: number, py: number, pts: number[]): boolean {
  let inside = false;
  const n = pts.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = pts[i * 2], yi = pts[i * 2 + 1];
    const xj = pts[j * 2], yj = pts[j * 2 + 1];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export type BBox = { x0: number; y0: number; x1: number; y1: number };
export function bboxOf(pts: number[]): BBox {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < pts.length; i += 2) {
    x0 = Math.min(x0, pts[i]);
    x1 = Math.max(x1, pts[i]);
    y0 = Math.min(y0, pts[i + 1]);
    y1 = Math.max(y1, pts[i + 1]);
  }
  return { x0, y0, x1, y1 };
}

export class PolySet {
  items: { pts: number[]; bb: BBox; tag: string }[] = [];
  add(pts: number[], tag = '') {
    this.items.push({ pts, bb: bboxOf(pts), tag });
  }
  contains(x: number, y: number): string | null {
    for (const it of this.items) {
      const b = it.bb;
      if (x < b.x0 || x > b.x1 || y < b.y0 || y > b.y1) continue;
      if (pointInPoly(x, y, it.pts)) return it.tag || 'x';
    }
    return null;
  }
}

export function distToSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay;
  const L2 = dx * dx + dy * dy;
  let t = L2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / L2 : 0;
  t = Math.max(0, Math.min(1, t));
  const qx = ax + dx * t, qy = ay + dy * t;
  return { d: Math.hypot(px - qx, py - qy), t };
}

// Grid hash of polyline segments for nearest-distance queries
export class SegIndex {
  cell: number;
  map = new Map<number, number[]>();
  segs: number[] = []; // ax ay bx by id
  constructor(cell = 200) {
    this.cell = cell;
  }
  key(ix: number, iy: number) {
    return (ix + 1000) * 100000 + (iy + 1000);
  }
  addPolyline(pts: number[], id: number) {
    for (let i = 0; i + 3 < pts.length; i += 2) this.addSeg(pts[i], pts[i + 1], pts[i + 2], pts[i + 3], id, i / 2);
  }
  addSeg(ax: number, ay: number, bx: number, by: number, id: number, sub = 0) {
    const si = this.segs.length / 6;
    this.segs.push(ax, ay, bx, by, id, sub);
    const c = this.cell;
    const x0 = Math.floor(Math.min(ax, bx) / c), x1 = Math.floor(Math.max(ax, bx) / c);
    const y0 = Math.floor(Math.min(ay, by) / c), y1 = Math.floor(Math.max(ay, by) / c);
    for (let ix = x0; ix <= x1; ix++)
      for (let iy = y0; iy <= y1; iy++) {
        const k = this.key(ix, iy);
        let a = this.map.get(k);
        if (!a) this.map.set(k, (a = []));
        a.push(si);
      }
  }
  nearest(px: number, py: number, maxR = 400) {
    const c = this.cell;
    const r = Math.ceil(maxR / c);
    const cx = Math.floor(px / c), cy = Math.floor(py / c);
    let best = { d: Infinity, seg: -1, t: 0 };
    for (let ix = cx - r; ix <= cx + r; ix++)
      for (let iy = cy - r; iy <= cy + r; iy++) {
        const a = this.map.get(this.key(ix, iy));
        if (!a) continue;
        for (const si of a) {
          const s = this.segs;
          const q = distToSeg(px, py, s[si * 6], s[si * 6 + 1], s[si * 6 + 2], s[si * 6 + 3]);
          if (q.d < best.d) best = { d: q.d, seg: si, t: q.t };
        }
      }
    return best;
  }
}

export function simplifyPolyline(pts: number[], tol: number): number[] {
  const n = pts.length / 2;
  if (n <= 2) return pts.slice();
  const keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const stack: [number, number][] = [[0, n - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let md = 0, mi = -1;
    for (let i = a + 1; i < b; i++) {
      const d = distToSeg(pts[i * 2], pts[i * 2 + 1], pts[a * 2], pts[a * 2 + 1], pts[b * 2], pts[b * 2 + 1]).d;
      if (d > md) {
        md = d;
        mi = i;
      }
    }
    if (md > tol && mi > 0) {
      keep[mi] = 1;
      stack.push([a, mi], [mi, b]);
    }
  }
  const out: number[] = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(pts[i * 2], pts[i * 2 + 1]);
  return out;
}

export function catmullRom(ctrl: Pt[], step: number, closed = false): number[] {
  const out: number[] = [];
  const n = ctrl.length;
  const get = (i: number) => (closed ? ctrl[(i + n) % n] : ctrl[Math.max(0, Math.min(n - 1, i))]);
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    const L = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const m = Math.max(2, Math.ceil(L / step));
    for (let k = 0; k < m; k++) {
      const t = k / m, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push(f(p0.x, p1.x, p2.x, p3.x), f(p0.y, p1.y, p2.y, p3.y));
    }
  }
  if (!closed) out.push(ctrl[n - 1].x, ctrl[n - 1].y);
  else out.push(out[0], out[1]);
  return out;
}

export function polylineLength(pts: number[]) {
  let L = 0;
  for (let i = 2; i < pts.length; i += 2) L += Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]);
  return L;
}

export function circlePoly(cx: number, cy: number, r: number, n = 40): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    out.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  return out;
}

// Offset an open polyline by distance d (positive = left normal)
export function offsetPolyline(pts: number[], d: number | ((i: number) => number)): number[] {
  const n = pts.length / 2;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
    let dx = pts[b * 2] - pts[a * 2], dy = pts[b * 2 + 1] - pts[a * 2 + 1];
    const L = Math.hypot(dx, dy) || 1;
    dx /= L;
    dy /= L;
    const dd = typeof d === 'number' ? d : d(i);
    out.push(pts[i * 2] - dy * dd, pts[i * 2 + 1] + dx * dd);
  }
  return out;
}
