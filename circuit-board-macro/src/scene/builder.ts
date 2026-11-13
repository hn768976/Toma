import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { MatKey, Palette } from "./palette";

type V2 = [number, number];

function clean(g: THREE.BufferGeometry) {
  const n = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(n.attributes)) {
    if (k !== "position" && k !== "normal" && k !== "uv") n.deleteAttribute(k);
  }
  if (!n.attributes.uv) {
    n.setAttribute(
      "uv",
      new THREE.BufferAttribute(
        new Float32Array(n.attributes.position.count * 2),
        2,
      ),
    );
  }
  n.clearGroups();
  return n;
}

/** Offset a polyline in the XZ plane by `d` (mitred joints). */
export function offsetLine(pts: V2[], d: number): V2[] {
  const out: V2[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[i];
    const c = pts[Math.min(pts.length - 1, i + 1)];
    const n1 = norm([-(b[1] - a[1]), b[0] - a[0]]);
    const n2 = norm([-(c[1] - b[1]), c[0] - b[0]]);
    let n: V2;
    if (i === 0) n = n2;
    else if (i === pts.length - 1) n = n1;
    else {
      const m = norm([n1[0] + n2[0], n1[1] + n2[1]]);
      const k = 1 / Math.max(0.3, m[0] * n1[0] + m[1] * n1[1]);
      n = [m[0] * k, m[1] * k];
    }
    out.push([b[0] + n[0] * d, b[1] + n[1] * d]);
  }
  return out;
}
function norm(v: V2): V2 {
  const l = Math.hypot(v[0], v[1]) || 1;
  return [v[0] / l, v[1] / l];
}

/** Collects geometry per material and merges everything into a few meshes. */
export class Builder {
  private lists = new Map<MatKey, THREE.BufferGeometry[]>();
  private stack: THREE.Matrix4[] = [new THREE.Matrix4()];

  push(m: THREE.Matrix4) {
    this.stack.push(this.stack[this.stack.length - 1].clone().multiply(m));
  }
  pushAt(x: number, y: number, z: number, ry = 0) {
    this.push(new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z));
  }
  pop() {
    this.stack.pop();
  }

  add(mat: MatKey, geo: THREE.BufferGeometry, local?: THREE.Matrix4) {
    const g = clean(geo);
    const m = this.stack[this.stack.length - 1].clone();
    if (local) m.multiply(local);
    g.applyMatrix4(m);
    if (!this.lists.has(mat)) this.lists.set(mat, []);
    this.lists.get(mat)!.push(g);
  }

  /** Box with bevelled edges, base centre at (x, y, z). */
  rbox(
    mat: MatKey,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    bevel = 0.03,
    radius = 0,
  ) {
    const b = Math.min(bevel, w / 2.2, h / 2.2, d / 2.2);
    const r = Math.max(
      0,
      Math.min(radius, (w - 2 * b) / 2 - 1e-3, (d - 2 * b) / 2 - 1e-3),
    );
    const hw = w / 2 - b;
    const hd = d / 2 - b;
    const s = new THREE.Shape();
    s.moveTo(-hw + r, -hd);
    s.lineTo(hw - r, -hd);
    if (r > 0) s.absarc(hw - r, -hd + r, r, -Math.PI / 2, 0, false);
    s.lineTo(hw, hd - r);
    if (r > 0) s.absarc(hw - r, hd - r, r, 0, Math.PI / 2, false);
    s.lineTo(-hw + r, hd);
    if (r > 0) s.absarc(-hw + r, hd - r, r, Math.PI / 2, Math.PI, false);
    s.lineTo(-hw, -hd + r);
    if (r > 0) s.absarc(-hw + r, -hd + r, r, Math.PI, Math.PI * 1.5, false);
    const g = new THREE.ExtrudeGeometry(s, {
      depth: h - 2 * b,
      bevelEnabled: true,
      bevelSize: b,
      bevelThickness: b,
      bevelSegments: 2,
      curveSegments: 6,
    });
    g.rotateX(-Math.PI / 2);
    g.translate(x, y + b, z);
    this.add(mat, g);
  }

  /** Vertical cylinder, base centre at (x, y, z). */
  cyl(
    mat: MatKey,
    r: number,
    h: number,
    x: number,
    y: number,
    z: number,
    seg = 32,
    rTop = r,
  ) {
    const g = new THREE.CylinderGeometry(rTop, r, h, seg, 1);
    g.translate(x, y + h / 2, z);
    this.add(mat, g);
  }

  /** Cylinder lying on the board along local X (axis height y). */
  hcyl(
    mat: MatKey,
    r: number,
    len: number,
    x: number,
    y: number,
    z: number,
    alongZ = false,
    seg = 20,
  ) {
    const g = new THREE.CylinderGeometry(r, r, len, seg, 1);
    g.rotateZ(Math.PI / 2);
    if (alongZ) g.rotateY(Math.PI / 2);
    g.translate(x, y, z);
    this.add(mat, g);
  }

  disc(mat: MatKey, r: number, x: number, y: number, z: number, seg = 20) {
    const g = new THREE.CircleGeometry(r, seg);
    g.rotateX(-Math.PI / 2);
    g.translate(x, y, z);
    this.add(mat, g);
  }

  ring(
    mat: MatKey,
    r0: number,
    r1: number,
    x: number,
    y: number,
    z: number,
    seg = 28,
  ) {
    const g = new THREE.RingGeometry(r0, r1, seg);
    g.rotateX(-Math.PI / 2);
    g.translate(x, y, z);
    this.add(mat, g);
  }

  /** Flat strip following a polyline in the XZ plane (with thin side walls). */
  ribbon(mat: MatKey, pts: V2[], width: number, y: number, thick = 0.006) {
    const L = offsetLine(pts, width / 2);
    const R = offsetLine(pts, -width / 2);
    const pos: number[] = [];
    const nor: number[] = [];
    const quad = (
      a: number[],
      b: number[],
      c: number[],
      d: number[],
      n: number[],
    ) => {
      pos.push(...a, ...b, ...c, ...a, ...c, ...d);
      for (let i = 0; i < 6; i++) nor.push(...n);
    };
    const y0 = y - thick;
    for (let i = 0; i < pts.length - 1; i++) {
      const l0 = L[i],
        l1 = L[i + 1],
        r0 = R[i],
        r1 = R[i + 1];
      quad(
        [l0[0], y, l0[1]],
        [l1[0], y, l1[1]],
        [r1[0], y, r1[1]],
        [r0[0], y, r0[1]],
        [0, 1, 0],
      );
      const dx = pts[i + 1][0] - pts[i][0];
      const dz = pts[i + 1][1] - pts[i][1];
      const n = norm([-dz, dx]);
      quad(
        [l0[0], y0, l0[1]],
        [l1[0], y0, l1[1]],
        [l1[0], y, l1[1]],
        [l0[0], y, l0[1]],
        [n[0], 0.4, n[1]],
      );
      quad(
        [r1[0], y0, r1[1]],
        [r0[0], y0, r0[1]],
        [r0[0], y, r0[1]],
        [r1[0], y, r1[1]],
        [-n[0], 0.4, -n[1]],
      );
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    // winding is not guaranteed for arbitrary directions -> fix by orientation
    fixWinding(g);
    this.add(mat, g);
  }

  /** `count` parallel ribbons around a centre line. */
  bundle(
    mat: MatKey,
    pts: V2[],
    count: number,
    pitch: number,
    width: number,
    y: number,
  ) {
    for (let k = 0; k < count; k++) {
      this.ribbon(
        mat,
        offsetLine(pts, (k - (count - 1) / 2) * pitch),
        width,
        y,
      );
    }
  }

  build(palette: Palette): THREE.Group {
    const group = new THREE.Group();
    for (const [key, list] of this.lists) {
      const geo = mergeGeometries(list, false);
      if (!geo) continue;
      for (const l of list) l.dispose();
      const p = palette.mats[key];
      const mat = new THREE.MeshStandardMaterial({
        color: p.color,
        roughness: p.roughness,
        metalness: p.metalness,
        envMapIntensity: p.env ?? 1,
        emissive: p.emissive ?? 0x000000,
        emissiveIntensity: p.emissiveIntensity ?? 0,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow =
        key !== "trace" &&
        key !== "pad" &&
        key !== "plateDetail" &&
        key !== "plateDark";
      mesh.receiveShadow = true;
      mesh.name = key;
      group.add(mesh);
    }
    return group;
  }
}

/** Make every triangle face the direction of its stored normal. */
function fixWinding(g: THREE.BufferGeometry) {
  const p = g.attributes.position.array as Float32Array;
  const n = g.attributes.normal.array as Float32Array;
  for (let i = 0; i < p.length; i += 9) {
    const ax = p[i + 3] - p[i],
      ay = p[i + 4] - p[i + 1],
      az = p[i + 5] - p[i + 2];
    const bx = p[i + 6] - p[i],
      by = p[i + 7] - p[i + 1],
      bz = p[i + 8] - p[i + 2];
    const cx = ay * bz - az * by,
      cy = az * bx - ax * bz,
      cz = ax * by - ay * bx;
    if (cx * n[i] + cy * n[i + 1] + cz * n[i + 2] < 0) {
      for (let k = 0; k < 3; k++) {
        const t = p[i + 3 + k];
        p[i + 3 + k] = p[i + 6 + k];
        p[i + 6 + k] = t;
      }
    }
  }
}
