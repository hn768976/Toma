import { GLSL_LIB } from "./lib";

/**
 * Plate 01 - DUST MOTES.
 *
 * Reference: fine airborne particulate drifting through a shaft of light, shot
 * on a long lens so only one depth slice is in focus. Five depth layers are
 * stacked: far layers are many, tiny and near-sharp; near layers are few, large
 * and heavily defocused (and therefore dimmer, since a blur circle spreads the
 * same energy over more area).
 *
 * Looping: each mote's wander is the sum of two sinusoids whose periods are the
 * loop length and half the loop length, so every mote is exactly back where it
 * started - and moving in the same direction - at phase 1.
 */
export const DUST_FRAG = /* glsl */ `#version 300 es
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

float dustLayer(
  vec2 uv, float li, float cells, float radius, float wander, float keep
) {
  vec2 p = uv * cells;
  vec2 ip = floor(p);
  vec2 fp = p - ip;

  float acc = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 o = vec2(float(x), float(y));
      vec4 h = hash24(ip + o + vec2(li * 37.31, uSeed * 13.77));
      if (h.w > keep * uDensity) {
        continue;
      }

      float ph = h.z * TAU;
      // Two harmonics of the loop frequency: organic float, exact return.
      vec2 w = vec2(
        sin(TAU * uT + ph) + 0.45 * sin(2.0 * TAU * uT + ph * 2.3),
        cos(TAU * uT + ph * 1.7) + 0.40 * sin(2.0 * TAU * uT + ph * 0.7)
      ) * wander * uSpeed;

      vec2 d = fp - (o + clamp(h.xy, 0.08, 0.92) + w);
      float r = radius * (0.45 + 1.10 * h.z);
      acc += exp(-dot(d, d) / (r * r)) * (0.25 + 0.75 * hash11(h.x + h.y + li));
    }
  }
  return acc;
}

void main() {
  float aspect = uRes.x / uRes.y;
  vec2 uv = vec2(vUV.x * aspect, vUV.y);

  //                     li   cells  radius  wander  keep
  float d  = 0.90 * dustLayer(uv, 0.0, 42.0, 0.055, 0.055, 0.55);
  d += 0.75 * dustLayer(uv, 1.0, 30.0, 0.075, 0.075, 0.50);
  d += 0.50 * dustLayer(uv, 2.0, 20.0, 0.110, 0.100, 0.42);
  d += 0.30 * dustLayer(uv, 3.0, 13.0, 0.190, 0.130, 0.30);
  d += 0.18 * dustLayer(uv, 4.0,  8.0, 0.320, 0.170, 0.18);

  // Faint volumetric haze so the field is not perfectly flat black. Breathes
  // once per loop, which is periodic by construction.
  float breathe = 0.85 + 0.15 * sin(TAU * uT);
  float haze = fbm3(vec3(uv * 1.35, uSeed * 3.1), 3) * breathe;
  haze = smoothstep(0.35, 0.95, haze);

  // Light falls off toward the lower right, as in the reference - but gently:
  // the dust is present across the whole frame, it is only *lit* unevenly.
  float fall = 0.52 + 0.48 * smoothstep(2.35, 0.00, uv.x * 0.62 + uv.y * 0.85);

  vec3 tint = vec3(1.00, 0.935, 0.880);          // warm motes
  vec3 hazeCol = vec3(0.40, 0.26, 0.29);         // faint magenta in the air

  vec3 col = tint * d * fall * uBright;
  col += hazeCol * haze * 0.034 * fall;

  // Sub-LSB dither + a whisper of grain: kills banding in the near-black range.
  col += grain(gl_FragCoord.xy, uT) * 0.0065;

  finalColor = vec4(max(col, 0.0), 1.0);
}
`;
