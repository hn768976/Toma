/**
 * Shared GLSL (ES 3.00) helpers for the light-texture plates.
 *
 * Everything here is written for SEAMLESS LOOPING. The convention is that
 * plates receive `uT`, a normalised loop position in [0,1), and build all
 * motion from terms that return to their frame-0 value at uT = 1:
 *
 *   - oscillation -> cos(TAU * (k*uT + phase)) with INTEGER k
 *   - travel      -> fract(base + k*uT) with INTEGER k (wrap-around)
 *   - noise flow  -> loopFbm(), which cross-fades two time-offset samples
 *
 * Density is sampled from a jittered grid rather than by looping over a
 * flat list of sprites: each pixel only inspects the 3x3 cells around it,
 * so cost is independent of how many discs are notionally on screen. That
 * matters here because the delivery renders run on software GL.
 */
export const GLSL_LIB = /* glsl */ `
#define TAU 6.283185307179586
#define PI  3.141592653589793

// ---------------------------------------------------------------- hashing

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

vec3 hash32(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xxy + p3.yzz) * p3.zyx);
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// ------------------------------------------------------------ value noise

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  // Quintic fade - C2 continuous, so fbm octaves stay free of
  // the grid-aligned creasing a cubic fade leaves behind.
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = hash12(i + vec2(0.0, 0.0));
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm3(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 3; i++) {
    v += a * vnoise(p);
    p = rot * p * 2.03;
    a *= 0.5;
  }
  return v;
}

float fbm4(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 4; i++) {
    v += a * vnoise(p);
    p = rot * p * 2.03;
    a *= 0.5;
  }
  return v;
}

/**
 * Seamlessly looping fbm. Samples the field at two positions one full
 * drift-cycle apart and cross-fades between them across the loop, so the
 * value at t=1 is identical to the value at t=0 while the field still
 * appears to flow steadily along 'drift'.
 */
float loopFbm(vec2 p, vec2 drift, float t) {
  float a = fbm3(p + drift * t);
  float b = fbm3(p + drift * (t - 1.0));
  return mix(a, b, t);
}

float loopFbm4(vec2 p, vec2 drift, float t) {
  float a = fbm4(p + drift * t);
  float b = fbm4(p + drift * (t - 1.0));
  return mix(a, b, t);
}

// ------------------------------------------------------------ bokeh optics

/**
 * Out-of-focus point-light profile.
 *
 * A real defocused highlight is not a gaussian blob: it is a near-flat
 * disc of light bounded by the aperture, with a brighter rim where the
 * lens edge concentrates energy, and a soft falloff whose width depends
 * on how far from the focal plane the source sits.
 *
 *   r    - radial distance normalised so 1.0 is the disc edge
 *   soft - edge softness, 0 = hard aperture, 1 = fully diffuse
 *   rim  - strength of the bright edge ring
 */
float bokehProfile(float r, float soft, float rim) {
  if (r > 1.0) return 0.0;
  float edge = clamp(soft, 0.02, 1.0);
  // Flat body that rolls off over the outer 'edge' fraction of the disc.
  float body = 1.0 - smoothstep(1.0 - edge, 1.0, r);
  // Rim brightening, peaked just inside the boundary. Kept narrow: a
  // broad rim reads as a soap bubble rather than a defocused highlight.
  float ringPos = 1.0 - edge * 0.42;
  float ringWidth = max(edge * 0.55, 0.05);
  float ring = exp(-pow((r - ringPos) / ringWidth, 2.0) * 2.6);
  // Barely-there centre dip, as with a real iris.
  float dip = 1.0 - 0.035 * (1.0 - smoothstep(0.0, 0.7, r));
  return body * dip + ring * rim * body;
}

/**
 * Per-cell jitter for the grid sampler. Returns the disc's offset within
 * its cell (xy), plus two independent random values (zw) for size and
 * brightness/tint variation.
 */
vec4 cellRandom(vec2 cell, float layerSeed) {
  vec3 h = hash32(cell + layerSeed * 91.7);
  float extra = hash12(cell * 1.7 + layerSeed * 13.3);
  return vec4(h.x, h.y, h.z, extra);
}

// -------------------------------------------------------------- shimmer

/**
 * Per-element blink / shimmer.
 *
 * A plain cosine breathes: it spends as much time bright as dim and reads
 * as a slow swell. Raising it to a power pushes the waveform down towards
 * its floor and leaves short peaks, which is what makes a light read as
 * BLINKING rather than pulsing. Two harmonics at different integer rates
 * are mixed so the pattern does not repeat on an obvious beat.
 *
 * Both rates are integer cycles per loop, so every element returns to its
 * starting brightness at the loop point.
 *
 *   phase - per-element offset, otherwise the whole field blinks in step
 *   hzA/hzB - blink rates in Hz, converted to integer cycles per loop
 *   depth - 0 holds steady, 1 swings from near-black to well over full
 *   sharp - 1 breathes, 3+ snaps
 */
float shimmer(float t, float loopSeconds, float phase, float hzA, float hzB, float depth, float sharp) {
  // uShimmerRate scales every blink rate in the plate at once, so the
  // speed of the whole field can be dialled without disturbing the
  // relative spread of fast and slow elements that gives it life.
  float kA = max(1.0, floor(hzA * uShimmerRate * loopSeconds + 0.5));
  float kB = max(1.0, floor(hzB * uShimmerRate * loopSeconds + 0.5));
  float a = pow(0.5 + 0.5 * cos(TAU * kA * t + phase), sharp);
  float b = pow(0.5 + 0.5 * cos(TAU * kB * t + phase * 1.73 + 2.1), sharp);
  float s = a * 0.62 + b * 0.38;
  return mix(1.0 - depth * 0.92, 1.0 + depth * 1.25, s);
}

// --------------------------------------------------------------- grading

// Filmic-ish shoulder. Keeps the blown-out cores of the bright plates from
// clipping to flat white the moment several discs overlap.
vec3 tonemap(vec3 c, float shoulder) {
  return c / (1.0 + c * shoulder);
}

vec3 saturate3(vec3 c, float amount) {
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  return mix(vec3(l), c, amount);
}

vec3 liftGammaGain(vec3 c, vec3 lift, float gamma, vec3 gain) {
  c = clamp(c, 0.0, 4.0);
  c = c * gain + lift;
  return pow(max(c, 0.0), vec3(gamma));
}

/**
 * Animated film grain, quantised to whole frames.
 *
 * Deriving the frame index from uT rather than from a free-running clock
 * keeps the pattern deterministic: a given frame gets the same grain
 * however many times it is rendered, and in whichever tab. Adjacent
 * frames get independent patterns, which is what grain should do - the
 * wrap from the last frame to the first is no different from any other
 * step, so the loop point does not read as a noise pop.
 */
float grain(vec2 fragPos, float t, float loopFrames) {
  float f = floor(t * loopFrames + 0.5);
  return hash12(fragPos * 0.7331 + vec2(f * 1.7, f * 3.1)) - 0.5;
}

/** Soft elliptical vignette. 0 at centre, 1 at the corners. */
float vignette(vec2 uv, float radius, float softness) {
  vec2 d = uv - 0.5;
  float r = length(d * vec2(1.0, 0.88)) * 2.0;
  return smoothstep(radius, radius + softness, r);
}

/**
 * Cheap lateral chromatic aberration, applied as a per-channel radial
 * scale of an already-computed colour triple. Used sparingly: it reads as
 * "shot on glass" and hides the synthetic evenness of a procedural field.
 */
vec3 fringe(vec3 c, float amount, float radial) {
  float k = amount * radial;
  return vec3(c.r * (1.0 + k), c.g, c.b * (1.0 - k * 0.6));
}
`;

/**
 * The vertex shader Pixi v8 uses for filters. Reproduced here (rather than
 * imported) so the plate shaders own their full pipeline and the uv
 * convention is explicit: `vTextureCoord` runs 0..1 across the full-screen
 * sprite the filter is attached to.
 */
export const FILTER_VERT = /* glsl */ `
in vec2 aPosition;
out vec2 vTextureCoord;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

vec4 filterVertexPosition(void) {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  return vec4(position, 0.0, 1.0);
}

vec2 filterTextureCoord(void) {
  return aPosition * (uOutputFrame.zw * uInputSize.zw);
}

void main(void) {
  gl_Position = filterVertexPosition();
  vTextureCoord = filterTextureCoord();
}
`;

/**
 * Preamble every plate fragment shader opens with: the filter varying,
 * the output, the uniforms shared by all plates, and the helper library.
 *
 *   uT          - loop position in [0,1)
 *   uResolution - output size in px (drives aspect correction)
 *   uScale      - 1.0 at 1080p, 2.0 at 4K. Multiplies anything measured
 *                 in pixels so the plates look identical at both sizes.
 *   uLoopFrames - loop length, so grain can be quantised to whole frames
 *   uSeed       - reshuffles every hashed field without touching motion
 */
export const PLATE_FRAG_HEADER = /* glsl */ `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;

uniform float uT;
uniform vec2  uResolution;
uniform float uScale;
uniform float uLoopFrames;
uniform float uSeed;
uniform float uGrainAmount;
uniform float uExposure;
uniform float uLoopSeconds;
uniform float uShimmer;
uniform float uShimmerRate;
` + GLSL_LIB;
