import * as THREE from "three";
import { mulberry32, Rng } from "./random";

/**
 * Bokeh: out-of-focus lights as soft discs (slightly brighter rim). Sizes are
 * authored in px at 2160p and scaled by uPxScale. Motion is a closed path:
 * offset = amp · sin(2π·k·frame/period + phase) with integer k, so loops close.
 */
const VERT = /* glsl */ `
in vec3 aColor; in float aSize; in vec4 aMotion; // (ampX, ampY, k, phase)
uniform float uPxScale; uniform float uPhase; uniform float uGain;
out vec3 vColor;
void main() {
  vec3 p = position;
  float a = 6.2831853 * aMotion.z * uPhase + aMotion.w;
  p.x += aMotion.x * sin(a);
  p.y += aMotion.y * cos(a);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uPxScale;
  vColor = aColor * uGain;
}
`;
const FRAG = /* glsl */ `
precision highp float;
in vec3 vColor; out vec4 fragColor;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float d = length(q);
  float disc = 1.0 - smoothstep(0.6, 1.0, d);
  float rim = 0.85 + 0.2 * smoothstep(0.4, 0.85, d);
  fragColor = vec4(vColor * disc * rim, 1.0);
}
`;

export type BokehSpec = { x: number; y: number; z: number; size: number; color: THREE.Color; gain: number };

export const makeBokeh = (specs: BokehSpec[], rngSeed: number) => {
  const rng: Rng = mulberry32(rngSeed);
  const n = specs.length;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const size = new Float32Array(n);
  const motion = new Float32Array(n * 4);
  specs.forEach((s, i) => {
    pos.set([s.x, s.y, s.z], i * 3);
    col.set([s.color.r * s.gain, s.color.g * s.gain, s.color.b * s.gain], i * 3);
    size[i] = s.size;
    motion.set([0.05 + rng() * 0.15, 0.03 + rng() * 0.1, 1 + Math.floor(rng() * 2), rng() * 6.283], i * 4);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
  geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
  geo.setAttribute("aMotion", new THREE.BufferAttribute(motion, 4));
  const mat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: { uPxScale: { value: 1 }, uPhase: { value: 0 }, uGain: { value: 1 } },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
};
