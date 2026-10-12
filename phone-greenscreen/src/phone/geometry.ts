import * as THREE from "three";

/**
 * Geometry helpers for the phone. All units are "scene units" where
 * 1 unit = 100 mm (so the 150 mm tall phone is 1.5 units tall).
 */

export type OutlinePoint = { x: number; y: number; nx: number; ny: number };

/**
 * Samples a closed rounded rectangle centred on the origin. Every point
 * carries its outward unit normal, so the outline can be offset exactly
 * (offsetting a rounded rect by `o` gives a rounded rect of radius r + o).
 */
export const roundedRectOutline = (
  w: number,
  h: number,
  r: number,
  segmentsPerCorner = 24,
): OutlinePoint[] => {
  const pts: OutlinePoint[] = [];
  const hx = w / 2 - r;
  const hy = h / 2 - r;
  // corner centres, counter-clockwise starting top-right
  const corners: [number, number, number][] = [
    [hx, hy, 0],
    [-hx, hy, Math.PI / 2],
    [-hx, -hy, Math.PI],
    [hx, -hy, (3 * Math.PI) / 2],
  ];
  for (const [cx, cy, a0] of corners) {
    for (let i = 0; i <= segmentsPerCorner; i++) {
      const a = a0 + (i / segmentsPerCorner) * (Math.PI / 2);
      const nx = Math.cos(a);
      const ny = Math.sin(a);
      pts.push({ x: cx + nx * r, y: cy + ny * r, nx, ny });
    }
  }
  return pts;
};

export type ProfileSegment = {
  /** start / end as [outward offset, z] */
  a: [number, number];
  b: [number, number];
  /** profile-space normals as [outward, z] (normalised internally) */
  na: [number, number];
  nb: [number, number];
  /** subdivisions along the segment */
  steps?: number;
};

/**
 * Sweeps a cross-section profile around a rounded-rect outline. Normals are
 * smooth along the outline and taken from the profile across it, so hard
 * creases (chamfers) stay crisp while the corners stay perfectly smooth.
 */
export const sweepProfile = (
  outline: OutlinePoint[],
  profile: ProfileSegment[],
): THREE.BufferGeometry => {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const n = outline.length;

  for (const seg of profile) {
    const steps = seg.steps ?? 1;
    const base = positions.length / 3;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const o = seg.a[0] + (seg.b[0] - seg.a[0]) * t;
      const z = seg.a[1] + (seg.b[1] - seg.a[1]) * t;
      let pn0 = seg.na[0] + (seg.nb[0] - seg.na[0]) * t;
      let pn1 = seg.na[1] + (seg.nb[1] - seg.na[1]) * t;
      const l = Math.hypot(pn0, pn1) || 1;
      pn0 /= l;
      pn1 /= l;
      for (let i = 0; i < n; i++) {
        const p = outline[i];
        positions.push(p.x + p.nx * o, p.y + p.ny * o, z);
        normals.push(p.nx * pn0, p.ny * pn0, pn1);
      }
    }
    for (let s = 0; s < steps; s++) {
      for (let i = 0; i < n; i++) {
        const i2 = (i + 1) % n;
        const a = base + s * n + i;
        const b = base + s * n + i2;
        const c = base + (s + 1) * n + i;
        const d = base + (s + 1) * n + i2;
        indices.push(a, b, d, a, d, c);
      }
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  g.setIndex(indices);
  // Make winding agree with the supplied normals regardless of profile direction.
  fixWinding(g);
  return g;
};

/** Flip any triangle whose winding disagrees with its vertex normals. */
const fixWinding = (g: THREE.BufferGeometry) => {
  const pos = g.getAttribute("position");
  const nor = g.getAttribute("normal");
  const idx = g.getIndex()!;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const nrm = new THREE.Vector3();
  const face = new THREE.Vector3();
  for (let i = 0; i < idx.count; i += 3) {
    const ia = idx.getX(i);
    const ib = idx.getX(i + 1);
    const ic = idx.getX(i + 2);
    a.fromBufferAttribute(pos, ia);
    b.fromBufferAttribute(pos, ib);
    c.fromBufferAttribute(pos, ic);
    face.subVectors(b, a).cross(c.sub(a));
    nrm
      .fromBufferAttribute(nor, ia)
      .add(new THREE.Vector3().fromBufferAttribute(nor, ib))
      .add(new THREE.Vector3().fromBufferAttribute(nor, ic));
    if (face.dot(nrm) < 0) {
      idx.setX(i + 1, ic);
      idx.setX(i + 2, ib);
    }
  }
};

/** A flat rounded-rect (or pill / circle) cap facing +z, at z = 0. */
export const roundedRectCap = (
  w: number,
  h: number,
  r: number,
  segmentsPerCorner = 24,
): THREE.BufferGeometry => {
  const outline = roundedRectOutline(w, h, r, segmentsPerCorner);
  const shape = new THREE.Shape(outline.map((p) => new THREE.Vector2(p.x, p.y)));
  const g = new THREE.ShapeGeometry(shape, 1);
  // ShapeGeometry UVs are in shape units; normalise them to 0..1
  const uv = g.getAttribute("uv");
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) / w + 0.5, uv.getY(i) / h + 0.5);
  }
  return g;
};

/**
 * A raised rounded-rect plate: top cap, short side wall, small rounded edge.
 * Faces +z; its base sits at z = 0.
 */
export const raisedPlate = (
  w: number,
  h: number,
  r: number,
  height: number,
  edge: number,
): THREE.BufferGeometry => {
  const outline = roundedRectOutline(w, h, r, 20);
  const steps = 4;
  const profile: ProfileSegment[] = [
    { a: [0, 0], b: [0, height - edge], na: [1, 0], nb: [1, 0] },
  ];
  // quarter-round edge
  for (let i = 0; i < steps; i++) {
    const a0 = (i / steps) * (Math.PI / 2);
    const a1 = ((i + 1) / steps) * (Math.PI / 2);
    profile.push({
      a: [-edge + Math.cos(a0) * edge, height - edge + Math.sin(a0) * edge],
      b: [-edge + Math.cos(a1) * edge, height - edge + Math.sin(a1) * edge],
      na: [Math.cos(a0), Math.sin(a0)],
      nb: [Math.cos(a1), Math.sin(a1)],
    });
  }
  const wall = sweepProfile(outline, profile);
  const cap = roundedRectCap(w - 2 * edge, h - 2 * edge, Math.max(r - edge, 0.0001), 20);
  cap.translate(0, 0, height);
  cap.deleteAttribute("uv");
  return mergeSimple([wall, cap]);
};

/** Merge indexed / non-indexed geometries that share position + normal. */
export const mergeSimple = (geos: THREE.BufferGeometry[]): THREE.BufferGeometry => {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  for (const g0 of geos) {
    const g = g0.index ? g0 : g0.toNonIndexed();
    const pos = g.getAttribute("position");
    let nor = g.getAttribute("normal");
    if (!nor) {
      g.computeVertexNormals();
      nor = g.getAttribute("normal");
    }
    const base = positions.length / 3;
    for (let i = 0; i < pos.count; i++) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      normals.push(nor.getX(i), nor.getY(i), nor.getZ(i));
    }
    if (g.index) {
      for (let i = 0; i < g.index.count; i++) indices.push(base + g.index.getX(i));
    } else {
      for (let i = 0; i < pos.count; i++) indices.push(base + i);
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  out.setIndex(indices);
  return out;
};

/** A lathe ring (camera lens bezel) around +z, from a list of [radius, z]. */
export const latheRing = (
  profile: [number, number][],
  segments = 64,
): THREE.BufferGeometry => {
  const g = new THREE.LatheGeometry(
    profile.map(([r, z]) => new THREE.Vector2(r, z)),
    segments,
  );
  // Lathe revolves around +y; turn it so the axis is +z.
  g.rotateX(Math.PI / 2);
  g.computeVertexNormals();
  return g;
};
