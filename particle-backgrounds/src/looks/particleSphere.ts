import * as THREE from "three";
import { DOF_GLSL, SPRITE_FS_GLSL } from "../gl/glsl";
import type { Look } from "../gl/Stage";
import { additive, dofUniforms, vec3Of } from "../gl/util";
import { gauss, mulberry32 } from "../lib/random";
import { loopPhase } from "../lib/timing";

export type SphereColors = { particles: string; glow: string; background: string };

/** Particle counts (see README for measured timings). */
export const SPHERE_SHELL_COUNT = 80000;
export const SPHERE_DUST_COUNT = 9000;

const FOV = 40;
// Sphere radius 1. Camera distance chosen so the diameter fills ~90% of frame height.
const CAM_D = 1 / Math.sin(Math.atan(0.9 * Math.tan(THREE.MathUtils.degToRad(FOV / 2))));

// ---- geometry: built once at module level from fixed seeds -----------------
const buildShell = () => {
  const rnd = mulberry32(0x5f3e11);
  const n = SPHERE_SHELL_COUNT;
  const dir = new Float32Array(n * 3);
  const a = new Float32Array(n * 4); // radius offset, size, brightness, shimmer phase
  for (let i = 0; i < n; i++) {
    const z = rnd() * 2 - 1;
    const t = rnd() * Math.PI * 2;
    const s = Math.sqrt(1 - z * z);
    dir[i * 3] = s * Math.cos(t);
    dir[i * 3 + 1] = z;
    dir[i * 3 + 2] = s * Math.sin(t);
    const halo = rnd() < 0.12;
    a[i * 4] = halo ? Math.abs(gauss(rnd)) * 0.07 : gauss(rnd) * 0.008;
    a[i * 4 + 1] = 2.2 + Math.pow(rnd(), 3) * 5.5;
    a[i * 4 + 2] = 0.35 + rnd() * 0.9 + (rnd() < 0.04 ? 1.5 : 0);
    a[i * 4 + 3] = rnd();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(dir, 3));
  g.setAttribute("aData", new THREE.BufferAttribute(a, 4));
  return g;
};

const buildDust = () => {
  const rnd = mulberry32(0xd057);
  const n = SPHERE_DUST_COUNT;
  const p = new Float32Array(n * 3);
  const a = new Float32Array(n * 4); // size, brightness, phase, orbit radius
  for (let i = 0; i < n; i++) {
    p[i * 3] = (rnd() * 2 - 1) * 7.5;
    p[i * 3 + 1] = (rnd() * 2 - 1) * 4.2;
    p[i * 3 + 2] = -7 + rnd() * (CAM_D - 0.6 + 7);
    a[i * 4] = 2.5 + Math.pow(rnd(), 4) * 8;
    a[i * 4 + 1] = 0.3 + rnd() * 1.1;
    a[i * 4 + 2] = rnd();
    a[i * 4 + 3] = 0.04 + rnd() * 0.16;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(p, 3));
  g.setAttribute("aData", new THREE.BufferAttribute(a, 4));
  return g;
};

const SHELL_GEO = buildShell();
const DUST_GEO = buildDust();

const SHELL_VS = /* glsl */ `
precision highp float;
${DOF_GLSL}
uniform float uPhase;   // loop phase 0..1
uniform vec3 uColor;
in vec3 position;       // unit direction
in vec4 aData;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
out vec3 vColor;
out float vPx;
const float TAU = 6.28318530718;
void main() {
  // Exactly one full turn per loop.
  float ang = TAU * uPhase;
  float c = cos(ang), s = sin(ang);
  vec3 d = vec3(c * position.x + s * position.z, position.y, -s * position.x + c * position.z);
  // Breathing: 2 cycles per loop; per-particle shimmer: 3 cycles per loop.
  float breathe = 1.0 + 0.009 * sin(TAU * 2.0 * uPhase);
  float shimmer = 0.004 * sin(TAU * (3.0 * uPhase + aData.w));
  vec3 p = d * (1.0 + aData.x + shimmer) * breathe;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float depth = -mv.z;
  // Rim: brightest where the shell is seen edge-on (two bright arcs).
  vec3 toCam = normalize(-mv.xyz);
  vec3 nView = normalize((modelViewMatrix * vec4(d, 0.0)).xyz);
  float rim = 1.0 - abs(dot(nView, toCam));
  // Weight the silhouette towards the left/right sides so it reads as two arcs.
  float side = 0.06 + 0.94 * pow(abs(nView.x), 3.0);
  float bright = aData.z * mix(0.07, 0.035, rim * (1.0 - side)) + aData.z * 1.7 * pow(rim, 5.0) * side;
  float twinkle = 0.75 + 0.25 * sin(TAU * (4.0 * uPhase + aData.w * 7.0));
  vec2 sp = dofSprite(aData.y, depth);
  gl_PointSize = sp.x;
  vPx = sp.x;
  // the brightest rim particles run slightly hotter (towards white)
  vec3 col = mix(uColor, vec3(1.0), 0.35 * pow(rim, 6.0) * side);
  vColor = col * bright * twinkle * sp.y;
  gl_Position = projectionMatrix * mv;
}`;

const DUST_VS = /* glsl */ `
precision highp float;
${DOF_GLSL}
uniform float uPhase;
uniform vec3 uColor;
in vec3 position;
in vec4 aData;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
out vec3 vColor;
out float vPx;
const float TAU = 6.28318530718;
void main() {
  // Closed drift orbit: one cycle per loop.
  float ph = TAU * (uPhase + aData.z);
  vec3 p = position + aData.w * vec3(sin(ph), cos(ph) * 0.6, sin(ph * 2.0) * 0.5);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float depth = -mv.z;
  vec2 sp = dofSprite(aData.x, depth);
  gl_PointSize = sp.x;
  vPx = sp.x;
  float twinkle = 0.7 + 0.3 * sin(TAU * (2.0 * uPhase + aData.z * 5.0));
  vColor = uColor * aData.y * twinkle * sp.y;
  gl_Position = projectionMatrix * mv;
}`;

const SPRITE_FS = /* glsl */ `
precision highp float;
${SPRITE_FS_GLSL}
in vec3 vColor;
in float vPx;
out vec4 outColor;
void main() {
  float m = spriteMask(gl_PointCoord, vPx);
  if (m <= 0.0) discard;
  outColor = vec4(vColor * m, 1.0);
}`;

export const createParticleSphere = (colors: SphereColors) => (): Look => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.05, 100);
  camera.position.set(0, 0, CAM_D);
  camera.lookAt(0, 0, 0);

  const pc = vec3Of(colors.particles);
  const shellMat = new THREE.RawShaderMaterial({
    ...additive,
    vertexShader: SHELL_VS,
    fragmentShader: SPRITE_FS,
    uniforms: { ...dofUniforms(FOV, CAM_D, 10), uColor: { value: pc } },
  });
  const dustMat = new THREE.RawShaderMaterial({
    ...additive,
    vertexShader: DUST_VS,
    fragmentShader: SPRITE_FS,
    uniforms: { ...dofUniforms(FOV, CAM_D, 34), uColor: { value: pc.clone().multiplyScalar(0.9) } },
  });
  const shell = new THREE.Points(SHELL_GEO, shellMat);
  const dust = new THREE.Points(DUST_GEO, dustMat);
  shell.frustumCulled = false;
  dust.frustumCulled = false;
  scene.add(dust, shell);

  const bgUniforms = {
    uBg: { value: vec3Of(colors.background) },
    uGlow: { value: vec3Of(colors.glow) },
    uAspect: { value: 16 / 9 },
    uGlowAmt: { value: 1 },
  };

  return {
    scene,
    camera,
    post: {
      bloomStrength: 0.55,
      bloomRadius: 0.85,
      grain: 0.02,
      backgroundUniformsGLSL: `uniform vec3 uBg; uniform vec3 uGlow; uniform float uAspect; uniform float uGlowAmt;`,
      backgroundUniforms: bgUniforms,
      backgroundGLSL: /* glsl */ `
vec3 background(vec2 uv) {
  vec2 p = (uv - 0.5) * vec2(uAspect, 1.0);
  float r2 = dot(p, p);
  // Light behind the centre: tight core + wide halo + faint horizontal streak.
  float core = exp(-r2 / 0.012);
  float halo = exp(-r2 / 0.10);
  float wide = exp(-r2 / 0.55);
  float streak = exp(-p.y * p.y / 0.0009) * exp(-p.x * p.x / 0.35);
  float g = (0.42 * core + 0.30 * halo + 0.12 * wide + 0.14 * streak) * uGlowAmt;
  vec3 col = uBg * (1.0 - 0.35 * smoothstep(0.3, 1.1, length(p)));
  col += uGlow * g + uGlow * core * 0.25;
  return col;
}`,
    },
    update: ({ frame, height }) => {
      const ph = loopPhase(frame);
      for (const m of [shellMat, dustMat]) {
        m.uniforms.uPhase.value = ph;
        m.uniforms.uPxScale.value = height / 2160;
      }
      // Glow breathes with the shell (2 cycles per loop).
      bgUniforms.uGlowAmt.value = 1 + 0.06 * Math.sin(Math.PI * 2 * 2 * ph);
      bgUniforms.uAspect.value = camera.aspect;
    },
    dispose: () => {
      shellMat.dispose();
      dustMat.dispose();
    },
  };
};
