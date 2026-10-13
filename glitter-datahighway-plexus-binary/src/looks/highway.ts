// Look 2 — Data Highway. Instanced glowing bars in lanes on a planet-curved
// floor (sphere, R = 40), streaming toward a low camera. Layout is periodic
// along the lanes and scrolls exactly one period per 600 frames.
import * as THREE from "three";
import type { SceneBuilder } from "../lib/ThreeStage";
import { hexToLinear, LOOP, mulberry32, pickWeighted } from "../lib/random";

export type HighwayVersion = {
  colors: [number, string][]; // [weight, hex]
  horizon: string;
  haze: string;
  unlit: string;
};

const R = 40; // floor sphere radius
const CAM_H = 0.085; // camera height above the floor
const LANES = 140;
const PITCH = 0.017; // lane spacing
const BAR_W = 0.0125;
const CELL = 0.026; // length unit along a lane
const PERIOD = 3.4; // layout period along the lanes (world units)
const Z_NEAR = 0.3; // wrap window [Z_NEAR - PERIOD, Z_NEAR] (behind camera .. past horizon)
const HOLDS = [10, 12, 15, 20, 24, 30]; // flicker holds, all divide 600

type Layout = { count: number; data: Float32Array; color: Float32Array; color2: Float32Array };

const buildLayout = (v: HighwayVersion): Layout => {
  const rnd = mulberry32(0x2a6aff);
  const data: number[] = [];
  const color: number[] = [];
  const color2: number[] = [];
  const cells = Math.round(PERIOD / CELL);
  for (let l = 0; l < LANES; l++) {
    const x = (l - (LANES - 1) / 2) * PITCH;
    let c = rnd() * 3;
    while (c < cells) {
      const len = 0.5 + rnd() * 3.5; // 0.5–4 cells
      if (c + len > cells - 0.2) break;
      const hex = pickWeighted(rnd(), v.colors);
      // ~45% of slots are unlit: dim navy bar shapes that form the lattice
      const lit = rnd() < 0.78;
      const col = lit ? hexToLinear(hex) : hexToLinear(v.unlit);
      const width = rnd() < 0.12 ? 0.35 + rnd() * 0.3 : 1; // a few thin dashes
      data.push(x, c * CELL, len * CELL, lit ? rnd() : -1, HOLDS[Math.floor(rnd() * HOLDS.length)], rnd(), width);
      color.push(...col);
      // ~25% of lit bars end in a second colour (pink / orange / peach cap)
      const cap = lit && rnd() < 0.25 ? hexToLinear(["#FF6AC8", "#FF8A3A", "#FFB8A0"][Math.floor(rnd() * 3)]) : col;
      color2.push(...cap, lit ? 0.55 + rnd() * 0.3 : 2);
      c += len + 0.12 + (rnd() < 0.55 ? rnd() * 0.5 : rnd() * 2.6); // seeded gaps
    }
  }
  return { count: data.length / 7, data: new Float32Array(data), color: new Float32Array(color), color2: new Float32Array(color2) };
};

const BAR_VERT = /* glsl */ `
precision highp float;
in vec3 position; // quad corner in [0,1]^2
in vec3 iA;       // lane x, z start (in period), length
in vec4 iB;       // brightness seed (-1 = unlit), hold, flicker seed, width
in vec3 iColor;
in vec4 iColor2; // cap colour, cap start along the bar (0..1; >1 = none)
uniform mat4 projectionMatrix; uniform mat4 viewMatrix;
uniform float uFlow; uniform float uFrame;
out vec2 vLocal; out vec3 vColor; out float vDist; out vec2 vSize; out float vLit; out float vSide; out float vTw; out vec4 vCap;
float h12(float a, float b) { return fract(sin(a * 127.1 + b * 311.7) * 43758.5453); }
void main() {
  float zs = iA.y - uFlow;                         // scroll toward the camera (+z)
  zs = mod(zs, ${PERIOD.toFixed(3)});              // wrap into [0, P)
  float zStart = ${Z_NEAR.toFixed(3)} - zs;        // bar head (near end)
  float zz = zStart - position.y * iA.z;           // extends away from camera
  float xx = iA.x + (position.x - 0.5) * ${BAR_W.toFixed(4)} * iB.w;
  float r2 = xx * xx + zz * zz;
  float yy = sqrt(max(${(R * R).toFixed(1)} - r2, 0.0)) - ${R.toFixed(1)};
  vec4 world = vec4(xx, yy, zz, 1.0);
  vec4 view = viewMatrix * world;
  gl_Position = projectionMatrix * view;
  vLocal = position.xy;
  vSize = vec2(${BAR_W.toFixed(4)} * iB.w, iA.z);
  vLit = iB.x < 0.0 ? 0.0 : 1.0;
  vSide = abs(xx) / max(-zz, 0.05);
  vDist = length(view.xyz);
  float bucket = floor(uFrame / iB.y);
  float fl = mix(0.86, 1.0, h12(iB.z * 91.0, bucket));
  float k = (iB.x < 0.0 ? 1.0 : mix(0.6, 1.2, iB.x) * fl);
  vCap = vec4(iColor2.rgb * k, iColor2.w);
  vColor = iColor * (iB.x < 0.0 ? 1.0 : mix(0.6, 1.2, iB.x) * fl);
  vTw = h12(iB.z * 53.0 + 7.0, bucket);
}`;

const BAR_FRAG = /* glsl */ `
precision highp float;
in vec2 vLocal; in vec3 vColor; in float vDist; in vec2 vSize; in float vLit; in float vSide; in float vTw; in vec4 vCap;
uniform vec3 uHaze; uniform float uHorizon;
out vec4 outColor;
void main() {
  // distance to the bar edge in world units, filtered by the pixel footprint
  vec2 d = (0.5 - abs(vLocal - 0.5)) * vSize;
  vec2 fw = fwidth(vLocal) * vSize;
  // box-filtered coverage: edge AA, and subpixel bars lose energy in proportion
  vec2 cov2 = clamp(d / max(fw, 1e-5) + 0.5, 0.0, 1.0) * min(vec2(1.0), vSize / max(fw * 1.5, 1e-5));
  float cov = cov2.x * cov2.y;
  float edge = max(min(d.x, d.y), 0.0); // MSAA: pixel centre may lie outside the quad
  float rim = exp(-edge / 0.0012);
  vec3 base = vLocal.y > vCap.w ? vCap.rgb : vColor;  // two-colour bars
  vec3 c = base * mix(1.0, 0.55 + 0.9 * rim, vLit);
  // far bars turn into bright white-cyan sparkle near the horizon
  float far = smoothstep(uHorizon * 0.15, uHorizon * 0.8, vDist);
  vec3 sparkle = (c * 0.6 + uHaze * 1.1 + vec3(0.6)) * (0.4 + 2.4 * vTw * vTw);
  c = mix(c, sparkle * max(vLit, 0.4) * 2.6, far * 0.9);
  // the floor's far corners fall away into black at the frame sides
  c *= mix(1.0, smoothstep(0.6, 0.2, vSide), far);
  // the horizon folds unbounded depth into one pixel row; fade bars out before it
  c *= smoothstep(uHorizon * 1.0, uHorizon * 0.9, vDist);
  // far bars are sub-pixel: keep part of their energy so the horizon band stays luminous
  outColor = vec4(c * mix(cov, sqrt(cov), far), 1.0);
}`;

const SKY_FRAG = /* glsl */ `
precision highp float;
in vec3 vDir; uniform vec3 uGlow; uniform vec3 uHaze; uniform float uDip;
out vec4 outColor;
void main() {
  vec3 d = normalize(vDir);
  float elev = asin(clamp(d.y, -1.0, 1.0)) + uDip;    // 0 at the horizon
  float az = atan(d.x, -d.z);
  float centre = exp(-az * az / 0.3);
  float glow = exp(-max(elev, 0.0) / 0.012) * step(-0.002, elev);
  vec3 c = (uHaze * 0.16 + uGlow * 0.03) * glow * centre;
  outColor = vec4(c, 1.0);
}`;
const SKY_VERT = /* glsl */ `
precision highp float;
in vec3 position; uniform mat4 projectionMatrix; uniform mat4 viewMatrix; uniform mat4 modelMatrix;
out vec3 vDir;
void main() { vDir = position; gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0); }`;

const FLOOR_FRAG = /* glsl */ `
precision highp float;
in float vDist; uniform vec3 uHaze; uniform float uHorizon;
out vec4 outColor;
void main() {
  float far = smoothstep(uHorizon * 0.2, uHorizon * 1.1, vDist);
  vec3 c = vec3(0.0008, 0.0008, 0.006) + uHaze * far * far * 0.05;
  outColor = vec4(c, 1.0);
}`;
const FLOOR_VERT = /* glsl */ `
precision highp float;
in vec3 position; uniform mat4 projectionMatrix; uniform mat4 viewMatrix; uniform mat4 modelMatrix;
out float vDist;
void main() { vec4 v = viewMatrix * modelMatrix * vec4(position, 1.0); vDist = length(v.xyz); gl_Position = projectionMatrix * v; }`;

export const makeHighway = (v: HighwayVersion): SceneBuilder => {
  const layout = buildLayout(v);
  return () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.005, 200);
    const horizonDist = Math.sqrt(2 * R * CAM_H + CAM_H * CAM_H);
    const dip = Math.acos(R / (R + CAM_H));
    const haze = new THREE.Color(...hexToLinear(v.haze));
    const glow = new THREE.Color(...hexToLinear(v.horizon));

    // sky dome (rendered first, behind everything)
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(150, 64, 32),
      new THREE.RawShaderMaterial({
        glslVersion: THREE.GLSL3, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG,
        uniforms: { uGlow: { value: glow }, uHaze: { value: haze }, uDip: { value: dip } },
        side: THREE.BackSide, depthWrite: false,
      }),
    );
    sky.renderOrder = -2;
    scene.add(sky);

    // floor sphere
    const floor = new THREE.Mesh(
      new THREE.SphereGeometry(R, 256, 128),
      new THREE.RawShaderMaterial({
        glslVersion: THREE.GLSL3, vertexShader: FLOOR_VERT, fragmentShader: FLOOR_FRAG,
        uniforms: { uHaze: { value: haze }, uHorizon: { value: horizonDist } },
        polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2,
      }),
    );
    floor.position.set(0, -R, 0);
    floor.renderOrder = -1;
    scene.add(floor);

    // bars
    const quad = new THREE.InstancedBufferGeometry();
    quad.setAttribute("position", new THREE.BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]), 3));
    quad.setIndex([0, 1, 2, 0, 2, 3]);
    const n = layout.count;
    const a = new Float32Array(n * 3), b = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      a.set(layout.data.subarray(i * 7, i * 7 + 3), i * 3);
      b.set(layout.data.subarray(i * 7 + 3, i * 7 + 7), i * 4);
    }
    quad.setAttribute("iA", new THREE.InstancedBufferAttribute(a, 3));
    quad.setAttribute("iB", new THREE.InstancedBufferAttribute(b, 4));
    quad.setAttribute("iColor", new THREE.InstancedBufferAttribute(layout.color, 3));
    quad.setAttribute("iColor2", new THREE.InstancedBufferAttribute(layout.color2, 4));
    quad.instanceCount = n;
    const barMat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3, vertexShader: BAR_VERT, fragmentShader: BAR_FRAG,
      uniforms: { uFlow: { value: 0 }, uFrame: { value: 0 }, uHaze: { value: haze }, uHorizon: { value: horizonDist } },
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true,
    });
    const bars = new THREE.Mesh(quad, barMat);
    bars.frustumCulled = false;
    scene.add(bars);

    const update = (f: number) => {
      barMat.uniforms.uFlow.value = (PERIOD * f) / LOOP;
      barMat.uniforms.uFrame.value = f;
      const ph = (2 * Math.PI * f) / LOOP;
      camera.position.set(0.015 * Math.sin(ph), CAM_H, 0);
      camera.rotation.order = "YXZ";
      camera.rotation.set(-dip - THREE.MathUtils.degToRad(1.0), 0.012 * Math.sin(ph), THREE.MathUtils.degToRad(1.5) * Math.sin(ph));
    };
    return {
      scene, camera, update,
      post: {
        bloomStrength: 0.3, bloomThreshold: 0.35, bloomRadius: 1.0, bloomLevels: 5, vignette: 0.35,
        grain: 0.015, grainFloor: 0.03, exposure: 1.0,
        dof: {
          surface: { kind: "sphere", radius: R, center: new THREE.Vector3(0, -R, 0) },
          focusDist: horizonDist * 0.3, scale: 0.0015, farScale: 0.0022, maxCoc: 0.004,
        },
      },
    };
  };
};

export const HIGHWAY_BAR_COUNT = (v: HighwayVersion) => buildLayout(v).count;
