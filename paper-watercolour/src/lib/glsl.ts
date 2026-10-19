// Shared GLSL. All scene shaders work in "comp pixels": a 3840x2160 (or
// 6000x3375 for stills) coordinate space with a top-left origin, so the
// artwork looks the same at every render scale.

export const HEADER = /* glsl */ `#version 300 es
precision highp float;
precision highp sampler2D;
precision highp sampler2DArray;
`;

export const FULLSCREEN_VS = /* glsl */ `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

// Hashes and periodic gradient noise. The noise is only evaluated in the
// one-off generator passes below; per-frame shaders sample the baked,
// tiling noise texture instead, which is far cheaper on SwiftShader.
export const NOISE = /* glsl */ `
uint hashU(uint x) {
  x ^= x >> 16; x *= 0x7feb352du; x ^= x >> 15; x *= 0x846ca68bu; x ^= x >> 16;
  return x;
}
float hash12(vec2 p, float s) {
  uvec2 q = uvec2(ivec2(floor(p)) + 65536);
  return float(hashU(q.x * 1973u + hashU(q.y * 9277u + uint(s) * 26699u))) / 4294967295.0;
}
vec2 grad2(vec2 cell, vec2 period, float seed) {
  vec2 c = mod(cell, period);
  float a = hash12(c, seed) * 6.2831853;
  return vec2(cos(a), sin(a));
}
float pnoise(vec2 p, vec2 period, float seed) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = dot(grad2(i, period, seed), f);
  float b = dot(grad2(i + vec2(1, 0), period, seed), f - vec2(1, 0));
  float c = dot(grad2(i + vec2(0, 1), period, seed), f - vec2(0, 1));
  float d = dot(grad2(i + vec2(1, 1), period, seed), f - vec2(1, 1));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y) * 1.41421;
}
float pfbm(vec2 p, vec2 period, float seed, int oct) {
  float s = 0.0, amp = 0.5, norm = 0.0;
  for (int o = 0; o < 8; o++) {
    if (o >= oct) break;
    s += amp * pnoise(p, period, seed + float(o) * 17.0);
    norm += amp; p *= 2.0; period *= 2.0; amp *= 0.5;
  }
  return s / norm;
}
`;

// Sampling helpers available to every scene shader.
export const SCENE_COMMON = /* glsl */ `
uniform vec2 uComp;      // composition size (comp pixels)
uniform vec2 uBasis;     // the same frame in 3840-wide units: all scene maths uses these
uniform vec2 uRes;       // actual render-target size (device pixels)
uniform float uFrame;    // current frame (already wrapped to the loop)
uniform float uLoop;     // loop length in frames
uniform vec2 uCam;       // camera offset, comp px
uniform float uCamZoom;  // camera zoom (1 = none)
uniform sampler2D uNoise;   // 1024^2 tiling fbm, 4 independent channels
uniform sampler2D uPaper;   // baked paper: r height, g blotch, b fibre
uniform vec3 uPaperColor;   // linear
uniform float uPaperMargin; // fraction of comp size baked beyond each edge
out vec4 outColor;

const float TAU = 6.2831853;

// Position of this pixel in 3840-basis units (top-left origin), after the camera.
vec2 screenComp() {
  vec2 s = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uRes * uBasis;
  return (s - 0.5 * uBasis) / uCamZoom + 0.5 * uBasis + uCam;
}
vec4 noiseAt(vec2 q, float scalePx) { return texture(uNoise, q / scalePx); }
vec4 noiseLod(vec2 q, float scalePx, float lod) { return textureLod(uNoise, q / scalePx, lod); }
vec4 paperAt(vec2 q) {
  vec2 uv = (q / uBasis + uPaperMargin) / (1.0 + 2.0 * uPaperMargin);
  return texture(uPaper, uv);
}
// A point that walks once round a circle per loop: noise sampled along it
// changes smoothly and returns exactly to its start at frame == uLoop.
vec2 timeCircle(float radius, float phase) {
  float a = TAU * uFrame / uLoop + phase;
  return radius * vec2(cos(a), sin(a));
}
vec3 paperBase(vec2 q) {
  vec4 p = paperAt(q);
  float tone = 1.0 - 0.045 * (p.g - 0.5) * 2.0;     // slight blotchiness
  tone *= 1.0 + 0.035 * (p.b - 0.5) * 2.0;          // fibres, light and dark
  tone *= 1.0 - 0.025 * (0.5 - p.r);               // tooth shading
  return uPaperColor * tone;
}
// Pigment granulation: pigment settles in the paper's valleys.
float granulate(vec2 q, float amount) {
  vec4 p = paperAt(q);
  float n = noiseAt(q, 70.0).w;
  return 1.0 + amount * ((0.5 - p.r) * 1.6 + (n - 0.5) * 0.9);
}
vec3 srgbToLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}
`;

// One-off pass: tiling fbm texture.
export const NOISE_GEN_FS = HEADER + NOISE + /* glsl */ `
uniform vec2 uSize;
out vec4 outColor;
void main() {
  vec2 uv = gl_FragCoord.xy / uSize;
  vec2 P = vec2(8.0);
  outColor = vec4(
    pfbm(uv * P, P, 11.0, 6),
    pfbm(uv * P, P, 23.0, 6),
    pfbm(uv * P * 2.0, P * 2.0, 37.0, 5),
    pfbm(uv * P * 4.0, P * 4.0, 51.0, 5)
  ) * 0.5 + 0.5;
}
`;

// One-off pass: the paper sheet (cold-press tooth, blotches, fibres).
export const PAPER_GEN_FS = HEADER + NOISE + /* glsl */ `
uniform vec2 uSize;      // texture size in texels
uniform vec2 uComp;
uniform float uMargin;
uniform float uSeed;
uniform float uFibre;    // fibre strength (0 for chalkboard)
out vec4 outColor;
float n2(vec2 q, float scale, float seed, int oct) {
  vec2 P = vec2(4096.0);
  return pfbm(q / scale, P, seed, oct);
}
void main() {
  vec2 uv = gl_FragCoord.xy / uSize;
  uv.y = 1.0 - uv.y;
  vec2 q = (uv * (1.0 + 2.0 * uMargin) - uMargin) * uComp;
  // scale everything to a 3840-wide sheet so stills match the clips
  q *= 3840.0 / uComp.x;
  float tooth = 0.55 * n2(q, 11.0, uSeed, 3) + 0.35 * n2(q, 34.0, uSeed + 5.0, 3) + 0.1 * n2(q, 4.0, uSeed + 9.0, 2);
  float blotch = n2(q, 900.0, uSeed + 13.0, 4) * 0.7 + n2(q, 260.0, uSeed + 19.0, 3) * 0.3;
  float fib = 0.0;
  for (int i = 0; i < 5; i++) {
    float a = hash12(vec2(float(i), 3.0), uSeed) * 6.2831853;
    mat2 R = mat2(cos(a), -sin(a), sin(a), cos(a));
    vec2 r = R * q;
    float n = n2(vec2(r.x / 9.0, r.y), 26.0, uSeed + 31.0 + float(i) * 7.0, 3);
    float ridge = pow(max(0.0, 1.0 - abs(n) * 7.0), 3.0);
    float gate = smoothstep(0.1, 0.45, n2(q, 160.0, uSeed + 61.0 + float(i), 2));
    fib += ridge * gate * (i % 2 == 0 ? 1.0 : -0.8);
  }
  outColor = vec4(tooth * 0.5 + 0.5, blotch * 0.5 + 0.5, clamp(0.5 + fib * 0.5 * uFibre, 0.0, 1.0), 1.0);
}
`;

// Final pass: grain + blue-noise dither, linear -> sRGB, into the 8-bit canvas.
export const POST_FS = HEADER + /* glsl */ `
uniform sampler2D uScene;
uniform sampler2D uBlue;
uniform vec2 uRes;
uniform float uFrame;
uniform float uGrain;
out vec4 outColor;
uint hashU(uint x) {
  x ^= x >> 16; x *= 0x7feb352du; x ^= x >> 15; x *= 0x846ca68bu; x ^= x >> 16;
  return x;
}
vec3 toSrgb(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
void main() {
  ivec2 px = ivec2(gl_FragCoord.xy);
  vec3 c = texelFetch(uScene, px, 0).rgb;
  // grain: fixed formula of pixel and (wrapped) frame
  uint h = hashU(uint(px.x) * 73856093u ^ hashU(uint(px.y) * 19349663u ^ uint(uFrame) * 83492791u));
  float g = float(h) / 4294967295.0 - 0.5;
  c *= 1.0 + uGrain * 2.0 * g;
  vec3 s = toSrgb(c);
  // triangular blue-noise dither, +-1/255, pattern shifted per frame (R2 sequence)
  vec2 off = floor(fract(vec2(0.7548777, 0.5698403) * uFrame) * 64.0);
  float b1 = texelFetch(uBlue, (px + ivec2(off)) & 63, 0).r;
  float b2 = texelFetch(uBlue, (px + ivec2(off) + ivec2(17, 41)) & 63, 0).r;
  s += (b1 + b2 - 1.0) / 255.0;
  outColor = vec4(s, 1.0);
}
`;
