import * as THREE from "three";

// Soft round glowing dots (stars, plexus nodes, orbit-arc beads, sparks).
// Size is a fraction of frame height, or world units when worldSize is set.
// `float dotMod(vec4 p)` shapes per-dot intensity (twinkle etc).

export type Dot = {
  p: [number, number, number];
  color: THREE.Color;
  intensity: number;
  size: number;
  param?: [number, number, number, number];
};

export type DotOptions = {
  worldSize?: boolean;
  dotMod?: string;
  uniforms?: Record<string, THREE.IUniform>;
  minPx?: number;
  // Profile: 0 = crisp disc with soft edge, 1 = gaussian.
  softness?: number;
  depthTest?: boolean;
  fog?: number;
};

const VERT = /* glsl */ `
uniform float uResY;
uniform float uMinPx;
in vec4 aColor;
in float aSize;
in vec4 aParam;
out vec4 vColor;
out vec4 vParam;
out float vFade;
out float vViewZ;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
#ifdef WORLD_SIZE
  float px = aSize * projectionMatrix[1][1] * 0.5 * uResY / gl_Position.w;
#else
  float px = aSize * uResY;
#endif
  float fade = 1.0;
  if (px < uMinPx) {
    fade = (px * px) / (uMinPx * uMinPx);
    px = uMinPx;
  }
  gl_PointSize = px * 2.0;
  vColor = aColor;
  vParam = aParam;
  vFade = fade;
  vViewZ = -mv.z;
}
`;

const FRAG = (dotMod: string) => /* glsl */ `
uniform float uSoft;
uniform float uFog;
in vec4 vColor;
in vec4 vParam;
in float vFade;
in float vViewZ;
${dotMod}
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float r = length(q);
  if (r > 1.0) discard;
  float disc = smoothstep(1.0, 0.45, r);
  float g = exp(-r * r * 5.0);
  float prof = mix(disc, g, uSoft);
  float k = prof * vColor.a * vFade * dotMod(vParam) * exp(-vViewZ * uFog);
  gl_FragColor = vec4(vColor.rgb * k, 1.0);
}
`;

export const makeDots = (dots: Dot[], opts: DotOptions = {}) => {
  const n = dots.length;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 4);
  const size = new Float32Array(n);
  const par = new Float32Array(n * 4);
  dots.forEach((d, i) => {
    pos.set(d.p, i * 3);
    col.set([d.color.r, d.color.g, d.color.b, d.intensity], i * 4);
    size[i] = d.size;
    par.set(d.param ?? [0, 0, 0, 0], i * 4);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aColor", new THREE.BufferAttribute(col, 4));
  g.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
  g.setAttribute("aParam", new THREE.BufferAttribute(par, 4));
  const m = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG(opts.dotMod ?? "float dotMod(vec4 p) { return 1.0; }"),
    defines: opts.worldSize ? { WORLD_SIZE: "" } : {},
    uniforms: {
      uResY: { value: 1080 },
      uMinPx: { value: opts.minPx ?? 1.0 },
      uSoft: { value: opts.softness ?? 0.5 },
      uFog: { value: opts.fog ?? 0 },
      ...(opts.uniforms ?? {}),
    },
    transparent: true,
    depthWrite: false,
    depthTest: opts.depthTest ?? true,
    blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  pts.onBeforeRender = (renderer) => {
    const t = renderer.getRenderTarget();
    m.uniforms.uResY.value = t ? t.height : renderer.getDrawingBufferSize(new THREE.Vector2()).y;
  };
  return pts;
};
