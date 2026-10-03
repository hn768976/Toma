// GLSL for the Data Block City. All scene shaders write HDR colour to rgb and
// the view distance to alpha (used by the depth-of-field pass).
import { HASH_GLSL } from "../lib/glsl";

const FOG = /* glsl */ `
uniform vec3 uHaze;
uniform float uFogStart;
uniform float uFogDist;
float fogAmount(float d) {
  float x = max(d - uFogStart, 0.0) / uFogDist;
  return 1.0 - exp(-x * x * 0.9 - x * 0.35);
}
`;

const HASH21 = /* glsl */ `
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
`;

// ------------------------------------------------------------------ blocks
export const BLOCK_VERT = /* glsl */ `
in vec4 aBox;     // x0, z0, x1, z1 (tile-local)
in vec2 aHS;      // top height, shade
in vec2 aOrigin;  // tile copy offset (x, z)
out vec3 vWorld;
out vec3 vLocal;
out vec3 vNormal;
out float vShade;
out float vTop;
void main() {
  vec3 p = position + 0.5; // 0..1 box
  float y0 = -3.0;
  vec3 local = vec3(mix(aBox.x, aBox.z, p.x), mix(y0, aHS.x, p.y), mix(aBox.y, aBox.w, p.z));
  vec3 world = local + vec3(aOrigin.x, 0.0, aOrigin.y);
  vWorld = world;
  vLocal = local;
  vNormal = normal;
  vShade = aHS.y;
  vTop = aHS.x;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`;

export const BLOCK_FRAG = /* glsl */ `
precision highp float;
in vec3 vWorld;
in vec3 vLocal;
in vec3 vNormal;
in float vShade;
in float vTop;
out vec4 outColor;
uniform vec3 uBlock;
${FOG}
${HASH21}
void main() {
  float d = distance(vWorld, cameraPosition);
  vec3 base = uBlock * vShade;
  vec3 col;
  if (vNormal.y > 0.5) {
    // top: panels on the cell grid, long strips, dark seams
    vec2 lp = vLocal.xz;
    vec2 cell = floor(lp);
    vec2 f = fract(lp);
    float strip = floor(f.x * 3.0);
    float panel = 0.78 + 0.42 * hash21(cell + 0.37 * strip);
    vec2 e = min(f, 1.0 - f);
    float seamW = 0.035;
    vec2 aa = fwidth(lp) * 1.2;
    float seam = 1.0 - smoothstep(seamW, seamW + aa.x, e.x) * smoothstep(seamW, seamW + aa.y, e.y);
    float f3 = fract(f.x * 3.0);
    float e3 = min(f3, 1.0 - f3) / 3.0;
    float sub = 1.0 - smoothstep(0.012, 0.012 + aa.x, e3);
    col = base * panel * 1.35;
    col *= 1.0 - 0.7 * seam - 0.25 * sub;
    // a faint sheen towards the far city
    col += uBlock * 0.25 * smoothstep(8.0, 30.0, d);
  } else {
    // sides: darker, horizontal ribs, falling into shadow
    float rib = fract(vWorld.y * 6.0);
    float aa = fwidth(vWorld.y * 6.0) * 1.2;
    float ribs = 0.72 + 0.28 * smoothstep(0.45 - aa, 0.45 + aa, rib);
    float fall = smoothstep(vTop - 2.2, vTop, vWorld.y);
    col = base * 0.42 * ribs * (0.15 + 0.85 * fall);
    // a thin bright lip just under the top edge
    col += uBlock * 0.6 * smoothstep(vTop - 0.06, vTop - 0.005, vWorld.y);
  }
  col = mix(col, uHaze, fogAmount(d));
  outColor = vec4(col, d);
}
`;

// ------------------------------------------------------------------- tiles
export const TILE_VERT = /* glsl */ `
in vec4 aTile;    // x, z, y, size
in vec4 aLook;    // r, g, b (already * intensity), blink cycles
in float aPhase;  // blink phase
in vec2 aOrigin;
uniform float uPhase; // frame / loop, wrapped to [0, 1)
out vec2 vUv;
out vec3 vWorld;
out vec3 vColor;
const float TAU = 6.28318530718;
void main() {
  vec3 world = vec3(
    aTile.x + position.x * aTile.w + aOrigin.x,
    aTile.z + 0.012,
    aTile.y + position.y * aTile.w + aOrigin.y);
  vWorld = world;
  vUv = position.xy + 0.5;
  float blink = 1.0;
  if (aLook.w > 0.5) {
    float s = 0.5 + 0.5 * sin(TAU * fract(aLook.w * uPhase + aPhase));
    blink = 0.12 + 0.88 * s * s * s;
  }
  vColor = aLook.rgb * blink;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`;

export const TILE_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
in vec3 vWorld;
in vec3 vColor;
out vec4 outColor;
uniform vec3 uBlock;
${FOG}
void main() {
  float d = distance(vWorld, cameraPosition);
  vec2 q = abs(vUv - 0.5) * 2.0;
  float m = max(q.x, q.y);
  float aa = fwidth(m) * 1.5;
  float sq = 1.0 - smoothstep(0.86 - aa, 0.86 + aa, m);
  float core = 1.0 - smoothstep(0.0, 0.9, m);
  vec3 col = vColor * (0.55 * sq + 0.6 * core * sq);
  // tiles sit on dark block tops; outside the square, show nothing (discard
  // so the block underneath keeps its depth/colour)
  if (sq < 0.004) discard;
  // never darker than the block top it sits on (blinking tiles fade into
  // the panel instead of leaving a dark hole)
  vec3 under = uBlock * 1.2;
  col = mix(under, max(col, under), sq);
  float fog = fogAmount(d);
  col = mix(col, uHaze * sq, fog * 0.92);
  outColor = vec4(col, d);
}
`;

// ------------------------------------------------------------- light lines
// Camera-facing vertical quads. Width never drops below ~1.2 output px; the
// intensity is scaled down to keep the energy of thinner lines.
export const LINE_VERT = /* glsl */ `
in vec4 aLine;    // x, z, y(base), height
in vec4 aLook;    // r, g, b (* intensity), pulse cycles
in float aPhase;
in vec2 aOrigin;
uniform float uPhase;
uniform float uPxWorld; // world size of one output pixel at distance 1
out vec2 vUv;
out vec3 vColor;
out float vPulse;
out float vFog;
const float TAU = 6.28318530718;
${FOG}
void main() {
  vec3 base = vec3(aLine.x + aOrigin.x, aLine.z, aLine.y + aOrigin.y);
  vec3 toCam = cameraPosition - base;
  float d = length(toCam);
  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), toCam));
  float wWorld = 0.016;
  float wMin = uPxWorld * d * 1.4;
  float w = max(wWorld, wMin);
  vec3 world = base + right * position.x * w * 3.0 + vec3(0.0, (position.y + 0.5) * aLine.w, 0.0);
  vUv = vec2(position.x + 0.5, position.y + 0.5);
  float pulse = -10.0;
  if (aLook.w > 0.5) pulse = fract(aLook.w * uPhase + aPhase);
  vPulse = pulse;
  vColor = aLook.rgb * (wWorld / w);
  vFog = fogAmount(distance(world, cameraPosition));
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`;

export const LINE_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
in vec3 vColor;
in float vPulse;
in float vFog;
out vec4 outColor;
uniform vec3 uHaze;
void main() {
  float u = (vUv.x - 0.5) * 3.0; // quad is 3x the line width
  float across = exp(-u * u * 5.5);
  float v = vUv.y;
  float along = pow(1.0 - v, 0.8) * smoothstep(0.0, 0.03, v);
  // small bright dot at the top of each line
  along += exp(-pow((v - 0.985) / 0.012, 2.0)) * 2.2 * exp(-u * u * 1.0) / max(across, 1e-3) * across;
  float p = exp(-pow((v - vPulse) / 0.07, 2.0)) * 1.8 * (1.0 - v * 0.6);
  vec3 col = vColor * across * (along + p);
  col = mix(col, uHaze * across * (along + p) * 0.35, vFog);
  outColor = vec4(col, 0.0);
}
`;

// ----------------------------------------------------------------- sparks
export const SPARK_VERT = /* glsl */ `
in vec4 aSpark;   // x, z, y, size
in vec4 aLook;    // r, g, b, cycles
in float aPhase;
in vec2 aOrigin;
uniform float uPhase;
uniform float uPxWorld;
out vec2 vUv;
out vec3 vColor;
out float vFog;
const float TAU = 6.28318530718;
${FOG}
void main() {
  vec3 c = vec3(aSpark.x + aOrigin.x, aSpark.z, aSpark.y + aOrigin.y);
  vec3 toCam = cameraPosition - c;
  float d = length(toCam);
  vec3 fwd = normalize(toCam);
  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), fwd));
  vec3 up = cross(fwd, right);
  float s = max(aSpark.w, uPxWorld * d * 1.6);
  vec3 world = c + (right * position.x + up * position.y) * s * 3.0;
  vUv = position.xy;
  float tw = 0.5 + 0.5 * sin(TAU * fract(aLook.w * uPhase + aPhase));
  vColor = aLook.rgb * (0.25 + 0.75 * tw) * (aSpark.w / s) * (aSpark.w / s);
  vFog = fogAmount(d);
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`;

export const SPARK_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
in vec3 vColor;
in float vFog;
out vec4 outColor;
void main() {
  float r = length(vUv) * 3.0;
  float g = exp(-r * r * 2.2);
  outColor = vec4(vColor * g * (1.0 - vFog * 0.85), 0.0);
}
`;

// -------------------------------------------------------------------- sky
export const SKY_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform vec3 uSky;
uniform vec3 uHaze;
void main() {
  float t = smoothstep(0.0, 1.0, vUv.y);
  vec3 col = mix(uHaze, uSky, t);
  outColor = vec4(col, 1000.0);
}
`;

// -------------------------------------------------------- depth of field
// Scatter-as-gather disc blur driven by the circle of confusion of each tap.
export const DOF_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tScene;
uniform vec2 uRes;        // output size in px
uniform float uFocus;     // focus distance
uniform float uCocScale;  // px per unit |d - f| / d  (already resolution scaled)
uniform float uMaxCoc;    // px
const int N = 56;
float coc(float d) {
  return min(uCocScale * abs(d - uFocus) / max(d, 0.001), uMaxCoc);
}
void main() {
  vec4 c0 = texture(tScene, vUv);
  float coc0 = coc(c0.a);
  vec3 acc = c0.rgb;
  float wsum = 1.0;
  for (int i = 0; i < N; i++) {
    float fi = float(i) + 0.5;
    float r = sqrt(fi / float(N)) * uMaxCoc;
    float a = fi * 2.39996323;
    vec2 off = vec2(cos(a), sin(a)) * r / uRes;
    vec4 s = texture(tScene, vUv + off);
    float cs = coc(s.a);
    // a sharp background tap must not bleed over a blurred foreground
    // pixel's own disc more than that pixel's own CoC allows
    float c = s.a > c0.a ? min(cs, coc0) : cs;
    float w = smoothstep(r - 1.0, r + 0.5, c) / max(c * c, 1.0) * max(coc0 * coc0, 1.0);
    w = min(w, 4.0);
    acc += s.rgb * w;
    wsum += w;
  }
  outColor = vec4(acc / wsum, c0.a);
}
`;

// ---------------------------------------------------------------- final
export const FINAL_FRAG = /* glsl */ `
precision highp float;
precision highp int;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform float uBloom;
uniform float uExposure;
uniform float uFrame;
uniform float uGrain;
${HASH_GLSL}
void main() {
  vec3 c = texture(tScene, vUv).rgb + texture(tBloom, vUv).rgb * uBloom;
  c *= uExposure;
  // vignette-free, per-channel exponential shoulder
  vec3 m = 1.0 - exp(-c);
  uvec2 p = uvec2(gl_FragCoord.xy);
  uint f = uint(uFrame + 0.5);
  float l = dot(m, vec3(0.2126, 0.7152, 0.0722));
  m += grain(p, f, uGrain) * (0.4 + 0.6 * smoothstep(0.0, 0.2, l));
  m += ditherTPDF(p, f);
  outColor = vec4(clamp(m, 0.0, 1.0), 1.0);
}
`;
