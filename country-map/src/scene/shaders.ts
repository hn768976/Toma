// GLSL for the paper sheet and the single-frame post pass (DoF gather, grade,
// vignette, grain, dither). Everything is a function of uniforms; no clocks.

export const paperVertex = /* glsl */ `
uniform vec2 uHiCentre;   // world xz of the hi-res texture centre
uniform vec2 uNameXZ;     // world xz of the name (focus point)
uniform float uBow;       // dome height (world units)
uniform float uWave;      // waviness amplitude
varying vec3 vWorld;
varying vec3 vNormal;
varying float vViewZ;

float sheetHeight(vec2 xz) {
  vec2 d = (xz - uHiCentre) / 10.0;
  vec2 dn = (uNameXZ - uHiCentre) / 10.0;
  float bow = uBow * (dot(dn, dn) - dot(d, d));
  float wave = uWave * (sin(xz.x * 0.83 + 1.3) * sin(xz.y * 0.61 + 0.4) + 0.5 * sin(xz.x * 1.9 - xz.y * 1.3 + 2.1));
  float waveName = uWave * (sin(uNameXZ.x * 0.83 + 1.3) * sin(uNameXZ.y * 0.61 + 0.4) + 0.5 * sin(uNameXZ.x * 1.9 - uNameXZ.y * 1.3 + 2.1));
  return bow + wave - waveName;
}

void main() {
  vec3 p = position;
  p.y = sheetHeight(p.xz);
  float e = 0.01;
  float hx = sheetHeight(p.xz + vec2(e, 0.0)) - sheetHeight(p.xz - vec2(e, 0.0));
  float hz = sheetHeight(p.xz + vec2(0.0, e)) - sheetHeight(p.xz - vec2(0.0, e));
  vNormal = normalize(vec3(-hx / (2.0 * e), 1.0, -hz / (2.0 * e)));
  vec4 world = modelMatrix * vec4(p, 1.0);
  vWorld = world.xyz;
  vec4 view = viewMatrix * world;
  vViewZ = -view.z;
  gl_Position = projectionMatrix * view;
}
`;

export const paperFragment = /* glsl */ `
precision highp float;
uniform sampler2D uHi;
uniform sampler2D uLo;
uniform sampler2D uFibre;
uniform vec2 uHiOrigin;   // world xz of the hi texture's top-left corner
uniform float uHiSize;    // world size of the hi texture
uniform float uLoSpan;
uniform vec3 uCamPos;
uniform vec3 uKeyDir;
uniform vec3 uKeyColour;
uniform vec3 uFillColour;
uniform vec2 uWindow;     // world xz the window light comes from
varying vec3 vWorld;
varying vec3 vNormal;
varying float vViewZ;

const float PI = 3.14159265;

void main() {
  vec2 st = (vWorld.xz - uHiOrigin) / uHiSize;        // hi texture, v down
  vec2 stLo = (st + 0.5 * (uLoSpan - 1.0)) / uLoSpan; // lo texture, v down
  vec3 hi = texture(uHi, vec2(st.x, 1.0 - st.y)).rgb;
  vec3 lo = texture(uLo, vec2(stLo.x, 1.0 - stLo.y)).rgb;
  vec2 edge = min(st, 1.0 - st);
  float wHi = smoothstep(0.0, 0.004, min(edge.x, edge.y));
  vec3 albedo = mix(lo, hi, wHi);

  // Paper fibre normal (tangent space: x = world x, y = world -z).
  vec3 fn = texture(uFibre, vWorld.xz * 2.2).xyz * 2.0 - 1.0;
  fn.xy *= 0.55;
  vec3 N = normalize(vNormal + vec3(fn.x, 0.0, -fn.y));

  vec3 V = normalize(uCamPos - vWorld);
  vec3 L = normalize(uKeyDir);
  vec3 H = normalize(L + V);
  float NdL = max(dot(N, L), 0.0);
  float NdV = max(dot(N, V), 1e-3);
  float NdH = max(dot(N, H), 0.0);

  // GGX, roughness 0.75 (soft sheen).
  float rough = 0.75;
  float a2 = pow(rough * rough, 2.0);
  float d = NdH * NdH * (a2 - 1.0) + 1.0;
  float D = a2 / (PI * d * d);
  float k = (rough + 1.0) * (rough + 1.0) / 8.0;
  float G = (NdL / (NdL * (1.0 - k) + k)) * (NdV / (NdV * (1.0 - k) + k));
  float F = 0.04 + 0.96 * pow(1.0 - max(dot(H, V), 0.0), 5.0);
  float spec = D * G * F / max(4.0 * NdL * NdV, 1e-3);
  // Cloth-like sheen at grazing angles.
  float sheen = pow(1.0 - NdV, 4.0) * 0.06;

  // Window light falls off across the page away from the window.
  float fall = 1.1 - 0.3 * smoothstep(3.0, 16.0, distance(vWorld.xz, uWindow));
  vec3 light = uKeyColour * NdL * fall + uFillColour * (0.6 + 0.4 * N.y);
  vec3 col = albedo * light + (uKeyColour * spec * NdL * 0.35 + sheen) * fall;
  gl_FragColor = vec4(col, vViewZ);
}
`;

export const postVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const postFragment = /* glsl */ `
precision highp float;
uniform sampler2D uColour;  // linear rgb + view depth in alpha, mipmapped
uniform vec2 uRes;          // render target size (px)
uniform float uFocus;       // in-focus view depth
uniform float uCocScale;    // coc = k * |z - zf| / z, fraction of frame height
uniform float uMaxCoc;
uniform float uFrame;       // frame % 450
uniform float uGrain;
varying vec2 vUv;

const int N = 64;
const float GOLDEN = 2.39996323;

// Fixed hash of (pixel, frame): deterministic, no Math.random.
float hash(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.x + p.y) * p.z);
}

vec3 toSrgb(vec3 c) {
  c = max(c, 0.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

void main() {
  vec4 c0 = textureLod(uColour, vUv, 0.0);
  float z = max(c0.a, 1e-3);
  // Paper nearer than the focus plane (bottom of frame) blurs more gently.
  float coc = min(uCocScale * abs(z - uFocus) / z * (z < uFocus ? 0.7 : 1.0), uMaxCoc);
  float r = coc * uRes.y; // radius in px
  vec3 col = c0.rgb;
  if (r > 0.35) {
    // Vogel-disk gather with a fixed sample pattern, rotated per pixel by a
    // fixed hash. Mip level matches the sample spacing so the disk is smooth.
    float spacing = r * 1.7725 / sqrt(float(N));
    float lod = clamp(log2(max(spacing, 1.0)), 0.0, 7.0);
    float rot = hash(vec3(gl_FragCoord.xy, 7.0)) * 6.2831853;
    vec3 acc = vec3(0.0);
    for (int i = 0; i < N; i++) {
      float fi = float(i) + 0.5;
      float rr = sqrt(fi / float(N)) * r;
      float th = fi * GOLDEN + rot;
      vec2 off = vec2(cos(th), sin(th)) * rr / uRes;
      acc += textureLod(uColour, vUv + off, lod).rgb;
    }
    col = mix(c0.rgb, acc / float(N), smoothstep(0.35, 1.2, r));
  }

  // Photographic haze: a little desaturation and lift, stronger towards the
  // window (top-left) where the page washes out.
  float hl = smoothstep(0.75, 0.0, length(vUv - vec2(0.0, 1.0)));
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col, vec3(lum), 0.1);
  col = mix(col, vec3(0.93, 0.95, 0.96), 0.04 + 0.35 * hl * hl);
  // Slight warm grade.
  col *= vec3(1.008, 1.0, 0.99);
  // Vignette.
  vec2 q = vUv - 0.5;
  q.x *= uRes.x / uRes.y;
  col *= 1.0 - 0.26 * smoothstep(0.35, 1.05, length(q));

  vec3 srgb = toSrgb(col);
  // Grain (fixed formula of pixel + frame), then ±1/255 triangular dither.
  float g = hash(vec3(gl_FragCoord.xy, uFrame + 1.0)) + hash(vec3(gl_FragCoord.yx + 17.0, uFrame + 3.0)) - 1.0;
  srgb += g * uGrain;
  float d = hash(vec3(gl_FragCoord.xy + 91.0, uFrame + 5.0)) - hash(vec3(gl_FragCoord.xy + 37.0, uFrame + 9.0));
  srgb += d / 255.0;
  gl_FragColor = vec4(srgb, 1.0);
}
`;
