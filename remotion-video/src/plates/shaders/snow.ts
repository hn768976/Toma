import { GLSL_LIB } from "./lib";

/**
 * Plate 04 - DRIVING SNOW.
 *
 * Reference: dense snow driven diagonally from upper-left to lower-right at
 * roughly 32 degrees off vertical. Far flakes are tiny and motion-streaked;
 * foreground flakes are large, round, heavily defocused bokeh discs with the
 * faint bright rim real defocus produces.
 *
 * The whole field is computed in a rotated frame so "down" is the wind
 * direction; the same integer-falls-per-loop trick as the rain plate makes it
 * loop exactly, with a periodic lateral flutter on top.
 */
export const SNOW_FRAG = /* glsl */ `#version 300 es
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

// cells    - flakes per screen height along the wind axis
// radius   - flake radius in screen-height units
// elong    - motion-blur stretch along the wind axis (1 = round)
// soft     - 0 = crisp speck, 1 = fully defocused disc
// rim      - strength of the defocus edge highlight
float snowLayer(
  vec2 s, float li, float cells, float radius, float elong,
  float keep, float kBase, float flutter, float soft, float rim
) {
  vec2 p = s * cells;
  vec2 ip = floor(p);
  vec2 fp = p - ip;

  float acc = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 o = vec2(float(x), float(y));
      vec4 h = hash24(ip + o + vec2(li * 53.17, uSeed * 41.29));
      if (h.w > keep * uDensity) {
        continue;
      }

      float k = kBase + floor(h.z * 1.999);
      float ty = fract(h.y + uT * k * uSpeed);
      // Lateral flutter, periodic over the loop.
      float sway = sin(TAU * uT * 2.0 + h.x * TAU) * flutter;

      vec2 d = fp - (o + vec2(clamp(h.x, 0.02, 0.98) + sway, ty));
      vec2 sd = d / cells;                       // screen-height units
      float rr = radius * (0.55 + 0.95 * h.z);

      float dist = length(vec2(sd.x, sd.y / elong));

      // Crisp core and defocused disc, blended by 'soft'.
      float core = exp(-dist * dist / (rr * rr));
      float disc = smoothstep(rr, rr * 0.55, dist);
      float shape = mix(core, disc, soft);

      // Defocus leaves a slightly brighter ring at the edge of the blur circle.
      float ring = smoothstep(rr * 1.02, rr * 0.88, dist)
                 - smoothstep(rr * 0.88, rr * 0.70, dist);
      shape += max(ring, 0.0) * rim * soft;

      acc += shape * (0.30 + 0.70 * h.z);
    }
  }
  return acc;
}

void main() {
  float aspect = uRes.x / uRes.y;
  vec2 s = vec2(vUV.x * aspect, vUV.y);

  // Rotate into the wind frame: ~32 degrees, blowing to the lower right.
  const float WIND = 0.56;
  float cw = cos(WIND);
  float sw = sin(WIND);
  vec2 rs = mat2(cw, -sw, sw, cw) * s;

  //                        li  cells radius elong keep  kBase flutter soft rim
  // The reference is a gusting blizzard - density and atmosphere pulse across
  // the clip. Built from harmonics of the loop frequency, so gusting costs
  // nothing in loopability.
  float gust = 0.80 + 0.20 * sin(TAU * uT + 1.2) + 0.09 * sin(2.0 * TAU * uT + 0.4);

  // Radii are in screen-height units: 0.0017 is ~1.8px at 1080p and ~3.7px at
  // 4K, i.e. the flake keeps its apparent size and simply resolves finer.
  float f  = 1.05 * snowLayer(rs, 0.0, 26.0, 0.0017, 3.8, 0.75, 5.0, 0.008, 0.00, 0.00);
  f += 0.95 * snowLayer(rs, 1.0, 16.0, 0.0034, 3.0, 0.68, 4.0, 0.014, 0.20, 0.10);
  f += 0.62 * snowLayer(rs, 2.0,  9.0, 0.0095, 2.0, 0.44, 3.0, 0.022, 0.65, 0.25);
  // Foreground bokeh: few, large, round, slow, soft-edged.
  f += 0.38 * snowLayer(rs, 3.0,  5.0, 0.0290, 1.30, 0.26, 2.0, 0.030, 1.00, 0.35);
  f *= gust;

  // Milky atmosphere thrown up by all the airborne snow. This, rather than the
  // flakes themselves, is what carries the reference plate's overall level.
  float haze = smoothstep(0.25, 0.80, fbm3(vec3(s * 1.35, uSeed * 7.3), 3)) * gust;

  vec3 tint = vec3(0.96, 0.975, 1.00);
  vec3 col = tint * f * 0.95 * uBright;
  col += vec3(0.68, 0.73, 0.82) * haze * 0.185 * uBright;

  col += grain(gl_FragCoord.xy, uT) * 0.0060;

  finalColor = vec4(max(col, 0.0), 1.0);
}
`;
