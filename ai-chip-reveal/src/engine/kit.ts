import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { Rng } from "./rng";

/**
 * Procedural building kit. Convention ("board space"): the circuit board lies
 * in the XY plane and +Z points away from it, so every part is placed by its
 * centre in XY and the height of its base above the board.
 */

type Shape = "box" | "rbox" | "cyl" | "can" | "ring";

interface Bucket {
  shape: Shape;
  mat: string;
  matrices: THREE.Matrix4[];
  colors: (THREE.Color | null)[];
}

const unitGeometry = (shape: Shape): THREE.BufferGeometry => {
  switch (shape) {
    case "box":
      return new THREE.BoxGeometry(1, 1, 1);
    case "rbox":
      return new RoundedBoxGeometry(1, 1, 1, 2, 0.07);
    case "cyl": {
      const g = new THREE.CylinderGeometry(1, 1, 1, 20, 1);
      g.rotateX(Math.PI / 2);
      return g;
    }
    case "can": {
      // cylinder with a rounded shoulder and a gently domed top, so that
      // metal cans show graded reflections instead of one flat value
      const pts = [
        new THREE.Vector2(0.0, 0.5),
        new THREE.Vector2(0.35, 0.492),
        new THREE.Vector2(0.65, 0.47),
        new THREE.Vector2(0.86, 0.43),
        new THREE.Vector2(0.96, 0.37),
        new THREE.Vector2(1.0, 0.28),
        new THREE.Vector2(1.0, -0.5),
        new THREE.Vector2(0.0, -0.5),
      ];
      // LatheGeometry wants the profile bottom-to-top for outward normals
      const g = new THREE.LatheGeometry(pts.reverse(), 28);
      g.rotateX(Math.PI / 2);
      g.computeVertexNormals();
      return g;
    }
    case "ring": {
      // short tube with a hole (a plated pin socket)
      const pts = [
        new THREE.Vector2(0.45, -0.5),
        new THREE.Vector2(0.45, 0.3),
        new THREE.Vector2(0.6, 0.5),
        new THREE.Vector2(0.9, 0.5),
        new THREE.Vector2(1.0, 0.35),
        new THREE.Vector2(1.0, -0.5),
      ];
      const g = new THREE.LatheGeometry(pts.reverse(), 14);
      g.rotateX(Math.PI / 2);
      g.computeVertexNormals();
      return g;
    }
  }
};

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _e = new THREE.Euler();

export interface PartOpts {
  /** rotation about the board normal, radians */
  rot?: number;
  /** full euler rotation (overrides rot) */
  euler?: [number, number, number];
  color?: THREE.ColorRepresentation;
  round?: boolean;
}

export class Batch {
  private readonly buckets = new Map<string, Bucket>();

  private push(
    shape: Shape,
    mat: string,
    m: THREE.Matrix4,
    color?: THREE.ColorRepresentation,
  ) {
    const key = `${shape}|${mat}`;
    let b = this.buckets.get(key);
    if (!b) {
      b = { shape, mat, matrices: [], colors: [] };
      this.buckets.set(key, b);
    }
    b.matrices.push(m.clone());
    b.colors.push(color === undefined ? null : new THREE.Color(color));
  }

  /** Box centred at (x, y) whose base sits at height z0. */
  box(
    mat: string,
    x: number,
    y: number,
    z0: number,
    sx: number,
    sy: number,
    h: number,
    o: PartOpts = {},
  ) {
    if (o.euler) _e.set(o.euler[0], o.euler[1], o.euler[2]);
    else _e.set(0, 0, o.rot ?? 0);
    _q.setFromEuler(_e);
    _m.compose(_p.set(x, y, z0 + h / 2), _q, _s.set(sx, sy, h));
    this.push(o.round ? "rbox" : "box", mat, _m, o.color);
  }

  /** Upright cylinder (axis = board normal). */
  cyl(
    mat: string,
    x: number,
    y: number,
    z0: number,
    r: number,
    h: number,
    o: PartOpts & { shape?: "cyl" | "can" | "ring" } = {},
  ) {
    if (o.euler) _e.set(o.euler[0], o.euler[1], o.euler[2]);
    else _e.set(0, 0, o.rot ?? 0);
    _q.setFromEuler(_e);
    _m.compose(_p.set(x, y, z0 + h / 2), _q, _s.set(r, r, h));
    this.push(o.shape ?? "cyl", mat, _m, o.color);
  }

  count() {
    let n = 0;
    for (const b of this.buckets.values()) n += b.matrices.length;
    return n;
  }

  build(
    mats: Record<string, THREE.Material>,
    opts: { castShadow?: boolean; receiveShadow?: boolean } = {},
  ): THREE.Group {
    const group = new THREE.Group();
    for (const b of this.buckets.values()) {
      const mat = mats[b.mat];
      if (!mat) throw new Error(`Unknown material "${b.mat}"`);
      const mesh = new THREE.InstancedMesh(
        unitGeometry(b.shape),
        mat,
        b.matrices.length,
      );
      const hasColor = b.colors.some((c) => c !== null);
      const white = new THREE.Color(1, 1, 1);
      b.matrices.forEach((m, i) => {
        mesh.setMatrixAt(i, m);
        if (hasColor) mesh.setColorAt(i, b.colors[i] ?? white);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.castShadow = opts.castShadow ?? true;
      mesh.receiveShadow = opts.receiveShadow ?? true;
      mesh.frustumCulled = false;
      mesh.name = `${b.shape}:${b.mat}`;
      group.add(mesh);
    }
    return group;
  }
}

/* ------------------------------------------------------------------------ */
/* Ribbons: flat poly-lines with mitred corners, merged into one geometry.   */
/* ------------------------------------------------------------------------ */

export type Pt = readonly [number, number];

export class Ribbons {
  private readonly pos: number[] = [];
  private readonly uv: number[] = [];
  private readonly info: number[] = [];
  private readonly idx: number[] = [];
  private v = 0;

  /**
   * @param pts   path in the XY plane
   * @param width ribbon width
   * @param z     height above the board
   * @param a     free per-path values, available in shaders as `aInfo`
   *              (x: path length is written automatically into aInfo.w)
   */
  add(
    pts: readonly Pt[],
    width: number,
    z: number,
    a: [number, number, number] = [0, 0, 0],
  ) {
    if (pts.length < 2) return;
    const hw = width / 2;
    const n = pts.length;
    let total = 0;
    for (let i = 1; i < n; i++)
      total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    let dist = 0;
    const base = this.v;
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const prev = pts[Math.max(0, i - 1)];
      const next = pts[Math.min(n - 1, i + 1)];
      let d1x = p[0] - prev[0];
      let d1y = p[1] - prev[1];
      let d2x = next[0] - p[0];
      let d2y = next[1] - p[1];
      const l1 = Math.hypot(d1x, d1y) || 1;
      const l2 = Math.hypot(d2x, d2y) || 1;
      if (i === 0) {
        d1x = d2x;
        d1y = d2y;
      } else {
        d1x /= l1;
        d1y /= l1;
      }
      if (i === n - 1) {
        d2x = d1x;
        d2y = d1y;
      } else {
        d2x /= l2;
        d2y /= l2;
      }
      if (i === 0) {
        const l = Math.hypot(d1x, d1y) || 1;
        d1x /= l;
        d1y /= l;
      }
      if (i === n - 1) {
        const l = Math.hypot(d2x, d2y) || 1;
        d2x /= l;
        d2y /= l;
      }
      // mitre direction
      let tx = d1x + d2x;
      let ty = d1y + d2y;
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl;
      ty /= tl;
      const nx = -ty;
      const ny = tx;
      const cosHalf = Math.max(0.35, tx * d1x + ty * d1y);
      const m = hw / cosHalf;
      if (i > 0) dist += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
      this.pos.push(
        p[0] + nx * m,
        p[1] + ny * m,
        z,
        p[0] - nx * m,
        p[1] - ny * m,
        z,
      );
      this.uv.push(dist, 1, dist, -1);
      this.info.push(a[0], a[1], a[2], total, a[0], a[1], a[2], total);
      this.v += 2;
    }
    for (let i = 0; i < n - 1; i++) {
      const k = base + i * 2;
      this.idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }

  /** small filled disc (via or pad) */
  dot(
    x: number,
    y: number,
    r: number,
    z: number,
    a: [number, number, number] = [0, 0, 0],
    dist = 0,
    total = 1,
  ) {
    const seg = 10;
    const base = this.v;
    this.pos.push(x, y, z);
    this.uv.push(dist, 0);
    this.info.push(a[0], a[1], a[2], total);
    this.v++;
    for (let i = 0; i < seg; i++) {
      const t = (i / seg) * Math.PI * 2;
      this.pos.push(x + Math.cos(t) * r, y + Math.sin(t) * r, z);
      this.uv.push(dist, 1);
      this.info.push(a[0], a[1], a[2], total);
      this.v++;
    }
    for (let i = 0; i < seg; i++) {
      // counter-clockwise so the disc faces +Z
      this.idx.push(base, base + 1 + i, base + 1 + ((i + 1) % seg));
    }
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute("aInfo", new THREE.Float32BufferAttribute(this.info, 4));
    const normals = new Float32Array(this.pos.length);
    for (let i = 2; i < normals.length; i += 3) normals[i] = 1;
    g.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    g.setIndex(this.idx);
    return g;
  }
}

/* ------------------------------------------------------------------------ */
/* Trace router: PCB-style paths with 45 degree bends on a grid.             */
/* ------------------------------------------------------------------------ */

const DIRS: Pt[] = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
];

export interface RouteOpts {
  cols: number;
  rows: number;
  count: number;
  minRun: number;
  maxRun: number;
  minSegs: number;
  maxSegs: number;
  /** cells that traces may not enter (1 = blocked); it is updated in place */
  occupied?: Uint8Array;
  /** preferred initial direction index into the 8 compass directions */
  startDir?: (rng: Rng) => number;
  /** custom start cell */
  start?: (rng: Rng) => [number, number];
  /** chance (0..1) that a bend is a right angle instead of 45 degrees */
  ortho?: number;
}

/** Returns paths as lists of grid points (integers). */
export const routeTraces = (rng: Rng, o: RouteOpts): Pt[][] => {
  const occ = o.occupied ?? new Uint8Array(o.cols * o.rows);
  const at = (x: number, y: number) =>
    x < 0 || y < 0 || x >= o.cols || y >= o.rows ? 1 : occ[y * o.cols + x];
  const paths: Pt[][] = [];
  let guard = 0;
  while (paths.length < o.count && guard++ < o.count * 30) {
    let x: number;
    let y: number;
    if (o.start) [x, y] = o.start(rng);
    else {
      x = rng.int(0, o.cols - 1);
      y = rng.int(0, o.rows - 1);
    }
    if (at(x, y)) continue;
    let d = o.startDir ? o.startDir(rng) : rng.int(0, 3) * 2;
    const pts: Pt[] = [[x, y]];
    const marked: number[] = [y * o.cols + x];
    occ[y * o.cols + x] = 1;
    const segs = rng.int(o.minSegs, o.maxSegs);
    for (let s = 0; s < segs; s++) {
      const run = rng.int(o.minRun, o.maxRun);
      let moved = 0;
      for (let k = 0; k < run; k++) {
        const nx = x + DIRS[d][0];
        const ny = y + DIRS[d][1];
        if (at(nx, ny)) break;
        // a diagonal step may not squeeze between two occupied cells
        if (DIRS[d][0] !== 0 && DIRS[d][1] !== 0 && at(nx, y) && at(x, ny))
          break;
        x = nx;
        y = ny;
        occ[y * o.cols + x] = 1;
        marked.push(y * o.cols + x);
        moved++;
      }
      if (moved > 0) pts.push([x, y]);
      if (moved < run && moved === 0 && s > 0) break;
      if (o.ortho && rng.chance(o.ortho))
        d = (d + (rng.chance(0.5) ? 2 : 6)) % 8;
      else d = (d + (rng.chance(0.5) ? 1 : 7)) % 8;
    }
    if (pts.length >= 2) paths.push(pts);
    else for (const m of marked) occ[m] = 0;
  }
  return paths;
};

/** Offset a poly-line sideways (positive = left of travel) with mitred joins. */
export const offsetPath = (pts: readonly Pt[], off: number): Pt[] => {
  const n = pts.length;
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(n - 1, i + 1)];
    let ax = p[0] - prev[0];
    let ay = p[1] - prev[1];
    let bx = next[0] - p[0];
    let by = next[1] - p[1];
    if (i === 0) {
      ax = bx;
      ay = by;
    }
    if (i === n - 1) {
      bx = ax;
      by = ay;
    }
    const la = Math.hypot(ax, ay) || 1;
    const lb = Math.hypot(bx, by) || 1;
    ax /= la;
    ay /= la;
    bx /= lb;
    by /= lb;
    let tx = ax + bx;
    let ty = ay + by;
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl;
    ty /= tl;
    const c = Math.max(0.35, tx * ax + ty * ay);
    out.push([p[0] - ty * (off / c), p[1] + tx * (off / c)]);
  }
  return out;
};

/* ------------------------------------------------------------------------ */
/* Canvas helpers (all drawing is seeded, so textures are deterministic).    */
/* ------------------------------------------------------------------------ */

export const makeCanvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2D canvas not available");
  return { canvas: c, ctx };
};

export const canvasTexture = (
  canvas: HTMLCanvasElement,
  o: { srgb?: boolean; repeat?: boolean; aniso?: number } = {},
) => {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = o.srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = o.repeat
    ? THREE.RepeatWrapping
    : THREE.ClampToEdgeWrapping;
  t.anisotropy = o.aniso ?? 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
};

export const strokePath = (
  ctx: CanvasRenderingContext2D,
  pts: readonly Pt[],
  sx: number,
  sy: number,
  ox = 0,
  oy = 0,
) => {
  ctx.beginPath();
  pts.forEach((p, i) => {
    const X = ox + p[0] * sx;
    const Y = oy + p[1] * sy;
    if (i === 0) ctx.moveTo(X, Y);
    else ctx.lineTo(X, Y);
  });
  ctx.stroke();
};
