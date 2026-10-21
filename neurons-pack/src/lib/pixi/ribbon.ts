import { Geometry } from "pixi.js";

/**
 * Static ribbon geometry for many polylines. Each point becomes two
 * vertices (one each side); the vertex shader extrudes them along
 * `aNormal` by a width chosen per frame, so the geometry is built once and
 * only uniforms change while animating.
 */
export type RibbonLine = {
  /** x, y pairs in composition pixels. */
  pts: ArrayLike<number>;
  /** Per-line constants, packed into aLineA / aLineB (4 floats each). */
  a: [number, number, number, number];
  b: [number, number, number, number];
};

export const buildRibbons = (lines: RibbonLine[]) => {
  let nPts = 0;
  let nSeg = 0;
  for (const l of lines) {
    const n = l.pts.length / 2;
    nPts += n;
    nSeg += Math.max(0, n - 1);
  }
  const pos = new Float32Array(nPts * 4);
  const nrm = new Float32Array(nPts * 4);
  // s: arc length fraction; side: -1 / +1; len: total arc length.
  const sAttr = new Float32Array(nPts * 6);
  const la = new Float32Array(nPts * 8);
  const lb = new Float32Array(nPts * 8);
  const idx = new Uint32Array(nSeg * 6);
  let v = 0;
  let k = 0;
  for (const l of lines) {
    const p = l.pts;
    const n = p.length / 2;
    const cum = new Float64Array(n);
    for (let i = 1; i < n; i++) {
      cum[i] = cum[i - 1] + Math.hypot(p[2 * i] - p[2 * i - 2], p[2 * i + 1] - p[2 * i - 1]);
    }
    const total = cum[n - 1] || 1;
    const v0 = v;
    for (let i = 0; i < n; i++) {
      const i0 = Math.max(0, i - 1);
      const i1 = Math.min(n - 1, i + 1);
      // Segment normals either side, averaged into a limited miter.
      let dx0 = p[2 * i] - p[2 * i0];
      let dy0 = p[2 * i + 1] - p[2 * i0 + 1];
      let dx1 = p[2 * i1] - p[2 * i];
      let dy1 = p[2 * i1 + 1] - p[2 * i + 1];
      const l0 = Math.hypot(dx0, dy0);
      const l1 = Math.hypot(dx1, dy1);
      if (l0 < 1e-9) { dx0 = dx1; dy0 = dy1; } else { dx0 /= l0; dy0 /= l0; }
      if (l1 < 1e-9) { dx1 = dx0; dy1 = dy0; } else { dx1 /= l1; dy1 /= l1; }
      let tx = dx0 + dx1;
      let ty = dy0 + dy1;
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl;
      ty /= tl;
      const nx = -ty;
      const ny = tx;
      const cosHalf = Math.max(0.5, nx * -dy1 + ny * dx1);
      for (let side = -1; side <= 1; side += 2) {
        pos[2 * v] = p[2 * i];
        pos[2 * v + 1] = p[2 * i + 1];
        nrm[2 * v] = (nx * side) / cosHalf;
        nrm[2 * v + 1] = (ny * side) / cosHalf;
        sAttr[3 * v] = cum[i] / total;
        sAttr[3 * v + 1] = side;
        sAttr[3 * v + 2] = total;
        la.set(l.a, 4 * v);
        lb.set(l.b, 4 * v);
        v++;
      }
    }
    for (let i = 0; i < n - 1; i++) {
      const a = v0 + 2 * i;
      idx[k++] = a;
      idx[k++] = a + 1;
      idx[k++] = a + 2;
      idx[k++] = a + 1;
      idx[k++] = a + 3;
      idx[k++] = a + 2;
    }
  }
  return new Geometry({
    attributes: {
      aPosition: { buffer: pos.subarray(0, v * 2), format: "float32x2" },
      aNormal: { buffer: nrm.subarray(0, v * 2), format: "float32x2" },
      aS: { buffer: sAttr.subarray(0, v * 3), format: "float32x3" },
      aLineA: { buffer: la.subarray(0, v * 4), format: "float32x4" },
      aLineB: { buffer: lb.subarray(0, v * 4), format: "float32x4" },
    },
    indexBuffer: idx.subarray(0, k),
  });
};

/**
 * GLSL for the ribbon vertex shader: extrude by a width in composition
 * pixels; lines thinner than one device pixel are drawn one pixel wide with
 * coverage scaled down, so 720p and 4K read the same.
 * Outputs vDist (device px from centre) and vHalf (device half width).
 */
export const RIBBON_VERT_HEAD = /* glsl */ `
in vec2 aPosition;
in vec2 aNormal;
in vec3 aS;
in vec4 aLineA;
in vec4 aLineB;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
out float vDist;
out float vHalf;
out float vCover;
// Returns clip position; sets vDist / vHalf / vCover.
vec4 extrude(vec2 center, float widthPx, float px) {
  float wd = widthPx * px;
  vCover = clamp(wd, 0.0, 1.0);
  wd = max(wd, 1.0);
  vHalf = 0.5 * wd;
  float ext = vHalf + 1.0;
  vDist = aS.y * ext;
  vec2 p = center + aNormal * (ext / px);
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  return vec4((mvp * vec3(p, 1.0)).xy, 0.0, 1.0);
}
`;

export const RIBBON_FRAG_HEAD = /* glsl */ `
in float vDist;
in float vHalf;
in float vCover;
float ribbonCoverage() {
  return clamp(vHalf + 0.5 - abs(vDist), 0.0, 1.0) * vCover;
}
`;
