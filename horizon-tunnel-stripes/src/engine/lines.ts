import * as THREE from "three";

// Instanced thick lines. Each segment is a camera-facing quad expanded in
// screen space, so lines stay smooth at any resolution. Width is either in
// world units (shrinks with distance, used for tunnel bars and floor lines)
// or a fraction of frame height (constant on screen, used for rays/plexus).
// A per-look GLSL snippet `float lineMod(float u, vec4 p)` shapes intensity
// along the segment (u = 0..1, perspective-correct) for dashes, heads, etc.

export type Seg = {
  a: [number, number, number];
  b: [number, number, number];
  color: THREE.Color; // linear
  intensity: number;
  widthA: number;
  widthB?: number;
  param?: [number, number, number, number];
};

export type LineOptions = {
  worldWidth: boolean;
  // 0 = hard anti-aliased bar, 1 = gaussian falloff.
  softness?: number;
  // Quad is extended to feather * halfWidth (for soft lines).
  feather?: number;
  // Minimum on-screen half width in px; thinner lines are widened and dimmed.
  minHalfPx?: number;
  // Fade with view distance: intensity *= exp(-z * fog).
  fog?: number;
  lineMod?: string;
  uniforms?: Record<string, THREE.IUniform>;
  depthTest?: boolean;
  blending?: THREE.Blending;
  // Depth of field done per line: out-of-focus segments get wider and
  // dimmer by the same factor (energy preserving) and turn gaussian.
  dof?: { focus: number; range: number; maxBlur: number; nearOnly?: boolean };
};

const VERT = /* glsl */ `
uniform vec2 uRes;
uniform float uNear;
uniform float uMinHalfPx;
uniform float uFeather;
uniform vec4 uDof; // focus, range, max blur (fraction of height), nearOnly
in vec3 iA;
in vec3 iB;
in vec4 iColor;
in vec4 iParam;
in vec2 iWidth;
out float vAcrossPx;
out float vHalfPx;
out float vU;
out vec4 vColor;
out vec4 vParam;
out float vFade;
out float vViewZ;
out float vSoftExtra;
void main() {
  vec4 va = modelViewMatrix * vec4(iA, 1.0);
  vec4 vb = modelViewMatrix * vec4(iB, 1.0);
  float ua = 0.0;
  float ub = 1.0;
  float zn = -uNear * 1.001;
  if (va.z > zn && vb.z > zn) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  if (va.z > zn) {
    float t = (zn - va.z) / (vb.z - va.z);
    va = mix(va, vb, t);
    ua = t;
  } else if (vb.z > zn) {
    float t = (zn - vb.z) / (va.z - vb.z);
    vb = mix(vb, va, t);
    ub = 1.0 - t;
  }
  vec4 ca = projectionMatrix * va;
  vec4 cb = projectionMatrix * vb;
  vec2 sa = ca.xy / ca.w * 0.5 * uRes;
  vec2 sb = cb.xy / cb.w * 0.5 * uRes;
  vec2 dir = sb - sa;
  float len = length(dir);
  dir = len > 1e-4 ? dir / len : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  float side = position.x;
  float wA = iWidth.x;
  float wB = iWidth.y;
#ifdef WORLD_WIDTH
  float pxA = 0.5 * wA * projectionMatrix[1][1] * 0.5 * uRes.y / ca.w;
  float pxB = 0.5 * wB * projectionMatrix[1][1] * 0.5 * uRes.y / cb.w;
#else
  float pxA = 0.5 * wA * uRes.y;
  float pxB = 0.5 * wB * uRes.y;
#endif
  float halfPx = mix(pxA, pxB, side);
  float fade = 1.0;
  vSoftExtra = 0.0;
  if (uDof.z > 0.0) {
    float z = -(side < 0.5 ? va.z : vb.z);
    float sd = (z - uDof.x) / uDof.y;
    if (sd > 0.0 && uDof.w > 0.5) sd = 0.0;
    float coc = clamp(abs(sd), 0.0, 1.0) * uDof.z * uRes.y;
    float nh = sqrt(halfPx * halfPx + coc * coc);
    fade *= halfPx / nh;
    vSoftExtra = coc / nh;
    halfPx = nh;
  }
  if (halfPx < uMinHalfPx) {
    fade = halfPx / uMinHalfPx;
    halfPx = uMinHalfPx;
  }
  float ext = halfPx * uFeather + 1.0;
  vec4 c = side < 0.5 ? ca : cb;
  vec2 off = nrm * position.y * ext;
  c.xy += off / (0.5 * uRes) * c.w;
  gl_Position = c;
  vAcrossPx = position.y * ext;
  vHalfPx = halfPx;
  vU = mix(ua, ub, side);
  vColor = iColor;
  vParam = iParam;
  vFade = fade;
  vViewZ = -(side < 0.5 ? va.z : vb.z);
}
`;

const FRAG = (lineMod: string) => /* glsl */ `
uniform float uSoft;
uniform float uFog;
in float vAcrossPx;
in float vHalfPx;
in float vU;
in vec4 vColor;
in vec4 vParam;
in float vFade;
in float vViewZ;
in float vSoftExtra;
${lineMod}
void main() {
  float d = abs(vAcrossPx);
  float hard = clamp(vHalfPx - d + 0.5, 0.0, 1.0);
  float x = d / max(vHalfPx, 1e-3);
  float soft = exp(-x * x * 2.2);
  float prof = mix(hard, soft, max(uSoft, vSoftExtra));
  float m = lineMod(vU, vParam);
  float k = prof * m * vFade * vColor.a * exp(-vViewZ * uFog);
  gl_FragColor = vec4(vColor.rgb * k, 1.0);
}
`;

const DEFAULT_MOD = /* glsl */ `float lineMod(float u, vec4 p) { return 1.0; }`;

export const makeLines = (segs: Seg[], opts: LineOptions) => {
  const base = new THREE.InstancedBufferGeometry();
  base.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([0, -1, 0, 1, -1, 0, 0, 1, 0, 1, 1, 0], 3),
  );
  base.setIndex([0, 1, 2, 2, 1, 3]);
  const n = segs.length;
  const A = new Float32Array(n * 3);
  const B = new Float32Array(n * 3);
  const C = new Float32Array(n * 4);
  const P = new Float32Array(n * 4);
  const W = new Float32Array(n * 2);
  segs.forEach((s, i) => {
    A.set(s.a, i * 3);
    B.set(s.b, i * 3);
    C.set([s.color.r, s.color.g, s.color.b, s.intensity], i * 4);
    P.set(s.param ?? [0, 0, 0, 0], i * 4);
    W.set([s.widthA, s.widthB ?? s.widthA], i * 2);
  });
  base.setAttribute("iA", new THREE.InstancedBufferAttribute(A, 3));
  base.setAttribute("iB", new THREE.InstancedBufferAttribute(B, 3));
  base.setAttribute("iColor", new THREE.InstancedBufferAttribute(C, 4));
  base.setAttribute("iParam", new THREE.InstancedBufferAttribute(P, 4));
  base.setAttribute("iWidth", new THREE.InstancedBufferAttribute(W, 2));
  base.instanceCount = n;

  const softness = opts.softness ?? 0;
  const material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG(opts.lineMod ?? DEFAULT_MOD),
    defines: opts.worldWidth ? { WORLD_WIDTH: "" } : {},
    uniforms: {
      uRes: { value: new THREE.Vector2(1920, 1080) },
      uNear: { value: 0.1 },
      uMinHalfPx: { value: opts.minHalfPx ?? 0.6 },
      uFeather: { value: opts.feather ?? (softness > 0 || opts.dof ? 1.8 : 1.0) },
      uSoft: { value: softness },
      uFog: { value: opts.fog ?? 0 },
      uDof: {
        value: opts.dof
          ? new THREE.Vector4(opts.dof.focus, opts.dof.range, opts.dof.maxBlur, opts.dof.nearOnly ? 1 : 0)
          : new THREE.Vector4(0, 1, 0, 0),
      },
      ...(opts.uniforms ?? {}),
    },
    transparent: true,
    depthWrite: false,
    depthTest: opts.depthTest ?? true,
    blending: opts.blending ?? THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(base, material);
  mesh.frustumCulled = false;
  // Keep resolution and near plane in sync with whatever renders this.
  mesh.onBeforeRender = (renderer, _scene, camera) => {
    const v = renderer.getDrawingBufferSize(new THREE.Vector2());
    const target = renderer.getRenderTarget();
    if (target) v.set(target.width, target.height);
    material.uniforms.uRes.value.copy(v);
    material.uniforms.uNear.value = (camera as THREE.PerspectiveCamera).near ?? 0.1;
  };
  return mesh;
};
