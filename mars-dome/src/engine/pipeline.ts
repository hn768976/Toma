import * as THREE from "three";

/**
 * Post pipeline: the whole image chain after the scene render.
 *
 *   scene (MSAA, RGBA16F + depth)
 *     -> prep      depth fog / haze, circle of confusion        (RGBA16F)
 *     -> dof       half-res scatter-as-gather + fill, composite  (RGBA16F)
 *     -> bloom     soft-knee prefilter + mip chain               (RGBA16F)
 *     -> final     chromatic aberration, vignette, exposure, tone mapping,
 *                  grade, film grain, +-1/255 dither, sRGB         (canvas)
 *
 * Every size is expressed as a fraction of the frame height, so a 1080p
 * render and a 4K render of the same composition look the same.
 * Nothing here reads a clock: the only time input is the frame number.
 */

export type Vec3 = [number, number, number];

export interface Look {
  /** Multisample count for the scene pass (0, 2 or 4). */
  msaaSamples: number;
  /** Scene-linear gain applied before tone mapping. */
  exposure: number;
  toneMap: "aces" | "agx";
  /** Linear RGB gain before tone mapping (white balance). */
  whiteBalance: Vec3;
  fog: {
    /** Linear RGB fog colour away from the sun, and towards it. */
    color: Vec3;
    sunColor: Vec3;
    sunDir: Vec3;
    sunPower: number;
    /** Extinction per world unit at baseHeight. */
    density: number;
    /** 0 = uniform fog. Larger = fog hugs the ground. */
    heightFalloff: number;
    baseHeight: number;
    maxOpacity: number;
  };
  dof: {
    enabled: boolean;
    /** Focus distance along the camera axis, world units. */
    focus: number;
    /** Blur diameter of a point at infinity, as a fraction of frame height. */
    cocInfinity: number;
    /** Clamp for the blur diameter, fraction of frame height. */
    maxCoc: number;
    /** Extra multiplier for things in front of the focus plane. */
    nearScale: number;
    /**
     * Miniature (tilt-shift) falloff: extra blur towards the top and bottom of the frame.
     * amount = blur diameter at the frame edge (fraction of frame height), centre = sharp band's
     * height (0 = bottom, 1 = top), width = half-height of the sharp band.
     */
    tiltShift: { amount: number; centre: number; width: number };
  };
  bloom: {
    /** Scene-linear luminance (after exposure) where bloom starts. */
    threshold: number;
    knee: number;
    strength: number;
    /** -1 = tight core only ... +1 = wide halo only. */
    tilt: number;
  };
  grade: {
    /** Output black and white level (display, 0-1): lifts blacks / caps whites. */
    blackLevel: number;
    whiteLevel: number;
    contrast: number;
    pivot: number;
    saturation: number;
    gamma: Vec3;
    /** Added to shadows / highlights (display space) for split toning. */
    shadowTint: Vec3;
    highlightTint: Vec3;
  };
  lens: {
    vignette: number;
    vignetteStart: number;
    chromaticAberration: number;
    /** Overall lens softness: blur radius as a fraction of frame height (0 = none). */
    softness: number;
  };
  grain: {
    /** Standard deviation in display units (1 = full range). */
    amount: number;
    /** Grain cell size in 1080p pixels. */
    size: number;
    chroma: number;
  };
  dither: boolean;
}

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const PREP_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform mat4 uProjInv;
uniform mat4 uViewInv;
uniform vec3 uCamPos;
uniform vec3 uFogColor;
uniform vec3 uFogSunColor;
uniform vec3 uFogSunDir;
uniform float uFogSunPower;
uniform float uFogDensity;
uniform float uFogFalloff;
uniform float uFogBase;
uniform float uFogMax;
uniform float uFocus;
uniform float uCocInf;
uniform float uMaxCoc;
uniform float uNearScale;
uniform vec3 uTilt;
void main() {
  vec3 col = texture2D(tColor, vUv).rgb;
  float d = texture2D(tDepth, vUv).x;
  vec4 clip = vec4(vUv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  vec4 view = uProjInv * clip;
  view /= view.w;
  float viewZ = max(-view.z, 1e-4);
  vec3 world = (uViewInv * view).xyz;
  vec3 ray = world - uCamPos;
  float dist = length(ray);
  vec3 dir = ray / max(dist, 1e-5);
  if (uFogDensity > 0.0) {
    // analytic integral of an exponential height fog along the view ray
    float dy = ray.y;
    float k = uFogFalloff;
    float base = exp(-k * (uCamPos.y - uFogBase));
    float t = k * dy;
    float integral = abs(t) > 1e-3 ? (1.0 - exp(-t)) / t : 1.0 - 0.5 * t;
    float tau = uFogDensity * dist * base * integral;
    float f = min(1.0 - exp(-tau), uFogMax);
    float s = pow(max(dot(dir, normalize(uFogSunDir)), 0.0), uFogSunPower);
    col = mix(col, mix(uFogColor, uFogSunColor, s), f);
  }
  float coc = uCocInf * (1.0 - uFocus / viewZ);
  if (coc < 0.0) coc *= uNearScale;
  coc = clamp(coc, -uMaxCoc, uMaxCoc);
  if (uTilt.x > 0.0) {
    float ts = uTilt.x * smoothstep(uTilt.z, uTilt.z + 0.32, abs(vUv.y - uTilt.y));
    coc = (coc < 0.0 ? -1.0 : 1.0) * max(abs(coc), ts);
  }
  gl_FragColor = vec4(col, coc);
}`;

// half-res downsample: colour average, CoC of the nearest sample
const DOWN_COC_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tPrep;
uniform vec2 uTexel;
void main() {
  vec4 a = texture2D(tPrep, vUv + uTexel * vec2(-0.5, -0.5));
  vec4 b = texture2D(tPrep, vUv + uTexel * vec2( 0.5, -0.5));
  vec4 c = texture2D(tPrep, vUv + uTexel * vec2(-0.5,  0.5));
  vec4 d = texture2D(tPrep, vUv + uTexel * vec2( 0.5,  0.5));
  float coc = min(min(a.a, b.a), min(c.a, d.a));
  gl_FragColor = vec4((a.rgb + b.rgb + c.rgb + d.rgb) * 0.25, coc);
}`;

// tile max of the near-field CoC (so foreground blur can spill over sharp pixels)
const NEAR_TILE_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tHalf;
uniform vec2 uTexel;
void main() {
  float m = 0.0;
  for (int y = 0; y < 4; y++) {
    for (int x = 0; x < 4; x++) {
      vec2 o = (vec2(float(x), float(y)) - 1.5) * 2.0;
      m = max(m, -texture2D(tHalf, vUv + o * uTexel).a);
    }
  }
  gl_FragColor = vec4(max(m, 0.0));
}`;

const NEAR_DILATE_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tTile;
uniform vec2 uTexel;
void main() {
  float m = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      m = max(m, texture2D(tTile, vUv + vec2(float(x), float(y)) * uTexel).r);
    }
  }
  gl_FragColor = vec4(m);
}`;

const diskTaps = (rings: number) => {
  const pts: [number, number][] = [];
  for (let k = 1; k <= rings; k++) {
    const n = 8 * k;
    const r = k / rings;
    for (let j = 0; j < n; j++) {
      const a = ((j + (k % 2) * 0.5) / n) * Math.PI * 2;
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }
  return pts;
};

const gatherFrag = (rings: number) => {
  const taps = diskTaps(rings);
  const lit = taps.map(([x, y]) => `vec2(${x.toFixed(6)}, ${y.toFixed(6)})`).join(",\n  ");
  return /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tHalf;
uniform sampler2D tNear;
uniform vec2 uTexel;
uniform float uHeight; // half-res height in pixels
const int N = ${taps.length};
const vec2 DISK[N] = vec2[N](
  ${lit}
);
void main() {
  vec4 c0 = texture2D(tHalf, vUv);
  float r0 = abs(c0.a) * 0.5 * uHeight;
  float rn = texture2D(tNear, vUv).r * 0.5 * uHeight;
  float R = max(r0, rn);
  if (R < 0.35) {
    gl_FragColor = vec4(c0.rgb, abs(c0.a));
    return;
  }
  vec3 acc = c0.rgb;
  float accCoc = abs(c0.a);
  float tot = 1.0;
  for (int i = 0; i < N; i++) {
    vec2 o = DISK[i] * R;
    float dist = length(o);
    vec4 s = texture2D(tHalf, vUv + o * uTexel);
    float sr = abs(s.a) * 0.5 * uHeight;
    // a sample behind the centre pixel may not blur over it more than the centre blurs itself
    if (s.a > c0.a) sr = min(sr, r0 * 2.0);
    float m = smoothstep(dist - 0.5, dist + 0.5, sr);
    acc += mix(acc / tot, s.rgb, m);
    accCoc += mix(accCoc / tot, abs(s.a), m);
    tot += 1.0;
  }
  gl_FragColor = vec4(acc / tot, accCoc / tot);
}`;
};

const fillFrag = (rings: number) => /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tGather;
uniform vec2 uTexel;
uniform float uHeight;
void main() {
  vec4 c = texture2D(tGather, vUv);
  float r = c.a * 0.5 * uHeight;
  float s = max(r / ${(rings * 2).toFixed(1)}, 0.0);
  if (s < 0.25) { gl_FragColor = c; return; }
  vec4 acc = c * 4.0;
  acc += texture2D(tGather, vUv + vec2( s, 0.0) * uTexel) * 2.0;
  acc += texture2D(tGather, vUv + vec2(-s, 0.0) * uTexel) * 2.0;
  acc += texture2D(tGather, vUv + vec2(0.0,  s) * uTexel) * 2.0;
  acc += texture2D(tGather, vUv + vec2(0.0, -s) * uTexel) * 2.0;
  acc += texture2D(tGather, vUv + vec2( s,  s) * uTexel);
  acc += texture2D(tGather, vUv + vec2(-s,  s) * uTexel);
  acc += texture2D(tGather, vUv + vec2( s, -s) * uTexel);
  acc += texture2D(tGather, vUv + vec2(-s, -s) * uTexel);
  gl_FragColor = acc / 16.0;
}`;

const DOF_COMPOSITE_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tPrep;
uniform sampler2D tBlur;
uniform float uHeight; // full-res height in pixels
void main() {
  vec4 sharp = texture2D(tPrep, vUv);
  vec4 blur = texture2D(tBlur, vUv);
  float r = max(blur.a, abs(sharp.a)) * 0.5 * uHeight;
  float t = smoothstep(0.6, 2.2, r);
  gl_FragColor = vec4(mix(sharp.rgb, blur.rgb, t), 1.0);
}`;

const BLOOM_PREFILTER_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uThreshold;
uniform float uKnee;
vec3 pre(vec3 c) {
  float l = max(c.r, max(c.g, c.b));
  float soft = clamp(l - uThreshold + uKnee, 0.0, 2.0 * uKnee);
  soft = soft * soft / (4.0 * uKnee + 1e-5);
  float w = max(soft, l - uThreshold) / max(l, 1e-5);
  return c * max(w, 0.0);
}
void main() {
  vec3 a = pre(texture2D(tSrc, vUv + uTexel * vec2(-0.5, -0.5)).rgb);
  vec3 b = pre(texture2D(tSrc, vUv + uTexel * vec2( 0.5, -0.5)).rgb);
  vec3 c = pre(texture2D(tSrc, vUv + uTexel * vec2(-0.5,  0.5)).rgb);
  vec3 d = pre(texture2D(tSrc, vUv + uTexel * vec2( 0.5,  0.5)).rgb);
  gl_FragColor = vec4((a + b + c + d) * 0.25, 1.0);
}`;

// 13-tap downsample (Jimenez, "Next Generation Post Processing in Call of Duty")
const BLOOM_DOWN_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tSrc;
uniform vec2 uTexel; // texel of the source
void main() {
  vec3 a = texture2D(tSrc, vUv + uTexel * vec2(-2.0, -2.0)).rgb;
  vec3 b = texture2D(tSrc, vUv + uTexel * vec2( 0.0, -2.0)).rgb;
  vec3 c = texture2D(tSrc, vUv + uTexel * vec2( 2.0, -2.0)).rgb;
  vec3 d = texture2D(tSrc, vUv + uTexel * vec2(-2.0,  0.0)).rgb;
  vec3 e = texture2D(tSrc, vUv).rgb;
  vec3 f = texture2D(tSrc, vUv + uTexel * vec2( 2.0,  0.0)).rgb;
  vec3 g = texture2D(tSrc, vUv + uTexel * vec2(-2.0,  2.0)).rgb;
  vec3 h = texture2D(tSrc, vUv + uTexel * vec2( 0.0,  2.0)).rgb;
  vec3 i = texture2D(tSrc, vUv + uTexel * vec2( 2.0,  2.0)).rgb;
  vec3 j = texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb;
  vec3 k = texture2D(tSrc, vUv + uTexel * vec2( 1.0, -1.0)).rgb;
  vec3 l = texture2D(tSrc, vUv + uTexel * vec2(-1.0,  1.0)).rgb;
  vec3 m = texture2D(tSrc, vUv + uTexel * vec2( 1.0,  1.0)).rgb;
  vec3 o = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  gl_FragColor = vec4(o, 1.0);
}`;

// 9-tap tent upsample, added to the weighted level below
const BLOOM_UP_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tLow;   // smaller level (already accumulated)
uniform sampler2D tHigh;  // this level
uniform vec2 uTexel;      // texel of the low level
uniform float uWeight;
void main() {
  vec3 s = texture2D(tLow, vUv).rgb * 4.0;
  s += texture2D(tLow, vUv + uTexel * vec2( 1.0, 0.0)).rgb * 2.0;
  s += texture2D(tLow, vUv + uTexel * vec2(-1.0, 0.0)).rgb * 2.0;
  s += texture2D(tLow, vUv + uTexel * vec2(0.0,  1.0)).rgb * 2.0;
  s += texture2D(tLow, vUv + uTexel * vec2(0.0, -1.0)).rgb * 2.0;
  s += texture2D(tLow, vUv + uTexel * vec2( 1.0,  1.0)).rgb;
  s += texture2D(tLow, vUv + uTexel * vec2(-1.0,  1.0)).rgb;
  s += texture2D(tLow, vUv + uTexel * vec2( 1.0, -1.0)).rgb;
  s += texture2D(tLow, vUv + uTexel * vec2(-1.0, -1.0)).rgb;
  gl_FragColor = vec4(s / 16.0 + texture2D(tHigh, vUv).rgb * uWeight, 1.0);
}`;

const BLOOM_SCALE_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tSrc;
uniform float uWeight;
void main() { gl_FragColor = vec4(texture2D(tSrc, vUv).rgb * uWeight, 1.0); }`;

const FINAL_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tColor;
uniform sampler2D tBloom;
uniform vec2 uResolution;
uniform float uFrame;
uniform float uExposure;
uniform vec3 uWhiteBalance;
uniform int uToneMap;
uniform float uBloomStrength;
uniform float uBlack;
uniform float uWhite;
uniform float uContrast;
uniform float uPivot;
uniform float uSaturation;
uniform vec3 uGamma;
uniform vec3 uShadowTint;
uniform vec3 uHighlightTint;
uniform float uVignette;
uniform float uVignetteStart;
uniform float uCA;
uniform float uSoft; // blur radius in uv (y) units
uniform float uGrain;
uniform float uGrainCell; // grain cell size in output pixels
uniform float uGrainChroma;
uniform float uDither;

vec3 RRTAndODTFit(vec3 v) {
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
}
vec3 aces(vec3 color) {
  const mat3 inM = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
  const mat3 outM = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
  color *= 1.0 / 0.6;
  color = inM * color;
  color = RRTAndODTFit(color);
  color = outM * color;
  return clamp(color, 0.0, 1.0);
}
vec3 agxContrast(vec3 x) {
  vec3 x2 = x * x;
  vec3 x4 = x2 * x2;
  return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
}
vec3 agx(vec3 color) {
  const mat3 toRec2020 = mat3(vec3(0.6274, 0.0691, 0.0164), vec3(0.3293, 0.9195, 0.0880), vec3(0.0433, 0.0113, 0.8956));
  const mat3 fromRec2020 = mat3(vec3(1.6605, -0.1246, -0.0182), vec3(-0.5876, 1.1329, -0.1006), vec3(-0.0728, -0.0083, 1.1187));
  const mat3 inset = mat3(vec3(0.856627153315983, 0.137318972929847, 0.11189821299995), vec3(0.0951212405381588, 0.761241990602591, 0.0767994186031903), vec3(0.0482516061458583, 0.101439036467562, 0.811302368396859));
  const mat3 outset = mat3(vec3(1.1271005818144368, -0.1413297634984383, -0.14132976349843826), vec3(-0.11060664309660323, 1.157823702216272, -0.11060664309660294), vec3(-0.016493938717834573, -0.016493938717834257, 1.2519364065950405));
  const float minEv = -12.47393;
  const float maxEv = 4.026069;
  color = toRec2020 * color;
  color = inset * color;
  color = max(color, 1e-10);
  color = log2(color);
  color = clamp((color - minEv) / (maxEv - minEv), 0.0, 1.0);
  color = agxContrast(color);
  color = outset * color;
  color = pow(max(vec3(0.0), color), vec3(2.2));
  color = fromRec2020 * color;
  return clamp(color, 0.0, 1.0);
}
vec3 sampleSoft(vec2 uv) {
  if (uSoft <= 0.0) return texture2D(tColor, uv).rgb;
  vec2 r = vec2(uSoft * uResolution.y / uResolution.x, uSoft);
  vec3 c = texture2D(tColor, uv).rgb * 0.2;
  c += texture2D(tColor, uv + r * vec2( 0.7,  0.7)).rgb * 0.125;
  c += texture2D(tColor, uv + r * vec2(-0.7,  0.7)).rgb * 0.125;
  c += texture2D(tColor, uv + r * vec2( 0.7, -0.7)).rgb * 0.125;
  c += texture2D(tColor, uv + r * vec2(-0.7, -0.7)).rgb * 0.125;
  c += texture2D(tColor, uv + r * vec2( 1.0,  0.0)).rgb * 0.075;
  c += texture2D(tColor, uv + r * vec2(-1.0,  0.0)).rgb * 0.075;
  c += texture2D(tColor, uv + r * vec2( 0.0,  1.0)).rgb * 0.075;
  c += texture2D(tColor, uv + r * vec2( 0.0, -1.0)).rgb * 0.075;
  return c;
}
vec3 toSrgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}
// PCG-style integer hash: stable across GPUs, no sin()
uint hashu(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v.x ^ v.y ^ v.z;
}
float hash1(vec2 p, float f, float s) {
  return float(hashu(uvec3(uint(p.x + 64.0), uint(p.y + 64.0), uint(f) * 7u + uint(s))) >> 8u) / 16777216.0;
}
// smooth value noise on a grid of the given cell size (cell = 1 -> one value per pixel)
float grainField(vec2 frag, float cell, float f, float s) {
  vec2 p = frag / cell;
  vec2 i = floor(p - 0.5);
  vec2 t = p - 0.5 - i;
  t = t * t * (3.0 - 2.0 * t);
  float a = hash1(i, f, s);
  float b = hash1(i + vec2(1.0, 0.0), f, s);
  float c = hash1(i + vec2(0.0, 1.0), f, s);
  float d = hash1(i + vec2(1.0, 1.0), f, s);
  return mix(mix(a, b, t.x), mix(c, d, t.x), t.y) - 0.5;
}

void main() {
  vec2 uv = vUv;
  vec2 cc = uv - 0.5;
  cc.x *= uResolution.x / uResolution.y;
  float r2 = dot(cc, cc);
  vec3 col;
  if (uCA > 0.0) {
    vec2 o = (uv - 0.5) * r2 * uCA;
    col.r = sampleSoft(uv + o).r;
    col.g = sampleSoft(uv).g;
    col.b = sampleSoft(uv - o).b;
  } else {
    col = sampleSoft(uv);
  }
  col += texture2D(tBloom, uv).rgb * uBloomStrength;
  col *= uExposure * uWhiteBalance;
  float vig = smoothstep(uVignetteStart, 1.1, sqrt(r2));
  col *= 1.0 - uVignette * vig * vig;
  col = uToneMap == 0 ? aces(col) : agx(col);
  col = toSrgb(col);
  // grade (display space)
  col = (col - uPivot) * uContrast + uPivot;
  col = clamp(col, 0.0, 1.0);
  col = pow(col, uGamma);
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(l), col, uSaturation);
  col += uShadowTint * (1.0 - l) * (1.0 - l) + uHighlightTint * l * l;
  col = uBlack + col * (uWhite - uBlack);
  col = clamp(col, 0.0, 1.0);
  // film grain: fixed pattern per frame, fades out in pure black
  if (uGrain > 0.0) {
    l = dot(col, vec3(0.2126, 0.7152, 0.0722));
    float g = grainField(gl_FragCoord.xy, uGrainCell, uFrame, 1.0) + grainField(gl_FragCoord.xy, uGrainCell * 0.5, uFrame, 2.0) * 0.5;
    vec3 gc = vec3(grainField(gl_FragCoord.xy, uGrainCell, uFrame, 3.0), grainField(gl_FragCoord.xy, uGrainCell, uFrame, 4.0), grainField(gl_FragCoord.xy, uGrainCell, uFrame, 5.0));
    float fade = smoothstep(0.0, 0.06, l) * (1.0 - 0.5 * smoothstep(0.7, 1.0, l));
    col += (vec3(g) + gc * uGrainChroma) * uGrain * 3.4 * fade;
  }
  // +-1/255 triangular dither, never on pure black or pure white
  if (uDither > 0.0) {
    float n = hash1(gl_FragCoord.xy, uFrame, 11.0) + hash1(gl_FragCoord.xy, uFrame, 12.0) - 1.0;
    float lum = dot(col, vec3(1.0 / 3.0));
    float gate = step(0.5 / 255.0, lum) * step(lum, 1.0 - 0.5 / 255.0);
    col += n / 255.0 * gate;
  }
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

const DOF_RINGS = 4;

const hdr = (w: number, h: number, opts: Partial<THREE.RenderTargetOptions> = {}) =>
  new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: false,
    ...opts,
  });

const mat = (frag: string, uniforms: Record<string, THREE.IUniform>) =>
  new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: frag,
    uniforms,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });

export class PostPipeline {
  look: Look;
  frame = 0;
  private w = 0;
  private h = 0;
  private sceneRT!: THREE.WebGLRenderTarget;
  private prepRT!: THREE.WebGLRenderTarget;
  private halfA!: THREE.WebGLRenderTarget;
  private halfB!: THREE.WebGLRenderTarget;
  private tileA!: THREE.WebGLRenderTarget;
  private tileB!: THREE.WebGLRenderTarget;
  private dofRT!: THREE.WebGLRenderTarget;
  private bloomDown: THREE.WebGLRenderTarget[] = [];
  private bloomUp: THREE.WebGLRenderTarget[] = [];
  private quad: THREE.Mesh;
  private quadScene = new THREE.Scene();
  private quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private m: Record<string, THREE.ShaderMaterial>;

  constructor(look: Look) {
    this.look = look;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    geo.setAttribute("uv", new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
    this.quad = new THREE.Mesh(geo);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
    const u = (v: unknown) => ({ value: v });
    this.m = {
      prep: mat(PREP_FRAG, {
        tColor: u(null), tDepth: u(null), uProjInv: u(new THREE.Matrix4()), uViewInv: u(new THREE.Matrix4()),
        uCamPos: u(new THREE.Vector3()), uFogColor: u(new THREE.Vector3()), uFogSunColor: u(new THREE.Vector3()),
        uFogSunDir: u(new THREE.Vector3(0, 1, 0)), uFogSunPower: u(8), uFogDensity: u(0), uFogFalloff: u(0),
        uFogBase: u(0), uFogMax: u(1), uFocus: u(1), uCocInf: u(0), uMaxCoc: u(0), uNearScale: u(1), uTilt: u(new THREE.Vector3()),
      }),
      downCoc: mat(DOWN_COC_FRAG, { tPrep: u(null), uTexel: u(new THREE.Vector2()) }),
      nearTile: mat(NEAR_TILE_FRAG, { tHalf: u(null), uTexel: u(new THREE.Vector2()) }),
      nearDilate: mat(NEAR_DILATE_FRAG, { tTile: u(null), uTexel: u(new THREE.Vector2()) }),
      gather: mat(gatherFrag(DOF_RINGS), { tHalf: u(null), tNear: u(null), uTexel: u(new THREE.Vector2()), uHeight: u(1) }),
      fill: mat(fillFrag(DOF_RINGS), { tGather: u(null), uTexel: u(new THREE.Vector2()), uHeight: u(1) }),
      dofComp: mat(DOF_COMPOSITE_FRAG, { tPrep: u(null), tBlur: u(null), uHeight: u(1) }),
      bloomPre: mat(BLOOM_PREFILTER_FRAG, { tSrc: u(null), uTexel: u(new THREE.Vector2()), uThreshold: u(1), uKnee: u(0.5) }),
      bloomDown: mat(BLOOM_DOWN_FRAG, { tSrc: u(null), uTexel: u(new THREE.Vector2()) }),
      bloomUp: mat(BLOOM_UP_FRAG, { tLow: u(null), tHigh: u(null), uTexel: u(new THREE.Vector2()), uWeight: u(1) }),
      bloomScale: mat(BLOOM_SCALE_FRAG, { tSrc: u(null), uWeight: u(1) }),
      final: mat(FINAL_FRAG, {
        tColor: u(null), tBloom: u(null), uResolution: u(new THREE.Vector2()), uFrame: u(0), uExposure: u(1),
        uWhiteBalance: u(new THREE.Vector3(1, 1, 1)), uToneMap: u(0), uBloomStrength: u(0), uBlack: u(0), uWhite: u(1),
        uContrast: u(1), uPivot: u(0.5), uSaturation: u(1), uGamma: u(new THREE.Vector3(1, 1, 1)),
        uShadowTint: u(new THREE.Vector3()), uHighlightTint: u(new THREE.Vector3()), uVignette: u(0),
        uVignetteStart: u(0.3), uCA: u(0), uSoft: u(0), uGrain: u(0), uGrainCell: u(1), uGrainChroma: u(0), uDither: u(1),
      }),
    };
  }

  private resize(w: number, h: number) {
    if (w === this.w && h === this.h) return;
    this.dispose();
    this.w = w;
    this.h = h;
    const depth = new THREE.DepthTexture(w, h);
    depth.type = THREE.UnsignedIntType;
    depth.minFilter = THREE.NearestFilter;
    depth.magFilter = THREE.NearestFilter;
    this.sceneRT = hdr(w, h, { samples: this.look.msaaSamples, depthBuffer: true, depthTexture: depth });
    this.prepRT = hdr(w, h);
    this.dofRT = hdr(w, h);
    const hw = Math.ceil(w / 2);
    const hh = Math.ceil(h / 2);
    this.halfA = hdr(hw, hh);
    this.halfB = hdr(hw, hh);
    const tile = { type: THREE.HalfFloatType };
    this.tileA = hdr(Math.ceil(hw / 8), Math.ceil(hh / 8), tile);
    this.tileB = hdr(Math.ceil(hw / 8), Math.ceil(hh / 8), tile);
    // bloom chain: the smallest level is ~8 px high, so the widest halo is the
    // same fraction of the frame at every output resolution
    this.bloomDown = [];
    this.bloomUp = [];
    let bw = hw;
    let bh = hh;
    while (bh >= 8) {
      this.bloomDown.push(hdr(bw, bh));
      this.bloomUp.push(hdr(bw, bh));
      bw = Math.ceil(bw / 2);
      bh = Math.ceil(bh / 2);
    }
  }

  dispose() {
    const all = [this.sceneRT, this.prepRT, this.dofRT, this.halfA, this.halfB, this.tileA, this.tileB, ...this.bloomDown, ...this.bloomUp];
    for (const rt of all) {
      if (rt) {
        rt.depthTexture?.dispose();
        rt.dispose();
      }
    }
    this.w = 0;
    this.h = 0;
  }

  private pass(render: Render, material: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null, renderer: THREE.WebGLRenderer) {
    this.quad.material = material;
    renderer.setRenderTarget(target);
    render(this.quadScene, this.quadCam);
  }

  render(renderer: THREE.WebGLRenderer, render: Render, scene: THREE.Scene, camera: THREE.Camera) {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const w = Math.round(size.x);
    const h = Math.round(size.y);
    this.resize(w, h);
    const L = this.look;
    const m = this.m;
    const prevTarget = renderer.getRenderTarget();
    const prevAutoClear = renderer.autoClear;
    renderer.autoClear = true;

    // 1. scene -> HDR
    renderer.setRenderTarget(this.sceneRT);
    render(scene, camera);

    // 2. fog + CoC
    const cam = camera as THREE.PerspectiveCamera;
    let u = m.prep.uniforms;
    u.tColor.value = this.sceneRT.texture;
    u.tDepth.value = this.sceneRT.depthTexture;
    u.uProjInv.value.copy(cam.projectionMatrixInverse);
    u.uViewInv.value.copy(cam.matrixWorld);
    u.uCamPos.value.setFromMatrixPosition(cam.matrixWorld);
    u.uFogColor.value.fromArray(L.fog.color);
    u.uFogSunColor.value.fromArray(L.fog.sunColor);
    u.uFogSunDir.value.fromArray(L.fog.sunDir);
    u.uFogSunPower.value = L.fog.sunPower;
    u.uFogDensity.value = L.fog.density;
    u.uFogFalloff.value = L.fog.heightFalloff;
    u.uFogBase.value = L.fog.baseHeight;
    u.uFogMax.value = L.fog.maxOpacity;
    u.uFocus.value = L.dof.focus;
    u.uCocInf.value = L.dof.enabled ? L.dof.cocInfinity : 0;
    u.uMaxCoc.value = L.dof.maxCoc;
    u.uNearScale.value = L.dof.nearScale;
    u.uTilt.value.set(L.dof.enabled ? L.dof.tiltShift.amount : 0, L.dof.tiltShift.centre, L.dof.tiltShift.width);
    this.pass(render, m.prep, this.prepRT, renderer);

    // 3. depth of field
    let dofOut = this.prepRT;
    if (L.dof.enabled) {
      const hw = this.halfA.width;
      const hh = this.halfA.height;
      m.downCoc.uniforms.tPrep.value = this.prepRT.texture;
      m.downCoc.uniforms.uTexel.value.set(1 / w, 1 / h);
      this.pass(render, m.downCoc, this.halfA, renderer);
      m.nearTile.uniforms.tHalf.value = this.halfA.texture;
      m.nearTile.uniforms.uTexel.value.set(1 / hw, 1 / hh);
      this.pass(render, m.nearTile, this.tileA, renderer);
      m.nearDilate.uniforms.uTexel.value.set(1 / this.tileA.width, 1 / this.tileA.height);
      m.nearDilate.uniforms.tTile.value = this.tileA.texture;
      this.pass(render, m.nearDilate, this.tileB, renderer);
      m.nearDilate.uniforms.tTile.value = this.tileB.texture;
      this.pass(render, m.nearDilate, this.tileA, renderer);
      u = m.gather.uniforms;
      u.tHalf.value = this.halfA.texture;
      u.tNear.value = this.tileA.texture;
      u.uTexel.value.set(1 / hw, 1 / hh);
      u.uHeight.value = hh;
      this.pass(render, m.gather, this.halfB, renderer);
      u = m.fill.uniforms;
      u.tGather.value = this.halfB.texture;
      u.uTexel.value.set(1 / hw, 1 / hh);
      u.uHeight.value = hh;
      this.pass(render, m.fill, this.halfA, renderer);
      u = m.dofComp.uniforms;
      u.tPrep.value = this.prepRT.texture;
      u.tBlur.value = this.halfA.texture;
      u.uHeight.value = h;
      this.pass(render, m.dofComp, this.dofRT, renderer);
      dofOut = this.dofRT;
    }

    // 4. bloom
    const n = this.bloomDown.length;
    u = m.bloomPre.uniforms;
    u.tSrc.value = dofOut.texture;
    u.uTexel.value.set(1 / w, 1 / h);
    u.uThreshold.value = L.bloom.threshold / L.exposure;
    u.uKnee.value = L.bloom.knee / L.exposure;
    this.pass(render, m.bloomPre, this.bloomDown[0], renderer);
    for (let i = 1; i < n; i++) {
      m.bloomDown.uniforms.tSrc.value = this.bloomDown[i - 1].texture;
      m.bloomDown.uniforms.uTexel.value.set(1 / this.bloomDown[i - 1].width, 1 / this.bloomDown[i - 1].height);
      this.pass(render, m.bloomDown, this.bloomDown[i], renderer);
    }
    // level weights as a function of the level's size relative to the frame
    const weights: number[] = [];
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const rel = Math.pow(2, i + 1) / h; // texel size of level i, fraction of height
      const wgt = Math.pow(rel * 64, L.bloom.tilt * 1.2);
      weights.push(wgt);
      sum += wgt;
    }
    m.bloomScale.uniforms.tSrc.value = this.bloomDown[n - 1].texture;
    m.bloomScale.uniforms.uWeight.value = weights[n - 1] / sum;
    this.pass(render, m.bloomScale, this.bloomUp[n - 1], renderer);
    for (let i = n - 2; i >= 0; i--) {
      u = m.bloomUp.uniforms;
      u.tLow.value = this.bloomUp[i + 1].texture;
      u.tHigh.value = this.bloomDown[i].texture;
      u.uTexel.value.set(1 / this.bloomUp[i + 1].width, 1 / this.bloomUp[i + 1].height);
      u.uWeight.value = weights[i] / sum;
      this.pass(render, m.bloomUp, this.bloomUp[i], renderer);
    }

    // 5. final
    u = m.final.uniforms;
    u.tColor.value = dofOut.texture;
    u.tBloom.value = this.bloomUp[0].texture;
    u.uResolution.value.set(w, h);
    u.uFrame.value = this.frame;
    u.uExposure.value = L.exposure;
    u.uWhiteBalance.value.fromArray(L.whiteBalance);
    u.uToneMap.value = L.toneMap === "aces" ? 0 : 1;
    u.uBloomStrength.value = L.bloom.strength;
    u.uBlack.value = L.grade.blackLevel;
    u.uWhite.value = L.grade.whiteLevel;
    u.uContrast.value = L.grade.contrast;
    u.uPivot.value = L.grade.pivot;
    u.uSaturation.value = L.grade.saturation;
    u.uGamma.value.fromArray(L.grade.gamma);
    u.uShadowTint.value.fromArray(L.grade.shadowTint);
    u.uHighlightTint.value.fromArray(L.grade.highlightTint);
    u.uVignette.value = L.lens.vignette;
    u.uVignetteStart.value = L.lens.vignetteStart;
    u.uCA.value = L.lens.chromaticAberration;
    u.uSoft.value = L.lens.softness;
    u.uGrain.value = L.grain.amount;
    u.uGrainCell.value = Math.max(1, (L.grain.size * h) / 1080);
    u.uGrainChroma.value = L.grain.chroma;
    u.uDither.value = L.dither ? 1 : 0;
    this.pass(render, m.final, prevTarget, renderer);

    renderer.setRenderTarget(prevTarget);
    renderer.autoClear = prevAutoClear;
  }
}

export type Render = (scene: THREE.Object3D, camera: THREE.Camera) => void;
