/** GLSL for scene materials and post passes (three.js ShaderMaterial, GLSL ES 3.00). */

const lineAA = /* glsl */ `
float lineAlpha(float side, float halfW) {
  float fw = max(fwidth(side), 1e-6);
  float hw = max(halfW, 0.5 * fw);          // never thinner than ~1px …
  float a = clamp((hw - abs(side)) / fw + 0.5, 0.0, 1.0);
  return a * (halfW / hw);                  // … but keep the energy of thin lines
}`;

/** Lines on the HUD rings (word layer / far layer). */
export const ringVert = /* glsl */ `
attribute float aSide; attribute float aHalf; attribute float aI;
varying float vSide; varying float vHalf; varying float vI;
void main() {
  vSide = aSide; vHalf = aHalf; vI = aI;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
export const ringFrag = /* glsl */ `
uniform vec3 uColor; uniform float uGain;
varying float vSide; varying float vHalf; varying float vI;
${lineAA}
void main() {
  float a = lineAlpha(vSide, vHalf);
  gl_FragColor = vec4(uColor * vI * uGain * a, 0.0);
}`;

/** Board pieces write view distance into alpha (consumed by the depth-of-field pass). */
const boardCommon = /* glsl */ `
uniform float uCentreGain; uniform float uFalloff;
float centreBoost(vec2 p) {
  float r2 = dot(p * vec2(0.85, 1.0), p * vec2(0.85, 1.0));
  return 0.38 + uCentreGain * exp(-r2 / (2.0 * uFalloff * uFalloff));
}`;

export const boardBaseVert = /* glsl */ `
varying vec2 vLocal; varying float vDist;
void main() {
  vLocal = position.xy;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDist = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
export const boardBaseFrag = /* glsl */ `
uniform vec3 uBase; uniform vec3 uHaze;
varying vec2 vLocal; varying float vDist;
${boardCommon}
void main() {
  float b = centreBoost(vLocal);
  gl_FragColor = vec4(uBase + uHaze * b * b, vDist);
}`;

export const traceVert = /* glsl */ `
attribute float aSide; attribute float aHalf; attribute float aI; attribute float aAlong;
varying float vSide; varying float vHalf; varying float vI; varying float vAlong; varying vec2 vLocal;
void main() {
  vSide = aSide; vHalf = aHalf; vI = aI; vAlong = aAlong; vLocal = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
export const traceFrag = /* glsl */ `
uniform vec3 uColor; uniform float uGain;
varying float vSide; varying float vHalf; varying float vI; varying vec2 vLocal;
${boardCommon}
${lineAA}
void main() {
  float a = lineAlpha(vSide, vHalf);
  gl_FragColor = vec4(uColor * vI * uGain * centreBoost(vLocal) * a, 0.0);
}`;

/** Data pulse: bright head with a fading tail, positioned by arc length. */
export const pulseFrag = /* glsl */ `
uniform vec3 uColor; uniform float uGain; uniform float uHead; uniform float uTail;
varying float vSide; varying float vHalf; varying float vI; varying float vAlong; varying vec2 vLocal;
${boardCommon}
${lineAA}
void main() {
  float x = uHead - vAlong;                         // distance behind the head
  float tail = x >= 0.0 ? exp(-x / uTail) * step(x, uTail * 5.0) : 0.0;
  float head = exp(-x * x / (2.0 * 0.008 * 0.008));
  float a = lineAlpha(vSide, vHalf * 1.3);
  float k = 0.55 + 0.45 * centreBoost(vLocal);
  gl_FragColor = vec4(uColor * uGain * k * a * (tail + head), 0.0);
}`;

export const padVert = /* glsl */ `
attribute vec2 aLocal; attribute float aR; attribute float aRin; attribute float aI;
varying vec2 vOff; varying float vR; varying float vRin; varying float vI; varying vec2 vLocal;
void main() {
  vOff = aLocal; vR = aR; vRin = aRin; vI = aI; vLocal = position.xy - aLocal;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
export const padFrag = /* glsl */ `
uniform vec3 uColor; uniform float uGain;
varying vec2 vOff; varying float vR; varying float vRin; varying float vI; varying vec2 vLocal;
${boardCommon}
void main() {
  float d = length(vOff);
  float fw = max(fwidth(d), 1e-6);
  float a = clamp((vR - d) / fw + 0.5, 0.0, 1.0);
  if (vRin > 0.0) a *= clamp((d - vRin) / fw + 0.5, 0.0, 1.0);
  gl_FragColor = vec4(uColor * vI * uGain * centreBoost(vLocal) * a, 0.0);
}`;

/** Word: lit core, tight glow and wide halo, with brief flicker on parts of individual letters. */
export const wordVert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
export const wordFrag = /* glsl */ `
uniform sampler2D uTex; uniform vec3 uCore; uniform vec3 uGlow;
uniform float uCoreGain; uniform float uGlowGain; uniform float uHaloGain;
uniform vec4 uFlRect[3]; uniform float uFlAmt[3];
varying vec2 vUv;
void main() {
  vec4 t = texture(uTex, vUv);
  vec2 p = vec2(vUv.x, 1.0 - vUv.y);                // top-left origin, like the canvas
  float m = 1.0;
  for (int i = 0; i < 3; i++) {
    vec4 r = uFlRect[i];
    vec2 q = step(r.xy, p) * step(p, r.zw);
    m *= mix(1.0, uFlAmt[i], q.x * q.y);
  }
  float lit = t.r * m;
  vec3 c = uCore * lit * uCoreGain
         + uGlow * t.b * mix(1.0, m, 0.8) * uGlowGain
         + uGlow * t.g * mix(1.0, m, 0.5) * uHaloGain;
  gl_FragColor = vec4(c, 0.0);
}`;

// ---------------------------------------------------------------- post passes
export const fsVert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

/** Separable depth-of-field blur for the board; sigma from view distance in alpha. */
export const dofFrag = /* glsl */ `
uniform sampler2D uTex; uniform vec2 uDir; uniform float uFocus; uniform float uCocK; uniform float uCocBias;
uniform float uEdge; uniform float uAspect;
varying vec2 vUv;
void main() {
  vec4 c0 = texture(uTex, vUv);
  float dist = max(c0.a, 0.01);
  vec2 q = (vUv - 0.5) * vec2(uAspect, 1.0);
  float edge = dot(q, q) / (0.25 * uAspect * uAspect + 0.25);   // 0 centre .. 1 corners
  float sigma = max(uCocBias + uCocK * abs(1.0 / uFocus - 1.0 / dist) + uEdge * edge, 0.001); // px
  float step_ = sigma * 3.0 / 12.0;
  vec3 acc = vec3(0.0); float wsum = 0.0;
  for (int i = -12; i <= 12; i++) {
    float x = float(i) * step_;
    float w = exp(-0.5 * x * x / (sigma * sigma));
    acc += texture(uTex, vUv + uDir * x).rgb * w;
    wsum += w;
  }
  gl_FragColor = vec4(acc / wsum, dist);
}`;

/** Fixed Gaussian (sigma in px of the target). */
export const blurFrag = /* glsl */ `
uniform sampler2D uTex; uniform vec2 uDir; uniform float uSigma;
varying vec2 vUv;
void main() {
  float step_ = uSigma * 3.0 / 12.0;
  vec3 acc = vec3(0.0); float wsum = 0.0;
  for (int i = -12; i <= 12; i++) {
    float x = float(i) * step_;
    float w = exp(-0.5 * x * x / (uSigma * uSigma));
    acc += texture(uTex, vUv + uDir * x).rgb * w;
    wsum += w;
  }
  gl_FragColor = vec4(acc / wsum, 1.0);
}`;

export const addFrag = /* glsl */ `
uniform sampler2D uA; uniform sampler2D uB; uniform float uBGain;
varying vec2 vUv;
void main() { gl_FragColor = vec4(texture(uA, vUv).rgb + texture(uB, vUv).rgb * uBGain, 1.0); }`;

/** Bloom: soft-threshold prefilter + 13-tap downsample. */
export const bloomDownFrag = /* glsl */ `
uniform sampler2D uTex; uniform vec2 uTexel; uniform float uThreshold; uniform float uKnee; uniform bool uPrefilter;
varying vec2 vUv;
vec3 s(vec2 o) { return texture(uTex, vUv + o * uTexel).rgb; }
void main() {
  vec3 a = s(vec2(-2, 2)), b = s(vec2(0, 2)), c = s(vec2(2, 2));
  vec3 d = s(vec2(-2, 0)), e = s(vec2(0, 0)), f = s(vec2(2, 0));
  vec3 g = s(vec2(-2, -2)), h = s(vec2(0, -2)), i = s(vec2(2, -2));
  vec3 j = s(vec2(-1, 1)), k = s(vec2(1, 1)), l = s(vec2(-1, -1)), m = s(vec2(1, -1));
  vec3 col = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  if (uPrefilter) {
    float br = max(col.r, max(col.g, col.b));
    float soft = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
    soft = soft * soft / (4.0 * uKnee + 1e-5);
    col *= max(soft, br - uThreshold) / max(br, 1e-5);
  }
  gl_FragColor = vec4(col, 1.0);
}`;
/** Bloom: 9-tap tent upsample added onto the next-larger level. */
export const bloomUpFrag = /* glsl */ `
uniform sampler2D uTex; uniform sampler2D uBase; uniform vec2 uTexel; uniform float uRadius; uniform float uMix;
varying vec2 vUv;
void main() {
  vec2 t = uTexel * uRadius;
  vec3 c = texture(uTex, vUv).rgb * 4.0;
  c += (texture(uTex, vUv + vec2(-t.x, 0)).rgb + texture(uTex, vUv + vec2(t.x, 0)).rgb
      + texture(uTex, vUv + vec2(0, -t.y)).rgb + texture(uTex, vUv + vec2(0, t.y)).rgb) * 2.0;
  c += texture(uTex, vUv + vec2(-t.x, -t.y)).rgb + texture(uTex, vUv + vec2(t.x, -t.y)).rgb
     + texture(uTex, vUv + vec2(-t.x, t.y)).rgb + texture(uTex, vUv + vec2(t.x, t.y)).rgb;
  gl_FragColor = vec4(texture(uBase, vUv).rgb + c / 16.0 * uMix, 1.0);
}`;

/** Final: bloom add, ACES tonemap, sRGB encode, then dither ±1/255 and ~2% grain from (pixel, frame % 600). */
export const finalFrag = /* glsl */ `
uniform sampler2D uScene; uniform sampler2D uBloom; uniform float uBloomGain; uniform float uExposure;
uniform int uFrame; uniform float uGrain; uniform vec2 uRes; uniform float uVignette;
varying vec2 vUv;
uint pcg(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
float rnd(uvec3 p) { return float(pcg(p.x + pcg(p.y + pcg(p.z)))) * (1.0 / 4294967295.0); }
vec3 RRTAndODTFit(vec3 v) {
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
}
vec3 aces(vec3 color) {
  const mat3 ACESInputMat = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
  const mat3 ACESOutputMat = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
  color = ACESInputMat * (color / 0.6);
  color = RRTAndODTFit(color);
  return clamp(ACESOutputMat * color, 0.0, 1.0);
}
vec3 toSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
void main() {
  vec3 hdr = texture(uScene, vUv).rgb + texture(uBloom, vUv).rgb * uBloomGain;
  vec2 q = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  hdr *= 1.0 - uVignette * smoothstep(0.35, 1.25, length(q));
  vec3 c = toSRGB(aces(hdr * uExposure));
  uvec3 key = uvec3(uvec2(gl_FragCoord.xy), uint(uFrame));
  float g = (rnd(key) + rnd(key + uvec3(0u, 0u, 7919u)) - 1.0) * uGrain;      // triangular grain
  float d = (rnd(key + uvec3(0u, 0u, 104729u)) - 0.5) * (2.0 / 255.0);         // ±1/255 dither
  gl_FragColor = vec4(clamp(c + g + d, 0.0, 1.0), 1.0);
}`;
