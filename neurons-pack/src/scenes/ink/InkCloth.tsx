import * as THREE from "three";
import colors from "../../../data/colors.json";
import counts from "../../../data/counts.json";
import { SIMPLEX } from "../../lib/glsl";
import { gauss, mulberry32 } from "../../lib/random";
import { makeNoise3 } from "../../lib/noise";
import { GLStage, Stage, StageContext } from "../../lib/three/GLStage";

const LOOP = 600;

// The sheet lives in (u, v); every frame the vertex shader folds it with
// low-frequency noise and adds curl noise, both sampled on a circle in time
// (period 600 frames), then tumbles it by whole turns. Particles darken the
// white target multiplicatively, so draw order does not matter.
const VERT = /* glsl */ `
precision highp float;
in vec3 position;   // u, v, per-particle random
in float aRand2;
in vec4 aJit; // gaussian offset xyz, edge closeness
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float uTheta;
uniform float uPointPx;
out float vAlpha;
${SIMPLEX}

// 4D noise with time on a circle in the (z, w) plane: periodic in theta.
float tn(vec3 p, float seed) {
  return snoise4(vec4(p.xy + seed, p.z + 1.6 * cos(uTheta), 1.6 * sin(uTheta)));
}
vec3 potential(vec3 p) {
  return vec3(tn(p, 0.0), tn(p, 31.4), tn(p, 77.7));
}
vec3 curlNoise(vec3 p) {
  const float e = 0.08;
  vec3 a = potential(p);
  vec3 dx = (potential(p + vec3(e, 0, 0)) - a) / e;
  vec3 dy = (potential(p + vec3(0, e, 0)) - a) / e;
  vec3 dz = (potential(p + vec3(0, 0, e)) - a) / e;
  return vec3(dy.z - dz.y, dz.x - dx.z, dx.y - dy.x);
}

void main() {
  float th = uTheta;
  // Bunching: twice per loop the sheet gathers into a dense knot.
  float k1 = 0.25 + 0.75 * pow(0.5 + 0.5 * cos(2.0 * th - 1.3), 3.0);
  float knot = k1;
  vec2 uv = position.xy - 0.5;
  float scale = 1.0 - 0.5 * knot;
  // Particles bunch towards the middle (a darker core, lighter lobes).
  float rr = length(uv) * 2.0;
  vec2 uvc = uv * mix(0.35, 1.0, smoothstep(0.0, 1.0, rr));
  vec3 p = vec3(uvc.x * 1.75, uvc.y * 1.25, 0.0) * scale;
  // Large folds: the sheet bends and wraps around itself.
  vec3 q = vec3(uv * 1.6, 0.0);
  vec3 fold = vec3(
    snoise4(vec4(q.xy, 1.2 * cos(th), 1.2 * sin(th))),
    snoise4(vec4(q.xy + 17.0, 1.2 * cos(th) + 3.0, 1.2 * sin(th))),
    snoise4(vec4(q.xy + 41.0, 1.2 * cos(th), 1.2 * sin(th) + 5.0)));
  p += fold * vec3(0.13, 0.13, 0.3) * (1.0 - 0.3 * knot);
  // Curl noise: smoke-thin rippling and crumpling, stronger in the knot.
  vec3 c = curlNoise(p * (1.8 + 1.8 * knot));
  p += c * (0.018 + 0.03 * knot);
  // Thickness: a smoky volume rather than a crisp membrane; powdery edges.
  p += aJit.xyz * (0.009 + 0.025 * aJit.w + 0.004 * knot);
  vAlpha = mix(0.06, 0.12, position.z);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uPointPx * (0.8 + 0.4 * aRand2);
}
`;

const FRAG = /* glsl */ `
precision highp float;
in float vAlpha;
out vec4 outColor;
void main() {
  outColor = vec4(0.0, 0.0, 0.0, vAlpha);
}
`;

const buildSheet = () => {
  const n = counts.ink.particles;
  const rng = mulberry32(0x1c_c107);
  const noise = makeNoise3(0x9e37);
  const pos = new Float32Array(n * 3);
  const r2 = new Float32Array(n);
  const jit = new Float32Array(n * 4);
  let i = 0;
  while (i < n) {
    const u = rng();
    const v = rng();
    // Irregular, powdery outline: density falls off towards a noisy edge.
    const edge = Math.min(u, v, 1 - u, 1 - v);
    const wob = 0.09 * noise(u * 3.1, v * 3.1, 0.5) + 0.05 * noise(u * 9, v * 9, 2.5);
    const keep = Math.min(1, Math.max(0, (edge + wob) / 0.14));
    if (rng() > keep * keep) continue;
    pos[3 * i] = u;
    pos[3 * i + 1] = v;
    pos[3 * i + 2] = rng();
    r2[i] = rng();
    jit[4 * i] = gauss(rng);
    jit[4 * i + 1] = gauss(rng);
    jit[4 * i + 2] = gauss(rng);
    jit[4 * i + 3] = 1 - keep;
    i++;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aRand2", new THREE.BufferAttribute(r2, 1));
  g.setAttribute("aJit", new THREE.BufferAttribute(jit, 4));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 10);
  return g;
};

const build = (ctx: StageContext): Stage => {
  const { renderer, px } = ctx;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 50);
  camera.position.set(0, 0, 3.7);
  camera.lookAt(0, 0, 0);
  const mat = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: { uTheta: { value: 0 }, uPointPx: { value: 4.5 * px } },
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.ZeroFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.ZeroFactor,
    blendDstAlpha: THREE.OneFactor,
  });
  const points = new THREE.Points(buildSheet(), mat);
  points.frustumCulled = false;
  const pivot = new THREE.Group();
  pivot.add(points);
  scene.add(pivot);
  const white = new THREE.Color(colors.ink.background);
  return {
    render: (frame, target) => {
      const th = ((frame % LOOP) / LOOP) * Math.PI * 2;
      mat.uniforms.uTheta.value = th;
      // Tumble: one whole turn in the picture plane per loop, with a
      // periodic rock in depth so the sheet never goes edge-on.
      pivot.rotation.set(0.35 * Math.sin(th) + 0.15, 0.4 * Math.sin(th + 1.1), 0.5 * Math.sin(th) + 0.25 * Math.sin(2 * th), "ZXY");
      renderer.setRenderTarget(target);
      renderer.setClearColor(white, 1);
      renderer.clear(true, true, true);
      renderer.render(scene, camera);
    },
  };
};

export const InkCloth_White: React.FC = () => <GLStage build={build} background={colors.ink.background} />;
