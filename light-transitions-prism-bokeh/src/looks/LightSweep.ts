import { Container } from "pixi.js";
import { fullscreenMesh, GLSL_COMMON } from "../lib/gl";
import type { LookBuilder } from "../lib/stage";
import { envelope, hexToRgb, smootherstep, spline } from "../lib/timeline";

export interface LightSweepParams {
  /** Thin streak glow colour (core is white). */
  streak: string;
  /** Band gradient: deep (trailing) -> mid -> bright (leading edge). */
  bandDeep: string;
  bandMid: string;
  bandBright: string;
}

// Units: y in [0,1] = frame height, x in [0,aspect]. 1/720 = one pixel at 720p.
const FRAG = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
in vec2 vUV;
out vec4 finalColor;
uniform float uAspect;
uniform vec3 uStreak;
uniform vec3 uDeep, uMid, uBright;
// Streaks: curve (y0, slope, curvature, xc), anim (xTail, xHead, intensity, whiteMix)
uniform vec4 uCurveA, uAnimA, uCurveD, uAnimD;
uniform vec4 uBand;   // lead, intensity, -, -
uniform vec4 uShard;  // cx, cy, intensity, -
${GLSL_COMMON}
float n1(float x, float seed) {
  float i = floor(x), f = fract(x);
  float u = f * f * (3.0 - 2.0 * f);
  return mix(hash21(vec2(i, seed)), hash21(vec2(i + 1.0, seed)), u) * 2.0 - 1.0;
}
const float PX = 1.0 / 720.0;

vec3 streak(vec2 p, vec4 cv, vec4 an, vec3 col, float seed) {
  if (an.z <= 0.0) return vec3(0.0);
  float x = p.x;
  float dx = x - cv.w;
  // Fixed arc jitter (does not change over time -> no shimmer).
  float jit = 2.2 * PX * n1(x * 38.0, seed) + 1.0 * PX * n1(x * 110.0, seed + 3.0);
  float yc = cv.x + cv.y * dx + cv.z * dx * dx + jit;
  float slope = cv.y + 2.0 * cv.z * dx;
  float d = abs(p.y - yc) / sqrt(1.0 + slope * slope);
  float len = max(an.y - an.x, 1e-3);
  float along = (x - an.x) / len;            // 0 at tail, 1 at head
  float m = smoothstep(0.0, 0.25, along) * (1.0 - smoothstep(1.0, 1.0 + 6.0 * PX / len, along));
  m *= mix(0.25, 1.0, sat(along));
  float core = exp(-pow(d / (1.35 * PX), 2.0));
  float glow = 0.45 * exp(-d / (5.0 * PX)) + 0.14 * exp(-pow(d / (22.0 * PX), 2.0));
  vec2 head = vec2(an.y, cv.x + cv.y * (an.y - cv.w) + cv.z * (an.y - cv.w) * (an.y - cv.w));
  float hd = length(p - head);
  float headGlow = exp(-pow(hd / (9.0 * PX), 2.0)) * 1.4 + exp(-hd / (30.0 * PX)) * 0.35;
  vec3 white = vec3(1.0);
  vec3 coreCol = mix(col, white, an.w);
  return an.z * (m * (coreCol * core * 1.2 + col * glow) + (mix(col, white, 0.6) * headGlow) * step(0.0, along) * smoothstep(1.4, 0.95, along));
}

vec3 bandGrad(float g) {
  // g: 0 = leading edge (bright) -> 1 = trailing (deep)
  vec3 c = mix(uBright, uMid, smoothstep(0.4, 0.8, g));
  return mix(c, uDeep, smoothstep(0.75, 1.1, g));
}

vec3 band(vec2 p) {
  if (uBand.y <= 0.0) return vec3(0.0);
  vec2 q = p - vec2(0.5 * uAspect, 0.5);
  vec2 n = normalize(vec2(-1.0, 0.82));      // travel: upper right -> lower left
  vec2 t = vec2(n.y, -n.x);
  float across = dot(q, t);
  float s = dot(q, n) + 0.09 * across * across; // bowed leading edge
  float lead = uBand.x;
  const float W = 1.25;
  float g = (lead - s) / W;
  float front = smoothstep(-0.004, 0.012, lead - s);       // just behind the edge
  float back = 1.0 - smoothstep(0.95, 1.4, g);             // long soft trailing fade
  // Slow broad variation across the band so it is not a flat fill.
  float var = 0.94 + 0.06 * sin(across * 4.1 + 1.3);
  vec3 fill = bandGrad(sat(g)) * front * back * var;
  // Inner bloom just behind the leading edge.
  float e = lead - s;
  fill += mix(uBright, vec3(1.0), 0.35) * 0.35 * exp(-max(e, 0.0) / 0.05) * front;
  // White edge line on the leading edge.
  float de = abs(e) * inversesqrt(1.0 + pow(0.18 * across, 2.0));
  vec3 edge = vec3(1.0) * exp(-pow(de / (2.4 * PX), 2.0)) * 1.25
            + mix(uBright, vec3(1.0), 0.5) * (0.45 * exp(-de / (7.0 * PX)) + 0.12 * exp(-de / (40.0 * PX)));
  return uBand.y * (fill + edge);
}

vec3 sliver(vec2 p, vec2 c, vec2 a, float L, float w, vec3 col) {
  vec2 q = p - c;
  float u = dot(q, a);
  float v = dot(q, vec2(-a.y, a.x));
  float k = u / (0.5 * L);
  float hw = w * max(1.0 - k * k, 0.0);
  float inside = smoothstep(hw + 0.9 * PX, hw - 0.9 * PX, abs(v)) * step(abs(k), 1.0);
  float coreL = exp(-pow(v / (1.2 * PX), 2.0)) * max(1.0 - k * k, 0.0);
  float glow = exp(-abs(v) / (10.0 * PX)) * max(1.0 - abs(k), 0.0);
  float shade = 0.55 + 0.45 * (1.0 - abs(v) / max(hw, 1e-4));
  return col * (inside * shade * 0.9 + glow * 0.45) + vec3(1.0) * coreL * 0.9 * step(abs(k), 1.0);
}

vec3 shard(vec2 p) {
  if (uShard.z <= 0.0) return vec3(0.0);
  vec2 a = normalize(vec2(1.0, -0.78));
  vec2 c = uShard.xy;
  vec3 col = uStreak;
  vec3 r = sliver(p, c, a, 1.05, 9.0 * PX, col);
  r += 0.55 * sliver(p, c + vec2(-a.y, a.x) * (34.0 * PX) - a * 0.08, a, 0.8, 3.5 * PX, col);
  return uShard.z * r;
}

vec3 softClip(vec3 c) {
  vec3 k = vec3(0.82);
  return mix(c, k + (1.0 - k) * (1.0 - exp(-(c - k) / (1.0 - k))), step(k, c));
}

void main() {
  vec2 p = vec2(vUV.x * uAspect, vUV.y);
  vec3 c = band(p);
  c += streak(p, uCurveA, uAnimA, uStreak, 1.0);
  c += streak(p, uCurveD, uAnimD, mix(uStreak, vec3(1.0), 0.75), 5.0);
  c += shard(p);
  finalColor = vec4(softClip(max(c, 0.0)), 1.0);
}`;

const FPS = 30;

export const buildLightSweep: LookBuilder<LightSweepParams> = ({ width, height }, params) => {
  const aspect = width / height;
  const v4 = (a = 0, b = 0, c = 0, d = 0) => ({ value: new Float32Array([a, b, c, d]), type: "vec4<f32>" });
  const v3 = (hex: string) => ({ value: new Float32Array(hexToRgb(hex)), type: "vec3<f32>" });
  const { mesh, u } = fullscreenMesh(width, height, FRAG, {
    uAspect: { value: aspect, type: "f32" },
    uStreak: v3(params.streak),
    uDeep: v3(params.bandDeep),
    uMid: v3(params.bandMid),
    uBright: v3(params.bandBright),
    // Streak A: low gentle curve across the lower third, left -> right.
    uCurveA: v4(0.7, -0.12, 0.09, aspect * 0.5),
    uAnimA: v4(),
    // Streak D: skims the bottom right.
    uCurveD: v4(0.86, -0.07, 0.16, aspect * 0.78),
    uAnimD: v4(),
    uBand: v4(),
    uShard: v4(),
  });
  const scene = new Container();
  scene.addChild(mesh);

  // --- Timeline (seconds). All splines are monotone & eased: no jumps. ---
  const headA = spline([[0.12, -0.05], [0.95, aspect + 0.15]]);
  const tailA = spline([[0.3, -0.3], [1.2, aspect + 0.1]]);
  const lead = spline([
    [1.2, -1.35],
    [2.0, -0.05],
    [3.1, 0.95],
    [4.5, 3.05],
  ]);
  const shardU = spline([[4.5, -0.55], [5.8, 0.75]]);
  const headD = spline([[6.0, aspect * 0.48], [6.9, aspect + 0.1]]);
  const tailD = spline([[6.15, aspect * 0.4], [7.25, aspect + 0.05]]);

  const set = (name: string, vals: number[]) => {
    const arr = u[name] as Float32Array;
    for (let i = 0; i < vals.length; i++) arr[i] = vals[i];
  };

  return {
    scene,
    update(frame) {
      const t = frame / FPS;
      // Hard guarantee: first and last frame fully black.
      const ends = frame <= 0 || frame >= 239 ? 0 : 1;
      set("uAnimA", [tailA(t), headA(t), envelope(0.1, 0.3, 0.85, 1.2, t) * ends, 0.75]);
      set("uBand", [lead(t), smootherstep(1.2, 1.35, t) * (1 - smootherstep(4.35, 4.6, t)) * ends]);
      const su = shardU(t);
      const a = [1 / Math.hypot(1, 0.78), -0.78 / Math.hypot(1, 0.78)];
      set("uShard", [0.32 + a[0] * su, 0.3 + a[1] * su, envelope(4.5, 4.75, 5.35, 5.95, t) * ends]);
      set("uAnimD", [tailD(t), headD(t), envelope(5.98, 6.2, 6.9, 7.45, t) * ends, 0.9]);
    },
  };
};
