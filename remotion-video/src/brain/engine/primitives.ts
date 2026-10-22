import {
  AddEquation,
  BufferAttribute,
  CustomBlending,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  OneFactor,
  OneMinusSrcAlphaFactor,
} from "three";

// Fat line segments: three's LineSegments2 idea (each segment an instanced
// screen-space quad) with our own shaders, because GL lines are 1px wide and
// the fibres need varied thickness and soft edges. Widths are in 2160p pixels
// and scaled by the actual drawing-buffer height, so the 720p preview is a true
// downscale of the 4K look.

export const FATLINE_GLSL = /* glsl */ `
uniform vec2 uRes;
uniform float uNear;
uniform float uPx;
uniform float uCap; // 1 = extend segment ends by half a width (joins), 0 = no caps
out float vDist;
out float vHalfW;
out float vCover;
// Returns clip position for one corner of the quad for segment a->b.
// along: 0 at a, 1 at b. side: -1/+1. widthPx: in 2160p pixels.
vec4 fatLine(vec3 a, vec3 b, float widthPx, float along, float side) {
  vec4 va = modelViewMatrix * vec4(a, 1.0);
  vec4 vb = modelViewMatrix * vec4(b, 1.0);
  if (va.z > -uNear && vb.z > -uNear) return vec4(2.0, 2.0, 2.0, 1.0);
  if (va.z > -uNear) va = mix(va, vb, (va.z + uNear) / (va.z - vb.z));
  if (vb.z > -uNear) vb = mix(vb, va, (vb.z + uNear) / (vb.z - va.z));
  vec4 ca = projectionMatrix * va;
  vec4 cb = projectionMatrix * vb;
  vec2 sa = ca.xy / ca.w * 0.5 * uRes;
  vec2 sb = cb.xy / cb.w * 0.5 * uRes;
  vec2 dir = sb - sa;
  float L = length(dir);
  dir = L > 1e-5 ? dir / L : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  float w = widthPx * uPx;
  float wd = max(w, 1.0);
  vCover = w / wd;
  float hw = 0.5 * wd + 1.0;
  vec4 c = along < 0.5 ? ca : cb;
  vec2 off = nrm * side * hw + dir * (along * 2.0 - 1.0) * 0.5 * wd * uCap;
  c.xy += off / (0.5 * uRes) * c.w;
  vDist = side * hw;
  vHalfW = 0.5 * wd;
  return c;
}
`;

export const FATLINE_FRAG_GLSL = /* glsl */ `
in float vDist;
in float vHalfW;
in float vCover;
float lineCoverage() {
  return clamp(vHalfW + 0.5 - abs(vDist), 0.0, 1.0) * vCover;
}
// soft profile across the line (1 at centre, 0 at edge) for glowing strokes
float lineProfile() {
  float x = abs(vDist) / (vHalfW + 1.0);
  return clamp(1.0 - x * x, 0.0, 1.0);
}
`;

export const POINT_GLSL = /* glsl */ `
uniform vec2 uRes;
uniform float uPx;
uniform float uProjY; // projectionMatrix[1][1]
out float vPtAlpha;
// worldSize: diameter in world units; minPx: minimum diameter in 2160p px.
float pointSize(float worldSize, float viewZ, float minPx) {
  float px = worldSize * uProjY * 0.5 * uRes.y / max(-viewZ, 1e-3);
  float lo = max(minPx * uPx, 1.25);
  vPtAlpha = px < lo ? (px * px) / (lo * lo) : 1.0;
  return max(px, lo);
}
`;

/** Base quad for instanced fat segments. */
const quadBase = (g: InstancedBufferGeometry) => {
  g.setAttribute("position", new BufferAttribute(new Float32Array([0, -1, 0, 1, -1, 0, 0, 1, 0, 1, 1, 0]), 3));
  g.setIndex([0, 1, 2, 2, 1, 3]);
};

/**
 * Build instanced segments from polylines.
 * curves: flat xyz, `per` points per curve; `ids` selects curves in draw order.
 * perCurve(i) -> 4 floats stored per segment as aCurve.
 * Each segment also gets aSeg = (t0, t1, curveOrdinal, segIndex).
 */
export const buildSegments = (
  curves: Float32Array,
  per: number,
  ids: ArrayLike<number>,
  perCurve: (curve: number, ordinal: number) => [number, number, number, number],
  countPts?: (curve: number) => number,
) => {
  let nSeg = 0;
  for (let k = 0; k < ids.length; k++) nSeg += (countPts ? countPts(ids[k]) : per) - 1;
  const A = new Float32Array(nSeg * 3);
  const B = new Float32Array(nSeg * 3);
  const S = new Float32Array(nSeg * 4);
  const C = new Float32Array(nSeg * 4);
  let s = 0;
  for (let k = 0; k < ids.length; k++) {
    const c = ids[k];
    const n = countPts ? countPts(c) : per;
    const pc = perCurve(c, k);
    for (let j = 0; j < n - 1; j++) {
      const ia = (c * per + j) * 3;
      const ib = ia + 3;
      A[s * 3] = curves[ia];
      A[s * 3 + 1] = curves[ia + 1];
      A[s * 3 + 2] = curves[ia + 2];
      B[s * 3] = curves[ib];
      B[s * 3 + 1] = curves[ib + 1];
      B[s * 3 + 2] = curves[ib + 2];
      S[s * 4] = j / (n - 1);
      S[s * 4 + 1] = (j + 1) / (n - 1);
      S[s * 4 + 2] = k;
      S[s * 4 + 3] = j;
      C.set(pc, s * 4);
      s++;
    }
  }
  const g = new InstancedBufferGeometry();
  quadBase(g);
  g.setAttribute("aA", new InstancedBufferAttribute(A, 3));
  g.setAttribute("aB", new InstancedBufferAttribute(B, 3));
  g.setAttribute("aSeg", new InstancedBufferAttribute(S, 4));
  g.setAttribute("aCurve", new InstancedBufferAttribute(C, 4));
  g.instanceCount = nSeg;
  return g;
};

/**
 * Pure additive light (ONE, ONE). Glow shaders write premultiplied colour with
 * alpha 0, so they add light without occluding the background. (three's
 * AdditiveBlending weights by source alpha, which would cancel them.)
 */
export const ADDITIVE = {
  transparent: true,
  depthWrite: false,
  blending: CustomBlending,
  blendEquation: AddEquation,
  blendSrc: OneFactor,
  blendDst: OneFactor,
  blendEquationAlpha: AddEquation,
  blendSrcAlpha: OneFactor,
  blendDstAlpha: OneFactor,
} as const;

/** Premultiplied "over" (ONE, ONE_MINUS_SRC_ALPHA): translucent strokes that also occlude. */
export const PREMULT_OVER = {
  transparent: true,
  depthWrite: false,
  blending: CustomBlending,
  blendEquation: AddEquation,
  blendSrc: OneFactor,
  blendDst: OneMinusSrcAlphaFactor,
  blendEquationAlpha: AddEquation,
  blendSrcAlpha: OneFactor,
  blendDstAlpha: OneMinusSrcAlphaFactor,
} as const;
