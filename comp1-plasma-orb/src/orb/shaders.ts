/**
 * GLSL sources for the plasma orb.
 *
 * The scene is rendered as *intensity* (not colour) into float render
 * targets; a final pass maps intensity through a colour ramp sampled from the
 * reference footage. This keeps the palette exact and makes palette variants
 * a one-line change.
 */

// 3D simplex noise — Ashima Arts / Stefan Gustavson (MIT licence).
export const NOISE_GLSL = /* glsl */ `
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

vec3 rotateAxis(vec3 p, vec3 axis, float angle) {
  float s = sin(angle);
  float c = cos(angle);
  return p * c + cross(axis, p) * s + axis * dot(axis, p) * (1.0 - c);
}

// Large-scale "where is the plasma bright right now" field, shared by the
// volume and the particles so both agree on the clumps / dark voids.
float clumpField(vec3 p, float t) {
  vec3 q = rotateAxis(p, normalize(vec3(0.35, 1.0, 0.2)), t * 0.55);
  float c = snoise(q * 0.95 + vec3(0.0, t * 0.16, t * 0.07)) * 0.65
          + snoise(q * 1.9 - vec3(t * 0.21, 0.0, 0.0)) * 0.35;
  return smoothstep(-0.2, 0.6, c);
}
`;

export const FULLSCREEN_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/** Ray-marched emissive gas inside a sphere + analytic halo. */
export const VOLUME_FRAG = /* glsl */ `
precision highp float;
uniform float uTime;
uniform vec3 uCamPos;
uniform mat4 uInvViewProj;
uniform vec2 uResolution;
varying vec2 vUv;
${NOISE_GLSL}

const int STEPS = 60;
const float RB = 1.12;

void main() {
  vec2 ndc = vUv * 2.0 - 1.0;
  vec4 far = uInvViewProj * vec4(ndc, 1.0, 1.0);
  vec3 ro = uCamPos;
  vec3 rd = normalize(far.xyz / far.w - ro);

  float b = dot(ro, rd);
  float c = dot(ro, ro) - RB * RB;
  float h = b * b - c;

  // Closest approach of the ray to the orb centre -> soft halo.
  float tc = max(-b, 0.0);
  float dc = length(ro + rd * tc);
  float halo = 0.22 * exp(-pow(max(dc - 0.4, 0.0) * 2.6, 2.0))
             + 0.035 * exp(-max(dc - 0.9, 0.0) * 2.2) * smoothstep(3.2, 1.2, dc);

  float emit = 0.0;
  float hot = 0.0;
  if (h > 0.0) {
    h = sqrt(h);
    float t0 = max(-b - h, 0.0);
    float t1 = -b + h;
    float dt = (t1 - t0) / float(STEPS);
    // Static per-pixel jitter hides step banding without temporal noise.
    float jitter = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    float t = t0 + dt * jitter;
    vec3 spinAxis = normalize(vec3(0.2, 1.0, -0.25));
    for (int i = 0; i < STEPS; i++) {
      vec3 p = ro + rd * t;
      float r = length(p);
      vec3 pd = p / max(r, 1e-4);
      float lump = snoise(rotateAxis(pd, vec3(0.0, 1.0, 0.0), uTime * 0.3) * 1.3 + vec3(0.0, uTime * 0.2, 0.0));
      float shape = smoothstep(0.95 + 0.12 * lump, 0.1, r);
      if (shape > 0.0) {
        float clump = clumpField(p, uTime);
        float clump2 = clump * clump;
        vec3 q = rotateAxis(p, spinAxis, uTime * 0.42);
        vec3 w = q + 0.5 * vec3(
          snoise(q * 1.35 + vec3(0.0, 0.0, uTime * 0.33)),
          snoise(q * 1.35 + vec3(13.1, uTime * 0.29, 0.0)),
          snoise(q * 1.35 + vec3(uTime * 0.27, 7.7, 3.3)));
        float n = snoise(w * 1.7) * 0.65 + snoise(w * 3.9) * 0.35;
        float dens = smoothstep(-0.05, 0.8, n);
        float ridge = 1.0 - abs(snoise(w * 2.2 + vec3(2.0, -1.0, 0.5)));
        float ridge2 = 1.0 - abs(snoise(w * 4.7 - vec3(1.0, 3.0, 0.5)));
        float fil = pow(ridge, 7.0) * (0.55 + 0.45 * pow(ridge2, 3.0));
        float core = exp(-r * r * 7.0);
        float body = dens * (0.02 + clump2 * clump * 3.0) * shape;
        emit += (body + fil * shape * (0.06 + clump2 * 1.4) * 2.2 + core * 0.9 * (0.25 + clump2)) * dt;
        hot += (fil * clump2 * clump * shape * 1.6 + core * clump2 * 2.0 + pow(dens * clump, 3.0) * shape * 0.6) * dt;
      }
      t += dt;
    }
  }
  gl_FragColor = vec4(emit * 2.1 + halo, hot, 0.0, 1.0);
}
`;

/** Shared vertex shader for every particle layer (motes, strands, sparks, dust). */
export const POINTS_VERT = /* glsl */ `
precision highp float;
attribute vec4 aSeed;   // per-particle random numbers
attribute vec4 aParam;  // layer-specific parameters
uniform float uTime;
uniform float uLayer;   // 0 motes, 1 strands, 2 sparks, 3 dust
uniform float uFocalPx; // projection[1][1] * height / 2
uniform float uMaxSize;
varying float vIntensity;
varying float vHot;
varying float vSoft;
${NOISE_GLSL}

float hash11(float n) { return fract(sin(n * 127.1) * 43758.5453123); }
vec3 hashDir(float n) {
  float z = hash11(n) * 2.0 - 1.0;
  float a = hash11(n + 17.13) * 6.2831853;
  float r = sqrt(1.0 - z * z);
  return vec3(r * cos(a), r * sin(a), z);
}

void main() {
  vec3 pos;
  float size;      // world-space diameter
  float intensity;
  float hot = 0.0;
  float soft = 1.0;
  float t = uTime;

  if (uLayer < 0.5) {
    // --- Motes: tiny luminous specks swirling inside the orb.
    vec3 dir = normalize(aSeed.xyz * 2.0 - 1.0 + 1e-4);
    float r = aParam.x;
    vec3 axis = normalize(vec3(0.2, 1.0, -0.25) + (aSeed.wxy - 0.5) * 0.9);
    float w = 0.35 + aParam.y * 0.6;
    pos = rotateAxis(dir * r, axis, t * w + aSeed.w * 6.28);
    pos += 0.16 * vec3(snoise(pos * 1.6 + vec3(0.0, 0.0, t * 0.4)),
                       snoise(pos * 1.6 + vec3(5.2, t * 0.37, 0.0)),
                       snoise(pos * 1.6 + vec3(t * 0.31, 9.1, 0.0)));
    float clump = clumpField(pos, t);
    float twinkle = 0.65 + 0.35 * sin(t * (2.0 + aParam.z * 5.0) + aSeed.x * 40.0);
    intensity = (0.01 + clump * clump * 0.9) * twinkle * aParam.w * smoothstep(1.05, 0.55, length(pos));
    size = 0.04 + aParam.z * 0.11;
    soft = 1.8;
    hot = clump * clump * (aParam.w > 0.93 ? 2.5 : 0.3);
  } else if (uLayer < 1.5) {
    // --- Strands: dense chains of particles forming bright plasma filaments.
    float strand = aParam.x;
    float u = aParam.y;
    float period = 1.6 + hash11(strand * 3.1) * 1.8;
    float phase = hash11(strand * 7.7) * period;
    float cycleF = (t + phase) / period;
    float cyc = floor(cycleF);
    float life = fract(cycleF);
    float id = strand * 31.0 + cyc * 7.13;
    vec3 n = hashDir(id);
    vec3 tA = normalize(cross(n, abs(n.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
    vec3 tB = cross(n, tA);
    float rad = 0.28 + hash11(id + 2.0) * 0.62;
    float span = 0.9 + hash11(id + 3.0) * 2.0;
    float a0 = hash11(id + 4.0) * 6.2831853 + life * (0.6 + hash11(id + 5.0));
    float ang = a0 + (u - 0.5) * span;
    float wob = 1.0 + 0.16 * sin(u * 9.0 + t * 2.3 + id) + 0.08 * sin(u * 23.0 - t * 3.1);
    pos = (tA * cos(ang) + tB * sin(ang)) * rad * wob;
    pos += n * (0.12 * sin(u * 6.0 + t * 1.7 + id));
    pos += 0.05 * vec3(snoise(pos * 3.0 + t * 0.5), snoise(pos * 3.0 + 4.0), snoise(pos * 3.0 - t * 0.4));
    float env = sin(3.14159265 * life);
    env *= env;
    float along = smoothstep(0.0, 0.18, u) * smoothstep(1.0, 0.82, u);
    float pulse = 0.55 + 0.45 * sin(u * 14.0 - t * 6.0 + id);
    float clump = clumpField(pos, t);
    intensity = env * along * pulse * (0.01 + clump * clump * 0.3) * aSeed.x;
    hot = intensity * 0.8;
    size = 0.016 + aSeed.y * 0.012;
    soft = 1.4;
  } else if (uLayer < 2.5) {
    // --- Sparks: embers drifting out of the orb surface and fading.
    vec3 dir = normalize(aSeed.xyz * 2.0 - 1.0 + 1e-4);
    float period = 2.5 + aParam.x * 3.5;
    float life = fract(t / period + aParam.y);
    float cyc = floor(t / period + aParam.y);
    dir = normalize(dir + hashDir(aParam.z * 91.0 + cyc) * 0.6);
    float r = 0.75 + life * (0.55 + aParam.w * 1.1);
    pos = dir * r;
    pos += 0.08 * vec3(snoise(pos * 2.0 + t * 0.3), snoise(pos * 2.0 + 3.3), snoise(pos * 2.0 - t * 0.2));
    float clump = clumpField(dir * 0.8, t);
    intensity = smoothstep(0.0, 0.08, life) * pow(1.0 - life, 1.8) * (0.15 + clump * 0.8) * 0.6;
    size = 0.02 + aSeed.w * 0.025;
    soft = 1.3;
  } else {
    // --- Dust: sparse, faint specks scattered through the dark background.
    vec3 base = aSeed.xyz;
    pos = base + vec3(sin(t * 0.13 + aParam.x * 6.28) * 0.12,
                      sin(t * 0.11 + aParam.y * 6.28) * 0.10 + t * 0.03 * (aParam.z - 0.5),
                      0.0);
    intensity = aParam.w * (0.7 + 0.3 * sin(t * (0.6 + aParam.x) + aParam.y * 30.0));
    size = aSeed.w;
    soft = aParam.z > 0.65 ? 2.4 : 1.0;
  }

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  float depth = -mv.z;
  gl_Position = projectionMatrix * mv;
  float px = size * uFocalPx / max(depth, 0.05);
  // Fade sprites that come very close to the lens (camera move in V2).
  float nearFade = smoothstep(0.35, 1.2, depth);
  float clamped = clamp(px, 1.0, uMaxSize);
  // Keep energy roughly constant when a sprite is clamped to >= 1px.
  float energy = (px * px) / (clamped * clamped);
  gl_PointSize = clamped;
  vIntensity = intensity * nearFade * min(energy, 1.0) * (depth > 0.0 ? 1.0 : 0.0);
  vHot = hot * nearFade;
  vSoft = soft;
}
`;

export const POINTS_FRAG = /* glsl */ `
precision highp float;
varying float vIntensity;
varying float vHot;
varying float vSoft;
void main() {
  vec2 d = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(d, d);
  if (r2 > 1.0) discard;
  float k = exp(-r2 * 4.5 / vSoft);
  gl_FragColor = vec4(vIntensity * k, vHot * k, 0.0, 1.0);
}
`;

/** Final pass: intensity -> filmic curve -> colour ramp. */
export const COMPOSITE_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uVolume;
uniform sampler2D uPoints;
uniform sampler2D uVolumeB;
uniform sampler2D uPointsB;
uniform float uMix;
uniform float uGain;
uniform float uFrame;
uniform vec3 uRamp[8];
uniform float uStops[8];
uniform float uExposure;
uniform vec3 uHotColor;
varying vec2 vUv;

vec3 ramp(float x) {
  vec3 col = uRamp[0];
  for (int i = 1; i < 8; i++) {
    float a = clamp((x - uStops[i - 1]) / max(uStops[i] - uStops[i - 1], 1e-5), 0.0, 1.0);
    col = mix(col, uRamp[i], a);
  }
  return col;
}

void main() {
  vec4 v = texture2D(uVolume, vUv);
  vec4 p = texture2D(uPoints, vUv);
  if (uMix > 0.0) {
    v = mix(v, texture2D(uVolumeB, vUv), uMix);
    p = mix(p, texture2D(uPointsB, vUv), uMix);
  }
  v *= uGain;
  p *= mix(1.0, uGain, 0.6);
  float e = v.r + p.r;
  float hot = v.g + p.g;
  float i = 1.0 - exp(-e * uExposure);
  vec3 col = ramp(i);
  col = mix(col, uHotColor, clamp(hot * 0.35, 0.0, 0.85) * smoothstep(0.45, 0.85, i));
  // Fine animated grain, only where there is light, breaks up 8-bit banding in
  // the soft halo (after downscaling and H.264) while keeping true black.
  float g = fract(sin(dot(gl_FragCoord.xy + vec2(uFrame * 17.0, uFrame * 31.0), vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
  col += g * (2.5 / 255.0) * smoothstep(0.0, 0.08, i);
  gl_FragColor = vec4(max(col, 0.0), 1.0);
}
`;
