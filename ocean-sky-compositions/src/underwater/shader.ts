export const VERTEX_SHADER = /* glsl */ `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

// Single-pass underwater scene: rippled surface seen from below, a sun hot
// spot, fanning god rays, depth gradient, sea-floor haze and drifting specks.
// uv.y = 0 is the top of the frame.
export const FRAGMENT_SHADER = /* glsl */ `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 outColor;

uniform vec2 uRes;
uniform float uTime;
uniform vec2 uSun;          // sun position in uv (y down)
uniform float uHorizon;     // where the surface plane meets the haze

uniform vec3 uSurface;      // surface base tint
uniform vec3 uHighlight;    // ripple highlights / sun core
uniform vec3 uUpper;        // water just under the surface
uniform vec3 uMid;
uniform vec3 uDeep;
uniform vec3 uAbyss;        // darkest corner
uniform vec3 uFloor;        // sea-floor haze
uniform vec3 uRay;          // light-shaft tint
uniform float uRayStrength;

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}
float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float noise1(float x) {
  float i = floor(x);
  float f = fract(x);
  float u = f * f * (3.0 - 2.0 * f);
  return mix(hash11(i), hash11(i + 1.0), u);
}
float noise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1, 0)), u.x),
             mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) {
    v += a * noise2(p);
    p = m * p;
    a *= 0.5;
  }
  return v;
}

// Bright, net-like wave crests as seen from below.
float ripples(vec2 p, float t) {
  vec2 q = vec2(fbm(p + vec2(0.0, t * 0.35)), fbm(p + vec2(5.2, 1.3) - t * 0.3));
  float n = fbm(p * 1.7 + 2.2 * q + vec2(t * 0.25, -t * 0.4));
  float ridge = 1.0 - abs(2.0 * n - 1.0);
  return pow(ridge, 5.0);
}

void main() {
  vec2 uv = vec2(vUv.x, 1.0 - vUv.y);
  float aspect = uRes.x / uRes.y;
  vec2 p = vec2(uv.x * aspect, uv.y);
  vec2 sun = vec2(uSun.x * aspect, uSun.y);
  float t = uTime;

  // ---- water body gradient --------------------------------------------
  vec3 col = mix(uUpper, uMid, smoothstep(0.18, 0.62, uv.y));
  col = mix(col, uDeep, smoothstep(0.5, 0.88, uv.y));
  // darker water away from the sun, deepest towards the bottom right
  float side = smoothstep(0.45, 1.0, uv.x) * smoothstep(0.25, 0.8, uv.y);
  col = mix(col, uAbyss, side * 0.85);
  float leftEdge = smoothstep(0.4, 0.0, uv.x) * smoothstep(0.4, 0.8, uv.y) * smoothstep(1.0, 0.85, uv.y);
  col = mix(col, uDeep, leftEdge * 0.6);
  // sea-floor haze: a soft bright band along the bottom, centred under the sun
  float floorBand = smoothstep(0.76, 1.0, uv.y);
  float floorDrift = 0.05 * sin(t * 0.45) + 0.08 * (noise2(vec2(uv.x * 3.0 + t * 0.15, t * 0.2)) - 0.5);
  float floorShape = exp(-pow((uv.x - 0.4 - floorDrift) / 0.4, 2.0));
  col = mix(col, uFloor, floorBand * (0.15 + 0.85 * floorShape));

  // ---- surface (above the horizon line) --------------------------------
  float h = uHorizon;
  float sMask = smoothstep(h + 0.035, h - 0.05, uv.y);
  if (uv.y < h + 0.03) {
    float dz = max(h + 0.035 - uv.y, 0.004);
    float depth = min(0.11 / dz, 9.0);              // distance along the plane
    vec2 sp = vec2((uv.x - uSun.x) * aspect * (depth + 0.6) * 11.0, depth * 7.0);
    float r = ripples(sp * 0.9, t * 1.5);
    float r2 = ripples(sp * 2.1 + 7.0, t * 2.1);
    float waves = (r * 0.75 + r2 * 0.35) * smoothstep(9.0, 3.0, depth);
    float sunNear = exp(-pow(length((p - sun) * vec2(0.9, 1.6)) / 0.2, 2.0));
    vec3 surf = uSurface * (0.82 + 0.28 * fbm(sp * 0.6 + t * 0.35));
    surf += uHighlight * waves * (0.1 + 0.75 * sunNear) * smoothstep(h + 0.035, h - 0.12, uv.y);
    surf = mix(surf, uUpper * 1.08, smoothstep(h - 0.15, h + 0.03, uv.y) * 0.5);
    col = mix(col, surf, sMask);
  }

  // ---- god rays --------------------------------------------------------
  // broad, soft shafts fanning down and to the right from the hot spot
  vec2 v = p - (sun + vec2(-0.02, -0.12));
  float dist = length(p - sun);
  float ang = atan(v.x, v.y);                       // 0 = straight down
  float sway = 0.05 * sin(t * 0.7) + 0.03 * sin(t * 1.9 + 1.3);
  float a2 = ang + sway * (0.4 + dist);
  float env = exp(-pow((a2 - 0.42) / 0.42, 2.0));
  float s1 = noise1(a2 * 9.0 + t * 0.35 + 1.5 * noise1(a2 * 3.0 - t * 0.25));
  float s2 = noise1(a2 * 17.0 - t * 0.6);
  float s3 = noise1(a2 * 5.0 + t * 0.2);
  float shafts = pow(s1 * 0.55 + s2 * 0.15 + s3 * 0.45, 1.6);
  // shafts pulse and break up along their length with the surface waves
  float along = noise2(vec2(a2 * 12.0, dist * 2.2 - t * 0.9));
  float pulse = 0.75 + 0.25 * sin(t * 1.6 + a2 * 23.0);
  shafts *= (0.6 + 0.6 * along) * pulse;
  float fall = exp(-dist * 1.25) * smoothstep(0.0, 0.12, dist);
  float rays = shafts * env * fall * uRayStrength;
  // diffuse light scattered in the water around the shaft bundle
  float haze = exp(-pow((a2 - 0.38) / 0.5, 2.0)) * exp(-dist * 1.4) * 0.6;
  float glow = exp(-dist * 3.4) * 0.45 + exp(-dist * 10.0) * 0.4;
  col += uRay * rays * (1.0 - 0.35 * smoothstep(0.75, 1.0, uv.y));
  col += uRay * (haze * (0.85 + 0.15 * sin(t * 0.9)) + glow * 0.45) * smoothstep(-0.05, 0.12, uv.y + 0.05);
  // sun core blown out at the surface
  float core = exp(-pow(length((p - sun) * vec2(1.0, 1.8)) / 0.06, 2.0));
  col = mix(col, uHighlight, clamp(core * 0.9, 0.0, 1.0));

  // ---- drifting particles ----------------------------------------------
  vec2 gp = p * vec2(26.0, 26.0) + vec2(t * 0.12, -t * 0.22);
  vec2 cell = floor(gp);
  vec2 f = fract(gp) - 0.5;
  float rnd = hash21(cell);
  if (rnd > 0.86) {
    vec2 off = vec2(hash21(cell + 3.1), hash21(cell + 7.7)) - 0.5;
    float d = length(f - off * 0.7);
    float size = 0.012 + 0.03 * hash21(cell + 1.7);
    float tw = 0.5 + 0.5 * sin(t * 2.0 + rnd * 40.0);
    col += uHighlight * smoothstep(size, 0.0, d) * 0.18 * tw
           * (1.0 - smoothstep(0.2, 0.95, uv.y) * 0.6);
  }

  col *= 1.0 + 0.018 * sin(t * 1.1) + 0.01 * sin(t * 2.7);
  // dither to avoid gradient banding
  col += (hash21(gl_FragCoord.xy + fract(t) * 91.0) - 0.5) * 3.0 / 255.0;
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
