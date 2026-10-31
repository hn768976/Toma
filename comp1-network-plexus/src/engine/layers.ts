import * as THREE from "three";

/*
 * Tiny rendering engine used by the composition.
 *
 * Everything is drawn with additive, instanced, camera-facing quads. Depth of
 * field is simulated per element in the vertex shader: every quad is grown by
 * its circle-of-confusion (CoC) and the fragment shader spreads the element's
 * energy over the enlarged area. This gives a convincing lens blur in a single
 * pass (no post-processing), which keeps 4K software rendering fast.
 */

export type SharedUniforms = {
  uTime: { value: number };
  uViewport: { value: THREE.Vector2 };
  uFocus: { value: number };
  uAperture: { value: number };
  uResScale: { value: number };
  uNear: { value: number };
  uFogDist: { value: number };
  uGain: { value: number };
};

export const createSharedUniforms = (
  width: number,
  height: number,
): SharedUniforms => ({
  uTime: { value: 0 },
  uViewport: { value: new THREE.Vector2(width, height) },
  uFocus: { value: 10 },
  uAperture: { value: 40 },
  uResScale: { value: height / 2160 },
  uNear: { value: 0.12 },
  uFogDist: { value: 90 },
  uGain: { value: 1 },
});

const COMMON = /* glsl */ `
uniform float uTime;
uniform vec2 uViewport;
uniform float uFocus;
uniform float uAperture;
uniform float uResScale;
uniform float uNear;
uniform float uFogDist;
uniform float uGain;
// Well-defined smoothstep for either edge order (GLSL leaves smoothstep
// undefined when edge0 >= edge1, and some drivers return garbage there).
float sstep(float a, float b, float x) {
  float d = b - a; d = abs(d) < 1e-6 ? 1e-6 : d;
  float t = clamp((x - a) / d, 0.0, 1.0); return t * t * (3.0 - 2.0 * t);
}
vec2 sstep(vec2 a, vec2 b, vec2 x) {
  vec2 d = b - a; d = vec2(abs(d.x) < 1e-6 ? 1e-6 : d.x, abs(d.y) < 1e-6 ? 1e-6 : d.y);
  vec2 t = clamp((x - a) / d, 0.0, 1.0); return t * t * (3.0 - 2.0 * t);
}
float cocPx(float d) {
  return min(uAperture * uResScale * abs(d - uFocus) / max(d, 0.001), 700.0 * uResScale);
}
float fogF(float d) { return exp(-d / uFogDist); }
`;

/* ------------------------------------------------------------------------ */
/* Billboards                                                                */
/* ------------------------------------------------------------------------ */

export type Billboard = {
  pos: [number, number, number];
  size: [number, number]; // world units (full width / height)
  color: [number, number, number, number]; // rgb + intensity
  kind: number;
  params?: [number, number, number, number];
  timing?: [number, number, number, number]; // appearStart, appearDur, a, b
  minPx?: number; // minimum on-screen size in px at 2160p
  vel?: [number, number, number]; // world units / s, applied after appear time
};

const BILLBOARD_VERT = /* glsl */ `
${COMMON}
attribute vec3 iPos;
attribute vec2 iSize;
attribute vec4 iColor;
attribute vec4 iParams;
attribute vec4 iTiming;
attribute vec2 iKindMin;
attribute vec3 iVel;
varying vec2 vQ;        // quad coords, -1..1
varying vec2 vScale;    // total/size (shape coords = vQ * vScale)
varying vec2 vSizePx;
varying float vCoc;
varying float vEnergy;
varying vec4 vColor;
varying vec4 vParams;
varying vec4 vTiming;
varying float vKind;
varying float vDepth;
void main() {
  vec3 wp = iPos + iVel * max(uTime - iTiming.x, 0.0);
  vec4 mv = modelViewMatrix * vec4(wp, 1.0);
  float d = -mv.z;
  if (d < uNear || iColor.a <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float pxPerUnit = projectionMatrix[1][1] * uViewport.y * 0.5 / d;
  vec2 rawPx = iSize * pxPerUnit;
  float minPx = iKindMin.y * uResScale;
  vec2 sizePx = max(rawPx, vec2(minPx));
  // sub-minimum elements lose energy instead of shimmering
  float areaE = clamp((rawPx.x * rawPx.y) / max(sizePx.x * sizePx.y, 1e-6), 0.0, 1.0);
  float coc = cocPx(d);
  vec2 total = sizePx + vec2(coc);
  vec4 clip = projectionMatrix * mv;
  clip.xy += position.xy * total / uViewport * clip.w;
  gl_Position = clip;
  vQ = position.xy * 2.0;
  vScale = total / sizePx;
  vSizePx = sizePx;
  vCoc = coc;
  // fade out smoothly before crossing the near plane (no popping)
  vEnergy = areaE * fogF(d) * sstep(uNear, uNear + 1.6, d);
  vColor = iColor;
  vParams = iParams;
  vTiming = iTiming;
  vKind = iKindMin.x;
  vDepth = d;
}
`;

export const billboardFragment = (shapes: string) => /* glsl */ `
${COMMON}
varying vec2 vQ;
varying vec2 vScale;
varying vec2 vSizePx;
varying float vCoc;
varying float vEnergy;
varying vec4 vColor;
varying vec4 vParams;
varying vec4 vTiming;
varying float vKind;
varying float vDepth;
float hash11(float p) { p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
// Defocus helper: blur = CoC relative to the sharp shape size.
float blurRel() { return vCoc / max(min(vSizePx.x, vSizePx.y), 1.0); }
// Soft disk occupying the whole (blurred) quad: the bokeh of a point.
float bokeh(vec2 q) { float r = length(q); return sstep(1.0, 0.82, r) * (0.75 + 0.25 * r); }
${shapes}
void main() {
  float appear = clamp((uTime - vTiming.x) / max(vTiming.y, 0.0001), 0.0, 1.0);
  if (appear <= 0.0) discard;
  vec2 p = vQ * vScale; // shape coordinates: -1..1 covers the sharp element
  vec3 col = shade(p, vQ, appear);
  col = max(col, vec3(0.0)) * vEnergy * uGain;
  if (max(col.r, max(col.g, col.b)) < 0.00025) discard;
  gl_FragColor = vec4(col, 1.0);
}
`;

export const createBillboardLayer = (
  items: Billboard[],
  shapes: string,
  uniforms: SharedUniforms,
) => {
  const n = items.length;
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute(
    "position",
    new THREE.BufferAttribute(
      new Float32Array([
        -0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0,
      ]),
      3,
    ),
  );
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  const pos = new Float32Array(n * 3);
  const size = new Float32Array(n * 2);
  const color = new Float32Array(n * 4);
  const params = new Float32Array(n * 4);
  const timing = new Float32Array(n * 4);
  const kindMin = new Float32Array(n * 2);
  const vel = new Float32Array(n * 3);
  items.forEach((it, i) => {
    pos.set(it.pos, i * 3);
    size.set(it.size, i * 2);
    color.set(it.color, i * 4);
    params.set(it.params ?? [0, 0, 0, 0], i * 4);
    timing.set(it.timing ?? [-100, 0.001, 0, 0], i * 4);
    kindMin.set([it.kind, it.minPx ?? 2], i * 2);
    vel.set(it.vel ?? [0, 0, 0], i * 3);
  });
  geo.setAttribute("iPos", new THREE.InstancedBufferAttribute(pos, 3));
  geo.setAttribute("iSize", new THREE.InstancedBufferAttribute(size, 2));
  geo.setAttribute("iColor", new THREE.InstancedBufferAttribute(color, 4));
  geo.setAttribute("iParams", new THREE.InstancedBufferAttribute(params, 4));
  geo.setAttribute("iTiming", new THREE.InstancedBufferAttribute(timing, 4));
  geo.setAttribute("iKindMin", new THREE.InstancedBufferAttribute(kindMin, 2));
  geo.setAttribute("iVel", new THREE.InstancedBufferAttribute(vel, 3));
  geo.instanceCount = n;
  const mat = new THREE.ShaderMaterial({
    uniforms: uniforms as unknown as Record<string, THREE.IUniform>,
    vertexShader: BILLBOARD_VERT,
    fragmentShader: billboardFragment(shapes),
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return mesh;
};

/* ------------------------------------------------------------------------ */
/* Lines                                                                     */
/* ------------------------------------------------------------------------ */

export type Line = {
  a: [number, number, number];
  b: [number, number, number];
  colorA: [number, number, number, number];
  colorB: [number, number, number, number];
  widthPx: number; // core width in px at 2160p
  timing?: [number, number, number, number]; // growStart, growDur, pulseSpeed, pulsePhase
};

const LINE_VERT = /* glsl */ `
${COMMON}
attribute vec3 iA;
attribute vec3 iB;
attribute vec4 iColA;
attribute vec4 iColB;
attribute float iWidth;
attribute vec4 iTiming;
varying float vAcross;
varying float vT;
varying vec4 vCol;
varying float vSharp;
varying vec4 vTiming;
varying float vWidthPx;
void main() {
  vec4 a = modelViewMatrix * vec4(iA, 1.0);
  vec4 b = modelViewMatrix * vec4(iB, 1.0);
  float ta = 0.0; float tb = 1.0;
  if (a.z > -uNear && b.z > -uNear) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  if (a.z > -uNear) { float t = (-uNear - a.z) / (b.z - a.z); a = mix(a, b, t); ta = t; }
  if (b.z > -uNear) { float t = (-uNear - b.z) / (a.z - b.z); b = mix(b, a, t); tb = 1.0 - t; }
  vec4 ca = projectionMatrix * a;
  vec4 cb = projectionMatrix * b;
  vec2 sa = ca.xy / ca.w * 0.5 * uViewport;
  vec2 sb = cb.xy / cb.w * 0.5 * uViewport;
  vec2 dv = sb - sa;
  float len = length(dv);
  vec2 dir = len > 0.0001 ? dv / len : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  bool atB = position.x > 0.5;
  vec4 v = atB ? b : a;
  vec4 c = atB ? cb : ca;
  vec2 s = atB ? sb : sa;
  float d = -v.z;
  float coc = cocPx(d);
  float core = iWidth * uResScale;
  float w = core * 3.0 + coc;
  // extend slightly along the line so blurred ends are not cut square
  float ext = coc * 0.35;
  s += nrm * position.y * w * 0.5 + dir * (atB ? ext : -ext);
  gl_Position = vec4(s / (0.5 * uViewport) * c.w, c.z, c.w);
  vAcross = position.y;
  vT = atB ? tb : ta;
  vCol = (atB ? iColB : iColA) * fogF(d) * sstep(uNear, uNear + 1.6, d);
  vSharp = (core * 3.0) / w;
  vTiming = iTiming;
  vWidthPx = w;
}
`;

const LINE_FRAG = /* glsl */ `
${COMMON}
varying float vAcross;
varying float vT;
varying vec4 vCol;
varying float vSharp;
varying vec4 vTiming;
varying float vWidthPx;
void main() {
  float grow = clamp((uTime - vTiming.x) / max(vTiming.y, 0.0001), 0.0, 1.0);
  if (grow <= 0.0 || vT > grow) discard;
  float x = abs(vAcross);
  // sharp: thin bright core + soft glow. blurred: wide gaussian.
  float sharpProfile = exp(-x * x * 40.0) + 0.22 * exp(-x * x * 6.0);
  float blurProfile = exp(-x * x * 3.2);
  float s = clamp(vSharp, 0.0, 1.0);
  float prof = mix(blurProfile * 0.9, sharpProfile, s * s);
  float energy = pow(s, 0.85);
  // travelling pulse
  float pulse = 0.0;
  if (vTiming.z > 0.0) {
    float ph = fract(vT - uTime * vTiming.z + vTiming.w);
    pulse = exp(-ph * ph * 900.0) * 3.0 + exp(-ph * 30.0) * 0.4;
  }
  // fade towards growing tip
  float tip = sstep(grow, grow - 0.03, vT);
  vec3 col = max(vCol.rgb * vCol.a * prof * energy * (1.0 + pulse) * tip * uGain, vec3(0.0));
  if (max(col.r, max(col.g, col.b)) < 0.00025) discard;
  gl_FragColor = vec4(col, 1.0);
}
`;

export const createLineLayer = (items: Line[], uniforms: SharedUniforms) => {
  const n = items.length;
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute(
    "position",
    new THREE.BufferAttribute(
      new Float32Array([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0]),
      3,
    ),
  );
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  const A = new Float32Array(n * 3);
  const B = new Float32Array(n * 3);
  const CA = new Float32Array(n * 4);
  const CB = new Float32Array(n * 4);
  const W = new Float32Array(n);
  const T = new Float32Array(n * 4);
  items.forEach((l, i) => {
    A.set(l.a, i * 3);
    B.set(l.b, i * 3);
    CA.set(l.colorA, i * 4);
    CB.set(l.colorB, i * 4);
    W[i] = l.widthPx;
    T.set(l.timing ?? [-100, 0.001, 0, 0], i * 4);
  });
  geo.setAttribute("iA", new THREE.InstancedBufferAttribute(A, 3));
  geo.setAttribute("iB", new THREE.InstancedBufferAttribute(B, 3));
  geo.setAttribute("iColA", new THREE.InstancedBufferAttribute(CA, 4));
  geo.setAttribute("iColB", new THREE.InstancedBufferAttribute(CB, 4));
  geo.setAttribute("iWidth", new THREE.InstancedBufferAttribute(W, 1));
  geo.setAttribute("iTiming", new THREE.InstancedBufferAttribute(T, 4));
  geo.instanceCount = n;
  const mat = new THREE.ShaderMaterial({
    uniforms: uniforms as unknown as Record<string, THREE.IUniform>,
    vertexShader: LINE_VERT,
    fragmentShader: LINE_FRAG,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return mesh;
};

/* ------------------------------------------------------------------------ */
/* Full-screen passes                                                        */
/* ------------------------------------------------------------------------ */

const FS_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const fullscreenGeo = () =>
  new THREE.BufferGeometry().setAttribute(
    "position",
    new THREE.BufferAttribute(
      new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]),
      3,
    ),
  );

/** Opaque background, drawn first. `body` must define vec3 bg(vec2 uv). */
export const createBackgroundPass = (
  body: string,
  uniforms: Record<string, THREE.IUniform>,
) => {
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: FS_VERT,
    fragmentShader: `varying vec2 vUv;\n${body}\nvoid main(){ gl_FragColor = vec4(bg(vUv), 1.0); }`,
    depthTest: false,
    depthWrite: false,
    blending: THREE.NoBlending,
  });
  const mesh = new THREE.Mesh(fullscreenGeo(), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  return mesh;
};

/**
 * Final pass: dst = dst * mul + add. `body` must define
 * vec4 overlay(vec2 uv) returning (add.rgb, mul).
 */
export const createOverlayPass = (
  body: string,
  uniforms: Record<string, THREE.IUniform>,
) => {
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: FS_VERT,
    fragmentShader: `varying vec2 vUv;\n${body}\nvoid main(){ gl_FragColor = overlay(vUv); }`,
    depthTest: false,
    depthWrite: false,
    transparent: true,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.SrcAlphaFactor,
    blendSrcAlpha: THREE.ZeroFactor,
    blendDstAlpha: THREE.OneFactor,
  });
  const mesh = new THREE.Mesh(fullscreenGeo(), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1000;
  return mesh;
};
