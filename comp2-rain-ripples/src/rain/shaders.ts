// GLSL ES 3.00 shaders for the rain-on-water surface.
// Pass 1 writes a float height field (+ crater mask + pixel footprint).
// Pass 2 derives surface slope and maps it through a colour field measured
// from the reference clip.

export const VERT = /* glsl */ `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const COMMON = /* glsl */ `
precision highp float;
precision highp int;

uniform vec2 uRes;       // canvas size in px
uniform float uTime;     // seconds
uniform float uSeed;
// Camera: position, basis, tan(fov/2), world scale
uniform vec3 uCamPos;
uniform vec3 uCamFwd;
uniform vec3 uCamRight;
uniform vec3 uCamUp;
uniform float uTanHalfFov;
uniform float uWorldScale;
uniform float uWaveGain;
uniform float uRippleGain;

uint hashU(uint x) {
  x ^= x >> 16; x *= 0x7feb352du;
  x ^= x >> 15; x *= 0x846ca68bu;
  x ^= x >> 16;
  return x;
}
float hash13(vec3 p) {
  ivec3 q = ivec3(floor(p));
  uint h = hashU(uint(q.x) * 73856093u ^ uint(q.y) * 19349663u ^ uint(q.z) * 83492791u ^ uint(uSeed) * 2654435761u);
  return float(h) * (1.0 / 4294967295.0);
}
float u01(uint h) { return float(h) * (1.0 / 4294967295.0); }

// Ray through pixel → intersection with the water plane z = 0.
// Returns world xy (in "frame widths") and ray length.
vec3 worldFromPixel(vec2 frag) {
  vec2 ndc = (frag / uRes) * 2.0 - 1.0;
  float aspect = uRes.x / uRes.y;
  vec3 dir = normalize(uCamFwd + ndc.x * uTanHalfFov * aspect * uCamRight + ndc.y * uTanHalfFov * uCamUp);
  float t = -uCamPos.z / min(dir.z, -1e-4);
  vec3 P = uCamPos + t * dir;
  return vec3(P.xy * uWorldScale, t);
}
`;

export const HEIGHT_FRAG = /* glsl */ `#version 300 es
${COMMON}
in vec2 vUv;
out vec4 outColor;

const float CELL = 0.15;     // ripple spawn cell (frame widths)
const float SLOT = 1.7;       // seconds per spawn slot
const float LIFE = 1.15;      // ripple lifetime (s)
const float PROB = 0.85;      // spawn probability per slot

float vnoise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  float n000 = hash13(i);
  float n100 = hash13(i + vec3(1, 0, 0));
  float n010 = hash13(i + vec3(0, 1, 0));
  float n110 = hash13(i + vec3(1, 1, 0));
  float n001 = hash13(i + vec3(0, 0, 1));
  float n101 = hash13(i + vec3(1, 0, 1));
  float n011 = hash13(i + vec3(0, 1, 1));
  float n111 = hash13(i + vec3(1, 1, 1));
  return mix(mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
             mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y), u.z) * 2.0 - 1.0;
}

// Wind/rain-agitated background chop: 18 dispersive wave trains whose
// parameters are precomputed on the CPU (see waves.ts), domain-warped so
// they never look periodic, and band-limited by the pixel footprint so
// sub-pixel detail fades instead of aliasing.
const int NW = 18;
uniform vec4 uWave[NW];   // dir.xy, k, omega
uniform vec2 uWave2[NW];  // amplitude, phase

float waves(vec2 q, float fp) {
  float h = 0.0;
  for (int i = 0; i < NW; i++) {
    vec4 w = uWave[i];
    float lambda = 6.2831853 / w.z;
    float lod = smoothstep(2.2 * fp, 4.5 * fp, lambda);
    h += uWave2[i].x * lod * sin(dot(w.xy, q) * w.z - w.w * uTime + uWave2[i].y);
  }
  float nl = smoothstep(2.0 * fp, 4.0 * fp, 0.012);
  h += 0.0045 * nl * vnoise3(vec3(q * 75.0, uTime * 2.2));
  return h;
}

// Expanding rain-drop rings (several concentric crests) + impact crater.
vec2 ripples(vec2 p, float fp) {
  float h = 0.0;
  float crater = 0.0;
  vec2 cell = floor(p / CELL);
  for (int L = 0; L < 2; L++) {
    for (int oy = -1; oy <= 1; oy++) {
      for (int ox = -1; ox <= 1; ox++) {
        ivec2 c = ivec2(cell) + ivec2(ox, oy);
        uint h0 = hashU(uint(c.x) * 73856093u ^ uint(c.y) * 19349663u ^ uint(L + 1) * 83492791u ^ uint(uSeed) * 2654435761u);
        float phase = u01(h0) * SLOT;
        float slot = floor((uTime + phase) / SLOT);
        uint h1 = hashU(h0 ^ (uint(int(slot) + 4096) * 2246822519u));
        if (u01(h1) > PROB) continue;
        uint h2 = hashU(h1);
        uint h3 = hashU(h2);
        uint h4 = hashU(h3);
        uint h5 = hashU(h4);
        float t0 = slot * SLOT - phase + u01(h4) * (SLOT - LIFE);
        float age = uTime - t0;
        if (age < 0.0 || age >= LIFE) continue;
        vec2 ctr = (vec2(c) + vec2(u01(h2), u01(h3))) * CELL;
        float s = 0.62 + 0.38 * u01(h5); // drop size
        float rMax = 0.125 * s;
        float d = length(p - ctr);
        if (d > rMax + 0.025) continue;
        float r = rMax * (1.0 - exp(-age / 0.33));
        float lam = 0.016 * (0.8 + 0.4 * s) * (1.0 + 0.45 * age);
        float x = d - r;
        float env = x > 0.0 ? exp(-(x * x) / (0.16 * lam * lam)) : exp(x / (3.4 * lam));
        float fade = smoothstep(LIFE, LIFE * 0.55, age) * smoothstep(0.0, 0.02, age);
        float amp = 0.0075 * s * exp(-age / 0.55) * fade
                    * mix(0.45, 1.0, smoothstep(0.0, 0.04, r)) / (1.0 + r / 0.08);
        float lod = smoothstep(2.0 * fp, 4.0 * fp, lam);
        h += amp * lod * env * cos(6.2831853 * x / lam);
        // impact crater
        float cw = 0.0085 * (0.6 + 0.6 * s);
        float cr = exp(-age / 0.11) * exp(-(d * d) / (cw * cw));
        h -= 0.012 * s * cr;
        crater += cr * s;
      }
    }
  }
  return vec2(h, crater);
}

void main() {
  vec3 w = worldFromPixel(gl_FragCoord.xy);
  // world units per pixel (for band-limiting)
  vec3 wx = worldFromPixel(gl_FragCoord.xy + vec2(1.0, 0.0));
  vec3 wy = worldFromPixel(gl_FragCoord.xy + vec2(0.0, 1.0));
  float fp = max(length(wx.xy - w.xy), length(wy.xy - w.xy));
  vec2 p = w.xy;
  // two-scale domain warp shared by chop and rings (rings ride the chop)
  vec2 warp = vec2(vnoise3(vec3(p * 9.0, uTime * 0.35)),
                   vnoise3(vec3(p * 9.0 + 31.7, uTime * 0.35)));
  vec2 warp2 = vec2(vnoise3(vec3(p * 32.0, uTime * 0.6 + 4.0)),
                    vnoise3(vec3(p * 32.0 + 13.1, uTime * 0.6 + 9.0)));
  vec2 q = p + warp * 0.02 + warp2 * 0.0045;
  vec2 rp = ripples(p + warp2 * 0.004, fp);
  float h = uWaveGain * waves(q, fp) + uRippleGain * rp.x;
  outColor = vec4(h, uRippleGain > 0.0 ? rp.y : 0.0, fp, 1.0);
}
`;

export const SHADE_FRAG = /* glsl */ `#version 300 es
${COMMON}
in vec2 vUv;
out vec4 outColor;

uniform sampler2D uHeight;
uniform sampler2D uField;     // 24 x (14*7) colour field
uniform float uSigma;         // slope normaliser
uniform vec2 uLight;          // slope direction that reflects the bright sky
uniform float uFresnel;       // extra far-field sky reflection (low camera)
uniform int uDebug;

const float LV[7] = float[7](0.02, 0.10, 0.25, 0.50, 0.75, 0.90, 0.98);

vec3 fieldColor(int level, vec2 uv) {
  // each level is a 24x14 slab stacked vertically; clamp inside the slab
  vec2 g = vec2(24.0, 14.0);
  vec2 t = clamp(uv * g, vec2(0.5), g - 0.5);
  vec2 st = vec2(t.x / g.x, (float(level) * g.y + t.y) / (g.y * 7.0));
  return texture(uField, st).rgb;
}

void main() {
  ivec2 ip = ivec2(gl_FragCoord.xy);
  ivec2 mx = ivec2(uRes) - 1;
  vec4 c = texelFetch(uHeight, ip, 0);
  float hl = texelFetch(uHeight, clamp(ip - ivec2(1, 0), ivec2(0), mx), 0).r;
  float hr = texelFetch(uHeight, clamp(ip + ivec2(1, 0), ivec2(0), mx), 0).r;
  float hd = texelFetch(uHeight, clamp(ip - ivec2(0, 1), ivec2(0), mx), 0).r;
  float hu = texelFetch(uHeight, clamp(ip + ivec2(0, 1), ivec2(0), mx), 0).r;
  float fp = max(c.b, 1e-6);
  vec2 g = vec2(hr - hl, hu - hd) / (2.0 * fp); // world-space slope

  float sl = dot(g, uLight);
  float s = 1.0 / (1.0 + exp(-1.7 * sl / uSigma)); // ≈ uniform in (0,1)

  // reference frame is top-down in screen space: uv.y = 0 at the top
  vec2 uv = vec2(vUv.x, 1.0 - vUv.y);
  vec3 col;
  if (s <= LV[0]) {
    col = fieldColor(0, uv) * mix(0.7, 1.0, s / LV[0]);
  } else if (s >= LV[6]) {
    col = mix(fieldColor(6, uv), vec3(1.0, 0.99, 1.0), (s - LV[6]) / (1.0 - LV[6]) * 0.6);
  } else {
    col = fieldColor(0, uv);
    for (int i = 0; i < 6; i++) {
      if (s >= LV[i] && s < LV[i + 1]) {
        col = mix(fieldColor(i, uv), fieldColor(i + 1, uv), (s - LV[i]) / (LV[i + 1] - LV[i]));
      }
    }
  }
  // impact craters read as dark pits
  float cr = clamp(c.g, 0.0, 1.0);
  col = mix(col, vec3(0.02, 0.05, 0.16), 0.7 * cr);

  // far-field sky reflection for low camera angles
  if (uFresnel > 0.0) {
    float far = smoothstep(0.35, 1.0, vUv.y);
    col = mix(col, max(col, vec3(0.72, 0.74, 0.86)), uFresnel * far * s);
  }

  if (uDebug == 1) col = vec3(s);
  outColor = vec4(col, 1.0);
}
`;
