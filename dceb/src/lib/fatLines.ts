/**
 * Screen-space "fat" line segments (two triangles per segment), with widths
 * given in pixels at 1080p and scaled to the actual drawing buffer, so 720p
 * previews and 4K renders look the same. Lines thinner than one real pixel
 * are drawn one pixel wide with proportionally lower alpha — sub-pixel lines
 * would otherwise crawl and shimmer as they move.
 */
import * as THREE from "three";

export const FAT_LINE_VERTEX_HEADER = /* glsl */ `
attribute vec3 aA;
attribute vec3 aB;
attribute vec2 aCorner;   // x: 0 = at A, 1 = at B; y: -1 / +1 side
uniform vec2 uResolution; // drawing buffer px
uniform float uWidth;     // px at 1080p
varying float vSide;
varying float vWidthAlpha;
varying float vHalfPx;

vec4 fatLinePosition(mat4 mvp, float widthScale) {
  vec4 ca = mvp * vec4(aA, 1.0);
  vec4 cb = mvp * vec4(aB, 1.0);
  // keep both ends in front of the camera
  if (ca.w < 1e-3) ca = mix(ca, cb, (1e-3 - ca.w) / max(cb.w - ca.w, 1e-6));
  if (cb.w < 1e-3) cb = mix(cb, ca, (1e-3 - cb.w) / max(ca.w - cb.w, 1e-6));
  vec2 sa = ca.xy / ca.w * uResolution * 0.5;
  vec2 sb = cb.xy / cb.w * uResolution * 0.5;
  vec2 d = sb - sa;
  float len = length(d);
  vec2 dir = len > 1e-5 ? d / len : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  float wpx = uWidth * widthScale * uResolution.y / 1080.0;
  float drawn = max(wpx, 1.0);
  vWidthAlpha = clamp(wpx / drawn, 0.0, 1.0);
  // +1px of feather for analytic anti-aliasing
  float half_ = drawn * 0.5 + 0.75;
  vHalfPx = half_;
  vSide = aCorner.y * half_;
  vec4 c = aCorner.x < 0.5 ? ca : cb;
  vec2 off = nrm * aCorner.y * half_ + dir * (aCorner.x < 0.5 ? -half_ : half_) * 0.5;
  c.xy += off / (uResolution * 0.5) * c.w;
  return c;
}
`;

export const FAT_LINE_FRAGMENT_HEADER = /* glsl */ `
varying float vSide;
varying float vWidthAlpha;
varying float vHalfPx;
float fatLineCoverage() {
  // 1 inside the core, falling to 0 over the last ~1.5px
  float d = abs(vSide);
  return clamp((vHalfPx - d) / 1.5, 0.0, 1.0) * vWidthAlpha;
}
`;

/** A segment list: positions of A and B per segment plus optional per-endpoint attributes. */
export type SegmentAttr = { size: number; a: number[]; b: number[] };

export const buildFatLineGeometry = (
  a: number[],
  b: number[],
  extra: Record<string, SegmentAttr> = {},
  perSegment: Record<string, { size: number; data: number[] }> = {},
) => {
  const n = a.length / 3;
  const corners = [
    [0, -1],
    [0, 1],
    [1, 1],
    [1, -1],
  ];
  const A = new Float32Array(n * 4 * 3);
  const B = new Float32Array(n * 4 * 3);
  const C = new Float32Array(n * 4 * 2);
  const idx = new Uint32Array(n * 6);
  const extraArrays: Record<string, Float32Array> = {};
  for (const [k, v] of Object.entries(extra)) extraArrays[k] = new Float32Array(n * 4 * v.size);
  const segArrays: Record<string, Float32Array> = {};
  for (const [k, v] of Object.entries(perSegment)) segArrays[k] = new Float32Array(n * 4 * v.size);
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < 4; c++) {
      const vi = i * 4 + c;
      for (let j = 0; j < 3; j++) {
        A[vi * 3 + j] = a[i * 3 + j];
        B[vi * 3 + j] = b[i * 3 + j];
      }
      C[vi * 2] = corners[c][0];
      C[vi * 2 + 1] = corners[c][1];
      for (const [k, v] of Object.entries(extra)) {
        const src = corners[c][0] < 0.5 ? v.a : v.b;
        for (let j = 0; j < v.size; j++) extraArrays[k][vi * v.size + j] = src[i * v.size + j];
      }
      for (const [k, v] of Object.entries(perSegment)) {
        for (let j = 0; j < v.size; j++) segArrays[k][vi * v.size + j] = v.data[i * v.size + j];
      }
    }
    const o = i * 4;
    // counter-clockwise on screen for every direction (front faces)
    idx.set([o, o + 2, o + 1, o, o + 3, o + 2], i * 6);
  }
  const g = new THREE.BufferGeometry();
  // "position" is required by three; it carries A so bounds are sensible
  g.setAttribute("position", new THREE.BufferAttribute(A, 3));
  g.setAttribute("aA", new THREE.BufferAttribute(A, 3));
  g.setAttribute("aB", new THREE.BufferAttribute(B, 3));
  g.setAttribute("aCorner", new THREE.BufferAttribute(C, 2));
  for (const [k, v] of Object.entries(extra)) g.setAttribute(k, new THREE.BufferAttribute(extraArrays[k], v.size));
  for (const [k, v] of Object.entries(perSegment)) g.setAttribute(k, new THREE.BufferAttribute(segArrays[k], v.size));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
};

/** Points of a polyline -> consecutive segments (A,B arrays). */
export const polylineToSegments = (pts: THREE.Vector3[]) => {
  const a: number[] = [];
  const b: number[] = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    a.push(pts[i].x, pts[i].y, pts[i].z);
    b.push(pts[i + 1].x, pts[i + 1].y, pts[i + 1].z);
  }
  return { a, b };
};

/** Unique edges of an indexed or non-indexed geometry. */
export const uniqueEdges = (geo: THREE.BufferGeometry, mergeTol = 1e-5) => {
  const pos = geo.getAttribute("position");
  // weld vertices
  const key = (i: number) =>
    `${Math.round(pos.getX(i) / mergeTol)},${Math.round(pos.getY(i) / mergeTol)},${Math.round(pos.getZ(i) / mergeTol)}`;
  const map = new Map<string, number>();
  const verts: THREE.Vector3[] = [];
  const remap: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const k = key(i);
    let id = map.get(k);
    if (id === undefined) {
      id = verts.length;
      map.set(k, id);
      verts.push(new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)));
    }
    remap.push(id);
  }
  const index = geo.getIndex();
  const tri = (t: number, k: number) => remap[index ? index.getX(t * 3 + k) : t * 3 + k];
  const triCount = (index ? index.count : pos.count) / 3;
  const edges = new Set<string>();
  const list: [number, number][] = [];
  for (let t = 0; t < triCount; t++) {
    for (let k = 0; k < 3; k++) {
      const i0 = tri(t, k);
      const i1 = tri(t, (k + 1) % 3);
      if (i0 === i1) continue;
      const e = i0 < i1 ? `${i0}_${i1}` : `${i1}_${i0}`;
      if (!edges.has(e)) {
        edges.add(e);
        list.push(i0 < i1 ? [i0, i1] : [i1, i0]);
      }
    }
  }
  return { verts, edges: list };
};
