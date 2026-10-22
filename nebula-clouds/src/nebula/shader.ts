// WebGL 2 shaders for the nebula cloud field.
//
// The look is built from domain-warped fractal noise (fbm of fbm), which gives
// the billowing cloud masses, plus a ridged noise layer that produces the thin
// glowing filaments along the cloud edges. Everything is evaluated in
// resolution-independent coordinates so the 4K and 1080p renders are identical
// apart from pixel density.

export const VERTEX_SHADER = /* glsl */ `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  // Flip Y so vUv (0,0) is the top-left corner, like the DOM.
  vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

export const FRAGMENT_SHADER = /* glsl */ `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 outColor;

uniform float uAspect;
uniform float uTime;     // seconds, drives the slow evolution
uniform float uProgress; // 0..1 across the whole clip
uniform float uFrame;    // current frame, for one-off transients

uniform vec3 uDeep;
uniform vec3 uMid;
uniform vec3 uLight;
uniform vec3 uHaze;
uniform vec3 uVein;
uniform vec3 uWash;
uniform vec3 uGlow;

// --- 3D simplex noise (Ashima Arts / Stefan Gustavson, MIT) -----------------
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
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
  vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
          + i.y + vec4(0.0, i1.y, i2.y, 1.0))
          + i.x + vec4(0.0, i1.x, i2.x, 1.0));
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
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
// ---------------------------------------------------------------------------

const mat2 ROT = mat2(0.80, 0.60, -0.60, 0.80);

// Fractal noise in [0,1]. z is the "time" axis so the field morphs in place.
float fbm(vec2 p, float z, int octaves) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 7; i++) {
    if (i >= octaves) break;
    sum += amp * snoise(vec3(p, z));
    p = ROT * p * 2.03 + vec2(1.7, 9.2);
    z += 0.37;
    amp *= 0.5;
  }
  return sum * 0.5 + 0.5;
}

// Ridged fractal noise: sharp bright creases where the noise crosses zero.
// Ridged multifractal: each octave is weighted by the previous one, which
// gives connected, stringy filaments rather than isolated creases.
float ridged(vec2 p, float z) {
  float sum = 0.0;
  float amp = 0.5;
  float weight = 1.0;
  for (int i = 0; i < 5; i++) {
    float n = 1.0 - abs(snoise(vec3(p, z)));
    n *= n * weight;
    weight = clamp(n * 1.8, 0.0, 1.0);
    sum += amp * n;
    p = ROT * p * 2.07 + vec2(4.1, 2.3);
    z += 0.53;
    amp *= 0.55;
  }
  return sum;
}

// Billowy turbulence: |noise| octaves give puffy, cauliflower-like cloud
// texture instead of the smooth swirls of plain fbm.
float billow(vec2 p, float z) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 6; i++) {
    sum += amp * abs(snoise(vec3(p, z)));
    p = ROT * p * 2.02 + vec2(7.3, 1.1);
    z += 0.41;
    amp *= 0.52;
  }
  return sum;
}

vec3 srgb(vec3 c) { return c / 255.0; }

void main() {
  vec2 uv = vUv;
  // Aspect-correct, resolution-independent coordinates.
  vec2 p = vec2((uv.x - 0.5) * uAspect, uv.y - 0.5) * 1.3;

  float t = uTime;

  // A light domain warp so the cloud masses fold slightly as they morph.
  vec2 q = vec2(
    fbm(p + vec2(0.0, 0.0), t * 0.018, 3),
    fbm(p + vec2(5.2, 1.3), t * 0.018 + 3.1, 3)
  );
  vec2 w = p + 0.28 * (q - 0.5);
  float f = fbm(w, t * 0.022, 4);

  // Large-scale lighting layout, laid out like the reference: lit sky top
  // centre-right, on the left and in the bottom-right corner; shadowed
  // pockets top-left, mid-right and bottom-centre. The shadows lift as the
  // clip progresses so the whole frame gets brighter and softer.
  float lift = smoothstep(0.55, 1.0, uProgress);
  float light = 0.0;
  light += (0.75 - 0.35 * lift) * exp(-pow(length((uv - vec2(0.70, 0.12)) * vec2(3.2, 3.0)), 2.0));
  light += 0.55 * exp(-pow(length((uv - vec2(0.24, 0.70)) * vec2(2.2, 2.4)), 2.0));
  light += 0.70 * exp(-pow(length((uv - vec2(0.95, 1.00)) * vec2(3.6, 4.2)), 2.0));
  light -= (0.75 - 0.35 * lift) * exp(-pow(length((uv - vec2(0.06, 0.06)) * vec2(3.0, 3.4)), 2.0));
  light -= (0.55 - 0.30 * lift) * exp(-pow(length((uv - vec2(0.86, 0.52)) * vec2(3.6, 3.4)), 2.0));
  light -= (0.50 - 0.15 * lift) * exp(-pow(length((uv - vec2(0.47, 0.86)) * vec2(4.6, 3.6)), 2.0));
  // Milky band on the left that brightens towards the end.
  light += 0.35 * lift * exp(-pow(length((uv - vec2(0.14, 0.50)) * vec2(3.2, 1.2)), 2.0));
  light += 0.06 * lift;

  // Puffy texture inside the clouds and stringy filaments along their edges.
  float puff = billow(w * 2.6 + vec2(2.0, 4.0), t * 0.03 + 11.0);
  float strands = ridged(p * 3.4 + 0.6 * q, t * 0.025 + 4.0);
  float finepuff = billow(w * 6.5 + vec2(5.0, 1.0), t * 0.04 + 17.0);

  // Brightness of the sky: 0 = deep cloud shadow, 1 = lit haze.
  float b = (f - 0.5) * 1.5 + 0.52 + 0.50 * light + 0.65 * (puff - 0.32) + 0.12 * (finepuff - 0.32);
  b = clamp(b, 0.0, 1.0);

  vec3 cDeep = srgb(uDeep);
  vec3 cMid = srgb(uMid);
  vec3 cLight = srgb(uLight);
  vec3 cHaze = srgb(uHaze);
  vec3 cVein = srgb(uVein);
  vec3 cWash = srgb(uWash);
  vec3 cGlow = srgb(uGlow);

  vec3 col = mix(cDeep, cMid, smoothstep(-0.2, 0.55, b));
  col = mix(col, cLight, smoothstep(0.50, 1.0, b) * 0.85);

  // Milky haze in broad, slow patches keeps everything soft.
  float hz = fbm(p * 0.7 + vec2(3.3, 7.7), t * 0.015 + 5.0, 3);
  col = mix(col, cHaze, smoothstep(0.50, 0.78, hz + 0.25 * light) * 0.20);

  // Lilac filaments: thin, jagged, connected lines (zero-crossings of
  // noise, perturbed by fine turbulence) that glow around the cloud edges.
  vec2 jag = vec2(
    fbm(p * 7.0 + vec2(1.3, 8.1), t * 0.03 + 2.0, 4),
    fbm(p * 7.0 + vec2(6.4, 3.7), t * 0.03 + 9.0, 4)
  ) - 0.5;
  float l1 = 1.0 - abs(snoise(vec3(w * 1.7 + 0.12 * jag, t * 0.02 + 20.0)));
  float l2 = 1.0 - abs(snoise(vec3(w * 3.3 + 0.18 * jag + 4.0, t * 0.02 + 30.0)));
  float lines = 0.60 * pow(l1, 4.0) + 0.30 * pow(l2, 5.0);
  float glowLines = 0.55 * pow(l1, 2.2) + 0.22 * pow(l2, 2.6);
  // Filaments only show up in some regions, like the reference.
  float presence = smoothstep(0.25, 0.60, fbm(p * 1.1 + vec2(9.1, 2.6), t * 0.015 + 40.0, 3));
  float edge = exp(-pow((b - 0.45) / 0.22, 2.0));
  float vein = (lines + glowLines) * (0.25 + 0.75 * edge) * (0.30 + 0.70 * presence);
  vein += 0.20 * smoothstep(0.55, 0.95, strands) * edge;
  // Diffuse lilac fog hugging the shadow edges.
  vein += 0.08 * edge * smoothstep(0.35, 0.75, puff * 1.6 + 0.2 * presence);
  // A long vein that runs top to bottom just right of centre.
  float vx = 0.69 + 0.035 * snoise(vec3(uv.y * 2.4, 3.0, t * 0.02))
    + 0.012 * snoise(vec3(uv.y * 9.0, 5.0, t * 0.03)) + 0.03 * jag.x;
  float spine = exp(-abs(uv.x - vx) * uAspect * 140.0);
  spine *= 0.55 + 0.45 * smoothstep(0.3, 0.7, fbm(vec2(uv.y * 5.0, 7.0), t * 0.03, 3));
  vein += spine * 0.55 + exp(-abs(uv.x - vx) * uAspect * 30.0) * 0.12;
  vein = clamp(vein, 0.0, 1.0);
  col = mix(col, cVein, vein * 0.45);
  // Pale, almost white cores in the brightest filaments.
  col = mix(col, mix(cVein, cGlow, 0.6), pow(l1, 18.0) * (0.25 + 0.75 * edge) * presence * 0.35);

  // Lilac-pink wash that blooms up from the bottom centre over the second
  // half of the clip, keeping the cloud structure visible underneath.
  float washMask = exp(-pow(length((uv - vec2(0.52, 0.86)) * vec2(1.2, 2.0)), 2.0));
  float washAmt = smoothstep(0.50, 0.97, uProgress) * 0.62 + 0.06;
  col = mix(col, cWash, washMask * washAmt * (0.45 + 0.55 * (1.0 - b)));

  // Gentle overall lift toward the haze tone at the end of the clip.
  col = mix(col, cHaze, smoothstep(0.60, 1.0, uProgress) * 0.06);

  // Bright pinpoint near the top right inside a soft cyan glow; it fades as
  // the clouds roll in.
  vec2 gd = (uv - vec2(0.738, 0.225)) * vec2(uAspect, 1.0);
  float core = exp(-dot(gd, gd) * 15000.0);
  float halo = exp(-dot(gd, gd) * 12.0);
  float glowAmt = 1.0 - smoothstep(0.50, 0.95, uProgress) * 0.75;
  col = mix(col, mix(cLight, cGlow, 0.25), halo * 0.45 * glowAmt);
  col = mix(col, cGlow, core * 0.9 * glowAmt);

  // Lit cloud bank in the bottom-right corner.
  col = mix(col, cGlow, smoothstep(0.80, 1.0, uv.y) * smoothstep(0.50, 1.0, uv.x) * 0.70 * (0.6 + 0.4 * f));

  // Brief transients from the reference: a single-frame flash in the
  // top-left at frame 126 and a short-lived bright point near the bottom around
  // frame 200.
  float flash = 1.0 - step(0.5, abs(uFrame - 126.0)); // exactly one frame
  float flashMask = exp(-pow(length((uv - vec2(0.06, 0.18)) * vec2(3.0, 3.4)), 2.0));
  col = mix(col, mix(cGlow, cVein, 0.25), flash * flashMask * 0.95);
  vec2 sd = (uv - vec2(0.83, 0.96)) * vec2(uAspect, 1.0);
  float spark = exp(-pow((uFrame - 200.0) / 12.0, 2.0));
  col = mix(col, cGlow, spark * (exp(-dot(sd, sd) * 12000.0) * 0.85 + exp(-dot(sd, sd) * 300.0) * 0.25));

  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
