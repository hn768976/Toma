import { Container } from "pixi.js";
import { fullscreenMesh, GLSL_COMMON } from "../lib/gl";
import type { LookBuilder } from "../lib/stage";
import { hexToRgb, spline } from "../lib/timeline";

export interface FlareBurstParams {
  glow: string;
  core: string;
  whiteout: string;
  ghost: string;
}

const FRAG = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
in vec2 vUV;
out vec4 finalColor;
uniform float uAspect;
uniform vec3 uGlow, uCore, uWhiteCol, uGhost;
uniform vec4 uFlare;  // pos.x, pos.y, scale, intensity
uniform vec4 uFx;     // whiteout, hexMix, rotation, -
${GLSL_COMMON}
const float PX = 1.0 / 720.0;

float h1(float i, float s) { return hash21(vec2(i, s)); }

float sdHex(vec2 p, float r) {
  const vec3 k = vec3(-0.866025404, 0.5, 0.577350269);
  p = abs(p);
  p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
  p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
  return length(p) * sign(p.y);
}

vec3 rays(vec2 d, float S, float I) {
  float r = length(d);
  float a = atan(d.y, d.x) - uFx.z;
  vec3 acc = vec3(0.0);
  // ~60 fine rays of varied length and brightness.
  const float N = 60.0;
  float fi = floor(a / TAU * N + 0.5);
  for (int k = -1; k <= 1; k++) {
    float i = mod(fi + float(k), N);
    float ang = (i + 0.35 * (h1(i, 3.0) - 0.5)) / N * TAU;
    float da = a - ang; da = mod(da + PI, TAU) - PI;
    float perp = abs(sin(da)) * r;
    float len = S * (0.18 + 0.55 * h1(i, 7.0) * h1(i, 8.0) + 0.12 * h1(i, 9.0));
    float w = 1.6 * PX + 0.004 * S;
    float prof = exp(-pow(perp / w, 2.0)) * step(abs(da), 1.2);
    float b = 0.25 + 0.75 * h1(i, 11.0);
    acc += mix(uGlow, uCore, 0.75) * prof * exp(-r / len) * b * 0.24;
  }
  // 6 long rays.
  float a6 = a - 0.5236 + uFx.z; // one long ray stays vertical
  float j = floor(a6 / TAU * 6.0 + 0.5);
  float da6 = a6 - j / 6.0 * TAU; da6 = mod(da6 + PI, TAU) - PI;
  float perp6 = abs(sin(da6)) * r;
  float len6 = S * (0.75 + 0.25 * h1(j, 21.0));
  float w6 = 2.4 * PX + 0.006 * S;
  acc += mix(uCore, vec3(1.0), 0.3) * exp(-pow(perp6 / w6, 2.0)) * exp(-r / len6) * 0.38 * step(abs(da6), 1.2);
  acc += uGlow * exp(-pow(perp6 / (w6 * 5.0), 2.0)) * exp(-r / (len6 * 0.8)) * 0.25 * step(abs(da6), 1.2);
  // Fade rays into the core so the centre is a clean glow.
  return acc * I * smoothstep(0.0, 0.03 * S + 4.0 * PX, r);
}

vec3 ghosts(vec2 p, vec2 P, vec2 C, float S, float I) {
  vec3 acc = vec3(0.0);
  // Ghost axis runs through the frame centre; keep it long enough that the
  // ghosts stay spread out when the flare sits near the centre.
  vec2 v = P - C;
  v *= max(1.0, 0.34 / max(length(v), 1e-3));
  for (int k = 0; k < 8; k++) {
    float fk = float(k);
    float f = mix(-1.55, 0.7, h1(fk, 31.0));
    if (k == 0) f = -0.42; if (k == 1) f = -0.95; if (k == 2) f = 0.38; if (k == 3) f = -1.4;
    vec2 g = C + v * f;
    float rad = S * (0.05 + 0.13 * h1(fk, 33.0));
    vec2 q = p - g;
    float hexK = mod(fk, 2.0) < 0.5 ? uFx.y : uFx.y * 0.5;
    float sd = mix(length(q) - rad, sdHex(q, rad * 0.93), hexK);
    float soft = rad * 0.3 + 1.5 * PX;
    float fill = smoothstep(soft, -soft, sd);
    float rim = exp(-pow(sd / (rad * 0.2 + PX), 2.0)) * 0.5;
    float b = (0.06 + 0.1 * h1(fk, 35.0)) * I;
    vec3 col = mix(mix(uGhost, uCore, 0.45), uGlow, h1(fk, 37.0) * 0.5);
    acc += col * (fill * (0.55 + 0.45 * length(q) / max(rad, 1e-4)) + rim * 0.8) * b;
  }
  return acc;
}

vec3 softClip(vec3 c) {
  vec3 k = vec3(0.8);
  return mix(c, k + (1.0 - k) * (1.0 - exp(-(c - k) / (1.0 - k))), step(k, c));
}

void main() {
  vec2 p = vec2(vUV.x * uAspect, vUV.y);
  vec2 P = uFlare.xy;
  float S = uFlare.z, I = uFlare.w;
  vec2 C = vec2(0.5 * uAspect, 0.5);
  vec2 d = p - P;
  float r = length(d);
  vec3 c = vec3(0.0);
  if (I > 0.0) {
    // Core and glow.
    c += uCore * (exp(-pow(r / (0.03 * S + 2.0 * PX), 2.0)) * 2.4 + exp(-r / (0.06 * S)) * 1.0) * I;
    c += mix(uGlow, uCore, 0.35) * exp(-r / (0.12 * S)) * 0.6 * I;
    // Broad coloured wash that fills much of the frame (glow -> ghost hue outward).
    // Broad, warm, soft wash: core gold -> ghost pink -> glow violet toward the edges.
    float rs = r / S;
    vec3 gold = uCore * vec3(1.0, 0.82, 0.62);
    vec3 washCol = mix(mix(gold, uGhost, smoothstep(0.2, 0.75, rs)), uGlow * 0.8, smoothstep(0.6, 1.4, rs));
    c += washCol * (exp(-pow(rs / 0.4, 2.0)) * 0.6 + exp(-pow(rs / 1.1, 2.0)) * 0.3) * I;
    c += rays(d, S, I);
    // Halo ring with a little chromatic split.
    float R = 0.34 * S;
    float w = 0.0045 * S + 1.2 * PX;
    vec3 ring = vec3(exp(-pow((r - R * 1.012) / w, 2.0)), exp(-pow((r - R) / w, 2.0)), exp(-pow((r - R * 0.988) / w, 2.0)));
    c += (ring * mix(uGlow, vec3(1.0), 0.45) * 0.08 + mix(uCore, uGhost, 0.35) * exp(-pow((r - R) / (0.07 * S), 2.0)) * 0.3) * I;
    // Anamorphic horizontal streak.
    float dy = abs(d.y), dx = abs(d.x);
    c += mix(uGlow, uCore, 0.35) * (exp(-pow(dy / (0.012 * S + 2.0 * PX), 2.0)) * exp(-dx / (0.8 * S)) * 0.18
       + exp(-pow(dy / (0.03 * S), 2.0)) * exp(-dx / (0.5 * S)) * 0.14) * I;
    c += ghosts(p, P, C, S, I);
  }
  c = softClip(max(c, 0.0));
  // White-out spreads outward from the flare until the whole frame is white.
  float W = uFx.x;
  float wl = smoothstep(0.0, 1.0, (W - 0.35 * min(r / 2.1, 1.0)) / 0.65);
  // The blown-out frame stays warm toward the edges, with faint rays showing through.
  vec3 wcol = mix(uWhiteCol, mix(uWhiteCol, uCore, 0.55), smoothstep(0.35, 1.5, r));
  c = mix(c, wcol, wl);
  finalColor = vec4(c, 1.0);
}`;

const FPS = 30;

export const buildFlareBurst: LookBuilder<FlareBurstParams> = ({ width, height }, params) => {
  const aspect = width / height;
  const v3 = (hex: string) => ({ value: new Float32Array(hexToRgb(hex)), type: "vec3<f32>" });
  const v4 = () => ({ value: new Float32Array(4), type: "vec4<f32>" });
  const { mesh, u } = fullscreenMesh(width, height, FRAG, {
    uAspect: { value: aspect, type: "f32" },
    uGlow: v3(params.glow),
    uCore: v3(params.core),
    uWhiteCol: v3(params.whiteout),
    uGhost: v3(params.ghost),
    uFlare: v4(),
    uFx: v4(),
  });
  const scene = new Container();
  scene.addChild(mesh);

  const inten = spline([[0.12, 0], [0.5, 0.5], [1.4, 0.85], [2.0, 1.6], [2.8, 1.6], [3.5, 1.1], [4.5, 1.0], [5.85, 0]]);
  const scale = spline([[0.2, 0.22], [0.5, 0.28], [1.3, 0.6], [2.0, 1.3], [2.45, 1.95], [2.8, 1.85], [3.7, 1.08], [4.5, 1.0], [6.0, 1.06]]);
  const white = spline([[1.75, 0], [2.5, 1], [2.8, 1], [3.6, 0]]);
  const px = spline([[0, 0.3], [2.0, 0.41], [2.8, 0.43], [3.8, 0.45]]);
  const py = spline([[0, 0.5], [2.0, 0.52], [3.8, 0.55]]);
  const hex = spline([[0, 0.25], [3.2, 1]]);

  return {
    scene,
    update(frame) {
      const t = frame / FPS;
      const ends = frame <= 0 || frame >= 179 ? 0 : 1;
      const f = u.uFlare as Float32Array;
      f[0] = px(t) * aspect;
      f[1] = py(t);
      f[2] = scale(t);
      f[3] = Math.max(0, inten(t)) * ends;
      const fx = u.uFx as Float32Array;
      fx[0] = white(t) * ends;
      fx[1] = hex(t);
      fx[2] = 0.035 * t; // slow, smooth ray rotation
    },
  };
};
