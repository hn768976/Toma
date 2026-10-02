import { GLSL_HASH } from "../../lib/gl/glsl";

/**
 * Grain Gradient Glow. Everything is analytic: Gaussian blobs, a soft dark
 * wedge, a vignette and tapered light streaks summed into one "light" scalar,
 * mapped through a 5-stop colour ramp, then grain + dither.
 *
 * Time enters only as uPhase = 2*pi*(frame % 600)/600 and uGrainFrame = frame % 600.
 * Every motion term is sin/cos(k * uPhase + p) with integer k, and the noise
 * is sampled on a circle in time, so frame 600 == frame 0 exactly.
 */
export const GRAIN_GLOW_FRAG = /* glsl */ `
uniform vec2 uRes;
uniform float uPhase;
uniform uint uGrainFrame;
uniform vec3 uRampColor[5];
uniform float uRampAt[5];
in vec2 vUv;
out vec4 outColor;
${GLSL_HASH}

// --- smooth value noise (3D), for gentle domain warping ---
float vnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  uvec3 b = uvec3(ivec3(i) + 4096);
  float n000 = hash01(b);
  float n100 = hash01(b + uvec3(1u, 0u, 0u));
  float n010 = hash01(b + uvec3(0u, 1u, 0u));
  float n110 = hash01(b + uvec3(1u, 1u, 0u));
  float n001 = hash01(b + uvec3(0u, 0u, 1u));
  float n101 = hash01(b + uvec3(1u, 0u, 1u));
  float n011 = hash01(b + uvec3(0u, 1u, 1u));
  float n111 = hash01(b + uvec3(1u, 1u, 1u));
  return mix(mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
             mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y), u.z);
}

vec2 rot(vec2 p, float a) { float c = cos(a), s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }

// Elliptical Gaussian blob. p, c in frame space (x in [-aspect/2, aspect/2], y in [-0.5, 0.5]).
float blob(vec2 p, vec2 c, vec2 r, float ang) {
  vec2 q = rot(p - c, -ang) / r;
  return exp(-dot(q, q));
}

// Thin tapered sliver along angle ang, length len, max half-width w.
float streak(vec2 p, vec2 c, float ang, float len, float w) {
  vec2 q = rot(p - c, -ang);
  float u = q.x / (0.5 * len);
  float taper = pow(max(1.0 - u * u, 0.0), 0.8);
  float ww = w * taper + 1e-4;
  float core = exp(-pow(q.y / ww, 2.0)) * taper;
  float halo = exp(-pow(q.y / (ww * 4.0 + 0.02), 2.0)) * pow(max(1.0 - u * u, 0.0), 1.4);
  return core + 0.5 * halo;
}

vec3 ramp(float x) {
  vec3 c = uRampColor[0];
  for (int i = 1; i < 5; i++) {
    float t = clamp((x - uRampAt[i - 1]) / max(uRampAt[i] - uRampAt[i - 1], 1e-4), 0.0, 1.0);
    c = mix(c, uRampColor[i], t);
  }
  return c;
}

void main() {
  float aspect = uRes.x / uRes.y;
  vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);
  float ph = uPhase;

  // Noise sampled on a circle in time -> closed loop.
  vec3 circ = vec3(cos(ph), sin(ph), 0.0) * 0.9;
  vec2 warp = vec2(vnoise(vec3(p * 1.6, 0.0) + circ), vnoise(vec3(p * 1.6, 7.3) + circ)) - 0.5;
  vec2 pw = p + warp * 0.11;

  float L = 0.39;
  // Light blobs (closed Lissajous paths, integer frequencies).
  L += 0.42 * blob(pw, vec2(-0.55 + 0.10 * sin(ph + 0.4), 0.30 + 0.06 * sin(2.0 * ph + 1.1)),
                   vec2(0.48, 0.30) * (1.0 + 0.10 * sin(ph + 2.0)), 0.35 + 0.15 * sin(ph));
  L += 0.40 * blob(pw, vec2(0.58 + 0.08 * cos(ph + 1.7), -0.30 + 0.07 * sin(ph + 0.3)),
                   vec2(0.52, 0.32) * (1.0 + 0.12 * sin(2.0 * ph + 0.6)), -0.30 + 0.10 * cos(ph));
  L += 0.30 * blob(pw, vec2(0.05 + 0.16 * sin(ph + 2.6), 0.18 + 0.05 * cos(2.0 * ph)),
                   vec2(0.30, 0.20) * (1.0 + 0.15 * sin(ph + 4.0)), 0.6);
  L += 0.34 * blob(pw, vec2(-0.30 + 0.22 * cos(ph + 0.9), -0.12 + 0.10 * sin(ph + 2.2)),
                   vec2(0.22, 0.15) * (1.0 + 0.25 * sin(ph + 1.0)), 0.2 + 0.3 * sin(ph + 3.0));
  // Dark blobs.
  L -= 0.48 * blob(pw, vec2(0.72 + 0.08 * sin(ph + 3.3), 0.46 + 0.05 * cos(ph + 0.8)),
                   vec2(0.48, 0.30) * (1.0 + 0.10 * cos(ph + 1.4)), 0.1);
  L -= 0.44 * blob(pw, vec2(-0.78 + 0.07 * cos(ph + 2.1), -0.42 + 0.06 * sin(2.0 * ph + 0.2)),
                   vec2(0.44, 0.30) * (1.0 + 0.12 * sin(ph + 5.0)), -0.4);
  L -= 0.22 * blob(pw, vec2(0.20 + 0.20 * sin(ph + 5.1), -0.05 + 0.12 * cos(ph + 4.4)),
                   vec2(0.20, 0.14) * (1.0 + 0.2 * cos(2.0 * ph)), 0.9);

  // Dark wedge: apex travels a loop that passes through the frame.
  vec2 apex = vec2(-0.25 + 0.75 * cos(ph + 0.5), -0.62 + 0.20 * sin(ph + 0.5));
  float dir = 1.15 + 0.35 * sin(ph + 1.9);
  vec2 d = rot(pw - apex, -dir);
  // Soft edges everywhere: the edge softness grows with distance from the apex.
  float halfW = max(d.x, 0.0) * 0.32;
  float soft = 0.14 + 0.4 * max(d.x, 0.0);
  float wedge = smoothstep(halfW + soft, halfW - soft, abs(d.y)) * smoothstep(-0.15, 0.6, d.x);
  L -= 0.34 * wedge;

  // Deep corners.
  float vig = smoothstep(0.42, 1.05, length(p * vec2(0.85, 1.35)));
  L -= 0.30 * vig;

  // Thin bright light streaks at ~30-40 degrees.
  float s = 0.0;
  s += (0.80 + 0.20 * sin(ph + 0.7)) *
       streak(p, vec2(0.36 + 0.10 * sin(ph + 0.3), -0.02 + 0.08 * sin(ph + 1.9)), 0.62 + 0.04 * sin(ph), 0.34, 0.015);
  s += (0.60 + 0.30 * sin(ph + 2.9)) *
       streak(p, vec2(-0.48 + 0.08 * cos(ph + 1.1), 0.08 + 0.10 * sin(ph + 4.0)), 0.95 + 0.06 * sin(ph + 2.0), 0.24, 0.018);
  s += (0.35 + 0.35 * sin(2.0 * ph + 4.1)) *
       streak(p, vec2(0.05 + 0.25 * cos(ph + 3.6), 0.30 + 0.06 * cos(ph)), 0.58, 0.2, 0.010);
  L += 0.55 * s;

  vec3 col = ramp(clamp(L, 0.0, 1.0));
  // Monochrome film grain (~7% sd, frame % 600) + dither.
  col += triNoise(gl_FragCoord.xy, uGrainFrame, 0u) * 0.165;
  col += triNoise(gl_FragCoord.xy, uGrainFrame, 2u) / 255.0;
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
