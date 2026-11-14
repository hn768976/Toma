/** GLSL for the vessel wall, the red blood cells and the baked tissue map. */

export const FULLSCREEN_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/**
 * Tileable height map of the tissue: big domain-warped folds, stretched
 * fibrous ridges and a fine grain. Baked once into a float texture.
 * R = height, G = fibre mask.
 */
export const TISSUE_BAKE_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

// Gradient noise that repeats every 'per' lattice cells.
float pnoise(vec2 p, vec2 per) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  vec2 a = mod(i, per);
  vec2 b = mod(i + vec2(1.0, 0.0), per);
  vec2 c = mod(i + vec2(0.0, 1.0), per);
  vec2 d = mod(i + vec2(1.0, 1.0), per);
  return mix(
    mix(dot(hash2(a), f), dot(hash2(b), f - vec2(1.0, 0.0)), u.x),
    mix(dot(hash2(c), f - vec2(0.0, 1.0)), dot(hash2(d), f - vec2(1.0, 1.0)), u.x),
    u.y);
}

float fbm(vec2 p, vec2 per) {
  float a = 0.5;
  float s = 0.0;
  for (int i = 0; i < 5; i++) {
    s += a * pnoise(p, per);
    p *= 2.0;
    per *= 2.0;
    a *= 0.5;
  }
  return s;
}

float ridged(vec2 p, vec2 per) {
  float a = 0.5;
  float s = 0.0;
  for (int i = 0; i < 5; i++) {
    float n = 1.0 - abs(pnoise(p, per)) * 2.0;
    s += a * n * n;
    p *= 2.0;
    per *= 2.0;
    a *= 0.5;
  }
  return s;
}

void main() {
  vec2 sh = vUv;

  // large, soft, lumpy folds
  vec2 perA = vec2(5.0, 5.0);
  vec2 qa = sh * perA;
  vec2 w = vec2(fbm(qa + vec2(3.1, 1.7), perA), fbm(qa + vec2(17.7, 9.2), perA));
  float folds = fbm(qa + 0.7 * w, perA);

  vec2 perB = vec2(16.0, 16.0);
  vec2 qb = sh * perB;
  float fibres = ridged(qb + 1.2 * w, perB);

  vec2 perC = vec2(64.0, 64.0);
  float grain = fbm(sh * perC + 4.0 * w, perC);

  float h = 0.5 + 1.05 * folds + 0.035 * (fibres - 0.45) + 0.04 * grain;
  gl_FragColor = vec4(h, fibres, grain * 0.5 + 0.5, 1.0);
}
`;

export const WALL_VERT = /* glsl */ `
attribute vec3 aTanU;
attribute vec3 aTanV;
varying vec3 vWorld;
varying vec3 vN;
varying vec3 vTu;
varying vec3 vTv;
varying vec2 vUv;
varying float vViewZ;
void main() {
  vUv = uv;
  vN = normal;
  vTu = aTanU;
  vTv = aTanV;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vec4 vp = viewMatrix * wp;
  vViewZ = -vp.z;
  gl_Position = projectionMatrix * vp;
}
`;

export const WALL_FRAG = /* glsl */ `
precision highp float;
varying vec3 vWorld;
varying vec3 vN;
varying vec3 vTu;
varying vec3 vTv;
varying vec2 vUv;
varying float vViewZ;

uniform sampler2D tTissue;
uniform vec2 uNearFar;     // camera near / far
uniform float uHazeDepth;  // distance the fully glowing wall is pushed back to
uniform vec2 uTexel;       // one texel of the tissue map
uniform vec2 uWorldPerUv;  // world length of one full u / v period
uniform float uBump;
uniform vec3 uLightPos;
uniform vec3 uColLow;
uniform vec3 uColHigh;
uniform vec3 uSpecCol;
uniform vec3 uKeyCol;
uniform vec3 uHeadCol;
uniform vec3 uAmbient;
uniform vec3 uGlowCol;
uniform float uGlow0;
uniform float uGlow1;

void main() {
  vec4 t0 = texture2D(tTissue, vUv);
  float h = t0.r;
  vec2 e = uTexel * 6.0;
  float hb = textureLod(tTissue, vUv, 3.0).r;
  float hu = textureLod(tTissue, vUv + vec2(e.x, 0.0), 3.0).r - hb;
  float hv = textureLod(tTissue, vUv + vec2(0.0, e.y), 3.0).r - hb;
  vec2 grad = vec2(hu / (e.x * uWorldPerUv.x), hv / (e.y * uWorldPerUv.y));
  vec3 N0 = normalize(vN);
  vec3 N = normalize(N0 - uBump * (grad.x * normalize(vTu) + grad.y * normalize(vTv)));

  vec3 toCam = cameraPosition - vWorld;
  float d = length(toCam);
  vec3 V = toCam / d;

  vec3 toL = uLightPos - vWorld;
  float dl = length(toL);
  vec3 L = toL / dl;
  float att = 1.0 / (1.0 + dl * dl * 0.014);
  float diff = max(dot(N, L), 0.0);
  vec3 Hh = normalize(L + V);
  float ndh = max(dot(N, Hh), 0.0);
  float spec = pow(ndh, 14.0) * 0.16 + pow(ndh, 4.0) * 0.1;
  // sheen from the travelling light, strongest on ridges facing the lens
  spec += pow(max(dot(N, V), 0.0), 5.0) * 0.07 / (1.0 + d * d * 0.03) / max(att, 0.05);

  float head = (0.25 + 0.75 * max(dot(N, V), 0.0)) / (1.0 + d * d * 0.03);
  float cav = 0.06 + 0.86 * smoothstep(0.08, 0.92, h); // creases are darker
  vec3 albedo = mix(uColLow, uColHigh, cav);
  vec3 col = albedo * (uAmbient * 8.0 + uKeyCol * diff * att * 1.7 + uHeadCol * head * 0.86);
  col += uSpecCol * spec * att * (0.4 + 0.6 * cav) * 0.85;
  col += uAmbient * (0.4 + 0.6 * cav);
  // broad patches of shadow where the folds turn away from the light
  float shadow = textureLod(tTissue, vUv + vec2(0.37, 0.11), 4.6).r;
  col *= mix(0.3, 1.0, smoothstep(0.36, 0.64, shadow));

  // The far end of the vessel is flooded with light.
  float g = smoothstep(uGlow0, uGlow1, d);
  vec3 glow = uGlowCol * (0.6 + 0.5 * smoothstep(0.1, 0.95, textureLod(tTissue, vUv, 1.8).r));
  float gw = g * g * (3.0 - 2.0 * g);
  col = mix(col, glow, gw);
  gl_FragColor = vec4(col, 1.0);

  // Where the wall has dissolved into the glow it is luminous haze, not a
  // hard surface: push its depth back so cells that are behind a bend still
  // show through the glow instead of being cut off by an edge nobody can see.
  float push = smoothstep(0.8, 0.995, gw);
  float zv = vViewZ * mix(1.0, max(uHazeDepth / d, 1.0), push);
  float ndcZ = (uNearFar.y + uNearFar.x) / (uNearFar.y - uNearFar.x)
             - (2.0 * uNearFar.y * uNearFar.x) / ((uNearFar.y - uNearFar.x) * zv);
  gl_FragDepth = 0.5 * ndcZ + 0.5;
}
`;

export const CELL_VERT = /* glsl */ `
attribute float aShade;
varying vec3 vWorld;
varying vec3 vN;
varying vec3 vObj;
varying float vShade;
void main() {
  vObj = position;
  vShade = aShade;
  mat4 m = modelMatrix * instanceMatrix;
  vec4 wp = m * vec4(position, 1.0);
  vWorld = wp.xyz;
  vN = normalize(mat3(m) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const CELL_FRAG = /* glsl */ `
precision highp float;
varying vec3 vWorld;
varying vec3 vN;
varying vec3 vObj;
varying float vShade;

uniform sampler2D tTissue;
uniform vec3 uLightPos;
uniform vec3 uCellCol;
uniform vec3 uCellFar;
uniform vec3 uGlowCol;
uniform vec3 uKeyCol;
uniform float uGlow0;
uniform float uGlow1;

void main() {
  vec3 N = normalize(vN);
  vec3 toCam = cameraPosition - vWorld;
  float d = length(toCam);
  vec3 V = toCam / d;
  float ndv = max(dot(N, V), 0.0);

  // Soft mottling of the membrane.
  float mott = texture2D(tTissue, vObj.xz * 0.37 + vShade * 7.0).b;
  float m = 0.7 + 0.6 * mott;

  vec3 toL = uLightPos - vWorld;
  float dl = length(toL);
  vec3 L = toL / dl;
  float att = 1.0 / (1.0 + dl * dl * 0.012);
  float wrapL = clamp(dot(N, L) * 0.5 + 0.5, 0.0, 1.0);

  // Front-lit, slightly translucent body: the thin dimple in the middle of
  // the disc lets light through and glows, the thick rim stays darker.
  float core = pow(ndv, 1.3);
  float rObj = length(vObj.xz);
  float dimple = 1.0 - smoothstep(0.15, 0.85, rObj);
  float headAtt = 1.0 / (1.0 + d * d * 0.012);
  float lit = 0.1 + 0.36 * core * (0.5 + 0.5 * headAtt);
  // rougher, darker rim
  float rim = smoothstep(0.55, 1.0, rObj);
  vec3 col = uCellCol * lit * mix(m, m * m * 0.8, rim) * (0.8 + 0.4 * vShade);
  // light shining through the thin centre
  col += mix(uCellCol, uCellFar, 0.22) * pow(dimple, 1.4) * (0.3 + 0.7 * core) * 0.85;
  col += uCellCol * uKeyCol * wrapL * wrapL * att * 0.5;
  col += uKeyCol * pow(1.0 - ndv, 4.0) * wrapL * att * 0.06;

  // distant cells dissolve into the glow at the end of the vessel
  float g = smoothstep(uGlow0 * 1.5, uGlow1 * 2.6, d);
  col = mix(col, uCellFar * (0.72 + 0.35 * core), g * 0.9);
  // ...and the farthest ones vanish in it completely, so the far end of the
  // vessel is an even glow rather than a wall of pale cells
  col = mix(col, uGlowCol * 0.85, smoothstep(19.0, 34.0, d));
  gl_FragColor = vec4(col, 1.0);
}
`;
