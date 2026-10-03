// GLSL for the fake-glass material (shared by the hero meshes and the
// background impostors), the background gradient, and the final pass
// (vignette -> AgX -> sRGB -> grain -> dither). All shaders are GLSL3.

import {AGX_LOOK_SATURATION} from '../agx';

export const GLASS_COMMON = /* glsl */ `
uniform sampler2D uEnv;
uniform float uEnvLodMax;
uniform float uEnvScale;
uniform mat3 uViewToWorld;
uniform vec3 uEdge;
uniform vec3 uCenter;
uniform vec3 uBgMid;
uniform vec3 uLight;      // view-space key light direction (towards the light)
uniform float uSpecLevel;
uniform float uEnvNorm;  // 1 / mean HDRI luminance

vec3 envLookup(vec3 dirView, float lod) {
  vec3 d = normalize(uViewToWorld * dirView);
  vec2 uv = vec2(atan(d.z, d.x) * 0.15915494 + 0.5,
                 asin(clamp(d.y, -1.0, 1.0)) * 0.31830989 + 0.5);
  return textureLod(uEnv, uv, lod).rgb;
}

// Gaussian lobe in normal space; widening sigma^2 by the blur keeps the
// lobe's energy, which is what a defocused highlight does.
float lobe(vec3 N, vec3 C, float s0, float blur) {
  float s2 = s0 + blur * blur * 0.18;
  vec3 d = N - C;
  return exp(-dot(d, d) / (2.0 * s2)) * (s0 / s2);
}

// Fake glass. N, V in view space. blur = circle of confusion / radius.
// Returns premultiplied RGBA in scene-linear units.
vec4 glass(vec3 N, vec3 V, float blur, float pale, float opacity) {
  float ndv = clamp(dot(N, V), 0.0, 1.0);
  float rim = 1.0 - ndv;
  vec3 edge = mix(uEdge, uBgMid, pale);
  vec3 center = mix(uCenter, uBgMid, pale);

  // Defocus washes internal detail toward the average body colour.
  float wash = clamp(blur * 0.35, 0.0, 1.0);

  // Body: clear and light in the middle, saturated toward the silhouette;
  // the lower half reads a little deeper (light comes from above).
  float tilt = clamp(0.5 - N.y * 0.5, 0.0, 1.0);
  float f = smoothstep(0.05, 0.62, rim + tilt * 0.12 - 0.05);
  vec3 body = mix(center, edge, f);

  // Fake refraction: the studio seen through the glass, flipped like a lens,
  // modulates the body into darker and lighter curved shapes.
  vec3 Tr = refract(-V, N, 0.69);
  vec3 seen = envLookup(normalize(Tr - N * 0.75), min(uEnvLodMax, 1.5 + blur * 6.0));
  float lumSeen = dot(seen, vec3(0.2126, 0.7152, 0.0722)) * uEnvNorm;
  float pat = clamp(log2(lumSeen + 0.08) * 0.3, -0.75, 0.3) * (1.0 - wash) * smoothstep(0.0, 0.35, ndv);
  vec3 lightBody = mix(center, uBgMid, 0.4);
  body = pat < 0.0 ? mix(body, edge * 0.7, -pat) : mix(body, lightBody, pat);

  // deeper, saturated outline right at the silhouette
  body = mix(body, edge * 0.72, smoothstep(0.75, 0.985, rim) * (1.0 - wash));
  // the very middle lets the bright background through
  float alpha = mix(0.38, 1.0, smoothstep(0.0, 0.2, rim)) * opacity;

  // Transmitted light: a glow focused opposite the key light (lower inside),
  // plus a bright crescent hugging the inside of the rim on that side.
  vec3 cdir = normalize(vec3(-uLight.xy * 0.62, 0.55));
  float caus = lobe(N, cdir, 0.05, blur);
  float cres = smoothstep(0.45, 0.8, rim) * (1.0 - smoothstep(0.84, 0.96, rim))
             * smoothstep(0.0, 0.85, dot(normalize(N.xy + 1e-4), -normalize(uLight.xy)));
  vec3 glow = lightBody * (caus * 1.6 + cres * 1.2 / (1.0 + blur * 2.0));

  vec3 avgBody = mix(center, edge, 0.5);
  body = mix(body, avgBody, wash);

  vec3 col = (body + glow * (1.0 - wash * 0.5)) * alpha;

  // Environment reflection (studio HDRI), Fresnel weighted, kept off the
  // very rim so the silhouette stays a deep colour rather than a white line.
  float F = (0.04 + 0.96 * pow(rim, 5.0)) * (1.0 - smoothstep(0.88, 1.0, rim) * 0.7);
  vec3 R = reflect(-V, N);
  float lod = min(uEnvLodMax, 2.0 + blur * 5.0);
  vec3 env = min(envLookup(R, lod) * uEnvScale, vec3(uSpecLevel * 0.5));
  col += env * mix(F * 0.5, 0.04, wash) * (1.0 - pale * 0.6);

  // Small sharp specular highlights: key, a top-edge kicker, a lower window.
  vec3 H = normalize(uLight + V);
  float spec = lobe(N, H, 0.0006, blur) * 1.1 + lobe(N, H, 0.006, blur) * 0.05;
  vec3 H3 = normalize(normalize(vec3(0.15, 0.95, 0.25)) + V);
  spec += lobe(N, H3, 0.0005, blur) * 0.5;
  vec3 H2 = normalize(normalize(vec3(0.55, -0.45, 0.7)) + V);
  spec += lobe(N, H2, 0.0012, blur) * 0.2 / (1.0 + blur * 4.0);
  col += vec3(spec) * uSpecLevel * (1.0 - pale * 0.55);

  return vec4(col, alpha);
}
`;

// ------------------------------------------------------------- hero meshes

export const HERO_VERT = /* glsl */ `
out vec3 vN;
out vec3 vViewPos;
out vec3 vObjN;
void main() {
  vObjN = normal;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vViewPos = mv.xyz;
  vN = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * mv;
}
`;

export const HERO_FRAG = /* glsl */ `
${GLASS_COMMON}
uniform float uPale;
uniform float uOpacity;
uniform float uBubbles;
in vec3 vN;
in vec3 vViewPos;
in vec3 vObjN;
out vec4 fragColor;

// Tiny air bubbles trapped in the glass, fixed in the atom's own frame so
// they turn with it. Each is a thin darker ring with a pin-point glint.
const int NB = 9;
const vec4 BUB[NB] = vec4[NB](
  vec4( 0.31, -0.52,  0.79, 0.075), vec4(-0.22, -0.61,  0.76, 0.055),
  vec4( 0.05, -0.35,  0.94, 0.045), vec4( 0.55, -0.15,  0.82, 0.05),
  vec4(-0.48,  0.10,  0.87, 0.04),  vec4( 0.12,  0.25,  0.96, 0.035),
  vec4(-0.70, -0.40, -0.59, 0.06),  vec4( 0.40,  0.60, -0.69, 0.05),
  vec4(-0.10, -0.80, -0.59, 0.065)
);

void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(-vViewPos);
  if (dot(N, V) < 0.0) N = -N;
  vec4 c = glass(N, V, 0.0, uPale, uOpacity);
  if (uBubbles > 0.0) {
    vec3 on = normalize(vObjN);
    float ndv = clamp(dot(N, V), 0.0, 1.0);
    for (int k = 0; k < NB; k++) {
      vec3 d = normalize(BUB[k].xyz);
      float r = BUB[k].w;
      float dist = length(on - d);
      float ring = smoothstep(r * 0.55, r * 0.85, dist) * (1.0 - smoothstep(r * 0.85, r * 1.05, dist));
      float glint = 1.0 - smoothstep(0.0, r * 0.3, length(on - d - vec3(-0.35, 0.35, 0.0) * r));
      float vis = smoothstep(0.15, 0.5, ndv) * uBubbles;
      c.rgb = mix(c.rgb, uEdge * 0.6 * c.a, ring * 0.7 * vis);
      c.rgb += vec3(uSpecLevel * 0.25) * glint * vis;
    }
  }
  fragColor = c;
}
`;

// ------------------------------------------------- background impostors
// One instanced draw of camera-facing capsules. A sphere is a capsule whose
// two ends coincide. Defocus is analytic: each capsule widens by its circle
// of confusion and its edge softens by the same amount (no post blur, no
// temporal accumulation).

export const IMPOSTOR_VERT = /* glsl */ `
in vec2 corner;
in vec3 iA;
in vec3 iB;
in float iR;
in float iPale;
in float iOpacity;
in float iGlow;
uniform float uCocK;
uniform float uFocus;
uniform float uPixelScale;
out vec2 vLocal;
out float vLen;
out float vR;
out float vBlur;
out float vAA;
out float vPale;
out float vOpacity;
out float vGlow;
out vec2 vDir;
void main() {
  vec2 d2 = iB.xy - iA.xy;
  float L = length(d2);
  vec2 D = L > 1e-6 ? d2 / L : vec2(1.0, 0.0);
  vec2 P = vec2(-D.y, D.x);
  float zMid = -0.5 * (iA.z + iB.z);
  float coc = uCocK * abs(zMid - uFocus);
  float pw = zMid * uPixelScale;
  float W = iR + coc + 2.0 * pw;
  vec3 base = corner.x < 0.0 ? iA : iB;
  vec3 pos = base + vec3(D * corner.x * W + P * corner.y * W, 0.0);
  vLocal = vec2(corner.x < 0.0 ? -W : L + W, corner.y * W);
  vLen = L;
  vR = iR;
  vBlur = coc / iR;
  vAA = pw / iR;
  vPale = iPale;
  vOpacity = iOpacity;
  vGlow = iGlow;
  vDir = D;
  gl_Position = projectionMatrix * vec4(pos, 1.0);
}
`;

export const IMPOSTOR_FRAG = /* glsl */ `
${GLASS_COMMON}
in vec2 vLocal;
in float vLen;
in float vR;
in float vBlur;
in float vAA;
in float vPale;
in float vOpacity;
in float vGlow;
in vec2 vDir;
out vec4 fragColor;
void main() {
  float along = clamp(vLocal.x, 0.0, vLen);
  vec2 q = vec2(vLocal.x - along, vLocal.y) / vR;   // in radii, capsule frame
  float rho = length(q);
  float w = max(vBlur, vAA * 1.2);
  float cover = 1.0 - smoothstep(1.0 - w, 1.0 + w, rho);
  if (cover <= 0.0) discard;
  // a defocused shape spreads its light: lower peak for bigger blur
  bool isSphere = vLen < 1e-6;
  cover *= isSphere ? 1.0 / (1.0 + 0.15 * vBlur * vBlur) : 1.0 / (1.0 + 0.3 * vBlur);
  vec2 qn = rho > 0.985 ? q * (0.985 / rho) : q;
  vec2 P = vec2(-vDir.y, vDir.x);
  vec2 nxy = vDir * qn.x + P * qn.y;
  vec3 N = vec3(nxy, sqrt(max(0.0, 1.0 - dot(nxy, nxy))));
  vec4 c = glass(N, vec3(0.0, 0.0, 1.0), vBlur, vPale, vOpacity);
  if (vGlow > 0.0) {
    // floating specks: tiny luminous motes rather than glass beads
    vec3 warm = mix(uCenter, vec3(dot(uBgMid, vec3(0.333))), 0.55);
    c = vec4(warm * (1.0 + vGlow) * vOpacity, vOpacity * 0.6);
  }
  fragColor = c * cover;
}
`;

// ------------------------------------------------------- background quad

export const FULLSCREEN_VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const BG_FRAG = /* glsl */ `
uniform vec3 uBgLight;
uniform vec3 uBgDeep;
in vec2 vUv;
out vec4 fragColor;
void main() {
  // lightest toward the upper left, deepening toward the edges
  vec2 p = (vUv - vec2(0.3, 0.95)) * vec2(16.0 / 9.0, 1.2);
  float t = smoothstep(0.1, 1.75, length(p));
  t = t * t * (3.0 - 2.0 * t) * 0.85 + t * 0.15;
  // interpolate in log space so the falloff reads evenly after AgX
  vec3 c = exp(mix(log(uBgLight), log(uBgDeep), t));
  fragColor = vec4(c, 1.0);
}
`;

// ------------------------------------------------------------ final pass

export const FINAL_FRAG = /* glsl */ `
uniform sampler2D uScene;
uniform float uToneMappingExposure;
uniform uint uFrame;      // frame % 600
uniform float uGrain;     // grain amplitude (fraction of full scale)
uniform float uVignette;
uniform float uBloomThreshold;
uniform float uBloom;
in vec2 vUv;
out vec4 fragColor;

#define toneMappingExposure uToneMappingExposure

// Same polynomial as three.js' agxDefaultContrastApprox.
vec3 agxDefaultContrastApprox(vec3 x) {
  vec3 x2 = x * x;
  vec3 x4 = x2 * x2;
  return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x
       + 0.4298 * x2 + 0.1191 * x - 0.00232;
}

// AgX with a saturation-only look; mirrors src/agx.ts exactly.
vec3 agxWithLook(vec3 color) {
  const mat3 LINEAR_SRGB_TO_LINEAR_REC2020_ = mat3(
    vec3(0.6274, 0.0691, 0.0164), vec3(0.3293, 0.9195, 0.0880), vec3(0.0433, 0.0113, 0.8956));
  const mat3 LINEAR_REC2020_TO_LINEAR_SRGB_ = mat3(
    vec3(1.6605, -0.1246, -0.0182), vec3(-0.5876, 1.1329, -0.1006), vec3(-0.0728, -0.0083, 1.1187));
  const mat3 AgXInsetMatrix = mat3(
    vec3(0.856627153315983, 0.137318972929847, 0.11189821299995),
    vec3(0.0951212405381588, 0.761241990602591, 0.0767994186031903),
    vec3(0.0482516061458583, 0.101439036467562, 0.811302368396859));
  const mat3 AgXOutsetMatrix = mat3(
    vec3(1.1271005818144368, -0.1413297634984383, -0.14132976349843826),
    vec3(-0.11060664309660323, 1.157823702216272, -0.11060664309660294),
    vec3(-0.016493938717834573, -0.016493938717834257, 1.2519364065950405));
  const float AgxMinEv = -12.47393;
  const float AgxMaxEv = 4.026069;
  color *= toneMappingExposure;
  color = LINEAR_SRGB_TO_LINEAR_REC2020_ * color;
  color = AgXInsetMatrix * color;
  color = max(color, 1e-10);
  color = log2(color);
  color = (color - AgxMinEv) / (AgxMaxEv - AgxMinEv);
  color = clamp(color, 0.0, 1.0);
  color = agxDefaultContrastApprox(color);
  float l = dot(color, vec3(0.2126, 0.7152, 0.0722));
  color = l + ${AGX_LOOK_SATURATION.toFixed(4)} * (color - l);
  color = AgXOutsetMatrix * color;
  color = pow(max(vec3(0.0), color), vec3(2.2));
  color = LINEAR_REC2020_TO_LINEAR_SRGB_ * color;
  return clamp(color, 0.0, 1.0);
}

vec3 toSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}

// Integer hash (pcg3d): fixed function of pixel position and loop frame.
uvec3 pcg3d(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}

void main() {
  vec3 c = textureLod(uScene, vUv, 0.0).rgb;
  // soft bloom / haze from the scene's own mip chain (deterministic)
  vec3 bl = vec3(0.0);
  bl += max(textureLod(uScene, vUv, 3.0).rgb - uBloomThreshold, 0.0) * 0.3;
  bl += max(textureLod(uScene, vUv, 4.0).rgb - uBloomThreshold, 0.0) * 0.3;
  bl += max(textureLod(uScene, vUv, 5.0).rgb - uBloomThreshold, 0.0) * 0.25;
  bl += max(textureLod(uScene, vUv, 6.0).rgb - uBloomThreshold, 0.0) * 0.15;
  c += bl * uBloom;
  // soft vignette, weighted away from the bright upper-left
  vec2 p = (vUv - vec2(0.42, 0.7)) * vec2(16.0 / 9.0, 1.0);
  c *= 1.0 - uVignette * smoothstep(0.5, 1.45, length(p));
  c = toSRGB(agxWithLook(c));

  uvec3 h = pcg3d(uvec3(uvec2(gl_FragCoord.xy), uFrame));
  uvec3 h2 = pcg3d(uvec3(uvec2(gl_FragCoord.xy), uFrame + 7919u));
  vec3 u = vec3(h) * (1.0 / 4294967295.0);
  vec3 u2 = vec3(h2) * (1.0 / 4294967295.0);
  // monochrome film grain, +-uGrain
  c += (u.x - 0.5) * 2.0 * uGrain;
  // triangular dither, +-1/255, per channel
  c += (u2 + u.yzx - 1.0) / 255.0;
  fragColor = vec4(c, 1.0);
}
`;
