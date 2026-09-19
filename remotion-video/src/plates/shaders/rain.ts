import { GLSL_LIB } from "./lib";

/**
 * Plate 02 - RAIN.
 *
 * Reference: sparse vertical rainfall against black, streaks varying in length,
 * sharpness and brightness with depth. Four depth layers, each a grid of cells
 * holding one drop.
 *
 * Looping: a drop travels strictly inside its own cell, and its position is
 * `fract(phase0 + uT * k)` with k a whole number of falls per loop. At uT = 1
 * every drop is back on its starting phase exactly. Cells are tall (1-3 rows
 * per frame) so a drop crosses a large part of the frame before wrapping, and
 * the vertical neighbours are sampled too, so streaks read as continuous
 * rainfall rather than as a banded grid.
 */
export const RAIN_FRAG = /* glsl */ `#version 300 es
precision highp float;

in vec2 vUV;
out vec4 finalColor;

uniform float uT;
uniform vec2  uRes;
uniform float uSeed;
uniform float uDensity;
uniform float uBright;
uniform float uSpeed;

${GLSL_LIB}

float rainLayer(
  vec2 uv, float aspect, float li,
  float cols, float rows, float len, float wid, float keep, float kBase
) {
  vec2 p = vec2(uv.x * cols, uv.y * rows);
  vec2 ip = floor(p);
  vec2 fp = p - ip;

  float acc = 0.0;
  for (int y = -1; y <= 1; y++) {
    vec2 o = vec2(0.0, float(y));
    vec4 h = hash24(ip + o + vec2(li * 71.31, uSeed * 29.13));
    if (h.w > keep * uDensity) {
      continue;
    }

    // Whole number of falls per loop => exact loop closure.
    float k = kBase + floor(h.z * 2.999);
    float ty = fract(h.y + uT * k * uSpeed);

    vec2 d = fp - (o + vec2(clamp(h.x, 0.10, 0.90), ty));
    // Into screen-height units so the streak stays isotropic at any aspect.
    vec2 sd = vec2(d.x * aspect / cols, d.y / rows);

    float L = len * (0.45 + 1.10 * h.z);
    float w = wid * (0.55 + 1.20 * hash11(h.x * 3.71 + li * 5.31));

    // Separable profile: gaussian across the streak, soft-shouldered along it.
    // A capsule distance gives hard, CG-looking ends; this tapers like the
    // motion-blurred drops in the reference.
    float fy = exp(-pow(abs(sd.y) / L, 3.0));
    float fx = exp(-(sd.x * sd.x) / (w * w));
    float halo = exp(-(sd.x * sd.x) / (w * w * 9.0)) * 0.22;

    // h.z squared so most drops are faint and only a few read strongly.
    acc += (fx + halo) * fy * (0.10 + 0.90 * h.z * h.z);
  }
  return acc;
}

void main() {
  float aspect = uRes.x / uRes.y;
  vec2 uv = vUV;

  //                       aspect  li  cols  rows   len    wid    keep  kBase
  float r  = 0.75 * rainLayer(uv, aspect, 0.0, 30.0, 3.0, 0.018, 0.0012, 0.55, 5.0);
  r += 0.90 * rainLayer(uv, aspect, 1.0, 20.0, 2.0, 0.035, 0.0021, 0.45, 4.0);
  r += 0.80 * rainLayer(uv, aspect, 2.0, 12.0, 2.0, 0.060, 0.0036, 0.30, 3.0);
  // Foreground: heavily defocused, so wide and dim.
  r += 0.32 * rainLayer(uv, aspect, 3.0,  7.0, 1.0, 0.105, 0.0100, 0.18, 2.0);

  vec3 tint = vec3(0.92, 0.955, 1.00);   // rain highlights read slightly cool
  vec3 col = tint * r * 0.78 * uBright;  // the reference plate is the darkest

  col += grain(gl_FragCoord.xy, uT) * 0.0055;

  finalColor = vec4(max(col, 0.0), 1.0);
}
`;
