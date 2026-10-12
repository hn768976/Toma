import * as THREE from "three";

// Screen-space ribbons (lines with a real pixel width) and billboard
// sprites. Widths are in world units and clamped to a minimum pixel width;
// below that the alpha is scaled instead, so thin lines keep their energy
// at any resolution and do not crawl or shimmer as they move.

export type Polyline = {
  points: THREE.Vector3[];
  width: number;
  seed: number;
  /** Optional per-polyline extra value (e.g. brightness). */
  extra?: number;
  /** Optional per-point width multiplier. */
  widthMul?: (u: number) => number;
};

export const buildRibbons = (lines: Polyline[]) => {
  let nv = 0;
  let ni = 0;
  for (const l of lines) {
    nv += l.points.length * 2;
    ni += (l.points.length - 1) * 6;
  }
  const pos = new Float32Array(nv * 3);
  const prev = new Float32Array(nv * 3);
  const next = new Float32Array(nv * 3);
  const side = new Float32Array(nv);
  const u = new Float32Array(nv);
  const seed = new Float32Array(nv);
  const width = new Float32Array(nv);
  const extra = new Float32Array(nv);
  const index = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  let v = 0;
  let ii = 0;
  for (const l of lines) {
    const n = l.points.length;
    const base = v;
    for (let i = 0; i < n; i++) {
      const p = l.points[i];
      const pp = l.points[Math.max(0, i - 1)];
      const pn = l.points[Math.min(n - 1, i + 1)];
      const t = n > 1 ? i / (n - 1) : 0;
      const wm = l.widthMul ? l.widthMul(t) : 1;
      for (let s = 0; s < 2; s++) {
        pos.set([p.x, p.y, p.z], v * 3);
        prev.set([pp.x, pp.y, pp.z], v * 3);
        next.set([pn.x, pn.y, pn.z], v * 3);
        side[v] = s === 0 ? -1 : 1;
        u[v] = t;
        seed[v] = l.seed;
        width[v] = l.width * wm;
        extra[v] = l.extra ?? 1;
        v++;
      }
    }
    for (let i = 0; i < n - 1; i++) {
      const a = base + i * 2;
      index.set([a, a + 2, a + 1, a + 1, a + 2, a + 3], ii);
      ii += 6;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aPrev", new THREE.BufferAttribute(prev, 3));
  g.setAttribute("aNext", new THREE.BufferAttribute(next, 3));
  g.setAttribute("aSide", new THREE.BufferAttribute(side, 1));
  g.setAttribute("aU", new THREE.BufferAttribute(u, 1));
  g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  g.setAttribute("aWidth", new THREE.BufferAttribute(width, 1));
  g.setAttribute("aExtra", new THREE.BufferAttribute(extra, 1));
  g.setIndex(new THREE.BufferAttribute(index, 1));
  return g;
};

/** Vertex code for ribbons. Defines vSide, vU, vSeed, vAlpha, vExtra, vViewZ. */
export const RIBBON_VERT = /* glsl */ `
attribute vec3 aPrev;
attribute vec3 aNext;
attribute float aSide;
attribute float aU;
attribute float aSeed;
attribute float aWidth;
attribute float aExtra;
uniform vec2 uRes;
uniform float uMinPx;
varying float vSide;
varying float vU;
varying float vSeed;
varying float vAlpha;
varying float vExtra;
varying float vViewZ;
varying vec3 vWorld;
void main() {
  mat4 mvp = projectionMatrix * modelViewMatrix;
  vec4 c = mvp * vec4(position, 1.0);
  vec4 p = mvp * vec4(aPrev, 1.0);
  vec4 n = mvp * vec4(aNext, 1.0);
  vec2 half_ = uRes * 0.5;
  vec2 sc = c.xy / max(c.w, 1e-4) * half_;
  vec2 sp = p.xy / max(p.w, 1e-4) * half_;
  vec2 sn = n.xy / max(n.w, 1e-4) * half_;
  vec2 d = sn - sp;
  if (dot(d, d) < 1e-8) d = vec2(1.0, 0.0);
  d = normalize(d);
  vec2 nrm = vec2(-d.y, d.x);
  float pxPerUnit = projectionMatrix[1][1] * half_.y / max(c.w, 1e-4);
  float px = aWidth * pxPerUnit;
  float wpx = max(px, uMinPx);
  vAlpha = px / wpx;
  c.xy += nrm * aSide * (wpx * 0.5 + 0.5) / half_ * c.w;
  gl_Position = c;
  vSide = aSide * (wpx * 0.5 + 0.5) / (wpx * 0.5);
  vU = aU;
  vSeed = aSeed;
  vExtra = aExtra;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vViewZ = -mv.z;
  vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
}
`;

/** Instanced billboards. */
export const buildSprites = (
  items: { pos: THREE.Vector3; size: number; color: THREE.Color; seed: number }[],
) => {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3),
  );
  g.setIndex([0, 1, 2, 0, 2, 3]);
  const n = items.length;
  const ip = new Float32Array(n * 3);
  const is = new Float32Array(n);
  const ic = new Float32Array(n * 3);
  const isd = new Float32Array(n);
  items.forEach((it, i) => {
    ip.set([it.pos.x, it.pos.y, it.pos.z], i * 3);
    is[i] = it.size;
    ic.set([it.color.r, it.color.g, it.color.b], i * 3);
    isd[i] = it.seed;
  });
  g.setAttribute("iPos", new THREE.InstancedBufferAttribute(ip, 3));
  g.setAttribute("iSize", new THREE.InstancedBufferAttribute(is, 1));
  g.setAttribute("iColor", new THREE.InstancedBufferAttribute(ic, 3));
  g.setAttribute("iSeed", new THREE.InstancedBufferAttribute(isd, 1));
  g.instanceCount = n;
  return g;
};

/** Vertex code for sprites. Defines vCorner, vColor, vSeed, vAlpha, vViewZ, vWorld. */
export const SPRITE_VERT = /* glsl */ `
attribute vec3 iPos;
attribute float iSize;
attribute vec3 iColor;
attribute float iSeed;
uniform vec2 uRes;
uniform float uMinPx;
uniform float uSizeMul;
varying vec2 vCorner;
varying vec3 vColor;
varying float vSeed;
varying float vAlpha;
varying float vViewZ;
varying vec3 vWorld;
void main() {
  vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
  vec4 c = projectionMatrix * mv;
  vec2 half_ = uRes * 0.5;
  float px = iSize * uSizeMul * projectionMatrix[1][1] * half_.y / max(c.w, 1e-4);
  float rpx = max(px, uMinPx);
  vAlpha = (px * px) / (rpx * rpx);
  c.xy += position.xy * (rpx + 1.0) / half_ * c.w;
  gl_Position = c;
  vCorner = position.xy * (rpx + 1.0) / rpx;
  vColor = iColor;
  vSeed = iSeed;
  vViewZ = -mv.z;
  vWorld = (modelMatrix * vec4(iPos, 1.0)).xyz;
}
`;

/** Cubic Bezier sample. */
export const bezier = (
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3,
  d: THREE.Vector3,
  t: number,
) => {
  const s = 1 - t;
  return new THREE.Vector3()
    .addScaledVector(a, s * s * s)
    .addScaledVector(b, 3 * s * s * t)
    .addScaledVector(c, 3 * s * t * t)
    .addScaledVector(d, t * t * t);
};
