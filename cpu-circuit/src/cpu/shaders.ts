// GLSL for the CPU close-up (Three.js ShaderMaterials, WebGL 2).

export const BOARD_VERT = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

// Dark solder-mask board with a faint weave and light pooling from the
// glowing contacts along the package edge.
export const BOARD_FRAG = /* glsl */ `
uniform vec3 uBase;
uniform vec3 uGlowA;
uniform vec3 uGlowB;
uniform float uPower;
uniform float uPkg;
varying vec3 vWorld;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1, 0)), u.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), u.x), u.y);
}
void main() {
  vec2 p = vWorld.xz;
  float n = vnoise(p * 3.0) * 0.5 + vnoise(p * 11.0) * 0.3 + vnoise(p * 37.0) * 0.2;
  vec3 col = uBase * (0.75 + 0.5 * n);
  // Soft sheen from a key light behind the scene.
  vec3 V = normalize(cameraPosition - vWorld);
  float sheen = pow(1.0 - max(V.y, 0.0), 3.0);
  col += vec3(0.05, 0.07, 0.09) * sheen;
  // Light spill from the lit contacts next to the package edge.
  vec2 out2 = max(vec2(max(-uPkg - p.x, p.x), max(-uPkg - p.y, p.y)), 0.0);
  float dist = length(out2);
  float edge = exp(-max(dist - 0.3, 0.0) * 1.6) * step(0.001, dist);
  col += mix(uGlowA, uGlowB, vnoise(p * 1.7)) * edge * 0.14 * uPower;
  gl_FragColor = vec4(col, 1.0);
}
`;

export const TRACE_VERT = /* glsl */ `
attribute float across;
varying float vAcross;
varying vec3 vWorld;
void main() {
  vAcross = across;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

// Thin metallic copper-under-mask traces, analytically anti-aliased.
export const TRACE_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uHalfW;
uniform float uWake;
varying float vAcross;
varying vec3 vWorld;
void main() {
  float d = abs(vAcross);
  float px = max(fwidth(vAcross), 1e-6);
  float a = clamp((uHalfW - d) / px + 0.5, 0.0, 1.0);
  a *= clamp(2.0 * uHalfW / px, 0.15, 1.0);
  vec3 V = normalize(cameraPosition - vWorld);
  float glint = 0.6 + 0.8 * pow(1.0 - max(V.y, 0.0), 2.0);
  if (a < 0.003) discard;
  gl_FragColor = vec4(uColor * glint * uWake, a);
}
`;

export const PAD_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
varying float vRand;
void main() {
  vUv = uv;
  vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vRand = fract(sin(dot(w.xz, vec2(12.9898, 78.233))) * 43758.5453);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

// Gold LGA lands: rounded diamonds with a brushed, slightly uneven sheen.
export const PAD_FRAG = /* glsl */ `
uniform vec3 uGold;
uniform vec3 uGoldHi;
varying vec2 vUv;
varying vec3 vWorld;
varying float vRand;
void main() {
  vec2 q = abs(vUv - 0.5) * 2.0;
  float d = (q.x + q.y) * 0.5 - 0.46;          // diamond SDF in uv units
  float px = fwidth(d);
  float a = 1.0 - smoothstep(-px, px, d);
  if (a < 0.003) discard;
  vec3 V = normalize(cameraPosition - vWorld);
  float sheen = pow(1.0 - max(V.y, 0.0), 2.0);
  float dome = 1.0 - smoothstep(-0.42, 0.0, d) * 0.35;
  vec3 col = mix(uGold, uGoldHi, sheen * 0.7 + vRand * 0.25) * dome * (0.85 + 0.3 * vRand);
  gl_FragColor = vec4(col, a);
}
`;

export const PKG_VERT = /* glsl */ `
varying vec3 vNormalW;
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

// Package substrate: near-black green top, greener fibre-glass sides with a
// bright glint on the edges.
export const PKG_FRAG = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uSide;
uniform sampler2D uLabel;
uniform float uSize;
varying vec3 vNormalW;
varying vec3 vWorld;
void main() {
  vec3 col;
  if (vNormalW.y > 0.5) {
    col = uTop;
    vec2 luv = (vWorld.xz + uSize) / uSize;    // 0..1 across the package
    vec4 lab = texture2D(uLabel, vec2(luv.x, luv.y));
    col = mix(col, vec3(0.75, 0.78, 0.72), lab.r);
    col = mix(col, vec3(0.55, 0.38, 0.14), lab.g);
  } else {
    vec3 V = normalize(cameraPosition - vWorld);
    float glint = pow(1.0 - abs(dot(V, vNormalW)), 2.0);
    col = uSide * (0.6 + 0.9 * glint);
    float topLip = smoothstep(0.17, 0.215, vWorld.y);
    col += vec3(0.08, 0.2, 0.12) * topLip;
  }
  gl_FragColor = vec4(col, 1.0);
}
`;

export const PARTICLE_VERT = /* glsl */ `
attribute vec3 color;
attribute float size;
attribute float intensity;
uniform float uFocalPx;     // focal length in pixels
uniform float uFocus;       // focus distance
uniform float uAperture;    // CoC scale in pixels
uniform float uMaxCoc;
varying vec3 vColor;
varying float vGain;
varying float vSoft;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float z = -mv.z;
  float core = size * uFocalPx / max(z, 0.01);
  float coc = min(uAperture * abs(z - uFocus) / max(z, 0.01), uMaxCoc);
  float diam = max(core, 1.5) + coc;
  gl_PointSize = diam;
  // Spread the same energy over the blur disc (a bit generous so out-of-focus
  // lights still read as bright bokeh, like a real lens).
  vGain = intensity * pow(max(core, 1.5) / diam, 1.25);
  vSoft = clamp(1.6 / diam, 0.02, 0.6);
  vColor = color;
  gl_Position = projectionMatrix * mv;
}
`;

export const PARTICLE_FRAG = /* glsl */ `
varying vec3 vColor;
varying float vGain;
varying float vSoft;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r = length(c);
  float disc = 1.0 - smoothstep(1.0 - vSoft, 1.0, r);
  if (disc <= 0.0) discard;
  // Slightly brighter rim and a hot centre: lens bokeh character.
  float rim = smoothstep(0.55, 0.95, r) * 0.35;
  float hot = exp(-r * r * 6.0) * 0.5;
  gl_FragColor = vec4(vColor * vGain * disc * (0.75 + rim + hot), 1.0);
}
`;

export const QUAD_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// Depth-of-field from the depth buffer: per-pixel circle of confusion, a few
// rotated taps into a pre-filtered mip level.
export const DOF_FRAG = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 uRes;
uniform float uNear;
uniform float uFar;
uniform float uFocus;
uniform float uAperture;
uniform float uMaxCoc;
varying vec2 vUv;
float linearDepth(float d) {
  float zn = d * 2.0 - 1.0;
  return 2.0 * uNear * uFar / (uFar + uNear - zn * (uFar - uNear));
}
float cocAt(vec2 uv) {
  float z = linearDepth(texture2D(tDepth, uv).r);
  return min(uAperture * abs(z - uFocus) / max(z, 0.01), uMaxCoc);
}
void main() {
  float coc = cocAt(vUv);
  if (coc < 1.0) {
    gl_FragColor = vec4(texture2D(tColor, vUv).rgb, 1.0);
    return;
  }
  float lod = max(0.0, log2(coc / 2.0));
  float jit = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) * 6.2831;
  vec3 col = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    float th = jit + float(i) * 1.5708;
    vec2 o = vec2(cos(th), sin(th)) * coc * 0.5;
    col += textureLod(tColor, vUv + o / uRes, lod).rgb;
  }
  gl_FragColor = vec4(col * 0.25, 1.0);
}
`;

// Final: camera motion blur, bloom, vignette, grade, grain.
export const FINAL_FRAG = /* glsl */ `
uniform sampler2D tColor;
uniform vec2 uRes;
uniform vec2 uMotion;     // screen-space motion this frame, in pixels
uniform float uFrame;
uniform vec3 uLift;
uniform vec3 uGain;
uniform float uBloom;
varying vec2 vUv;
float hash(vec2 p) {
  p = fract(p * vec2(443.897, 441.423));
  p += dot(p, p.yx + 19.19);
  return fract((p.x + p.y) * p.x);
}
void main() {
  float m = length(uMotion);
  vec3 col;
  if (m > 6.0) {
    float lod = max(0.0, log2(m / 12.0));
    col = vec3(0.0);
    for (int i = 0; i < 6; i++) {
      float k = (float(i) + 0.5) / 6.0 - 0.5;
      col += textureLod(tColor, vUv + uMotion * k / uRes, lod).rgb;
    }
    col /= 6.0;
  } else {
    col = texture2D(tColor, vUv).rgb;
  }
  vec3 b = textureLod(tColor, vUv, 4.0).rgb * 0.5 + textureLod(tColor, vUv, 6.0).rgb * 0.5;
  col += b * uBloom;
  // Filmic shoulder so the brightest lights roll off instead of clipping.
  col = col / (1.0 + col * 0.35);
  col = uLift + col * uGain;
  vec2 q = vUv - 0.5;
  col *= 1.0 - 0.55 * smoothstep(0.25, 0.85, length(q * vec2(1.25, 1.0)));
  col += (hash(gl_FragCoord.xy + uFrame * 13.0) - 0.5) * 0.02;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
