import * as THREE from "three";
import { z } from "zod";
import { LookFactory } from "../gl/GLStage";
import { pointsFrom } from "../gl/points";
import { hexToRgb, TAU } from "../lib/loop";
import { mulberry32 } from "../lib/random";

export const arcSchema = z.object({
  core: z.string(),
  line: z.string(),
  edge: z.string(),
  warm: z.string(),
  background: z.string(),
});
export type ArcProps = z.infer<typeof arcSchema>;

// The bundle is a family of concentric curves lying in a tilted plane seen in
// perspective (that is what makes the near side broad and the far tail thin).
// Every pixel casts a ray, intersects the plane, and gets polar coordinates
// (r, theta) about the ring centre. Line i sits at r_i(theta) = R0 + s_i * W(theta).
// Distances are converted to pixels with an analytic screen-space gradient,
// so each line gets an exact anti-aliased core at any resolution.
const N_LINES = 90;
const FOV = 40;
const GEO = {
  centre: [-0.177, 0.326, -6.0], // ring centre in camera space
  pitch: 0.691, // plane tilt (radians from facing the camera)
  roll: 0.04, // rotation of the plane about the view axis
  R0: 1.578,
  wFar: 0.014, // bundle width at the tail
  wNear: 3.0, // bundle width at the broad near side
};
// Visible angular range, theta measured in the plane: 0 = screen right,
// +90deg = toward the camera (bottom), -90deg = far side (top).
const TH_TAIL = -2.155;
const TH_END = 2.45;

type LineSet = { s: Float32Array; b: Float32Array; laps: Float32Array; ph: Float32Array };
let lineCache: LineSet | null = null;
const lines = (): LineSet => {
  if (lineCache) return lineCache;
  const rng = mulberry32(0xa5c0de);
  // One continuous ribbon. Spacing is uneven: a slow density modulation
  // gathers the lines into 3-4 soft bundles without opening black gaps.
  const s: number[] = [];
  const warp = (u: number) => u + 0.035 * Math.sin(u * TAU * 3.5 + 0.7) + 0.02 * Math.sin(u * TAU * 7.3 + 2.1);
  for (let i = 0; i < N_LINES; i++) {
    const u = (i + 0.5 + (rng() - 0.5) * 0.7) / N_LINES;
    s.push(Math.min(1, Math.max(0, warp(u))));
  }
  s.sort((a, b) => a - b);
  const b = s.map(() => 0.45 + 0.55 * Math.pow(rng(), 1.4));
  const laps = s.map(() => 1 + Math.floor(rng() * 3));
  const ph = s.map(() => rng());
  lineCache = {
    s: new Float32Array(s),
    b: new Float32Array(b),
    laps: new Float32Array(laps),
    ph: new Float32Array(ph),
  };
  return lineCache;
};

const COMMON = /* glsl */ `
uniform vec3 uC;      // ring centre (camera space)
uniform vec3 uU;      // plane axis toward screen right
uniform vec3 uV;      // plane axis toward the camera
uniform vec3 uN;      // plane normal
uniform float uR0;
uniform float uWFar;
uniform float uWNear;
uniform float uBreath;
const float TH_TAIL = ${TH_TAIL.toFixed(4)};
const float TH_END = ${TH_END.toFixed(4)};
float widthAt(float th) {
  // Thin at the tail, broad toward the near side.
  float k = smoothstep(TH_TAIL, 1.513, th);
  return mix(uWFar, uWNear, k * k * (3.0 - 2.0 * k));
}
`;

const ARC_VERT = /* glsl */ `
in vec3 position;
out vec2 vNdc;
void main() { vNdc = position.xy; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const ARC_FRAG = /* glsl */ `
precision highp float;
${COMMON}
uniform float uAspect;
uniform float uTanH;
uniform vec2 uRes;
uniform float uPx;
uniform float uTime;
uniform float uS[${N_LINES}];
uniform float uB[${N_LINES}];
uniform float uLaps[${N_LINES}];
uniform float uPh[${N_LINES}];
uniform vec3 uCore;
uniform vec3 uLine;
uniform vec3 uEdge;
uniform vec3 uWarm;
in vec2 vNdc;
out vec4 outColor;
const float TAU = 6.28318530718;

// Polar coordinates in the plane for a pixel; returns (r, theta, valid).
vec3 polar(vec2 ndc) {
  vec3 d = normalize(vec3(ndc.x * uAspect * uTanH, ndc.y * uTanH, -1.0));
  float den = dot(d, uN);
  if (abs(den) < 1e-5) return vec3(0.0, 0.0, 0.0);
  float t = dot(uC, uN) / den;
  if (t <= 0.0) return vec3(0.0, 0.0, 0.0);
  vec3 q = d * t - uC;
  float x = dot(q, uU), y = dot(q, uV);
  return vec3(length(vec2(x, y)), atan(y, x), 1.0);
}

void main() {
  vec3 p = polar(vNdc);
  if (p.z < 0.5) { outColor = vec4(0.0); return; }
  vec2 px = 2.0 / uRes;
  vec3 px1 = polar(vNdc + vec2(px.x, 0.0));
  vec3 py1 = polar(vNdc + vec2(0.0, px.y));
  float r = p.x / uBreath;
  float th = p.y;
  float W = widthAt(th);
  // Gradient of the normalised in-bundle coordinate u = (r - R0) / W(theta), per pixel.
  float u = (r - uR0) / W;
  float ux = (px1.x / uBreath - uR0) / widthAt(px1.y) - u;
  float uy = (py1.x / uBreath - uR0) / widthAt(py1.y) - u;
  float grad = max(length(vec2(ux, uy)), 1e-6); // u units per pixel

  // Brightness envelope along the arc: fade at the tail and at the exit.
  // Where the bundle is narrow its lines overlap; dim it so the tail fades
  // instead of forming a hot spot.
  float narrow = pow(clamp(W / 0.5, 0.08, 1.0), 0.8);
  float env = narrow * smoothstep(TH_TAIL, TH_TAIL + 1.1, th) * (1.0 - smoothstep(TH_END - 0.9, TH_END, th));
  env *= 0.6 + 0.4 * smoothstep(-1.6, 0.6, th);
  if (env <= 0.0 || u < -0.6 || u > 1.6) { outColor = vec4(0.0); return; }

  // Line widths in 4K pixels, converted to this resolution. The rendered core
  // is never thinner than ~0.8 px; thinner lines just get dimmer.
  float coreW = 1.2 * uPx;
  float coreR = max(coreW, 1.25);
  float coreAmp = coreW / coreR;
  float haloR = 7.0 * uPx;

  vec3 col = vec3(0.0);
  for (int i = 0; i < ${N_LINES}; i++) {
    float dPx = abs(u - uS[i]) / grad;
    if (dPx > haloR * 3.5) continue;
    float flow = 0.45 + 0.55 * pow(0.5 + 0.5 * cos(3.0 * (th - TAU * uLaps[i] * uTime) + TAU * uPh[i]), 3.0);
    float k = uB[i] * flow;
    float edgeMix = smoothstep(0.25, 0.5, abs(uS[i] - 0.5));
    vec3 lc = mix(uLine, uEdge, edgeMix);
    float core = exp(-dPx * dPx / (coreR * coreR * 0.36)) * coreAmp;
    float halo = exp(-dPx * dPx / (haloR * haloR));
    col += k * (mix(lc, uCore, 0.55) * core * 1.5 + lc * halo * 0.3);
  }
  // Warm glow under the brightest, broad part.
  float bandC = (u - 0.5) / 0.62;
  float warm = exp(-bandC * bandC * bandC * bandC) * smoothstep(-0.6, 1.2, th);
  col += uWarm * warm * 1.1;
  outColor = vec4(col * env, 1.0);
}
`;

// Sparkles ride along the bundle, drifting with the flow (whole trips).
const SPARK_VERT = /* glsl */ `
${COMMON}
uniform float uPx;
uniform float uProj;
uniform float uTime;
attribute vec4 aP; // s, theta0 (0..1 of range), trips, twinkle phase
attribute vec2 aQ; // twinkle cycles, glint flag
varying vec3 vCol;
varying float vGlint;
uniform vec3 uCol;
const float TAU = 6.28318530718;
void main() {
  float f = fract(aP.y + aP.z * uTime);
  float th = mix(TH_TAIL, TH_END, f);
  float W = widthAt(th);
  float r = (uR0 + aP.x * W) * uBreath;
  vec3 pos = uC + r * (cos(th) * uU + sin(th) * uV);
  vec4 mv = vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  float dist = -pos.z;
  float env = smoothstep(0.0, 0.12, f) * (1.0 - smoothstep(0.82, 1.0, f));
  float tw = pow(0.5 + 0.5 * sin(TAU * (aQ.x * uTime + aP.w)), 3.0);
  float size = (aQ.y > 0.5 ? 36.0 : 15.0) * uPx * (6.0 / dist);
  float D = max(size, 1.6);
  vCol = uCol * env * (0.9 + 4.0 * tw) * (aQ.y > 0.5 ? 1.6 : 1.0) * min(1.0, (size * size) / (D * D) * 1.0);
  vGlint = aQ.y;
  gl_PointSize = D;
}
`;

const SPARK_FRAG = /* glsl */ `
varying vec3 vCol;
varying float vGlint;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(c, c);
  float a = exp(-r2 * 7.0);
  if (vGlint > 0.5) {
    float star = exp(-abs(c.x) * 22.0) * exp(-c.y * c.y * 2.5) + exp(-abs(c.y) * 22.0) * exp(-c.x * c.x * 2.5);
    a = exp(-r2 * 30.0) * 1.5 + star * 0.8;
  }
  gl_FragColor = vec4(vCol * a, 1.0);
}
`;

const N_SPARK = 500;
let sparkCache: { p: Float32Array; q: Float32Array } | null = null;
const sparks = () => {
  if (sparkCache) return sparkCache;
  const rng = mulberry32(0x5ba4c1e);
  const L = lines();
  const p = new Float32Array(N_SPARK * 4);
  const q = new Float32Array(N_SPARK * 2);
  for (let i = 0; i < N_SPARK; i++) {
    // Mostly on lines, a few between them.
    const s = rng() < 0.8 ? L.s[Math.floor(rng() * L.s.length)] : rng() * 1.1 - 0.05;
    p.set([s, rng(), 1 + Math.floor(rng() * 2), rng()], i * 4);
    q.set([1 + Math.floor(rng() * 4), rng() < 0.05 ? 1 : 0], i * 2);
  }
  sparkCache = { p, q };
  return sparkCache;
};

const planeAxes = () => {
  // Start with the plane facing the camera (normal +z), U = +x, V = -y
  // (toward the bottom of the screen), then pitch it back and roll it.
  const m = new THREE.Matrix4()
    .makeRotationZ(GEO.roll)
    .multiply(new THREE.Matrix4().makeRotationX(-GEO.pitch));
  const U = new THREE.Vector3(1, 0, 0).applyMatrix4(m);
  const V = new THREE.Vector3(0, -1, 0).applyMatrix4(m);
  const N = new THREE.Vector3(0, 0, 1).applyMatrix4(m);
  return { U, V, N };
};

export const makeArc =
  (p: ArcProps): LookFactory =>
  (ctx) => {
    const L = lines();
    const S = sparks();
    const { U, V, N } = planeAxes();
    const C = new THREE.Vector3(...GEO.centre);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV, ctx.width / ctx.height, 0.05, 100);
    camera.position.set(0, 0, 0);
    camera.updateMatrixWorld();
    const tanH = Math.tan(((FOV / 2) * Math.PI) / 180);
    const shared = {
      uC: { value: C },
      uU: { value: U },
      uV: { value: V },
      uN: { value: N },
      uR0: { value: GEO.R0 },
      uWFar: { value: GEO.wFar },
      uWNear: { value: GEO.wNear },
      uBreath: { value: 1 },
      uTime: { value: 0 },
      uPx: { value: ctx.px },
    };
    const arcMat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: ARC_VERT,
      fragmentShader: ARC_FRAG,
      uniforms: {
        ...shared,
        uAspect: { value: ctx.width / ctx.height },
        uTanH: { value: tanH },
        uRes: { value: new THREE.Vector2(ctx.width, ctx.height) },
        uS: { value: Array.from(L.s) },
        uB: { value: Array.from(L.b) },
        uLaps: { value: Array.from(L.laps) },
        uPh: { value: Array.from(L.ph) },
        uCore: { value: new THREE.Vector3(...hexToRgb(p.core)) },
        uLine: { value: new THREE.Vector3(...hexToRgb(p.line)) },
        uEdge: { value: new THREE.Vector3(...hexToRgb(p.edge)) },
        uWarm: { value: new THREE.Vector3(...hexToRgb(p.warm)) },
      },
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      transparent: true,
    });
    const tri = new THREE.BufferGeometry();
    tri.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    const arc = new THREE.Mesh(tri, arcMat);
    arc.frustumCulled = false;
    scene.add(arc);

    const sparkMat = new THREE.ShaderMaterial({
      vertexShader: SPARK_VERT,
      fragmentShader: SPARK_FRAG,
      uniforms: {
        ...shared,
        uProj: { value: ctx.height / (2 * tanH) },
        uCol: { value: new THREE.Vector3(...hexToRgb(p.core)) },
      },
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      transparent: true,
    });
    scene.add(pointsFrom({ position: { array: new Float32Array(N_SPARK * 3), size: 3 }, aP: { array: S.p, size: 4 }, aQ: { array: S.q, size: 2 } }, sparkMat));

    const post = {
      background: hexToRgb(p.background),
      glows: [],
      bloomStrength: 0.6,
      vignette: 0,
      grain: 0.015,
      grainLumaCut: 0.03,
    };
    return {
      scene,
      camera,
      post,
      update: (f) => {
        const t = f / 600;
        shared.uTime.value = t;
        shared.uBreath.value = 1 + 0.015 * Math.sin(TAU * t);
      },
      dispose: () => {
        arcMat.dispose();
        sparkMat.dispose();
        tri.dispose();
      },
    };
  };
