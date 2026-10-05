// Post chain: resolution-independent bloom pyramid (levels at H/2 ... H/64),
// an anamorphic horizontal streak, procedural lens-halo ghosts, then
// exposure -> tonemap -> sRGB -> grain -> dither as the very last step.

const HEAD = /* glsl */ `
precision highp float;
precision highp int;
in vec2 vUv;
out vec4 fragColor;
`;

// 13-tap "CoD" downsample; the first level also applies a soft threshold.
export const DOWNSAMPLE_FRAG = /* glsl */ `${HEAD}
uniform sampler2D uSrc;
uniform vec2 uTexel;        // source texel size
uniform float uThreshold;   // < 0: no threshold
uniform float uKnee;
vec3 tap(vec2 o) { return texture(uSrc, vUv + o * uTexel).rgb; }
vec3 prefilter(vec3 c) {
  if (uThreshold < 0.0) return c;
  float br = max(c.r, max(c.g, c.b));
  float rq = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
  rq = rq * rq / (4.0 * uKnee + 1e-5);
  float w = max(rq, br - uThreshold) / max(br, 1e-5);
  return c * w;
}
void main() {
  vec3 a = tap(vec2(-2, 2)), b = tap(vec2(0, 2)), c = tap(vec2(2, 2));
  vec3 d = tap(vec2(-2, 0)), e = tap(vec2(0, 0)), f = tap(vec2(2, 0));
  vec3 g = tap(vec2(-2, -2)), h = tap(vec2(0, -2)), i = tap(vec2(2, -2));
  vec3 j = tap(vec2(-1, 1)), k = tap(vec2(1, 1)), l = tap(vec2(-1, -1)), m = tap(vec2(1, -1));
  vec3 o = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  fragColor = vec4(prefilter(max(o, 0.0)), 1.0);
}
`;

// 9-tap tent upsample of the coarser level, added onto the current level.
export const UPSAMPLE_FRAG = /* glsl */ `${HEAD}
uniform sampler2D uCoarse;
uniform sampler2D uFine;
uniform vec2 uTexel;        // coarse texel size
uniform float uScatter;
void main() {
  vec2 t = uTexel;
  vec3 s = texture(uCoarse, vUv).rgb * 4.0;
  s += (texture(uCoarse, vUv + vec2(-t.x, 0)).rgb + texture(uCoarse, vUv + vec2(t.x, 0)).rgb
      + texture(uCoarse, vUv + vec2(0, -t.y)).rgb + texture(uCoarse, vUv + vec2(0, t.y)).rgb) * 2.0;
  s += texture(uCoarse, vUv + vec2(-t.x, -t.y)).rgb + texture(uCoarse, vUv + vec2(t.x, -t.y)).rgb
     + texture(uCoarse, vUv + vec2(-t.x, t.y)).rgb + texture(uCoarse, vUv + vec2(t.x, t.y)).rgb;
  s /= 16.0;
  fragColor = vec4(texture(uFine, vUv).rgb + s * uScatter, 1.0);
}
`;

// Horizontal-only gaussian-ish blur for the anamorphic streak; run several
// times with growing tap spacing.
export const STREAK_FRAG = /* glsl */ `${HEAD}
uniform sampler2D uSrc;
uniform vec2 uTexel;
uniform float uSpacing;
uniform float uThreshold;   // >= 0 only on the first pass
void main() {
  vec3 s = vec3(0.0);
  float wsum = 0.0;
  for (int i = -6; i <= 6; i++) {
    float w = exp(-float(i * i) / 18.0);
    vec3 c = texture(uSrc, vUv + vec2(float(i) * uSpacing * uTexel.x, 0.0)).rgb;
    if (uThreshold >= 0.0) c = max(c - uThreshold, 0.0);
    s += c * w;
    wsum += w;
  }
  fragColor = vec4(s / wsum, 1.0);
}
`;

export const COMPOSITE_FRAG = /* glsl */ `${HEAD}
uniform sampler2D uHdr;
uniform sampler2D uBloom;
uniform sampler2D uStreak;
uniform vec2 uRes;
uniform float uFrameMod;      // frame % 600
uniform float uExposure;
uniform float uBloomStr;
uniform float uStreakStr;
uniform vec3 uStreakCol;
uniform float uHaloStr;
uniform vec2 uHaloSrc;        // light source position in uv
uniform vec3 uTint;           // final colour balance
uniform float uSaturation;
uniform float uVignette;
uniform float uGrain;
uniform float uLift;          // black lift (keeps "dark" from crushing to 0)

uint pcg(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
float h3(uvec3 v) { return float(pcg(v.x + pcg(v.y + pcg(v.z)))) / 4294967295.0; }

// Hue-preserving extended-Reinhard on the max channel (linear toe, so dark
// haze is not crushed), then highlights burn toward white.
vec3 tonemap(vec3 c) {
  float m = max(c.r, max(c.g, c.b)) + 1e-6;
  const float W2 = 40.0;
  float tm = m * (1.0 + m / W2) / (1.0 + m);
  vec3 hp = c * (tm / m);
  float burn = smoothstep(0.8, 7.0, m);
  return clamp(mix(hp, vec3(tm), burn * 0.9), 0.0, 1.0);
}
vec3 toSrgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

// one big faint circular lens-halo ring centred on the source, with a hint
// of dispersion at its edge
uniform vec3 uHaloCol;
uniform float uHaloR;
vec3 halo(vec2 uv) {
  vec2 asp = vec2(uRes.x / uRes.y, 1.0);
  float d = length((uv - uHaloSrc) * asp);
  float R = uHaloR;
  vec3 ringRGB = vec3(
    exp(-pow((d - R * 1.000) / 0.018, 2.0)),
    exp(-pow((d - R * 0.994) / 0.018, 2.0)),
    exp(-pow((d - R * 0.988) / 0.018, 2.0)));
  float fill = smoothstep(R, R * 0.7, d) * 0.06;
  return (ringRGB + fill) * uHaloCol;
}

void main() {
  vec3 hdr = texture(uHdr, vUv).rgb;
  vec3 bloom = texture(uBloom, vUv).rgb;
  vec3 col = hdr + bloom * uBloomStr;
  if (uStreakStr > 0.0) col += texture(uStreak, vUv).rgb * uStreakCol * uStreakStr;
  if (uHaloStr > 0.0) col += halo(vUv) * uHaloStr;
  col *= uTint;
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = max(mix(vec3(l), col, uSaturation), 0.0);

  vec2 vc = vUv - 0.5;
  col *= 1.0 - uVignette * dot(vc, vc) * 1.6;

  col = tonemap(col * uExposure);
  col = toSrgb(col);
  col = uLift + (1.0 - uLift) * col;

  // film grain (~2%) from a fixed formula of pixel and frame % 600, then
  // a triangular +-1/255 dither. Both last, after tonemapping.
  uvec2 pix = uvec2(gl_FragCoord.xy);
  uint f = uint(uFrameMod);
  float g = h3(uvec3(pix, f + 1000u)) + h3(uvec3(pix, f + 3000u)) - 1.0;
  col += g * uGrain * (0.35 + 0.65 * sqrt(clamp(l, 0.0, 1.0)));
  float d = h3(uvec3(pix, f + 7000u)) - h3(uvec3(pix, f + 9000u));
  col += d / 255.0;
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
