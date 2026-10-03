import { HASH_GLSL, SIMPLEX_GLSL } from "../shared/glsl";

/**
 * Gold foil behind frosted glass.
 * Loop: wave noise is sampled on a circle in time; hot-spot paths use integer
 * harmonics; the twinkle period (120 frames) divides 600.
 * The frost is a static screen-space pattern defined in frame-relative units,
 * so it looks the same at 720p and 4K.
 */
export const FOIL_FRAG = /* glsl */ `
precision highp float;
uniform vec2 uRes;
uniform float uLoopFrame;
uniform vec3 uLight;   // pale
uniform vec3 uMid;     // gold
uniform vec3 uDark;    // bronze
uniform float uFrostCells;   // frost cells per frame height

${HASH_GLSL}
${SIMPLEX_GLSL}

const float TAU = 6.283185307179586;

// smooth value noise on an integer lattice (static, screen space)
float vnoise(vec2 q) {
  vec2 i = floor(q);
  vec2 f = fract(q);
  vec2 w = f * f * (3.0 - 2.0 * f);
  float a = hash2f(i);
  float b = hash2f(i + vec2(1.0, 0.0));
  float c = hash2f(i + vec2(0.0, 1.0));
  float d = hash2f(i + vec2(1.0, 1.0));
  return mix(mix(a, b, w.x), mix(c, d, w.x), w.y);
}

// frosted relief height: ridged (wormy, pebbled-glass) static pattern
float ridge(float n) { return 1.0 - abs(n); }
float frostH(vec2 q) {
  // maze-like worms: ridged noise, slightly stretched so grooves run
  // roughly horizontally and vertically
  // contour lines of a slowly varying noise give open, maze-like worms
  // (dense, mostly vertical wavy ridges like rolled glass)
  float n1 = snoise3(vec3(q * vec2(0.55, 0.28), 0.5)) + 0.25 * snoise3(vec3(q * 1.1, 4.0));
  float w = 0.5 + 0.5 * sin(n1 * 9.0);
  float b = ridge(snoise3(vec3(q * vec2(1.7, 1.0) + 13.0, 1.7)));
  return 0.75 * w * sqrt(w) + 0.25 * b * b;
}

float foilField(vec2 p, vec2 cs) {
  // vertical waves: blobs stretched vertically
  float a = snoise4(vec4(p.x * 0.95, p.y * 0.38, cs));
  // horizontal waves
  float b = snoise4(vec4(p.x * 0.55 + 9.1, p.y * 1.1 - 3.7, cs * 1.0 + 5.3));
  // crumple detail
  float c = snoise4(vec4(p * 2.6 + 21.0, cs * 1.3 + 1.9));
  return 0.66 * a + 0.36 * b + 0.08 * c;
}

vec3 ramp(float t) {
  vec3 c = mix(uDark * 0.7, uDark, smoothstep(0.0, 0.22, t));
  // olive-khaki mid: the gold toned toward the dark/light blend (no orange ring)
  vec3 midTone = mix(uMid, mix(uDark, uLight, 0.55), 0.6);
  c = mix(c, midTone, smoothstep(0.12, 0.38, t));
  c = mix(c, uLight, smoothstep(0.3, 0.68, t));
  c = mix(c, mix(uLight, vec3(1.0), 0.45), smoothstep(0.72, 1.0, t));
  return c;
}

void main() {
  vec2 fc = gl_FragCoord.xy;
  vec2 uv = fc / uRes;
  float aspect = uRes.x / uRes.y;
  float ph = TAU * uLoopFrame / 600.0;
  vec2 cs = vec2(cos(ph), sin(ph)) * 0.45;

  // ---- frost relief (screen-space, resolution-independent) ----
  vec2 q = vec2(uv.x * aspect, uv.y) * uFrostCells;
  float e = 0.12;
  float h = frostH(q);
  float hx = frostH(q + vec2(e, 0.0)) - h;
  float hy = frostH(q + vec2(0.0, e)) - h;
  vec2 grad = vec2(hx, hy) / e;

  // frosted glass refracts the foil by the relief slope
  vec2 p = vec2(uv.x * aspect, uv.y) + grad * 0.0075;

  // ---- foil base ----
  float n = foilField(p, cs);
  float t = clamp(0.63 + 1.1 * n, 0.0, 1.0);
  vec3 col = ramp(t);

  // drifting soft hot spots
  float hot = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    vec2 c = vec2(
      (0.5 + 0.42 * sin(ph * (1.0 + fi) + fi * 2.1)) * aspect,
      0.5 + 0.38 * cos(ph * (2.0 - mod(fi, 2.0)) + fi * 1.3)
    );
    vec2 d = (p - c) / vec2(0.30, 0.42);
    hot += exp(-dot(d, d)) * (0.55 + 0.45 * sin(ph + fi * 2.0));
  }
  col = mix(col, mix(uLight, vec3(1.0), 0.55), clamp(hot * 0.95 * smoothstep(0.2, 0.7, t), 0.0, 0.92));

  // ---- frost texture over everything ----
  // relief shading: lit from upper-left
  float shade = dot(grad, normalize(vec2(-0.6, 0.8)));
  float lum0 = dot(col, vec3(0.299, 0.587, 0.114));
  float texAmt = 0.45 + 0.55 * smoothstep(0.2, 0.6, lum0) * (1.0 - 0.85 * smoothstep(0.8, 0.97, lum0));
  col *= 1.0 + texAmt * (0.05 * shade + 0.13 * (h - 0.3));
  // fine horizontal streaks, like brushed metal under the glass
  float streak = snoise3(vec3(uv.x * 2.0, uv.y * uFrostCells * 4.5, 5.0));
  col *= 1.0 + 0.09 * texAmt * streak;

  // speckles: irregular dark pits and bright glints in drifting clusters;
  // glints twinkle on a 120-frame cycle (divides the 600-frame loop)
  float cluster = smoothstep(-0.3, 0.7, snoise3(vec3(q * 0.07, 3.3)));
  float pn = snoise3(vec3(q * 1.2, 7.7)) + 0.35 * snoise3(vec3(q * 2.6, 2.2));
  float pit = smoothstep(0.62 - 0.22 * cluster, 0.9 - 0.22 * cluster, pn);
  float gn = snoise3(vec3(q * 2.3 + 40.0, 9.1)) + 0.3 * snoise3(vec3(q * 5.0, 4.4));
  float glint = smoothstep(0.7 - 0.2 * cluster, 0.95 - 0.2 * cluster, gn);
  float r2 = hash2f(floor(q * 2.3) + 503.0);
  float tw = 0.5 + 0.5 * sin(TAU * (uLoopFrame / 120.0 + r2));
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col *= 1.0 - pit * 0.25 * (0.3 + 0.7 * texAmt);
  col += glint * (0.35 + 0.65 * tw) * 0.45 * (0.3 + lum) * normalize(uLight + 0.2);

  // fine grain + dither
  col += (pixelNoise(fc, uLoopFrame, 29u) - 0.5) * 0.02;
  col = clamp(col, 0.0, 1.0);
  col = dither255(col, fc, uLoopFrame);
  gl_FragColor = vec4(col, 1.0);
}
`;
