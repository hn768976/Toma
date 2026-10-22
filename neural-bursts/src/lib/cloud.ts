import * as THREE from "three";
import { additive, DOF_CHUNK, POINT_FRAG } from "./glsl";
import { range, Rng } from "./math";

// Generic animated point cloud: glow sprites / glossy beads / bokeh discs.
// Supports a radial "burst" expansion, twinkle, slow drift and depth of field.

export const CLOUD_VERT = /* glsl */ `
attribute vec3 aColor;
attribute float aSize;
attribute vec4 aSeed; // x: twinkle phase, y: twinkle speed, z: burst speed, w: alpha
uniform float uTime;
uniform float uBurstT;
uniform float uBurstDur;
uniform float uScale;
uniform float uOpacity;
uniform float uWorld;
uniform float uProjScale;
uniform float uKind;
uniform float uTwinkle;
uniform float uNearFade;
uniform float uMaxSize;
uniform float uDrift;
varying vec3 vColor;
varying float vAlpha;
varying float vKind;
varying float vBlur;
${DOF_CHUNK}
void main() {
  float p = uBurstDur > 0.0
    ? 1.0 - pow(1.0 - clamp(uBurstT * aSeed.z / uBurstDur, 0.0, 1.0), 3.0)
    : 1.0;
  vec3 drift = vec3(
    sin(uTime * aSeed.y * 0.21 + aSeed.x),
    cos(uTime * aSeed.y * 0.17 + aSeed.x * 1.7),
    sin(uTime * aSeed.y * 0.13 + aSeed.x * 2.3)) * uDrift;
  vec4 mv = modelViewMatrix * vec4(position * p * uScale + drift, 1.0);
  float depth = -mv.z;
  float tw = 0.5 + 0.5 * sin(uTime * aSeed.y + aSeed.x);
  float a = uOpacity * aSeed.w * (1.0 - uTwinkle + uTwinkle * tw);
  a *= smoothstep(uNearFade * 0.25, uNearFade, depth);
  float size = uWorld > 0.5 ? aSize * uProjScale / max(depth, 0.01) / uPx : aSize;
  size = min(size, uMaxSize);
  float blur;
  applyPointSize(size, depth, a, blur);
  vColor = aColor;
  vAlpha = a;
  vKind = uKind;
  vBlur = blur;
  gl_Position = projectionMatrix * mv;
  if (depth < 0.02 || a < 0.002) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`;


export type CloudUniforms = {
  uTime: THREE.IUniform<number>;
  uBurstT: THREE.IUniform<number>;
  uBurstDur: THREE.IUniform<number>;
  uScale: THREE.IUniform<number>;
  uOpacity: THREE.IUniform<number>;
  uWorld: THREE.IUniform<number>;
  uProjScale: THREE.IUniform<number>;
  uKind: THREE.IUniform<number>;
  uTwinkle: THREE.IUniform<number>;
  uNearFade: THREE.IUniform<number>;
  uMaxSize: THREE.IUniform<number>;
  uDrift: THREE.IUniform<number>;
  uPx: THREE.IUniform<number>;
  uFocus: THREE.IUniform<number>;
  uAperture: THREE.IUniform<number>;
  uMaxCoc: THREE.IUniform<number>;
};

export type PointSpec = {
  pos: [number, number, number];
  color: [number, number, number];
  size: number;
  seed: [number, number, number, number];
};

export const makeCloud = (
  points: PointSpec[],
  px: number,
  opts: { world?: boolean; kind?: number; twinkle?: number; maxSize?: number },
) => {
  const n = points.length;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const size = new Float32Array(n);
  const seed = new Float32Array(n * 4);
  points.forEach((p, i) => {
    pos.set(p.pos, i * 3);
    col.set(p.color, i * 3);
    size[i] = p.size;
    seed.set(p.seed, i * 4);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
  g.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
  g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 4));
  const uniforms: CloudUniforms = {
    uTime: { value: 0 },
    uBurstT: { value: 1 },
    uBurstDur: { value: 0 },
    uScale: { value: 1 },
    uOpacity: { value: 1 },
    uWorld: { value: opts.world ? 1 : 0 },
    uProjScale: { value: 1 },
    uKind: { value: opts.kind ?? 0 },
    uTwinkle: { value: opts.twinkle ?? 0 },
    uNearFade: { value: 0.4 },
    uMaxSize: { value: opts.maxSize ?? 90 },
    uDrift: { value: 0 },
    uPx: { value: px },
    uFocus: { value: 10 },
    uAperture: { value: 0 },
    uMaxCoc: { value: 60 },
  };
  const m = new THREE.ShaderMaterial({
    vertexShader: CLOUD_VERT,
    fragmentShader: POINT_FRAG,
    uniforms,
    ...additive,
  });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  return { object: pts, u: uniforms };
};

/** Random twinkle seed: phase, speed, burst speed, alpha. */
export const tw = (rng: Rng, alpha = 1, speed = 1): [number, number, number, number] => [
  rng() * Math.PI * 2,
  range(rng, 1.5, 5),
  speed,
  alpha,
];

