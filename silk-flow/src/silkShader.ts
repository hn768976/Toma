/**
 * "Silk Flow" — soft, out-of-focus ribbons of light with iridescent
 * (prismatic) fringes and a travelling white bloom. Everything is driven by
 * uTime and loops seamlessly over uDuration seconds.
 */
export const silkFragmentShader = /* glsl */ `#version 300 es
precision highp float;

uniform vec2 uResolution;
uniform float uTime;
uniform float uDuration;

// Palette (linear-ish sRGB, 0..1)
uniform vec3 uDeep;
uniform vec3 uMid;
uniform vec3 uLight;
uniform vec3 uHighlight;
uniform vec3 uRim;
uniform float uFringe;
uniform float uSpectrumShift;
uniform float uBloom;      // bloom size/intensity envelope (keyframed)
uniform vec2 uBloomPos;    // bloom centre, height units from frame centre

out vec4 outColor;

const float TAU = 6.28318530718;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = m * p;
    a *= 0.5;
  }
  return v;
}

mat2 rot(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, s, -s, c);
}

vec3 spectrum(float x) {
  return 0.5 + 0.5 * cos(TAU * (x + vec3(0.0, 0.33, 0.67)));
}

// Palette ramp: deep -> mid -> light -> highlight
vec3 ramp(float x) {
  x = clamp(x, 0.0, 1.0);
  vec3 c = mix(uDeep, uMid, smoothstep(0.0, 0.42, x));
  c = mix(c, uLight, smoothstep(0.38, 0.78, x));
  c = mix(c, uHighlight, smoothstep(0.74, 1.0, x));
  return c;
}

// Soft silk sheets as a function of the band coordinate v.
float sheets(float v, float ph) {
  float s = 0.0;
  s += 0.55 * (0.5 + 0.5 * sin(v * 3.1 + ph));
  s += 0.30 * (0.5 + 0.5 * sin(v * 6.7 - ph * 2.0 + 1.1));
  s += 0.15 * (0.5 + 0.5 * sin(v * 11.3 + ph + 2.3));
  return s;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / uResolution.y;
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);

  float t = uTime / uDuration;      // 0..1 over the clip
  float th = TAU * t;               // loop angle (every term below is periodic in it)

  // Loop-safe drift offsets (closed circles in noise space)
  vec2 o1 = 1.15 * vec2(cos(th), sin(th));
  vec2 o2 = 0.9 * vec2(cos(th * 2.0 + 1.7), sin(th + 0.6));

  // --- Flow frame: folds sweep from lower-left and curl up to the right ---
  float ang = 0.50 + 0.10 * sin(th + 0.4);
  vec2 r = rot(ang) * p;
  float along = r.x;
  float warp = fbm(vec2(along * 0.55, r.y * 1.3) + o1) - 0.5;
  float v = r.y - 0.62 * along * along + 0.50 * warp + 0.10 * sin(along * 1.6 + th);
  float ph = th + 0.8 * sin(th * 2.0);

  // Streaky "long exposure" texture stretched along the folds
  float streak = fbm(vec2(along * 0.45, v * 5.0) + o2) - 0.5;

  // --- Base light with chromatic dispersion across the folds ---
  float shade = 0.20 * streak - 0.05 * p.y - 0.12 * smoothstep(0.1, -0.9, p.x);
  float d = 0.018;
  float sR = sheets(v + d, ph);
  float sG = sheets(v, ph);
  float sB = sheets(v - d, ph);
  float lift = 0.0;
  vec3 col;
  col.r = ramp(sR * 0.80 + shade + lift).r;
  col.g = ramp(sG * 0.80 + shade + lift).g;
  col.b = ramp(sB * 0.80 + shade + lift).b;

  // Pastel iridescent fringe along steep fold edges
  float edge = abs(sheets(v + 0.01, ph) - sheets(v - 0.01, ph)) * 50.0;
  float fringeMask = smoothstep(0.35, 1.5, edge) * smoothstep(0.35, 0.7, fbm(vec2(along * 0.8, v * 1.5) + o1));
  vec3 pastel = mix(spectrum(v * 1.4 + t + uSpectrumShift), vec3(1.0), 0.45);
  col = mix(col, pastel * (0.55 + 0.45 * col), uFringe * fringeMask * 0.32);

  // --- Thin light filaments riding the folds ---
  float fl = fract(v * 1.3 + 0.37) - 0.5;
  float fil = exp(-pow(fl / 0.009, 2.0)) * 0.6 + exp(-pow(fl / 0.04, 2.0)) * 0.35;
  float filMask = smoothstep(0.46, 0.68, fbm(vec2(along * 1.1, floor(v * 1.3 + 0.87) * 3.1) + o2 * 0.8));
  filMask *= smoothstep(0.95, 0.35, abs(along - 0.1));
  col += mix(uLight, uHighlight, 0.5) * fil * filMask * 0.7;
  col = mix(col, pastel, exp(-pow((fl - 0.02) / 0.03, 2.0)) * filMask * 0.18 * uFringe);

  // --- Prismatic arcs: thin rainbow bands like light through a prism ---
  vec2 rp = rot(ang - 0.12) * p;
  float vp = rp.y - 0.55 * rp.x * rp.x + 0.35 * warp - 0.06 * sin(th * 2.0 + rp.x);
  float fp = fract(vp * 0.9 + 0.35 + 0.05 * sin(th)) - 0.5;
  float arcW = 0.035;
  float arcMask = smoothstep(0.45, 0.68, fbm(vec2(rp.x * 0.8, floor(vp * 0.9 + 0.85) * 2.7) - o1 * 0.7));
  vec3 rainbow = spectrum(fp / arcW * 0.35 + 0.55 + uSpectrumShift);
  float arc = exp(-pow(fp / arcW, 2.0));
  col = mix(col, mix(rainbow, vec3(1.0), 0.25) * (0.45 + 0.7 * col), arc * arcMask * 0.45 * uFringe);

  // --- Frame-wide pastel prismatic haze (low frequency, follows the flow) ---
  float hazeMask = smoothstep(0.48, 0.78, fbm(vec2(along * 0.7, v * 1.1) - o2 * 0.8));
  vec3 prism = mix(spectrum(v * 0.8 + along * 0.25 + t + uSpectrumShift), vec3(1.0), 0.5);
  col = mix(col, prism * (0.6 + 0.5 * col), hazeMask * 0.22 * uFringe);

  // --- Light bloom: blows out to white, edges carved by the folds ---
  vec2 rb = rot(ang) * (p - uBloomPos);
  float rad = 0.10 + 0.70 * uBloom;
  float softStreak = fbm(vec2(along * 0.3, v * 1.6) + o2) - 0.5;
  float dist = length(rb * vec2(0.45, 1.1)) + 0.3 * (sG - 0.5) + 0.35 * softStreak + 0.2 * warp;
  float field = 1.0 - smoothstep(0.0, rad, dist);
  // One broad dark fold cuts through the light so it reads as a wash, not a
  // disc (low frequency only, so it never looks ribbed)
  float fold = 0.5 + 0.5 * sin(v * 3.1 + ph);
  float carve = smoothstep(0.0, 0.45, fold + 0.15 * streak + 0.45 * (uBloom - 0.4));
  float light = field * mix(0.45, 1.0, carve) * (0.75 + 0.35 * uBloom) * smoothstep(0.0, 0.3, uBloom);
  float halo = smoothstep(0.0, 0.5, light);
  float core = smoothstep(0.3, 0.85, light);
  float rim = halo * (1.0 - core);
  col = mix(col, uLight, halo * 0.7);
  // broad pastel (pink / peach / lavender) haze where the light meets the folds
  vec3 haze = mix(uRim, pastel, 0.35);
  col = mix(col, haze, rim * 0.30 * uFringe);
  col = mix(col, uHighlight, core);

  // Gentle vignette toward the deep tone
  float vig = smoothstep(1.25, 0.25, length(p * vec2(0.8, 1.1)));
  col = mix(uDeep, col, 0.85 + 0.15 * vig);

  // Dither to avoid gradient banding after compression
  col += (hash(gl_FragCoord.xy + fract(uTime) * 91.7) - 0.5) / 255.0;

  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
