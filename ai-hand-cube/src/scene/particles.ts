// ~300 tiny specks drifting up from the palm. Paths are seeded once; the
// position at any time is a closed-form function of t in the vertex shader.
// Each particle's cycle length divides 20 s, so the motion loops exactly over
// the 20 s loop compositions.
import * as THREE from "three";
import { COC } from "../post/shaders";
import { mulberry32 } from "../lib/random";

const COUNT = 300;
const PERIODS = [4, 5, 10 / 3, 20 / 7, 2.5]; // seconds; 20 / p is an integer

export type ParticleRig = {
  points: THREE.Points;
  material: THREE.ShaderMaterial;
};

export const buildParticles = (color: string): ParticleRig => {
  const rng = mulberry32(0x9a77);
  const pos = new Float32Array(COUNT * 3);
  const a = new Float32Array(COUNT * 4); // x0, z0, phase, period
  const b = new Float32Array(COUNT * 4); // height, size, wobble freq (cycles/20s), wobble phase
  for (let i = 0; i < COUNT; i++) {
    const r = Math.sqrt(rng()) * 0.55;
    const ang = rng() * Math.PI * 2;
    a[i * 4] = Math.cos(ang) * r;
    a[i * 4 + 1] = Math.sin(ang) * r * 0.8;
    a[i * 4 + 2] = rng();
    a[i * 4 + 3] = PERIODS[Math.floor(rng() * PERIODS.length)];
    b[i * 4] = 0.5 + rng() * 0.9;
    b[i * 4 + 1] = 0.6 + rng() * 1.1;
    b[i * 4 + 2] = 1 + Math.floor(rng() * 3);
    b[i * 4 + 3] = rng() * Math.PI * 2;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aA", new THREE.BufferAttribute(a, 4));
  g.setAttribute("aB", new THREE.BufferAttribute(b, 4));
  const material = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uStart: { value: -1000 },
      uAmount: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uOrigin: { value: new THREE.Vector3() },
      uBasePx: { value: 2 },
      uFocus: { value: 4 },
      uNearK: { value: 0.03 },
      uFarK: { value: 0.01 },
      uMaxCoc: { value: 0.012 },
      uHeightPx: { value: 720 },
      uFocusBand: { value: 0 },
    },
    vertexShader: /* glsl */ `
      ${COC}
      in vec4 aA;
      in vec4 aB;
      uniform float uTime;
      uniform float uStart;
      uniform vec3 uOrigin;
      uniform float uBasePx;
      out float vAlpha;
      out float vSharp;
      void main() {
        float period = aA.w;
        float life = fract(aA.z + uTime / period);
        float born = uTime - life * period;
        float alive = step(uStart, born);
        float y = life * aB.x;
        float w = 6.2831853 * (aB.z * uTime / 20.0) + aB.w;
        vec3 p = uOrigin + vec3(aA.x * (1.0 + life * 0.6) + 0.04 * sin(w), y, aA.y * (1.0 + life * 0.6) + 0.04 * cos(w));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float z = -mv.z;
        float coc = cocPx(z);
        float base = uBasePx * aB.y * (uHeightPx / 2160.0) * 2.2;
        float size = max(base, 2.0 * coc);
        gl_PointSize = size;
        // energy-preserving: bigger (blurred) discs get dimmer
        vAlpha = alive * sin(3.14159265 * life) * min(1.0, (base * base) / (size * size) * 1.5 + 0.08);
        vSharp = clamp(base / size, 0.15, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform vec3 uColor;
      uniform float uAmount;
      in float vAlpha;
      in float vSharp;
      out vec4 outColor;
      void main() {
        float r = length(gl_PointCoord - 0.5) * 2.0;
        float disc = 1.0 - smoothstep(1.0 - 0.6 * vSharp - 0.2, 1.0, r);
        outColor = vec4(uColor * disc * vAlpha * uAmount * 2.4, 1.0);
      }`,
  });
  const points = new THREE.Points(g, material);
  points.frustumCulled = false;
  return { points, material };
};
