import * as THREE from "three";
import { DOF_GLSL, SPRITE_FS_GLSL } from "../gl/glsl";
import type { Look } from "../gl/Stage";
import { additive, dofUniforms, vec3Of } from "../gl/util";
import { mulberry32 } from "../lib/random";
import { loopPhase } from "../lib/timing";

export type WavesColors = {
  particles: string;
  crests: string;
  deep: string;
  skyTop: string;
  skyBottom: string;
  light: string;
};

/** Point counts (README has the measured timings). Total = 4*40k + 2*20k = 200k. */
export const WAVE_LAYERS = 4;
export const WAVE_SURFACE_PER_LAYER = 40000;
export const WAVE_CREST_LAYERS = 2;
export const WAVE_CREST_PER_LAYER = 20000;

const FOV = 40;
/** Field period along the travel direction; the camera glides exactly 1 period per loop. */
const L = 36;
const NEAR_KEEP = 2.5; // points kept this far behind the camera before they wrap
const X_HALF = 26;
const K = 6; // wave components per layer

type Wave = { a: number; kx: number; m: number; n: number; phi: number };

// ---- module-level, fixed-seed construction ---------------------------------
const buildLayerWaves = (layer: number): Wave[] => {
  const rnd = mulberry32(0x77a0 + layer * 131);
  const waves: Wave[] = [];
  for (let k = 0; k < K; k++) {
    // k=0,1: long swells; k>=2: smaller chop. m = integer cycles over L (spatially periodic),
    // n = integer cycles over the loop (a circle in time).
    const m = k < 3 ? 2 + Math.floor(rnd() * 4) : 5 + Math.floor(rnd() * 5) + k;
    const n = (rnd() < 0.5 ? -1 : 1) * (1 + Math.floor(rnd() * 2));
    waves.push({
      a: (k < 3 ? 0.5 : 0.5 / (k - 1.2)) * (0.75 + rnd() * 0.5),
      kx: (rnd() < 0.5 ? -1 : 1) * (k < 3 ? 0.18 + rnd() * 0.3 : 0.3 + rnd() * 0.5),
      m,
      n,
      phi: rnd() * Math.PI * 2,
    });
  }
  return waves;
};
const LAYER_WAVES = Array.from({ length: WAVE_LAYERS }, (_, i) => buildLayerWaves(i));

const buildPoints = (count: number, seed: number) => {
  const rnd = mulberry32(seed);
  const pos = new Float32Array(count * 3); // x, F (field coord along travel), unused
  const data = new Float32Array(count * 4); // size, brightness, twinkle phase, spare
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (rnd() * 2 - 1) * X_HALF;
    pos[i * 3 + 1] = rnd() * L;
    pos[i * 3 + 2] = 0;
    data[i * 4] = 2.2 + Math.pow(rnd(), 3) * 4.5;
    data[i * 4 + 1] = 0.3 + rnd() * 0.75 + (rnd() < 0.02 ? 1.4 : 0);
    data[i * 4 + 2] = rnd();
    data[i * 4 + 3] = rnd();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aData", new THREE.BufferAttribute(data, 4));
  return g;
};
const SURFACE_GEOS = Array.from({ length: WAVE_LAYERS }, (_, i) => buildPoints(WAVE_SURFACE_PER_LAYER, 0x1100 + i));
const CREST_GEOS = Array.from({ length: WAVE_CREST_LAYERS }, (_, i) => buildPoints(WAVE_CREST_PER_LAYER, 0x2200 + i));

const WAVES_GLSL = /* glsl */ `
const float TAU = 6.28318530718;
const float L = ${L.toFixed(4)};
uniform vec4 uWave[${K}];   // a, kx, m, n
uniform float uPhi[${K}];
uniform float uPhase;
uniform float uBaseY;

// h(x, F) and its first/second derivative along F. Every term is periodic in F
// (period L) and in time (whole cycles per loop): noise sampled on a time circle.
vec3 field(float x, float F) {
  float h = 0.0, d1 = 0.0, d2 = 0.0;
  // gentle domain warp so the crests are not straight
  float warp = 0.9 * sin(0.11 * x + TAU * (2.0 * F / L + uPhase));
  float dwarp = 0.9 * cos(0.11 * x + TAU * (2.0 * F / L + uPhase)) * TAU * 2.0 / L;
  for (int k = 0; k < ${K}; k++) {
    vec4 w = uWave[k];
    float kf = TAU * w.z / L;
    float arg = w.y * (x + warp * 3.0) + kf * F + TAU * w.w * uPhase + uPhi[k];
    float dargF = kf + w.y * 3.0 * dwarp;
    h += w.x * sin(arg);
    d1 += w.x * cos(arg) * dargF;
    d2 -= w.x * sin(arg) * dargF * dargF;
  }
  return vec3(h, d1, d2);
}
`;

const vs = (crest: boolean) => /* glsl */ `
precision highp float;
${DOF_GLSL}
${WAVES_GLSL}
uniform vec3 uColor;
uniform vec3 uCrestColor;
uniform float uCamF;
uniform float uBright;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
in vec3 position;
in vec4 aData;
out vec3 vColor;
out float vPx;

void main() {
  float x = position.x;
  float F = position.y;
  ${
    crest
      ? `// Crest points: walk to the nearest local maximum along F (Newton), so they
  // line up into thin bright ridge lines. Deterministic: fixed start, fixed steps.
  vec3 f = field(x, F);
  for (int i = 0; i < 5; i++) {
    if (f.z < -0.02) F -= clamp(f.y / f.z, -0.8, 0.8);
    else F += sign(f.y) * 0.5;
    f = field(x, F);
  }
  float onRidge = exp(-f.y * f.y / 0.004) * smoothstep(0.02, 0.35, -f.z);`
      : `vec3 f = field(x, F);
  // surface points close to a crest glow a little too
  float onRidge = exp(-f.y * f.y / 0.01) * smoothstep(0.0, 0.3, -f.z) * 0.6;`
  }
  // Wrap into the window around the camera; the camera moves exactly L per loop.
  float wr = mod(F - uCamF + ${NEAR_KEEP.toFixed(2)}, L) - ${NEAR_KEEP.toFixed(2)};
  vec3 p = vec3(x, uBaseY + f.x, -wr);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float depth = -mv.z;
  // in-focus size: fixed sprite size plus a small physical size (near particles are larger)
  vec2 sp = dofSprite(aData.x * (${crest ? "0.9" : "1.0"}) + 0.006 * uProj / depth, depth);
  gl_PointSize = sp.x;
  vPx = sp.x;
  float fog = smoothstep(L - ${NEAR_KEEP.toFixed(2)}, L * 0.55, wr) * smoothstep(-0.5, 0.8, wr);
  float distDim = 1.0 / (1.0 + depth * depth / 500.0);
  float tw = 0.75 + 0.25 * sin(TAU * (3.0 * uPhase + aData.z * 11.0));
  float b = aData.y * tw * fog * distDim * uBright;
  vec3 col = mix(uColor, uCrestColor, clamp(onRidge, 0.0, 1.0));
  b *= ${crest ? "onRidge * 1.6" : "(0.55 + 0.9 * onRidge)"};
  // a little lift with height: tops of the swell catch the light
  b *= 0.75 + 0.6 * smoothstep(-0.3, 0.5, f.x);
  vColor = col * b * sp.y;
  gl_Position = projectionMatrix * mv;
}`;

const FS = /* glsl */ `
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

export const createParticleWaves = (colors: WavesColors) => (): Look => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.05, 200);
  const cParticles = vec3Of(colors.particles);
  const cCrest = vec3Of(colors.crests);
  const cDeep = vec3Of(colors.deep);
  const materials: THREE.RawShaderMaterial[] = [];

  const layerUniforms = (layer: number, color: THREE.Vector3, crestColor: THREE.Vector3, bright: number) => ({
    ...dofUniforms(FOV, 9, 16, 140, 0.72),
    uWave: { value: LAYER_WAVES[layer].map((w) => new THREE.Vector4(w.a, w.kx, w.m, w.n)) },
    uPhi: { value: LAYER_WAVES[layer].map((w) => w.phi) },
    uBaseY: { value: -0.45 * layer },
    uColor: { value: color },
    uCrestColor: { value: crestColor },
    uCamF: { value: 0 },
    uBright: { value: bright },
  });

  for (let i = 0; i < WAVE_LAYERS; i++) {
    const t = i / (WAVE_LAYERS - 1);
    const col = cParticles.clone().lerp(cDeep, t);
    const crestCol = cCrest.clone().lerp(cParticles, t * 0.7);
    const m = new THREE.RawShaderMaterial({
      ...additive,
      vertexShader: vs(false),
      fragmentShader: FS,
      uniforms: layerUniforms(i, col, crestCol, 2.2 - 0.35 * i),
    });
    materials.push(m);
    const pts = new THREE.Points(SURFACE_GEOS[i], m);
    pts.frustumCulled = false;
    scene.add(pts);
  }
  for (let i = 0; i < WAVE_CREST_LAYERS; i++) {
    const m = new THREE.RawShaderMaterial({
      ...additive,
      vertexShader: vs(true),
      fragmentShader: FS,
      uniforms: layerUniforms(i, cParticles.clone(), cCrest.clone(), 1.3 - 0.4 * i),
    });
    materials.push(m);
    const pts = new THREE.Points(CREST_GEOS[i], m);
    pts.frustumCulled = false;
    scene.add(pts);
  }

  const bgUniforms = {
    uSkyTop: { value: vec3Of(colors.skyTop) },
    uSkyBottom: { value: vec3Of(colors.skyBottom) },
    uLight: { value: vec3Of(colors.light) },
    uAspect: { value: 16 / 9 },
  };

  return {
    scene,
    camera,
    post: {
      bloomStrength: 0.6,
      bloomRadius: 0.8,
      grain: 0.02,
      backgroundUniformsGLSL: `uniform vec3 uSkyTop; uniform vec3 uSkyBottom; uniform vec3 uLight; uniform float uAspect;`,
      backgroundUniforms: bgUniforms,
      backgroundGLSL: /* glsl */ `
vec3 background(vec2 uv) {
  float t = smoothstep(0.25, 1.0, uv.y);
  vec3 col = mix(uSkyBottom, uSkyTop, t);
  // Soft light in the upper left.
  vec2 p = (uv - vec2(0.06, 1.02)) * vec2(uAspect, 1.0);
  float d2 = dot(p, p);
  vec3 lc = mix(uLight, vec3(1.0), 0.35);
  col += lc * (0.5 * exp(-d2 / 0.035) + 0.2 * exp(-d2 / 0.3) + 0.06 * exp(-d2 / 1.4));
  // Darken the very bottom slightly (under the swell).
  col *= 0.75 + 0.25 * smoothstep(0.0, 0.4, uv.y);
  return col;
}`,
    },
    update: ({ frame, height }) => {
      const ph = loopPhase(frame);
      const camF = L * ph; // exactly one field period per loop
      for (const m of materials) {
        m.uniforms.uPhase.value = ph;
        m.uniforms.uCamF.value = camF;
        m.uniforms.uPxScale.value = height / 2160;
      }
      // Low glide with a closed sway path.
      const a = Math.PI * 2 * ph;
      camera.position.set(0.9 * Math.sin(a), 1.05 + 0.1 * Math.sin(2 * a), 0);
      camera.rotation.set(THREE.MathUtils.degToRad(-4.2 + 0.4 * Math.sin(a + 1)), 0.03 * Math.sin(a), 0.012 * Math.sin(a + 2), "YXZ");
      bgUniforms.uAspect.value = camera.aspect;
    },
    dispose: () => materials.forEach((m) => m.dispose()),
  };
};
