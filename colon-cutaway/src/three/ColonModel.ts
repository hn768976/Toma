import * as THREE from "three";

// Prepared colon data: the centreline (as a dense table), the outer shell with
// per-vertex attributes for the cutaway shaders, the boundary ring that closes
// the wall at open ends, and the cut heightfield.

export type CentrelineJson = {
  points: number[][];
  precut?: boolean; // the model already has its front half removed + a modelled wall
  wallInnerRadius?: number[]; // precut: radius of the modelled inner wall surface
  innerRadius: number[];
  outerRadius: number[];
  wallFraction: number;
  length: number;
};

export const TABLE_N = 1024;

export class Centreline {
  readonly curve: THREE.CatmullRomCurve3;
  readonly length: number;
  readonly wallFraction: number;
  // dense tables, index i <-> u = i / (TABLE_N - 1)
  readonly pos = new Float32Array(TABLE_N * 3);
  readonly tan = new Float32Array(TABLE_N * 3);
  readonly back = new Float32Array(TABLE_N * 3); // away from the camera / cut
  readonly side = new Float32Array(TABLE_N * 3);
  readonly rIn = new Float32Array(TABLE_N);
  readonly rOut = new Float32Array(TABLE_N);
  readonly rWall = new Float32Array(TABLE_N);
  readonly precut: boolean;

  constructor(json: CentrelineJson) {
    const pts = json.points.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    this.curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
    const n = pts.length;
    const per = 120;
    this.curve.arcLengthDivisions = (n - 1) * per;
    const lengths = this.curve.getLengths((n - 1) * per);
    this.length = lengths[lengths.length - 1];
    this.wallFraction = json.wallFraction;
    this.precut = !!json.precut;
    const wallIn = json.wallInnerRadius ?? json.outerRadius.map((r) => r * (1 - json.wallFraction));
    // u of each control point along the arc length
    const cu = pts.map((_, i) => lengths[i * per] / this.length);

    const p = new THREE.Vector3();
    const t = new THREE.Vector3();
    const b = new THREE.Vector3();
    const s = new THREE.Vector3();
    const away = new THREE.Vector3(0, 0, -1);
    for (let i = 0; i < TABLE_N; i++) {
      const u = i / (TABLE_N - 1);
      this.curve.getPointAt(u, p);
      this.curve.getTangentAt(u, t).normalize();
      b.copy(away).addScaledVector(t, -away.dot(t)).normalize();
      s.crossVectors(t, b).normalize();
      p.toArray(this.pos, i * 3);
      t.toArray(this.tan, i * 3);
      b.toArray(this.back, i * 3);
      s.toArray(this.side, i * 3);
      // piecewise-linear radius between stations
      let k = 0;
      while (k < n - 2 && cu[k + 1] < u) k++;
      const f = THREE.MathUtils.clamp((u - cu[k]) / (cu[k + 1] - cu[k]), 0, 1);
      this.rIn[i] = THREE.MathUtils.lerp(json.innerRadius[k], json.innerRadius[k + 1], f);
      this.rOut[i] = THREE.MathUtils.lerp(json.outerRadius[k], json.outerRadius[k + 1], f);
      this.rWall[i] = THREE.MathUtils.lerp(wallIn[k], wallIn[k + 1], f);
    }
  }

  private idx(u: number): [number, number, number] {
    const x = THREE.MathUtils.clamp(u, 0, 1) * (TABLE_N - 1);
    const i = Math.min(TABLE_N - 2, Math.floor(x));
    return [i, i + 1, x - i];
  }

  private v3(arr: Float32Array, u: number, out: THREE.Vector3) {
    const [i, j, f] = this.idx(u);
    return out.set(
      arr[i * 3] + (arr[j * 3] - arr[i * 3]) * f,
      arr[i * 3 + 1] + (arr[j * 3 + 1] - arr[i * 3 + 1]) * f,
      arr[i * 3 + 2] + (arr[j * 3 + 2] - arr[i * 3 + 2]) * f,
    );
  }

  point(u: number, out = new THREE.Vector3()) {
    return this.v3(this.pos, u, out);
  }
  tangent(u: number, out = new THREE.Vector3()) {
    return this.v3(this.tan, u, out).normalize();
  }
  backDir(u: number, out = new THREE.Vector3()) {
    return this.v3(this.back, u, out).normalize();
  }
  sideDir(u: number, out = new THREE.Vector3()) {
    return this.v3(this.side, u, out).normalize();
  }
  innerRadius(u: number) {
    const [i, j, f] = this.idx(u);
    return this.rIn[i] + (this.rIn[j] - this.rIn[i]) * f;
  }
  wallRadius(u: number) {
    const [i, j, f] = this.idx(u);
    return this.rWall[i] + (this.rWall[j] - this.rWall[i]) * f;
  }
  outerRadius(u: number) {
    const [i, j, f] = this.idx(u);
    return this.rOut[i] + (this.rOut[j] - this.rOut[i]) * f;
  }

  /**
   * Point inside the lumen: centreline at u, plus an offset in the
   * cross-section. (ox, oy) are in units of the safe radius (|o| <= 1 keeps
   * the object, of bounding radius `objRadius`, inside the inner wall).
   * oy > 0 is toward the back wall, oy < 0 toward the camera.
   */
  lumenPoint(u: number, ox: number, oy: number, objRadius: number, out = new THREE.Vector3()) {
    const safe = Math.max(0, this.innerRadius(u) * 0.92 - objRadius);
    const len = Math.hypot(ox, oy);
    const k = len > 1 ? 1 / len : 1;
    const p = this.point(u, out);
    const sd = this.sideDir(u, _tmpA);
    const bk = this.backDir(u, _tmpB);
    p.addScaledVector(sd, ox * k * safe).addScaledVector(bk, oy * k * safe);
    return p;
  }

  /** Nearest table index to a point (coarse-to-fine), optionally 2D (xy). */
  nearest(x: number, y: number, z: number, xyOnly: boolean): number {
    const P = this.pos;
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < TABLE_N; i += 4) {
      const dx = P[i * 3] - x;
      const dy = P[i * 3 + 1] - y;
      const dz = xyOnly ? 0 : P[i * 3 + 2] - z;
      const d = dx * dx + dy * dy + dz * dz;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    const a = Math.max(0, best - 6);
    const b = Math.min(TABLE_N - 1, best + 6);
    for (let i = a; i <= b; i++) {
      const dx = P[i * 3] - x;
      const dy = P[i * 3 + 1] - y;
      const dz = xyOnly ? 0 : P[i * 3 + 2] - z;
      const d = dx * dx + dy * dy + dz * dz;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  }
}

const _tmpA = new THREE.Vector3();
const _tmpB = new THREE.Vector3();

export type ColonGeometry = {
  shell: THREE.BufferGeometry; // outer shell + attributes (aWall, aSide, aUTB)
  ring: THREE.BufferGeometry | null; // closes the wall at open boundaries
  heightfield: THREE.DataTexture;
  hfRect: THREE.Vector4; // minX, minY, sizeX, sizeY
  cap: THREE.BufferGeometry; // grid covering hfRect (z from the heightfield)
  bounds: THREE.Box3;
};

const mergeMeshes = (root: THREE.Object3D): THREE.BufferGeometry => {
  const pos: number[] = [];
  const nor: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    let g = m.geometry.clone();
    g.applyMatrix4(m.matrixWorld);
    if (!g.index) g = g.toNonIndexed();
    if (!g.attributes.normal) g.computeVertexNormals();
    const base = pos.length / 3;
    const P = g.attributes.position;
    const N = g.attributes.normal;
    const C = g.attributes.color;
    for (let i = 0; i < P.count; i++) {
      pos.push(P.getX(i), P.getY(i), P.getZ(i));
      nor.push(N.getX(i), N.getY(i), N.getZ(i));
      if (C) col.push(C.getX(i), C.getY(i));
    }
    const I = g.index;
    if (I) for (let i = 0; i < I.count; i++) idx.push(base + I.getX(i));
    else for (let i = 0; i < P.count; i++) idx.push(base + i);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  if (col.length === pos.length / 3 * 2) g.setAttribute("aBaked", new THREE.Float32BufferAttribute(col, 2));
  g.setIndex(idx);
  return g;
};

export const buildColonGeometry = (root: THREE.Object3D, cl: Centreline): ColonGeometry => {
  const shell = mergeMeshes(root);
  const P = shell.attributes.position;
  const N = shell.attributes.normal;
  const n = P.count;
  const aWall = new Float32Array(n);
  const aUTB = new Float32Array(n * 3);
  const aSW = new Float32Array(n * 2);
  const c = new THREE.Vector3();
  const d = new THREE.Vector3();
  const t = new THREE.Vector3();
  const bk = new THREE.Vector3();
  const sd = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const x = P.getX(i);
    const y = P.getY(i);
    const z = P.getZ(i);
    let k = cl.nearest(x, y, z, false);
    // refine u by projecting onto the neighbouring segment
    const k2 = Math.min(TABLE_N - 1, k + 1);
    const k1 = Math.max(0, k - 1);
    const a = new THREE.Vector3().fromArray(cl.pos, k1 * 3);
    const b = new THREE.Vector3().fromArray(cl.pos, k2 * 3);
    const ab = b.clone().sub(a);
    const f = THREE.MathUtils.clamp(new THREE.Vector3(x, y, z).sub(a).dot(ab) / ab.lengthSq(), 0, 1);
    const u = THREE.MathUtils.clamp((k1 + f * (k2 - k1)) / (TABLE_N - 1), 0, 1);
    k = Math.round(u * (TABLE_N - 1));
    cl.point(u, c);
    cl.tangent(u, t);
    cl.backDir(u, bk);
    cl.sideDir(u, sd);
    d.set(x, y, z).sub(c);
    d.addScaledVector(t, -d.dot(t));
    const theta = Math.atan2(d.dot(sd), d.dot(bk));
    const rOut = cl.outerRadius(u);
    aWall[i] = rOut * cl.wallFraction;
    aUTB[i * 3] = u;
    aUTB[i * 3 + 1] = theta;
    aUTB[i * 3 + 2] = d.length() / rOut - 1;
    // precut models: normal vs radial direction (outer / rim / lining) and the
    // position across the modelled wall
    const baked = shell.getAttribute("aBaked");
    if (baked) {
      // classes baked by scripts/prepare_precut_colon.py (vertex colour R, G)
      aSW[i * 2] = baked.getX(i) * 2 - 1;
      aSW[i * 2 + 1] = baked.getY(i);
    } else {
      const dl = d.length() || 1;
      aSW[i * 2] = (N.getX(i) * d.x + N.getY(i) * d.y + N.getZ(i) * d.z) / dl;
      const rw = cl.wallRadius(u);
      aSW[i * 2 + 1] = THREE.MathUtils.clamp((dl - rw) / Math.max(1e-4, rOut - rw), 0, 1);
    }
  }
  // Offset direction for the inner surfaces: heavily smoothed normals, so the
  // inward offset never folds over itself at creases / tight bends.
  const index0 = shell.index!;
  const nbr: number[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < index0.count; i += 3) {
    const a = index0.getX(i);
    const b = index0.getX(i + 1);
    const c2 = index0.getX(i + 2);
    nbr[a].push(b, c2);
    nbr[b].push(a, c2);
    nbr[c2].push(a, b);
  }
  let on = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    on[i * 3] = N.getX(i);
    on[i * 3 + 1] = N.getY(i);
    on[i * 3 + 2] = N.getZ(i);
  }
  for (let it = 0; it < 24; it++) {
    const next = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      let x = on[i * 3];
      let y = on[i * 3 + 1];
      let z = on[i * 3 + 2];
      for (const j of nbr[i]) {
        x += on[j * 3] * 0.5;
        y += on[j * 3 + 1] * 0.5;
        z += on[j * 3 + 2] * 0.5;
      }
      const l = Math.hypot(x, y, z) || 1;
      next[i * 3] = x / l;
      next[i * 3 + 1] = y / l;
      next[i * 3 + 2] = z / l;
    }
    on = next;
  }
  shell.setAttribute("aOffN", new THREE.BufferAttribute(on, 3));
  shell.setAttribute("aWall", new THREE.BufferAttribute(aWall, 1));
  shell.setAttribute("aSW", new THREE.BufferAttribute(aSW, 2));
  shell.setAttribute("aSide", new THREE.BufferAttribute(new Float32Array(n), 1));
  shell.setAttribute("aUTB", new THREE.BufferAttribute(aUTB, 3));

  // ---- boundary ring (open ends): quads between offset 0 and offset 1 ----
  const index = shell.index!;
  const edgeCount = new Map<string, number>();
  const edgeDir = new Map<string, [number, number]>();
  for (let i = 0; i < index.count; i += 3) {
    const tri = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
    for (let e = 0; e < 3; e++) {
      const a = tri[e];
      const b = tri[(e + 1) % 3];
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      edgeCount.set(key, (edgeCount.get(key) ?? 0) + 1);
      edgeDir.set(key, [a, b]);
    }
  }
  const boundary: [number, number][] = [];
  edgeCount.forEach((cnt, key) => {
    if (cnt === 1) boundary.push(edgeDir.get(key)!);
  });
  let ring: THREE.BufferGeometry | null = null;
  if (boundary.length > 0 && !cl.precut) {
    const rp: number[] = [];
    const rn: number[] = [];
    const ro: number[] = [];
    const rw: number[] = [];
    const rs: number[] = [];
    const ru: number[] = [];
    const push = (v: number, side: number) => {
      rp.push(P.getX(v), P.getY(v), P.getZ(v));
      rn.push(N.getX(v), N.getY(v), N.getZ(v));
      ro.push(on[v * 3], on[v * 3 + 1], on[v * 3 + 2]);
      rw.push(aWall[v]);
      rs.push(side);
      ru.push(aUTB[v * 3], aUTB[v * 3 + 1], aUTB[v * 3 + 2]);
    };
    for (const [a, b] of boundary) {
      push(a, 0);
      push(b, 0);
      push(b, 1);
      push(a, 0);
      push(b, 1);
      push(a, 1);
    }
    ring = new THREE.BufferGeometry();
    ring.setAttribute("position", new THREE.Float32BufferAttribute(rp, 3));
    ring.setAttribute("normal", new THREE.Float32BufferAttribute(rn, 3));
    ring.setAttribute("aOffN", new THREE.Float32BufferAttribute(ro, 3));
    ring.setAttribute("aWall", new THREE.Float32BufferAttribute(rw, 1));
    ring.setAttribute("aSide", new THREE.Float32BufferAttribute(rs, 1));
    ring.setAttribute("aUTB", new THREE.Float32BufferAttribute(ru, 3));
  }

  // ---- cut heightfield: z of the centreline nearest in xy ----
  shell.computeBoundingBox();
  const bounds = shell.boundingBox!.clone();
  const margin = 0.6;
  const minX = bounds.min.x - margin;
  const minY = bounds.min.y - margin;
  const sizeX = bounds.max.x - bounds.min.x + 2 * margin;
  const sizeY = bounds.max.y - bounds.min.y + 2 * margin;
  const RES = 256;
  const hf = new Float32Array(RES * RES * 4);
  for (let j = 0; j < RES; j++) {
    for (let i = 0; i < RES; i++) {
      const x = minX + ((i + 0.5) / RES) * sizeX;
      const y = minY + ((j + 0.5) / RES) * sizeY;
      const k = cl.nearest(x, y, 0, true);
      const o = (j * RES + i) * 4;
      // precut models need no clipping: put the cut surface far in front
      hf[o] = cl.precut ? 1e6 : cl.pos[k * 3 + 2];
      hf[o + 1] = k / (TABLE_N - 1);
      hf[o + 2] = 0;
      hf[o + 3] = 1;
    }
  }
  const heightfield = new THREE.DataTexture(hf, RES, RES, THREE.RGBAFormat, THREE.FloatType);
  heightfield.minFilter = THREE.NearestFilter;
  heightfield.magFilter = THREE.NearestFilter;
  heightfield.wrapS = THREE.ClampToEdgeWrapping;
  heightfield.wrapT = THREE.ClampToEdgeWrapping;
  heightfield.needsUpdate = true;
  const hfRect = new THREE.Vector4(minX, minY, sizeX, sizeY);

  // cap grid: one vertex per texel centre (z is read in the vertex shader)
  const cap = new THREE.PlaneGeometry(sizeX - sizeX / RES, sizeY - sizeY / RES, RES - 1, RES - 1);
  cap.translate(minX + sizeX / 2, minY + sizeY / 2, 0);

  return { shell, ring, heightfield, hfRect, cap, bounds };
};
