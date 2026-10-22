import { BufferAttribute, BufferGeometry, PerspectiveCamera, Points, Scene, ShaderMaterial, Vector3 } from "three";
import type { BrainAssets } from "../engine/assets";
import { makeDrift } from "../engine/drift";
import { memo, pointCloud } from "../engine/geometry";
import { easeInOutSine, lin, srgb } from "../engine/math";
import { Post, pxScale } from "../engine/post";
import { ADDITIVE, POINT_GLSL } from "../engine/primitives";
import { mulberry32 } from "../engine/random";
import type { LookFactory } from "../engine/Stage";

// Look 1 · Brain Membrane Violet (20 s loop). Cortex and inner structures as
// thin translucent sheets of fine dots (fresnel-bright edges), magenta/white
// sparkles; the camera approaches, dives through the membranes, reverses out
// and returns to the starting side view.

export const MEMBRANE_COLORS = {
  // One data row: membrane, membrane (dim side), sparkle A, sparkle B, background, light streak, floor line
  membrane: "#D8D4FF",
  membraneDim: "#6450E0",
  sparkA: "#E040D8",
  sparkB: "#FFFFFF",
  bg: "#05061A",
  streak: "#2443B8",
  line: "#7A8CFF",
};

const PERIOD = 600;
const N_CORTEX = 440_000;
const N_INNER = 160_000;
const N_SPARK = 400;

// Camera keyframes: [frame, distance, azimuth, elevation, target x, target y]
// azimuth 0 = looking at the right hemisphere (front to the left of frame).
const KEYS: [number, number, number, number, number, number][] = [
  [0, 5.0, -0.05, 0.08, 0.0, -0.02],
  [150, 2.9, 0.3, 0.1, 0.02, 0.0],
  [300, 0.3, 0.95, 0.12, 0.08, 0.1],
  [450, 2.9, 0.3, 0.1, 0.02, 0.0],
  [600, 5.0, -0.05, 0.08, 0.0, -0.02],
];

const camAt = (frame: number) => {
  const f = frame % PERIOD;
  let k = 0;
  while (k < KEYS.length - 2 && f >= KEYS[k + 1][0]) k++;
  const a = KEYS[k];
  const b = KEYS[k + 1];
  const t = easeInOutSine((f - a[0]) / (b[0] - a[0]));
  // distance interpolated in log space so the approach feels even
  const d = Math.exp(Math.log(a[1]) + (Math.log(b[1]) - Math.log(a[1])) * t);
  const az = a[2] + (b[2] - a[2]) * t;
  const el = a[3] + (b[3] - a[3]) * t;
  const tx = a[4] + (b[4] - a[4]) * t;
  const ty = a[5] + (b[5] - a[5]) * t;
  const target = new Vector3(tx, ty, 0);
  const pos = new Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).multiplyScalar(d).add(target);
  return { pos, target };
};

const BG = /* glsl */ `
  vec3 c = uBg;
  // soft blue light streak, top left
  float sx = exp(-pow((uv.x - 0.07) / 0.09, 2.0)) + 0.5 * exp(-pow((uv.x - 0.16) / 0.05, 2.0));
  c += uStreak * sx * smoothstep(0.45, 1.0, uv.y) * 0.55;
  c += uStreak * exp(-length((uv - vec2(0.05, 1.05)) * vec2(aspect, 1.0)) * 3.0) * 0.25;
  // faint horizontal light line low in the frame
  float ly = exp(-pow((uv.y - 0.205) / 0.0035, 2.0)) + 0.25 * exp(-pow((uv.y - 0.205) / 0.02, 2.0));
  c += uLine * ly * (0.22 * smoothstep(0.85, 0.0, uv.x) + 0.04);
  return c;
`;

const MEM_VERT = /* glsl */ `
${POINT_GLSL}
in vec4 aAttr;
uniform vec3 uCam;
out float vI;
out float vF;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vec3 V = normalize(uCam - position);
  float ndv = abs(dot(normal, V));
  float fr = pow(1.0 - ndv, 1.6);
  bool inner = aAttr.z > 2.5;
  float dist = -mv.z;
  // sharp close dots: grow with proximity but stay crisp, fade right at the lens
  float s = pointSize(0.0042, mv.z, 1.6);
  gl_PointSize = min(s, 16.0 * uPx + 1.5);
  float near = smoothstep(0.015, 0.09, dist);
  float far = 1.0;
  vI = (inner ? (0.5 + 0.5 * fr) * 1.05 : (0.3 + 0.7 * fr)) * (0.75 + 0.5 * aAttr.w) * vPtAlpha * near * far;
  vF = fr;
  gl_Position = dist > 0.01 ? projectionMatrix * mv : vec4(2.0, 2.0, 2.0, 1.0);
}`;

const MEM_FRAG = /* glsl */ `
uniform vec3 uMem;
uniform vec3 uDim;
uniform float uGain;
in float vI;
in float vF;
out vec4 outColor;
void main() {
  vec2 d = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(d, d);
  if (r2 > 1.0) discard;
  float a = smoothstep(1.0, 0.55, r2);
  vec3 c = mix(uDim, uMem, smoothstep(0.1, 0.7, vF));
  outColor = vec4(c * vI * a * uGain, 0.0);
}`;

const SPARK_VERT = /* glsl */ `
${POINT_GLSL}
in vec4 aR;
uniform float uPhase;
out float vI;
out float vMix;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float k = 1.0 + floor(aR.y * 4.0);
  float tw = pow(0.5 + 0.5 * sin(6.28318 * (uPhase * k + aR.x)), 2.0);
  float s = pointSize(mix(0.026, 0.07, aR.w * aR.w), mv.z, 6.0);
  vI = (0.25 + 0.75 * tw) * vPtAlpha * smoothstep(0.02, 0.2, -mv.z);
  vMix = aR.z;
  gl_PointSize = min(s, 120.0 * uPx + 2.0);
  gl_Position = -mv.z > 0.02 ? projectionMatrix * mv : vec4(2.0, 2.0, 2.0, 1.0);
}`;

const SPARK_FRAG = /* glsl */ `
uniform vec3 uA;
uniform vec3 uB;
in float vI;
in float vMix;
out vec4 outColor;
void main() {
  vec2 d = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(d, d);
  if (r2 > 1.0) discard;
  float core = exp(-r2 * 7.0);
  float halo = exp(-r2 * 2.5) * 0.3;
  vec3 c = mix(uA, uB, step(0.62, vMix));
  outColor = vec4(c * vI * (core * 2.2 + halo), 0.0);
}`;

// Sparkles inside and around the brain (rejection-sampled in a padded ellipsoid).
const sparkGeometry = (a: BrainAssets) =>
  memo(a, "membrane-sparks", () => {
    const rng = mulberry32(1101);
    const pos = new Float32Array(N_SPARK * 3);
    const r = new Float32Array(N_SPARK * 4);
    let i = 0;
    while (i < N_SPARK) {
      const x = (rng() * 2 - 1) * 1.08;
      const y = (rng() * 2 - 1) * 0.92;
      const z = (rng() * 2 - 1) * 0.92;
      if ((x / 1.08) ** 2 + ((y - 0.05) / 0.92) ** 2 + (z / 0.92) ** 2 > 1) continue;
      pos.set([x, y, z], i * 3);
      r.set([rng(), rng(), rng(), rng()], i * 4);
      i++;
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(pos, 3));
    g.setAttribute("aR", new BufferAttribute(r, 4));
    return g;
  });

export const membraneLook: LookFactory = ({ gl, assets, width, height }) => {
  const post = new Post(
    gl,
    {
      msaa: 0,
      bloom: { strength: 0.6, threshold: 0.5, knee: 0.3, levels: 6, radius: 0.85 },
      background: BG,
      uniforms: {
        uBg: { value: srgb(MEMBRANE_COLORS.bg) },
        uStreak: { value: srgb(MEMBRANE_COLORS.streak) },
        uLine: { value: srgb(MEMBRANE_COLORS.line) },
      },
      key: null,
      exposure: 1,
    },
    assets.blueNoise,
  );
  const scene = new Scene();
  const cam = new PerspectiveCamera(34, width / height, 0.008, 60);
  const projY = cam.projectionMatrix.elements[5];
  const camPos = new Vector3();
  const common = {
    uRes: { value: post.size },
    uPx: { value: pxScale(post) },
    uProjY: { value: projY },
    uPhase: { value: 0 },
    uCam: { value: camPos },
  };
  const memMat = new ShaderMaterial({
    glslVersion: "300 es" as never,
    vertexShader: MEM_VERT,
    fragmentShader: MEM_FRAG,
    uniforms: {
      ...common,
      uMem: { value: new Vector3(...lin(MEMBRANE_COLORS.membrane)) },
      uDim: { value: new Vector3(...lin(MEMBRANE_COLORS.membraneDim)) },
      uGain: { value: 0.16 },
    },
    ...ADDITIVE,
    depthTest: false,
  });
  const membranes = new Points(pointCloud(assets, "membrane", N_CORTEX, N_INNER), memMat);
  membranes.frustumCulled = false;
  scene.add(membranes);

  const sparkMat = new ShaderMaterial({
    glslVersion: "300 es" as never,
    vertexShader: SPARK_VERT,
    fragmentShader: SPARK_FRAG,
    uniforms: {
      ...common,
      uA: { value: new Vector3(...lin(MEMBRANE_COLORS.sparkA)).multiplyScalar(1.6) },
      uB: { value: new Vector3(...lin(MEMBRANE_COLORS.sparkB)).multiplyScalar(1.3) },
    },
    ...ADDITIVE,
    depthTest: false,
  });
  const sparks = new Points(sparkGeometry(assets), sparkMat);
  sparks.frustumCulled = false;
  scene.add(sparks);

  // a few sparkles drifting out below the brain
  const fall = makeDrift(
    {
      seed: 1102,
      count: 40,
      min: [-0.9, -1.9, -0.7],
      max: [0.9, -0.35, 0.7],
      laps: [0, -1, 0],
      period: PERIOD,
      size: [0.012, 0.028],
      minPx: 3,
      color: lin(MEMBRANE_COLORS.sparkA),
      colorB: lin(MEMBRANE_COLORS.sparkB),
      intensity: 1.6,
      twinkle: 0.6,
      wobble: 0.03,
    },
    post,
    projY,
  );
  scene.add(fall.points);

  return {
    render(frame) {
      const f = frame % PERIOD;
      const { pos, target } = camAt(f);
      cam.position.copy(pos);
      cam.lookAt(target);
      cam.updateMatrixWorld();
      camPos.copy(pos);
      common.uPhase.value = f / PERIOD;
      fall.set(f);
      post.begin();
      gl.render(scene, cam);
      post.end(f);
    },
    dispose() {
      post.dispose();
      memMat.dispose();
      sparkMat.dispose();
      fall.dispose();
    },
  };
};

