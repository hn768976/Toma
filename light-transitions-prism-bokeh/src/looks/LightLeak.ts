import { Container } from "pixi.js";
import { fullscreenMesh, GLSL_COMMON } from "../lib/gl";
import type { LookBuilder } from "../lib/stage";
import { envelope, hexToRgb, noise1, spline } from "../lib/timeline";

export interface LightLeakParams {
  deep: string;
  mid: string;
  core: string;
  accent: string;
}

const N_LEAKS = 4;

const FRAG = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
in vec2 vUV;
out vec4 finalColor;
uniform float uAspect;
uniform float uTime;
uniform vec3 uDeep, uMid, uCore, uAccent;
uniform vec4 uLeakA[${N_LEAKS}]; // cx, cy, radius, intensity
uniform vec4 uLeakB[${N_LEAKS}]; // seed, stretch, angle, accent
uniform vec4 uStreak;            // intensity, angle, offset, -
${GLSL_COMMON}

vec3 ramp(float I, vec3 deep, vec3 mid, vec3 core) {
  vec3 c = deep * 2.2 * min(I, 0.3) / 0.3 * (1.0 - 0.5 * smoothstep(0.3, 0.8, I));
  c += mid * smoothstep(0.18, 0.72, I) * 1.4;
  c += core * smoothstep(0.55, 1.3, I) * 1.6;
  // Pale icy band where the coloured wash turns into the blown-out core.
  c += mix(mid, vec3(0.75, 0.85, 1.0), 0.6) * smoothstep(0.45, 0.85, I) * (1.0 - smoothstep(0.95, 1.3, I)) * 0.45;
  return c;
}

void main() {
  vec2 p = vec2(vUV.x * uAspect, vUV.y);
  vec3 c = vec3(0.0);
  for (int i = 0; i < ${N_LEAKS}; i++) {
    vec4 A = uLeakA[i];
    vec4 B = uLeakB[i];
    if (A.w <= 0.0) continue;
    vec2 q = p - A.xy;
    float ca = cos(B.z), sa = sin(B.z);
    q = mat2(ca, sa, -sa, ca) * q;
    q.x /= B.y;
    // Domain warp from fixed noise, drifting slowly with time.
    vec2 w = vec2(fbm(q * 1.7 + B.x + vec2(0.0, uTime * 0.07)), fbm(q * 1.7 + B.x + 5.2 - vec2(uTime * 0.06, 0.0))) - 0.5;
    vec2 qw = q + w * 0.22 * A.z;
    float d = length(qw) / A.z;
    // Broad coloured wash plus a large, round, blown-out disc (out-of-focus light).
    float wash = exp(-d * d * 0.8);
    float disc = smoothstep(0.8, 0.25, d);
    float tex = 0.92 + 0.16 * (fbm(qw * 1.4 / A.z + B.x * 3.1) - 0.5);
    float I = A.w * (0.8 * wash + 0.95 * disc) * tex;
    vec3 deep = mix(uDeep, uAccent * 0.35, B.w);
    vec3 mid = mix(uMid, uAccent, B.w);
    c += ramp(I, deep, mid, uCore);
  }
  // Faint diagonal streak where two leaks overlap.
  if (uStreak.x > 0.0) {
    vec2 n = vec2(cos(uStreak.y), sin(uStreak.y));
    vec2 q = p - vec2(0.5 * uAspect, 0.5);
    float dl = dot(q, vec2(-n.y, n.x)) - uStreak.z;
    float along = dot(q, n);
    float s = exp(-pow(dl / 0.012, 2.0)) * 0.7 + exp(-pow(dl / 0.06, 2.0)) * 0.25;
    s *= exp(-along * along * 1.3);
    c += mix(uMid, uCore, 0.6) * s * uStreak.x;
  }
  // Soft shoulder so overlapping leaks blaze to white instead of clipping hue.
  c = 1.0 - exp(-c * 1.05);
  finalColor = vec4(c, 1.0);
}`;

const FPS = 30;

interface LeakEvent {
  t0: number;
  t1: number;
  from: [number, number];
  to: [number, number];
  radius: number;
  peak: number;
  stretch: number;
  angle: number;
  accent: number;
  seed: number;
}

export const buildLightLeak: LookBuilder<LightLeakParams> = ({ width, height }, params) => {
  const aspect = width / height;
  const A = aspect;
  // Four leak events over 12s, each entering from an edge; black gaps at
  // ~5.9-6.6s and ~9.3-9.8s. Frames 0 and 359 are black.
  const events: LeakEvent[] = [
    { t0: 0.25, t1: 3.3, from: [-0.45, 0.62], to: [0.3, 0.45], radius: 0.52, peak: 1.3, stretch: 1.5, angle: 0.25, accent: 0, seed: 1.3 },
    { t0: 2.5, t1: 5.9, from: [A + 0.45, -0.25], to: [A - 0.3, 0.4], radius: 0.58, peak: 1.2, stretch: 1.35, angle: -0.6, accent: 0, seed: 7.9 },
    { t0: 6.6, t1: 9.3, from: [0.95, 1.5], to: [1.05, 0.7], radius: 0.6, peak: 1.15, stretch: 1.7, angle: 0.1, accent: 1, seed: 13.4 },
    { t0: 9.8, t1: 11.8, from: [-0.35, 0.05], to: [0.35, 0.5], radius: 0.62, peak: 1.35, stretch: 1.45, angle: 0.5, accent: 0, seed: 21.7 },
  ];
  const v3 = (hex: string) => ({ value: new Float32Array(hexToRgb(hex)), type: "vec3<f32>" });
  const { mesh, u } = fullscreenMesh(width, height, FRAG, {
    uAspect: { value: aspect, type: "f32" },
    uTime: { value: 0, type: "f32" },
    uDeep: v3(params.deep),
    uMid: v3(params.mid),
    uCore: v3(params.core),
    uAccent: v3(params.accent),
    uLeakA: { value: new Float32Array(4 * N_LEAKS), type: "vec4<f32>", size: N_LEAKS },
    uLeakB: { value: new Float32Array(4 * N_LEAKS), type: "vec4<f32>", size: N_LEAKS },
    uStreak: { value: new Float32Array(4), type: "vec4<f32>" },
  });
  const scene = new Container();
  scene.addChild(mesh);

  const paths = events.map((e) => {
    const d = e.t1 - e.t0;
    const k = (x: number) => e.t0 + d * x;
    return {
      x: spline([[e.t0, e.from[0]], [k(0.45), e.from[0] + (e.to[0] - e.from[0]) * 0.75], [e.t1, e.to[0]]]),
      y: spline([[e.t0, e.from[1]], [k(0.45), e.from[1] + (e.to[1] - e.from[1]) * 0.75], [e.t1, e.to[1]]]),
      r: spline([[e.t0, e.radius * 0.55], [k(0.5), e.radius], [e.t1, e.radius * 1.15]]),
      env: (t: number) => envelope(e.t0, k(0.38), k(0.62), e.t1, t),
    };
  });

  return {
    scene,
    update(frame) {
      const t = frame / FPS;
      const ends = frame <= 0 || frame >= 359 ? 0 : 1;
      u.uTime = t;
      const la = u.uLeakA as Float32Array;
      const lb = u.uLeakB as Float32Array;
      events.forEach((e, i) => {
        const p = paths[i];
        // Gentle low-frequency flicker from fixed noise (< 2 Hz, +-8%).
        const flicker = 1 + 0.06 * noise1(t * 1.6, 11 + i) + 0.025 * noise1(t * 3.3, 29 + i);
        la.set([p.x(t), p.y(t), p.r(t), e.peak * p.env(t) * flicker * ends], i * 4);
        lb.set([e.seed, e.stretch, e.angle, e.accent], i * 4);
      });
      const overlap = Math.min(paths[0].env(t), paths[1].env(t));
      (u.uStreak as Float32Array).set([1.4 * Math.sqrt(overlap) * ends, -0.52, -0.05 + 0.05 * (t - 2.5), 0]);
    },
  };
};
