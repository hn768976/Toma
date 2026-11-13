import { SIMPLEX_4D } from "./noise.glsl";

/**
 * Shared deformation field. Every dot and the dark "skin" underneath them use
 * exactly the same function so they always stay glued together.
 *
 * shape() returns (position, foldHeight). Two copies of the field – one at t and
 * one at t - loopLength – are cross-faded so the motion loops seamlessly.
 */
const DEFORM = /* glsl */ `
uniform float uTime;
uniform float uLoop;
uniform float uFold;
uniform mat3 uRot;

${SIMPLEX_4D}

vec4 shape(vec3 p, float tau) {
  float w = tau * 0.16;
  // Large, slow organic lumps: always present, give the "pebble" silhouette.
  float lump = snoise(vec4(p * 0.95, w * 0.9)) * 0.17
             + snoise(vec4(p * 1.9 + 7.3, w * 1.2)) * 0.06;
  // Domain warp so the folds meander instead of being straight stripes.
  vec3 q = p + 0.2 * vec3(
    snoise(vec4(p * 1.25 + 3.1, w)),
    snoise(vec4(p * 1.25 + 11.7, w)),
    snoise(vec4(p * 1.25 + 23.9, w)));
  // Two families of diagonal ridges that sweep around the body (the folded,
  // layered look of the reference). Crests are sharpened, troughs flattened.
  vec3 ax1 = normalize(vec3(0.9, 1.0, 0.35));
  vec3 ax2 = normalize(vec3(-0.7, 0.45, 0.55));
  float s1 = sin(dot(q, ax1) * 8.4 + 1.6 * snoise(vec4(q * 1.2, w * 1.4)) + tau * 1.1);
  float s2 = sin(dot(q, ax2) * 6.3 + 1.4 * snoise(vec4(q * 1.1 + 9.0, w * 1.2)) - tau * 0.8);
  float band = sign(s1) * pow(abs(s1), 0.6);
  float band2 = sign(s2) * pow(abs(s2), 0.7);
  float detail = snoise(vec4(q * 3.1 + 5.0, w * 1.6));
  float fold = band * 0.085 + band2 * 0.04 + detail * 0.018;
  float r = 1.0 + lump + uFold * fold;
  // gentle shear along the ridges for overhangs (kept small: larger values
  // pull bead rows apart and open visible tears)
  vec3 tang = cross(p, ax1);
  vec3 pos = p * r + uFold * 0.055 * band * tang;
  return vec4(pos, uFold * fold);
}

vec4 deform(vec3 p) {
  float k = smoothstep(0.0, 1.0, uTime / uLoop);
  return mix(shape(p, uTime), shape(p, uTime - uLoop), k);
}

// Deformed position (object space, rotated) + normal + fold height.
void evalSurface(vec3 p, out vec3 P, out vec3 N, out float fold) {
  vec3 up = abs(p.y) < 0.98 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 t1 = normalize(cross(p, up));
  vec3 t2 = cross(p, t1);
  const float e = 0.012;
  vec4 c = deform(p);
  vec3 a = deform(normalize(p + e * t1)).xyz;
  vec3 b = deform(normalize(p + e * t2)).xyz;
  vec3 n = normalize(cross(a - c.xyz, b - c.xyz));
  if (dot(n, p) < 0.0) n = -n;
  P = uRot * c.xyz;
  N = uRot * n;
  fold = c.w;
}
`;

export const DOT_VERT = /* glsl */ `
${DEFORM}
uniform float uDotSize;     // world-space diameter of a dot
uniform float uPixelScale;  // viewportHeight / (2 * tan(fov / 2))
out vec3 vN;
out float vFold;
out float vDepth;
void main() {
  vec3 P; vec3 N; float fold;
  evalSurface(position, P, N, fold);
  vec4 mv = modelViewMatrix * vec4(P, 1.0);
  vN = normalize(normalMatrix * N);
  vFold = fold;
  vDepth = -mv.z;
  gl_PointSize = uDotSize * uPixelScale / -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const LIGHTING = /* glsl */ `
uniform vec3 uDot;
uniform vec3 uHi;
uniform vec3 uRim;
uniform vec3 uAmb;
uniform vec3 uSkin;
const vec3 L = normalize(vec3(-0.55, 0.62, 0.58));   // key light, view space
const vec3 F = normalize(vec3(0.7, -0.35, 0.6));     // soft fill
`;

export const DOT_FRAG = /* glsl */ `
precision highp float;
${LIGHTING}
in vec3 vN;
in float vFold;
in float vDepth;
out vec4 fragColor;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  c.y = -c.y;
  float r2 = dot(c, c);
  if (r2 > 1.0) discard;
  vec3 sn = vec3(c, sqrt(1.0 - r2));                 // normal of the little sphere
  float self = smoothstep(-0.35, 0.65, dot(vN, L));   // blob shadows itself
  float cavity = 0.5 + 0.5 * smoothstep(-0.11, 0.07, vFold);
  float diff = max(dot(sn, L), 0.0) * self;
  float fill = max(dot(sn, F), 0.0) * 0.22;
  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
  float spec = pow(max(dot(sn, H), 0.0), 38.0) * self;
  float rim = pow(1.0 - clamp(vN.z, 0.0, 1.0), 2.2);
  vec3 col = uAmb * 0.45
           + uDot * (diff * 2.1 + fill * 0.75 + 0.24)
           + uHi * spec * 1.25
           + uRim * rim * 0.85 * (0.4 + 0.6 * sn.z);
  col *= cavity * mix(0.62, 1.0, sn.z);
  fragColor = vec4(col, 1.0);
}
`;

export const SKIN_VERT = /* glsl */ `
${DEFORM}
uniform float uInset;
out vec3 vN;
out float vFold;
void main() {
  vec3 P; vec3 N; float fold;
  evalSurface(normalize(position), P, N, fold);
  P -= N * uInset;
  vN = normalize(normalMatrix * N);
  vFold = fold;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(P, 1.0);
}
`;

export const SKIN_FRAG = /* glsl */ `
precision highp float;
${LIGHTING}
in vec3 vN;
in float vFold;
out vec4 fragColor;
void main() {
  vec3 n = normalize(vN);
  float diff = max(dot(n, L), 0.0);
  float cavity = 0.45 + 0.55 * smoothstep(-0.11, 0.07, vFold);
  float rim = pow(1.0 - clamp(n.z, 0.0, 1.0), 2.5);
  vec3 col = uSkin * (0.35 + 0.75 * diff) * cavity + uRim * rim * 0.12;
  fragColor = vec4(col, 1.0);
}
`;

export const BG_VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const BG_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform float uAspect;
uniform vec2 uCenter;
uniform float uStopPos[6];
uniform vec3 uStopCol[6];
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec2 d = (vUv - 0.5) * 2.0 - uCenter;
  d.x *= uAspect;
  float r = length(d * vec2(0.97, 1.03));
  vec3 col = uStopCol[0];
  for (int i = 1; i < 6; i++) {
    float t = clamp((r - uStopPos[i - 1]) / (uStopPos[i] - uStopPos[i - 1]), 0.0, 1.0);
    t = t * t * (3.0 - 2.0 * t);
    col = mix(col, uStopCol[i], r > uStopPos[i - 1] ? t : 0.0);
  }
  // lopsided studio light: the top-left corner falls off less
  vec2 uv = vUv;
  col += vec3(0.05, 0.045, 0.035) * smoothstep(0.55, 0.0, length((uv - vec2(0.0, 1.0)) * vec2(1.1, 1.6)));
  // fine grain + dither so the gradient survives 8-bit / H.264 without banding
  float n = hash(gl_FragCoord.xy) + hash(gl_FragCoord.yx + 17.0) - 1.0;
  col += n * (6.0 / 255.0);
  fragColor = vec4(col, 1.0);
}
`;
