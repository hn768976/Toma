import * as THREE from "three";
import { DOF_GLSL, SPRITE_FS_GLSL } from "../gl/glsl";
import type { Look } from "../gl/Stage";
import { additive, dofUniforms, vec3Of } from "../gl/util";
import { gauss, mulberry32 } from "../lib/random";
import { LOOP_FRAMES, loopPhase } from "../lib/timing";

export type CityColors = { dots: string; accent: string; skyHorizon: string; skyTop: string };

export const CITY_TOWERS = 420;
export const CITY_STREAMS = 250;
export const CITY_CROSS_STREAMS = 5;
const ACCENT_SHARE = 0.18;

const FOV = 38;
const FAR = 175; // streams run from the horizon (z=-FAR) to behind the camera
const LEN = FAR + 6; // stream loop length; each stream's dash pattern repeats LEN/q
const DOT_STEP = 0.14; // spacing of the points that make up a dash
const FLICKER_STEP = 20; // frames per flicker state (600/20 = 30 states per loop)

// ---- towers (module level, fixed seed) -------------------------------------
const buildTowers = () => {
  const rnd = mulberry32(0xc17e);
  const pos: number[] = [];
  const data: number[] = []; // size, brightness, accent(0/1), flicker id
  let id = 0;
  for (let t = 0; t < CITY_TOWERS; t++) {
    const z = -(FAR - 35 + rnd() * 40) - (rnd() < 0.3 ? 20 : 0);
    const spread = 230;
    const x = (rnd() * 2 - 1) * spread * (0.5 + 0.5 * Math.abs(z) / FAR);
    // heights: mostly mid, a few tall spires; taller towards the centre
    const centre = Math.exp(-(x * x) / (2 * 90 * 90));
    const h = 3 + Math.pow(rnd(), 1.8) * (12 + 16 * centre) + (rnd() < 0.07 ? 10 + rnd() * 8 : 0);
    const cols = 1 + Math.floor(rnd() * 5);
    const dy = 0.5;
    const dx = 0.55;
    const towerBright = 0.5 + rnd() * 0.7;
    const accentTower = rnd() < 0.08;
    for (let c = 0; c < cols; c++) {
      const colH = h * (c === 0 ? 1 : 0.6 + rnd() * 0.4);
      const n = Math.floor(colH / dy);
      for (let k = 0; k < n; k++) {
        if (rnd() < 0.12) continue; // gaps ("windows off")
        pos.push(x + c * dx, k * dy + rnd() * 0.05, z - c * 0.3);
        const topGlow = 0.6 + 0.6 * Math.pow(k / Math.max(1, n - 1), 2);
        data.push(4.2 + rnd() * 2.5, towerBright * topGlow * (0.6 + rnd() * 0.5), accentTower || rnd() < 0.04 ? 1 : 0, id++);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute("aData", new THREE.BufferAttribute(new Float32Array(data), 4));
  return g;
};

// ---- ground streams ---------------------------------------------------------
// A stream is a line on the ground. Its dash pattern is periodic with R = len/q and
// it flows exactly one repeat R per loop, so frame 600 == frame 0 point for point.
type StreamPts = { base: number[]; dir: number[]; flow: number[]; data: number[] };
const addStream = (
  out: StreamPts,
  rnd: () => number,
  base: [number, number, number],
  dir: [number, number, number],
  len: number,
  q: number,
  density: number,
) => {
  const R = len / q;
  // dash pattern for one repeat
  const dashes: { s: number; l: number; accent: number; b: number }[] = [];
  let s = rnd() * 3;
  while (s < R - 0.5) {
    const l = 0.25 + Math.pow(rnd(), 1.6) * 2.6;
    if (s + l > R) break;
    dashes.push({ s, l, accent: rnd() < ACCENT_SHARE ? 1 : 0, b: 0.45 + rnd() * 0.75 });
    s += l + (0.4 + Math.pow(rnd(), 1.4) * 6) / density;
  }
  for (let rep = 0; rep < q; rep++) {
    for (const d of dashes) {
      const n = Math.max(1, Math.round(d.l / DOT_STEP));
      for (let p = 0; p < n; p++) {
        out.base.push(...base);
        out.dir.push(...dir);
        out.flow.push(rep * R + d.s + (p + 0.5) * (d.l / n), R, len);
        out.data.push(3.4 + (p === n - 1 ? 1.2 : 0), d.b * (p === n - 1 ? 1.25 : 1), d.accent, 0);
      }
    }
  }
};

const buildStreams = () => {
  const rnd = mulberry32(0x57ea);
  const out: StreamPts = { base: [], dir: [], flow: [], data: [] };
  const spacing = 0.8;
  for (let i = 0; i < CITY_STREAMS; i++) {
    const x = (i - (CITY_STREAMS - 1) / 2) * spacing + gauss(rnd) * 0.08;
    if (rnd() < 0.12) continue; // a few empty lanes
    const q = 2 + Math.floor(rnd() * 3); // 2,3,4 repeats -> three flow speeds
    addStream(out, rnd, [x, 0, -FAR], [0, 0, 1], LEN, q, 1.0 + rnd() * 1.4);
  }
  // a few crossing lines, flowing sideways
  const crossZ = [-12, -27, -48, -80, -120];
  for (let i = 0; i < CITY_CROSS_STREAMS; i++) {
    const lenX = 240;
    addStream(out, rnd, [-lenX / 2, 0, crossZ[i]], [rnd() < 0.5 ? 1 : 1, 0, 0], lenX, 3 + (i % 2), 0.8);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(out.base), 3));
  g.setAttribute("aDir", new THREE.BufferAttribute(new Float32Array(out.dir), 3));
  g.setAttribute("aFlow", new THREE.BufferAttribute(new Float32Array(out.flow), 3));
  g.setAttribute("aData", new THREE.BufferAttribute(new Float32Array(out.data), 4));
  return g;
};

const TOWER_GEO = buildTowers();
const STREAM_GEO = buildStreams();
export const CITY_POINT_COUNTS = {
  towers: TOWER_GEO.getAttribute("position").count,
  streams: STREAM_GEO.getAttribute("position").count,
};

const COMMON = /* glsl */ `
precision highp float;
precision highp int;
${DOF_GLSL}
uniform float uPhase;
uniform int uFrame;
uniform vec3 uColor;
uniform vec3 uAccent;
uniform float uBright;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
out vec3 vColor;
out float vPx;
const float TAU = 6.28318530718;
uint hashu(uint x) {
  x ^= x >> 16u; x *= 0x7feb352du; x ^= x >> 15u; x *= 0x846ca68bu; x ^= x >> 16u;
  return x;
}
float hash01(uint a, uint b) { return float(hashu(a * 0x9e3779b9u ^ hashu(b))) / 4294967295.0; }
`;

const TOWER_VS = /* glsl */ `
${COMMON}
in vec3 position;
in vec4 aData;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float depth = -mv.z;
  uint id = uint(aData.w);
  // Flicker: a new on/off state every ${FLICKER_STEP} frames; ${LOOP_FRAMES / FLICKER_STEP} states per loop (whole cycles).
  uint stepIdx = uint(uFrame / ${FLICKER_STEP});
  float flickers = step(0.8, hash01(id, 7u));
  float on = hash01(id, stepIdx + 101u) > 0.35 ? 1.0 : 0.15;
  float shimmer = 0.85 + 0.15 * sin(TAU * (2.0 * uPhase + hash01(id, 3u)));
  float b = aData.y * mix(1.0, on, flickers) * shimmer * uBright;
  vec2 sp = dofSprite(aData.x, depth);
  gl_PointSize = sp.x;
  vPx = sp.x;
  vColor = mix(uColor, uAccent, aData.z) * b * sp.y;
  gl_Position = projectionMatrix * mv;
}`;

const STREAM_VS = /* glsl */ `
${COMMON}
in vec3 position; // stream start
in vec3 aDir;
in vec3 aFlow;    // s0, repeat R, loop length
in vec4 aData;
void main() {
  // Flow toward the camera: exactly one dash repeat R per loop.
  float s = mod(aFlow.x + aFlow.y * uPhase, aFlow.z);
  vec3 p = position + aDir * s;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float depth = -mv.z;
  // fade in from the horizon, fade at the stream ends
  float fog = smoothstep(${FAR.toFixed(1)}, ${(FAR * 0.3).toFixed(1)}, -p.z) / (1.0 + depth * depth / 2500.0) * smoothstep(0.0, 6.0, s) * smoothstep(aFlow.z, aFlow.z - 4.0, s);
  vec2 sp = dofSprite(aData.x + 0.03 * uProj / max(depth, 0.1), depth);
  gl_PointSize = depth > 0.05 ? sp.x : 0.0;
  vPx = sp.x;
  vColor = mix(uColor, uAccent, aData.z) * aData.y * fog * sp.y * uBright;
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

export const createDataCity = (colors: CityColors) => (): Look => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.05, 400);
  const mk = (vs: string, bright: number) =>
    new THREE.RawShaderMaterial({
      ...additive,
      vertexShader: vs,
      fragmentShader: FS,
      uniforms: {
        ...dofUniforms(FOV, 55, 9, 240, 0.85),
        uFrame: { value: 0 },
        uColor: { value: vec3Of(colors.dots) },
        uAccent: { value: vec3Of(colors.accent) },
        uBright: { value: bright },
      },
    });
  const towerMat = mk(TOWER_VS, 0.9);
  const streamMat = mk(STREAM_VS, 0.8);
  const towers = new THREE.Points(TOWER_GEO, towerMat);
  const streams = new THREE.Points(STREAM_GEO, streamMat);
  towers.frustumCulled = false;
  streams.frustumCulled = false;
  scene.add(towers, streams);

  const bgUniforms = {
    uSkyTop: { value: vec3Of(colors.skyTop) },
    uSkyHorizon: { value: vec3Of(colors.skyHorizon) },
    uHorizonY: { value: 0.6 },
  };

  return {
    scene,
    camera,
    post: {
      bloomStrength: 0.5,
      bloomRadius: 0.8,
      grain: 0.02,
      backgroundUniformsGLSL: `uniform vec3 uSkyTop; uniform vec3 uSkyHorizon; uniform float uHorizonY;`,
      backgroundGLSL: /* glsl */ `
vec3 background(vec2 uv) {
  float above = uv.y - uHorizonY;
  // sky: deep at the top, lighter towards the horizon
  vec3 sky = mix(uSkyHorizon, uSkyTop, smoothstep(0.0, 0.42, above));
  // ground: darker, picks up a little horizon light
  vec3 ground = mix(uSkyHorizon * 0.55, uSkyTop * 0.45, smoothstep(0.0, 0.5, -above));
  vec3 col = above >= 0.0 ? sky : ground;
  col += uSkyHorizon * (0.45 * exp(-above * above / 0.006) + 0.25 * exp(-above * above / 0.05));
  return col;
}`,
      backgroundUniforms: bgUniforms,
    },
    update: ({ frame, height }) => {
      const ph = loopPhase(frame);
      for (const m of [towerMat, streamMat]) {
        m.uniforms.uPhase.value = ph;
        m.uniforms.uFrame.value = ((frame % LOOP_FRAMES) + LOOP_FRAMES) % LOOP_FRAMES;
        m.uniforms.uPxScale.value = height / 2160;
      }
      // slight camera sway on a closed path
      const a = Math.PI * 2 * ph;
      camera.position.set(0.45 * Math.sin(a), 1.25 + 0.08 * Math.sin(2 * a), 0);
      const pitch = THREE.MathUtils.degToRad(-3.0 + 0.25 * Math.sin(a + 0.7));
      camera.rotation.set(pitch, 0.012 * Math.sin(a), 0.006 * Math.sin(a + 1.3), "YXZ");
      camera.updateMatrixWorld();
      // horizon screen position for the sky gradient (point far along the view)
      camera.updateProjectionMatrix();
      const v = new THREE.Vector3(camera.position.x, 0, -5000).project(camera);
      bgUniforms.uHorizonY.value = v.y * 0.5 + 0.5;
    },
    dispose: () => {
      towerMat.dispose();
      streamMat.dispose();
    },
  };
};
