/* GLSL shaders for the stage-light scene (WebGL 2 / GLSL ES 3.0 via three.js). */

const NOISE = /* glsl */ `
float hash31(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
float vnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  float n000 = hash31(i);
  float n100 = hash31(i + vec3(1, 0, 0));
  float n010 = hash31(i + vec3(0, 1, 0));
  float n110 = hash31(i + vec3(1, 1, 0));
  float n001 = hash31(i + vec3(0, 0, 1));
  float n101 = hash31(i + vec3(1, 0, 1));
  float n011 = hash31(i + vec3(0, 1, 1));
  float n111 = hash31(i + vec3(1, 1, 1));
  return mix(
    mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
    mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y),
    u.z);
}
float fbm(vec3 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * vnoise(p);
    p = p * 2.03 + vec3(1.7, 9.2, 3.1);
    a *= 0.5;
  }
  return s;
}
// Drifting stage haze density, shared by every shader so beams and background agree.
float haze(vec3 p, float t) {
  vec3 q = p * 0.42 + vec3(t * 0.045, t * 0.03, -t * 0.02);
  // single cheap warp octave keeps the swirl without two extra fbm evaluations
  vec3 w = vec3(vnoise(q * 0.7 + 4.0), vnoise(q * 0.7 + 8.0), 0.0);
  float n = fbm(q + 0.6 * w);
  return n;
}
`;

export const WORLD_VERTEX = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

/**
 * Volumetric spotlight cone.
 * The view ray is intersected analytically with the (capped) cone volume and
 * the in-scattered light is integrated numerically along the inside segment:
 * soft gaussian profile across the cone, inverse-distance falloff along it,
 * modulated by 3D haze noise. Works from any camera position, including
 * looking straight down the beam or standing inside it.
 */
export const BEAM_FRAGMENT = /* glsl */ `
uniform vec3 uApex;
uniform vec3 uDir;
uniform vec3 uColor;
uniform vec3 uColorB;
uniform vec3 uSide;
uniform float uSplit;
uniform float uTanA;
uniform float uLen;
uniform float uIntensity;
uniform float uTime;
varying vec3 vWorld;
${NOISE}
const int STEPS = 22;
const float INT_TAN_FACTOR = 1.75; // integration cone: where the gaussian profile is non-negligible

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float density(vec3 p, out float sideCoord) {
  vec3 v = p - uApex;
  float s = dot(v, uDir);
  vec3 radial = v - s * uDir;
  float R = max(s, 0.0) * uTanA + 0.02;
  float q = length(radial) / R;
  sideCoord = dot(radial, uSide) / R;
  float across = exp(-q * q * q * 1.7) + 0.5 * exp(-q * q * 14.0);
  // empirical falloff along the beam, tuned against the reference footage
  float along = 1.0 / (0.2 + s * 0.85);
  float fade = smoothstep(uLen, uLen * 0.35, s) * smoothstep(0.0, 0.25, s);
  return across * along * fade * 0.86;
}

void main() {
  vec3 ro = cameraPosition;
  vec3 rd = normalize(vWorld - ro);
  vec3 co = ro - uApex;
  float kTan = uTanA * INT_TAN_FACTOR + 0.02 / uLen;
  float kLen = uLen;
  float cos2 = 1.0 / (1.0 + kTan * kTan);
  float dv = dot(rd, uDir);
  float cv = dot(co, uDir);
  float a = dv * dv - cos2;
  float b = 2.0 * (dv * cv - dot(rd, co) * cos2);
  float c = cv * cv - dot(co, co) * cos2;

  float tIn = 1e9;
  float tOut = -1e9;
  float disc = b * b - 4.0 * a * c;
  if (disc >= 0.0 && abs(a) > 1e-6) {
    float sq = sqrt(disc);
    float r1 = (-b - sq) / (2.0 * a);
    float r2 = (-b + sq) / (2.0 * a);
    float s1 = cv + r1 * dv;
    float s2 = cv + r2 * dv;
    if (s1 > 0.0 && s1 < kLen) { tIn = min(tIn, r1); tOut = max(tOut, r1); }
    if (s2 > 0.0 && s2 < kLen) { tIn = min(tIn, r2); tOut = max(tOut, r2); }
  }
  if (abs(dv) > 1e-6) {
    float tc = (kLen - cv) / dv;
    vec3 pcap = co + tc * rd;
    float rc = length(pcap - kLen * uDir);
    if (rc <= kTan * kLen) { tIn = min(tIn, tc); tOut = max(tOut, tc); }
  }
  bool camInside = cv > 0.0 && cv < kLen && (dot(co, co) - cv * cv) < (kTan * cv) * (kTan * cv);
  if (camInside) tIn = 0.0;
  tIn = max(tIn, 0.0);
  if (tOut <= tIn) discard;

  float dt = (tOut - tIn) / float(STEPS);
  // per-pixel jitter turns residual step banding into fine grain (averaged out by the 4K->1080p downscale)
  float jitter = hash12(gl_FragCoord.xy + fract(uTime * 7.31) * 517.0);
  float sum = 0.0;
  float splitSum = 0.0;
  float peak = 0.0;
  float tPeak = tIn;
  for (int i = 0; i < STEPS; i++) {
    float t = tIn + (float(i) + jitter) * dt;
    float sc;
    float d = density(ro + rd * t, sc);
    sum += d;
    splitSum += d * smoothstep(uSplit - 0.12, uSplit + 0.12, sc);
    if (d > peak) { peak = d; tPeak = t; }
  }
  float I = sum * dt;
  if (I < 1e-5) discard;
  float mixB = splitSum / max(sum, 1e-6);
  float hz = haze((ro + rd * tPeak) * 2.6, uTime);
  float smoke = mix(0.78, 1.14, smoothstep(0.25, 0.7, hz));
  vec3 col = mix(uColor, uColorB, mixB);
  gl_FragColor = vec4(col * (uIntensity * I * smoke), 1.0);
}
`;

/** Back wall / deep haze: diffuse coloured fog lit by every fixture. */
export const WALL_FRAGMENT = /* glsl */ `
#define N_LIGHTS 8
uniform vec3 uPos[N_LIGHTS];
uniform vec3 uDirs[N_LIGHTS];
uniform vec3 uCols[N_LIGHTS];
uniform float uTans[N_LIGHTS];
uniform float uTime;
uniform float uAmbient;
varying vec3 vWorld;
${NOISE}
void main() {
  vec3 p = vWorld;
  vec3 acc = vec3(0.0);
  for (int i = 0; i < N_LIGHTS; i++) {
    vec3 v = p - uPos[i];
    // broad scatter around each fixture
    vec2 dxy = v.xy;
    float near = exp(-dot(dxy, dxy) / 38.0);
    // light spilling along the projected beam direction
    vec2 dir2 = normalize(uDirs[i].xy + vec2(0.0, -0.0001));
    float along = dot(dxy, dir2);
    float across = length(dxy - along * dir2);
    float wid = max(along, 0.0) * uTans[i] * 2.4 + 1.2;
    float spill = exp(-(across * across) / (wid * wid)) * smoothstep(-1.0, 2.0, along) * exp(-max(along, 0.0) / 9.0);
    acc += uCols[i] * (near * 0.9 + spill * 0.35 + 0.05);
  }
  float hz = haze(p * vec3(3.2, 2.2, 3.2), uTime);
  float smoke = mix(0.75, 1.15, smoothstep(0.2, 0.75, hz));
  // haze is lit most densely up in the rig, thinning towards the floor
  float vert = mix(0.5, 1.45, smoothstep(-6.0, 5.0, p.y));
  vec3 col = acc * uAmbient * smoke * vert;
  gl_FragColor = vec4(col, 1.0);
}
`;

/** Billboard glow for the light-source lens. */
export const GLOW_VERTEX = /* glsl */ `
uniform float uSize;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  mv.xy += position.xy * uSize;
  gl_Position = projectionMatrix * mv;
}
`;

export const GLOW_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uIntensity;
uniform float uFacing;
varying vec2 vUv;
void main() {
  vec2 c = vUv * 2.0 - 1.0;
  float d = length(c);
  float core = exp(-d * d * 260.0) * 6.0;
  float inner = exp(-d * d * 40.0) * 1.2;
  float halo = exp(-d * 5.5) * 0.55;
  // faint four-point lens star
  float star = (exp(-abs(c.y) * 90.0) + exp(-abs(c.x) * 90.0)) * exp(-d * 4.0) * 0.5;
  vec3 col = vec3(1.0) * core + mix(vec3(1.0), uColor, 0.45) * inner + uColor * (halo + star);
  col *= uIntensity * mix(0.6, 1.0, uFacing) * smoothstep(1.0, 0.7, d);
  gl_FragColor = vec4(col, 1.0);
}
`;

/** Final pass: exposure tone map from the HDR buffer, gentle vignette, dither. */
export const POST_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const POST_FRAGMENT = /* glsl */ `
uniform sampler2D uHdr;
uniform float uExposure;
uniform float uTime;
uniform vec2 uResolution;
varying vec2 vUv;
float h12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
void main() {
  vec3 hdr = texture2D(uHdr, vUv).rgb;
  vec3 col = 1.0 - exp(-hdr * uExposure);
  // soft highlight desaturation like film / camera sensor
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, vec3(lum), smoothstep(0.75, 1.0, lum) * 0.5);
  vec2 v = vUv - 0.5;
  col *= 1.0 - dot(v, v) * 0.35;
  col += (h12(vUv * uResolution + fract(uTime) * 113.0) - 0.5) / 255.0;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
