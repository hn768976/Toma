/**
 * GLSL for the light-stream renderer (Three.js ShaderMaterial / WebGL 2).
 *
 * Lines are drawn as camera-facing ribbons expanded in screen space
 * ("mesh line" technique) so their width is resolution independent. Each
 * ribbon carries a Gaussian cross-section whose width grows with the
 * circle of confusion -> a cheap but convincing depth-of-field, with the
 * intensity scaled down so blurred lines keep the same total energy.
 * Everything is accumulated additively into a half-float target and then
 * tone-mapped, bloomed and graded in a final composite pass.
 */

export const LINE_VERTEX = /* glsl */ `
attribute vec3 prevPos;
attribute vec3 nextPos;
attribute float side;
attribute vec3 lineInfo;    // x: u along line (0..1), y: seed, z: gain
attribute vec3 lineColor;

uniform vec2 uRes;          // render target size in px
uniform float uPx;          // px scale (render height / 1080)
uniform float uCore;        // in-focus sigma, in 1080p px
uniform float uFocus;       // focus distance (view space)
uniform float uCoc;         // CoC strength, in 1080p px
uniform float uCocMax;      // CoC clamp, in 1080p px

varying float vSide;
varying float vHalfPx;
varying float vSigmaPx;
varying float vEnergy;
varying vec3 vInfo;
varying vec3 vColor;
varying float vFade;

void main() {
  mat4 mvp = projectionMatrix * modelViewMatrix;
  vec4 c = mvp * vec4(position, 1.0);
  vec4 p = mvp * vec4(prevPos, 1.0);
  vec4 n = mvp * vec4(nextPos, 1.0);

  float viewZ = -(modelViewMatrix * vec4(position, 1.0)).z;

  vec2 aspect = vec2(uRes.x / uRes.y, 1.0);
  vec2 sc = c.xy / max(c.w, 1e-3) * aspect;
  vec2 sp = p.xy / max(p.w, 1e-3) * aspect;
  vec2 sn = n.xy / max(n.w, 1e-3) * aspect;
  vec2 dir = sn - sp;
  dir = length(dir) < 1e-6 ? vec2(1.0, 0.0) : normalize(dir);
  vec2 nrm = vec2(-dir.y, dir.x);

  float coc = min(uCoc * abs(viewZ - uFocus) / max(viewZ, 0.1), uCocMax);
  float sigma = (uCore + coc) * uPx;
  // vertices behind / right in front of the lens collapse and fade out
  float nearFade = smoothstep(1.0, 2.5, viewZ);
  float halfPx = (sigma * 3.2 + uPx) * step(0.3, viewZ);

  vec2 off = nrm * side * halfPx / (uRes.y * 0.5);
  c.xy += vec2(off.x / aspect.x, off.y) * c.w;

  vSide = side;
  vHalfPx = halfPx;
  vSigmaPx = sigma;
  // energy conservation: a blurred line spreads the same light wider
  vEnergy = (uCore * uPx) / sigma;
  vInfo = lineInfo;
  vColor = lineColor;
  // fade the ends of each line and anything very close to the lens
  float u = lineInfo.x;
  vFade = smoothstep(0.0, 0.06, u) * (1.0 - smoothstep(0.94, 1.0, u))
        * nearFade;
  gl_Position = c;
}
`;

export const LINE_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uFlow;        // streak travel speed (u per second)
uniform vec3 uHot;          // colour streak heads blend towards

varying float vSide;
varying float vHalfPx;
varying float vSigmaPx;
varying float vEnergy;
varying vec3 vInfo;
varying vec3 vColor;
varying float vFade;

void main() {
  float d = abs(vSide) * vHalfPx;
  float g = exp(-0.5 * d * d / (vSigmaPx * vSigmaPx));
  float halo = exp(-d / (vSigmaPx * 1.6)) * 0.18;

  float u = vInfo.x;
  float seed = vInfo.y;
  float gain = vInfo.z;

  // travelling light streaks along the line
  float x = u * (1.2 + 2.2 * fract(seed * 7.13)) - uTime * uFlow * (0.6 + 0.8 * fract(seed * 3.7)) + seed * 17.0;
  float s1 = 0.5 + 0.5 * sin(6.2831853 * x);
  float s2 = 0.5 + 0.5 * sin(6.2831853 * (x * 0.37 + seed * 3.1));
  float streak = 0.55 + 1.1 * pow(s1, 3.0) * (0.4 + 0.6 * s2) + 0.3 * s2;
  float hot = pow(s1, 14.0) * step(0.55, fract(seed * 11.7));

  vec3 col = mix(vColor, uHot, hot * 0.6) * (streak + hot * 0.8);
  float a = (g + halo) * vEnergy * gain * vFade;
  gl_FragColor = vec4(col * a, 1.0);
}
`;

export const POINT_VERTEX = /* glsl */ `
attribute float seed;
uniform float uPx;
uniform float uFocus;
uniform float uCoc;
uniform float uCocMax;
uniform float uTime;
varying float vEnergy;
varying float vTwinkle;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float viewZ = -mv.z;
  float coc = min(uCoc * abs(viewZ - uFocus) / max(viewZ, 0.1), uCocMax);
  float size = (1.6 + coc * 2.2) * uPx;
  gl_PointSize = size * 2.5;
  vEnergy = (1.6 * uPx) * (1.6 * uPx) / (size * size);
  vTwinkle = 0.55 + 0.45 * sin(uTime * (2.0 + 3.0 * seed) + seed * 40.0);
  vTwinkle *= smoothstep(0.6, 1.6, viewZ);
  gl_Position = projectionMatrix * mv;
}
`;

export const POINT_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
varying float vEnergy;
varying float vTwinkle;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(q, q) * 6.25;   // gl_PointSize = 2.5 * size
  float g = exp(-1.5 * r2);
  gl_FragColor = vec4(uColor * g * vEnergy * vTwinkle * 1.6, 1.0);
}
`;

/** Full-screen pass helpers. */
export const FS_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const BLUR_FRAGMENT = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uDir;          // texel step * direction
varying vec2 vUv;
void main() {
  // 9-tap Gaussian using linear filtering (~17 texel kernel)
  vec3 c = texture2D(tSrc, vUv).rgb * 0.2270270270;
  vec2 o1 = uDir * 1.3846153846;
  vec2 o2 = uDir * 3.2307692308;
  c += texture2D(tSrc, vUv + o1).rgb * 0.3162162162;
  c += texture2D(tSrc, vUv - o1).rgb * 0.3162162162;
  c += texture2D(tSrc, vUv + o2).rgb * 0.0702702703;
  c += texture2D(tSrc, vUv - o2).rgb * 0.0702702703;
  gl_FragColor = vec4(c, 1.0);
}
`;

export const COMPOSITE_FRAGMENT = /* glsl */ `
uniform sampler2D tScene;
uniform sampler2D tBloomA;
uniform sampler2D tBloomB;
uniform vec2 uRes;
uniform float uFrame;
uniform vec3 uBgTop;
uniform vec3 uBgHorizon;
uniform vec3 uBgBottom;
uniform vec2 uGlowPos;      // horizon glow centre (uv)
uniform vec3 uGlowColor;
uniform float uExposure;
uniform float uBloom;
uniform float uFadeIn;      // 0..1 multiplier (for the opening/closing frames)
varying vec2 vUv;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec3 tonemap(vec3 x) {
  // filmic shoulder that keeps the saturated blues and lets dense
  // regions burn towards white
  vec3 y = 1.0 - exp(-x * uExposure);
  float l = max(max(x.r, x.g), x.b) * uExposure;
  return mix(y, vec3(1.0), clamp((l - 2.2) * 0.15, 0.0, 0.4));
}

void main() {
  vec2 uv = vUv;
  vec3 bg = mix(uBgBottom, uBgHorizon, smoothstep(0.0, 0.62, uv.y));
  bg = mix(bg, uBgTop, smoothstep(0.62, 1.0, uv.y));
  vec2 g = (uv - uGlowPos) * vec2(uRes.x / uRes.y, 1.0);
  bg += uGlowColor * exp(-dot(g, g) * 3.0);

  vec3 scene = texture2D(tScene, uv).rgb;
  vec3 bloom = texture2D(tBloomA, uv).rgb * 0.6 + texture2D(tBloomB, uv).rgb * 0.4;
  vec3 col = bg + tonemap(scene + bloom * uBloom);

  vec2 q = uv - 0.5;
  col *= 1.0 - 0.55 * dot(q, q);
  col *= uFadeIn;

  float n = hash12(gl_FragCoord.xy + fract(uFrame * 0.618) * 97.0) - 0.5;
  col += n * (1.6 / 255.0);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
