import * as THREE from "three";

// Screen-space ribbons: every segment is an instanced quad whose width is
// given in 4K composition pixels and scaled to the actual drawing buffer,
// so line weight is identical at 720p, 4K and 6000px stills. Sub-pixel
// widths are clamped to 1px and compensated through alpha (no shimmer).

export const RIBBON_CHUNK = /* glsl */ `
uniform vec2 uRes;
uniform float uPxScale;
vec4 ribbon(vec4 ca, vec4 cb, float t, float side, float widthPx, out float alphaScale, out float halfW) {
  float near = 0.01;
  if (ca.w < near && cb.w < near) { alphaScale = 0.0; halfW = 1.0; return vec4(2.0, 2.0, 2.0, 1.0); }
  if (ca.w < near) ca = mix(ca, cb, (near - ca.w) / (cb.w - ca.w));
  if (cb.w < near) cb = mix(cb, ca, (near - cb.w) / (ca.w - cb.w));
  vec2 sa = ca.xy / ca.w * uRes * 0.5;
  vec2 sb = cb.xy / cb.w * uRes * 0.5;
  vec2 d = sb - sa;
  float L = length(d);
  d = L > 1e-4 ? d / L : vec2(1.0, 0.0);
  vec2 n = vec2(-d.y, d.x);
  float w = widthPx * uPxScale;
  alphaScale = clamp(w, 0.0, 1.0);
  w = max(w, 1.0);
  halfW = w * 0.5 + 0.75;
  vec4 c = mix(ca, cb, t);
  vec2 s = c.xy / c.w * uRes * 0.5 + n * side * halfW + d * (t * 2.0 - 1.0) * 0.75;
  return vec4(s / (uRes * 0.5) * c.w, c.z, c.w);
}
`;

const SEG_VERT = /* glsl */ `
${RIBBON_CHUNK}
in vec3 position;
in vec3 aA; in vec3 aB; in vec4 aCA; in vec4 aCB;
uniform mat4 modelViewMatrix; uniform mat4 projectionMatrix;
uniform float uWidth;
uniform vec3 uFadeCenter; uniform float uFacing; // optional globe back-face dimming
uniform vec3 uDof; // focus distance, range, max blur (4K px); x<=0 disables
out vec4 vCol; out float vSide; out float vHalfW; out float vCore;
void main(){
  vec4 ma = modelViewMatrix * vec4(aA, 1.0);
  vec4 mb = modelViewMatrix * vec4(aB, 1.0);
  vec4 ca = projectionMatrix * ma;
  vec4 cb = projectionMatrix * mb;
  float blur = 0.0;
  if (uDof.x > 0.0) {
    float z = -mix(ma.z, mb.z, position.x);
    blur = clamp(abs(z - uDof.x) / uDof.y, 0.0, 1.0) * uDof.z;
  }
  float as, hw;
  gl_Position = ribbon(ca, cb, position.x, position.y, uWidth + blur, as, hw);
  as *= uWidth / (uWidth + blur);
  vCore = uWidth / (uWidth + blur);
  vec4 col = mix(aCA, aCB, position.x);
  if (uFacing > 0.0) {
    vec3 p = (modelViewMatrix * vec4(mix(aA, aB, position.x), 1.0)).xyz;
    vec3 cc = (modelViewMatrix * vec4(uFadeCenter, 1.0)).xyz;
    float f = dot(normalize(p - cc), normalize(-p));
    col.a *= mix(uFacing, 1.0, smoothstep(-0.15, 0.2, f));
  }
  vCol = vec4(col.rgb, col.a * as);
  vSide = position.y; vHalfW = hw;
}`;

const SEG_FRAG = /* glsl */ `
precision highp float;
uniform float uOpacity;
in vec4 vCol; in float vSide; in float vHalfW; in float vCore; out vec4 o;
void main(){
  float px = abs(vSide) * vHalfW;
  float a = clamp(vHalfW - 0.75 - px + 0.5, 0.0, 1.0);
  if (vCore < 0.999) a *= mix(1.0 - smoothstep(0.0, 1.0, abs(vSide)), 1.0, vCore) * (2.0 - vCore);
  o = vec4(vCol.rgb * vCol.a * a * uOpacity, 1.0);
}`;

export const quadGeometry = () => {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, -1, 0, 1, 1, 0, 0, 1, 0], 3),
  );
  return g;
};

export type Seg = { a: THREE.Vector3Tuple; b: THREE.Vector3Tuple; ca: THREE.Vector4Tuple; cb?: THREE.Vector4Tuple };

export const ribbonUniforms = () => ({
  uRes: { value: new THREE.Vector2(1280, 720) },
  uPxScale: { value: 1 / 3 },
});

// Keep uRes / uPxScale in sync with the drawing buffer.
export const setRes = (mat: THREE.ShaderMaterial | THREE.RawShaderMaterial, w: number, h: number) => {
  if (mat.uniforms.uRes) mat.uniforms.uRes.value.set(w, h);
  if (mat.uniforms.uPxScale) mat.uniforms.uPxScale.value = h / 2160;
};

export const makeSegments = (
  segs: Seg[],
  opts: { width: number; opacity?: number; facing?: number; fadeCenter?: THREE.Vector3Tuple },
) => {
  const g = quadGeometry();
  const A = new Float32Array(segs.length * 3);
  const B = new Float32Array(segs.length * 3);
  const CA = new Float32Array(segs.length * 4);
  const CB = new Float32Array(segs.length * 4);
  segs.forEach((s, i) => {
    A.set(s.a, i * 3);
    B.set(s.b, i * 3);
    CA.set(s.ca, i * 4);
    CB.set(s.cb ?? s.ca, i * 4);
  });
  g.setAttribute("aA", new THREE.InstancedBufferAttribute(A, 3));
  g.setAttribute("aB", new THREE.InstancedBufferAttribute(B, 3));
  g.setAttribute("aCA", new THREE.InstancedBufferAttribute(CA, 4));
  g.setAttribute("aCB", new THREE.InstancedBufferAttribute(CB, 4));
  g.instanceCount = segs.length;
  const mat = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: SEG_VERT,
    fragmentShader: SEG_FRAG,
    uniforms: {
      ...ribbonUniforms(),
      uWidth: { value: opts.width },
      uOpacity: { value: opts.opacity ?? 1 },
      uFacing: { value: opts.facing ?? 0 },
      uFadeCenter: { value: new THREE.Vector3(...(opts.fadeCenter ?? [0, 0, 0])) },
      uDof: { value: new THREE.Vector3(0, 1, 0) },
    },
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  return mesh;
};

// Soft round points. Size in 4K composition pixels.
const PT_VERT = /* glsl */ `
in vec3 position; in vec4 aCol; in float aSize;
uniform mat4 modelViewMatrix; uniform mat4 projectionMatrix;
uniform float uPxScale; uniform float uSize; uniform float uFacing; uniform vec3 uFadeCenter;
uniform float uPerspective; uniform vec3 uDof;
out vec4 vCol; out float vSoftK;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float s = uSize * aSize * uPxScale;
  if (uPerspective > 0.0) s *= uPerspective / max(0.01, -mv.z);
  vSoftK = 0.0;
  if (uDof.x > 0.0) {
    float b = clamp(abs(-mv.z - uDof.x) / uDof.y, 0.0, 1.0) * uDof.z * uPxScale;
    float s2 = s + b;
    vSoftK = b / s2;
    s = s2;
    // energy roughly conserved
  }
  vec4 col = aCol;
  if (uFacing > 0.0) {
    vec3 cc = (modelViewMatrix * vec4(uFadeCenter, 1.0)).xyz;
    float f = dot(normalize(mv.xyz - cc), normalize(-mv.xyz));
    col.a *= mix(uFacing, 1.0, smoothstep(-0.15, 0.2, f));
  }
  col.a *= clamp(s / 1.5, 0.0, 1.0);
  col.a *= (1.0 - vSoftK) * (1.0 - vSoftK) + 0.04 * vSoftK;
  gl_PointSize = max(s, 1.5) + 1.0;
  vCol = col;
}`;
const PT_FRAG = /* glsl */ `
precision highp float;
uniform float uOpacity; uniform float uSoft;
in vec4 vCol; in float vSoftK; out vec4 o;
void main(){
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float a = 1.0 - smoothstep(1.0 - max(uSoft, vSoftK), 1.0, r);
  o = vec4(vCol.rgb * vCol.a * a * uOpacity, 1.0);
}`;

export const makePoints = (
  pos: Float32Array,
  col: Float32Array,
  size: Float32Array,
  opts: { size: number; soft?: number; facing?: number; perspective?: number; opacity?: number },
) => {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aCol", new THREE.BufferAttribute(col, 4));
  g.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
  const mat = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: PT_VERT,
    fragmentShader: PT_FRAG,
    uniforms: {
      ...ribbonUniforms(),
      uSize: { value: opts.size },
      uSoft: { value: opts.soft ?? 0.6 },
      uFacing: { value: opts.facing ?? 0 },
      uFadeCenter: { value: new THREE.Vector3() },
      uPerspective: { value: opts.perspective ?? 0 },
      uOpacity: { value: opts.opacity ?? 1 },
      uDof: { value: new THREE.Vector3(0, 1, 0) },
    },
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });
  const p = new THREE.Points(g, mat);
  p.frustumCulled = false;
  return p;
};

// Linear-space colour helper (hex sRGB -> linear rgb tuple * intensity).
export const lin = (hex: string, k = 1): [number, number, number] => {
  const c = new THREE.Color(hex);
  return [c.r * k, c.g * k, c.b * k];
};

// Walk a scene and keep all ribbon/point materials in sync with the buffer.
export const syncResolution = (root: THREE.Object3D, w: number, h: number) => {
  root.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.ShaderMaterial | undefined;
    if (m && (m as THREE.ShaderMaterial).uniforms) setRes(m as THREE.ShaderMaterial, w, h);
  });
};

// Set geometric depth-of-field on every ribbon/point material under root.
export const setDof = (root: THREE.Object3D, focus: number, range: number, maxBlurPx: number) => {
  root.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.ShaderMaterial | undefined;
    if (m && m.uniforms && m.uniforms.uDof) m.uniforms.uDof.value.set(focus, range, maxBlurPx);
  });
};

export const toLayer = (root: THREE.Object3D, layer: number) => root.traverse((o) => o.layers.set(layer));
