import React, { useMemo } from "react";
import * as THREE from "three";
import { hexToRgb } from "../lib/color";
import { BuiltScene, GLStage, SceneFactory } from "../lib/gl/Stage";
import { PostParams } from "../lib/gl/post";
import { FULLSCREEN_VERT } from "../lib/gl/shaders";
import { mulberry32, TAU } from "../lib/random";
import type { SoftGradientRow } from "../versions";

// sRGB hex -> OKLab (CPU side; the shader mixes in OKLab and converts back).
const toLin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
export const hexToOklab = (hex: string): [number, number, number] => {
  const [r, g, b] = hexToRgb(hex).map(toLin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
};

const MAX_BLOBS = 6;

const FRAG = /* glsl */ `
precision highp float;
uniform float uAspect;
uniform float uPhase;          // 0..1 over the loop
uniform vec3 uBase;            // OKLab
uniform float uBaseWeight;
uniform vec3 uLab[${MAX_BLOBS}];
uniform vec4 uPath[${MAX_BLOBS}];  // centre x, y, amp x, amp y
uniform vec4 uFreq[${MAX_BLOBS}];  // cycles x, cycles y (integers), phase x, phase y
uniform vec2 uShape[${MAX_BLOBS}]; // sigma (frame heights), weight
uniform vec2 uAniso[${MAX_BLOBS}]; // angle (rad), stretch (>=1 = elongated)
uniform int uCount;
uniform float uWarp;
uniform float uLift;           // airy white swirl amount (OKLab, toward white)
uniform float uPower;         // >1 keeps regions purer (less averaging)
in vec2 vUv;
out vec4 outColor;

// Simplex 3D noise (Ashima Arts / Stefan Gustavson, MIT).
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 105.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

vec3 oklabToSrgb(vec3 c) {
  float l_ = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
  float m_ = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
  float s_ = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
  float l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
  vec3 lin = vec3(
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s);
  lin = clamp(lin, 0.0, 1.0);
  vec3 lo = lin * 12.92;
  vec3 hi = 1.055 * pow(lin, vec3(1.0 / 2.4)) - 0.055;
  return mix(lo, hi, step(vec3(0.0031308), lin));
}

void main() {
  vec2 p = vec2(vUv.x * uAspect, vUv.y);
  float th = uPhase * 6.28318530718;
  // Gentle domain warp: noise sampled while its offset travels a circle in
  // the noise field, so the warp returns to its start each loop.
  vec2 circ = 0.9 * vec2(cos(th), sin(th));
  vec2 warp = vec2(
    snoise(vec3(p * 1.1 + circ, 1.7)),
    snoise(vec3(p * 1.1 - circ.yx, 8.3)));
  p += warp * uWarp;

  float bw = pow(uBaseWeight, uPower);
  vec3 lab = uBase * bw;
  float wsum = bw;
  for (int i = 0; i < ${MAX_BLOBS}; i++) {
    if (i >= uCount) break;
    vec4 path = uPath[i];
    vec4 fr = uFreq[i];
    vec2 c = path.xy + path.zw * vec2(sin(th * fr.x + fr.z), sin(th * fr.y + fr.w));
    vec2 d = p - c;
    vec2 an = uAniso[i];
    float ca = cos(an.x), sa = sin(an.x);
    d = vec2(ca * d.x + sa * d.y, -sa * d.x + ca * d.y);
    d.x /= an.y;
    float sig = uShape[i].x;
    float w = pow(uShape[i].y * exp(-dot(d, d) / (2.0 * sig * sig)), uPower);
    lab += uLab[i] * w;
    wsum += w;
  }
  lab /= wsum;
  // Airy whitish swathe: a slow noise field (looping on the time circle)
  // lifts lightness and lowers chroma, like light washing through.
  vec2 q = vec2(p.x * 0.8 + p.y * 0.55, -p.x * 0.35 + p.y * 1.1);
  float sw = smoothstep(-0.2, 0.7, snoise(vec3(q * 0.85 + circ * 0.5, 4.1)));
  lab = mix(lab, vec3(1.0, 0.0, 0.0), uLift * sw);
  outColor = vec4(oklabToSrgb(lab), 0.0);
}
`;

const makeFactory = (row: SoftGradientRow): SceneFactory => () => {
  const rng = mulberry32(row.seed);
  const aspect = 16 / 9;
  const n = Math.min(row.blobs.length, MAX_BLOBS);
  const lab: THREE.Vector3[] = [];
  const path: THREE.Vector4[] = [];
  const freq: THREE.Vector4[] = [];
  const shape: THREE.Vector2[] = [];
  const aniso: THREE.Vector2[] = [];
  for (let i = 0; i < MAX_BLOBS; i++) {
    const b = row.blobs[Math.min(i, n - 1)];
    lab.push(new THREE.Vector3(...hexToOklab(b.color)));
    const cx = b.at ? b.at[0] * aspect : (0.15 + rng() * 0.7) * aspect;
    const cy = b.at ? b.at[1] : 0.2 + rng() * 0.6;
    const ax = (0.18 + rng() * 0.22) * (b.drift ?? 1);
    const ay = (0.12 + rng() * 0.16) * (b.drift ?? 1);
    path.push(new THREE.Vector4(cx, cy, ax, ay));
    // Whole cycles per 600 frames: the path closes exactly.
    const fx = 1 + Math.floor(rng() * 2);
    const fy = 1 + Math.floor(rng() * 2);
    freq.push(new THREE.Vector4(fx, fy, rng() * TAU, rng() * TAU));
    shape.push(new THREE.Vector2(b.radius, b.weight));
    aniso.push(new THREE.Vector2(((b.angle ?? 0) * Math.PI) / 180, b.stretch ?? 1));
  }
  const material = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: FULLSCREEN_VERT,
    fragmentShader: FRAG,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uAspect: { value: aspect },
      uPhase: { value: 0 },
      uBase: { value: new THREE.Vector3(...hexToOklab(row.base)) },
      uBaseWeight: { value: row.baseWeight },
      uLab: { value: lab },
      uPath: { value: path },
      uFreq: { value: freq },
      uShape: { value: shape },
      uAniso: { value: aniso },
      uCount: { value: n },
      uWarp: { value: row.warp },
      uPower: { value: row.power },
      uLift: { value: row.lift },
    },
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  const mesh = new THREE.Mesh(g, material);
  mesh.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(mesh);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const built: BuiltScene = {
    scene,
    camera,
    update: (frame) => {
      material.uniforms.uPhase.value = frame / 600;
    },
    dispose: () => {
      g.dispose();
      material.dispose();
    },
  };
  return built;
};

export const SoftGradient: React.FC<{ row: SoftGradientRow }> = ({ row }) => {
  const build = useMemo(() => makeFactory(row), [row]);
  const post = useMemo<PostParams>(
    () => ({ bgTop: "#000000", bgBottom: "#000000", grain: row.grain, vignette: 0 }),
    [row],
  );
  return <GLStage build={build} post={post} />;
};
