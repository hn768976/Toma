import * as THREE from "three";

/**
 * Procedural, analytically anti-aliased HUD "data plane" written as a
 * WebGL 2 fragment shader. Everything is generated from plane coordinates
 * (units), so it stays razor sharp at 4K and never needs giant textures.
 *
 * Plane coordinates: x = text-row direction, y = column direction
 * (the bright main axis runs along y at x = 0).
 */

export type HudPalette = {
  bg: [number, number, number];
  bgFar: [number, number, number];
  ink: [number, number, number];
  hot: [number, number, number];
  accent: [number, number, number];
};

const VERT = /* glsl */ `
varying vec2 vP;
varying vec3 vWorld;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vP = vec2(wp.x, -wp.z);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const FRAG = /* glsl */ `
precision highp float;
uniform float uTime;
uniform vec3 uBg;
uniform vec3 uBgFar;
uniform vec3 uInk;
uniform vec3 uHot;
uniform vec3 uAccent;
uniform float uFogNear;
uniform float uFogFar;
uniform float uScale;
uniform vec4 uClear[4]; // plane-space rects (centre.xy, half-size.zw) kept free of block content
varying vec2 vP;
varying vec3 vWorld;

float h21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float h11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

// Integral of a pulse train (period P, on-width W starting at 0).
float pInt(float x, float P, float W) {
  float k = floor(x / P);
  return k * W + clamp(x - k * P, 0.0, W);
}
// Box-filtered pulse train over a footprint fw -> exact coverage, no aliasing.
float pulseAA(float x, float P, float W, float fw) {
  fw = max(fw, 1e-5);
  return (pInt(x + fw * 0.5, P, W) - pInt(x - fw * 0.5, P, W)) / fw;
}
// Box-filtered interval [a,b].
float boxAA(float x, float a, float b, float fw) {
  fw = max(fw, 1e-5);
  return clamp((min(x + fw * 0.5, b) - max(x - fw * 0.5, a)) / fw, 0.0, 1.0);
}
float lineAA(float x, float c, float w, float fw) {
  return boxAA(x, c - w * 0.5, c + w * 0.5, fw);
}

void main() {
  // uScale < 1 packs the data plane more densely without changing the hero overlays
  vec2 p = vP / uScale;
  vec2 fw = fwidth(p) * 1.15;
  float t = uTime;

  float ink = 0.0;     // cool white-blue elements
  float hot = 0.0;     // over-bright highlights (bloom)
  float acc = 0.0;     // amber accents
  float panel = 0.0;   // faint block backgrounds

  // ---------------- districts & blocks ----------------
  const vec2 DP = vec2(9.6, 7.2);
  vec2 did = floor(p / DP);
  vec2 dl = p - did * DP;
  vec2 bsz = vec2(mix(1.5, 3.0, h21(did + 3.1)), mix(0.85, 1.5, h21(did + 7.7)));
  vec2 nb = max(floor((DP - 0.2) / bsz), 1.0);
  bsz = (DP - 0.2) / nb;
  vec2 q = dl - 0.1;
  vec2 bid = floor(q / bsz);
  vec2 bl = q - bid * bsz;
  float inside = step(0.0, bid.x) * step(0.0, bid.y) * step(bid.x, nb.x - 1.0) * step(bid.y, nb.y - 1.0);
  vec2 gid = did * 37.0 + bid;
  float bt = h21(gid * 1.37 + 0.5);
  float bb = mix(0.4, 1.35, pow(h21(gid + 9.1), 0.8));
  float isLive = step(0.22, h21(gid + 2.2));
  float m = 0.045;
  vec2 c = bl - m;
  vec2 cs = bsz - 2.0 * m;
  float inC = boxAA(c.x, 0.0, cs.x, fw.x) * boxAA(c.y, 0.0, cs.y, fw.y) * inside;
  panel += inC * (0.35 + 0.65 * bb);

  float stepT = floor(t * mix(3.0, 9.0, h21(gid + 4.4)) + h21(gid) * 10.0);

  if (bt < 0.26) {
    // dot / dash matrix (LED-like, mostly lit, row-wise brightness)
    float Px = mix(0.13, 0.17, h21(gid + 1.9));
    float Pz = Px * mix(0.85, 1.05, h21(gid + 8.3));
    vec2 cell = floor(c / vec2(Px, Pz));
    float on = step(0.1, h21(cell + gid * 3.3 + isLive * stepT * 0.731));
    float rowB = mix(0.4, 1.0, h21(vec2(cell.y, gid.x * 1.7 + gid.y)));
    float colCut = step(cell.x, mix(5.0, 40.0, h21(vec2(cell.y, gid.y + 5.0))));
    float mf = smoothstep(0.3, 0.8, max(fw.x / Px, fw.y / Pz));
    on = mix(on * rowB * colCut, 0.5, mf);
    // round LED dots (analytic AA), fading to their average coverage when minified
    vec2 lc = (fract(c / vec2(Px, Pz)) - 0.5) * vec2(Px, Pz);
    float rad = min(Px, Pz) * mix(0.22, 0.3, h21(gid + 5.1));
    float aa = max(fw.x, fw.y) * 0.6;
    float dotc = 1.0 - smoothstep(rad - aa, rad + aa, length(lc));
    float g = mix(dotc, 3.14159 * rad * rad / (Px * Pz), mf) * boxAA(c.x, 0.0, cs.x, fw.x) * boxAA(c.y, 0.0, cs.y, fw.y);
    float v = g * on * inC * bb;
    float isAcc = step(0.993, h21(cell * 1.3 + gid)) * (1.0 - mf);
    ink += v * (1.0 - isAcc);
    hot += v * (1.0 - isAcc) * 0.25 * step(0.8, bb);
    acc += v * isAcc * 1.6;
  } else if (bt < 0.68) {
    // text-like rows
    float RP = 0.078;
    float row = floor(c.y / RP);
    float rowLen = cs.x * mix(0.35, 1.0, h21(vec2(row, gid.x + gid.y * 3.0 + isLive * floor(stepT * 0.25))));
    float WP = 0.26;
    float word = floor(c.x / WP);
    float wl = WP * mix(0.3, 0.9, h21(vec2(word, row) + gid * 1.1));
    float wOn = boxAA(c.x - word * WP, 0.0, wl, fw.x) * boxAA(c.x, 0.0, rowLen, fw.x);
    float chars = pulseAA(c.x, 0.03, 0.021, fw.x);
    float mf = smoothstep(0.4, 1.0, fw.x / 0.03);
    chars = mix(chars, 0.7, mf);
    float lineOn = pulseAA(c.y, RP, 0.026, fw.y) * boxAA(c.y, 0.0, cs.y, fw.y);
    // rows and individual words flicker on live blocks (data refreshing)
    float flick = mix(1.0, step(0.3, h21(vec2(row, stepT) + gid)) * step(0.22, h21(vec2(row * 7.0 + word, stepT) + gid * 1.3)), isLive);
    float v = wOn * chars * lineOn * inside * bb * mix(0.55, 1.0, h21(vec2(row, gid.y))) * flick;
    ink += v;
  } else if (bt < 0.86) {
    // horizontal bars (equaliser-like)
    float RP = 0.075;
    float row = floor(c.y / RP);
    float hv = h21(vec2(row, gid.x * 2.0 + gid.y));
    float L = cs.x * clamp(0.15 + 0.75 * hv + 0.08 * sin(t * (1.5 + 3.0 * hv) + row) * isLive, 0.05, 1.0);
    float v = boxAA(c.x, 0.0, L, fw.x) * pulseAA(c.y, RP, 0.022, fw.y) * boxAA(c.y, 0.0, cs.y, fw.y) * inside;
    float isAcc = step(0.975, h21(gid + 17.0));
    ink += v * bb * 0.7 * (1.0 - isAcc);
    acc += v * isAcc * 1.4;
  } else if (bt < 0.91) {
    // a few chunky bright tabs
    float RP = 0.22;
    float row = floor(c.y / RP);
    float hv = h21(vec2(row, gid.y + 11.0));
    float x0 = cs.x * hv * 0.5;
    float L = cs.x * mix(0.12, 0.35, h21(vec2(row, gid.x)));
    float v = boxAA(c.x, x0, x0 + L, fw.x) * pulseAA(c.y, RP, 0.07, fw.y) * boxAA(c.y, 0.0, cs.y, fw.y) * inside;
    v *= step(0.35, hv);
    float isAcc = step(0.93, h21(vec2(row, gid.x) + 3.0));
    ink += v * 0.8 * (1.0 - isAcc) * bb;
    hot += v * 0.1 * (1.0 - isAcc) * bb;
    acc += v * isAcc * 1.8;
  } else {
    // outlined frame + two text lines
    float o = boxAA(c.x, 0.0, cs.x, fw.x) * boxAA(c.y, 0.0, cs.y, fw.y);
    float ii = boxAA(c.x, 0.012, cs.x - 0.012, fw.x) * boxAA(c.y, 0.012, cs.y - 0.012, fw.y);
    float frame = (o - ii) * inside;
    float tl = pulseAA(c.x, 0.03, 0.02, fw.x) * boxAA(c.x, 0.08, cs.x * 0.6, fw.x) *
               (lineAA(c.y, cs.y * 0.7, 0.03, fw.y) + lineAA(c.y, cs.y * 0.55, 0.03, fw.y)) * inside;
    ink += (frame * 0.5 + tl * 0.7) * bb;
  }

  // keep a little breathing room around the hero overlays
  float clear = 1.0;
  for (int i = 0; i < 4; i++) {
    vec2 dd = abs(vP - uClear[i].xy) - uClear[i].zw;
    clear *= smoothstep(-0.12, 0.08, max(dd.x, dd.y));
  }
  ink *= clear;
  hot *= clear;
  acc *= clear;
  panel *= clear;

  // ---------------- district lines ----------------
  float lx = lineAA(dl.x, 0.0, 0.016, fw.x) + lineAA(dl.x, DP.x, 0.016, fw.x);
  float ly = lineAA(dl.y, 0.0, 0.012, fw.y) + lineAA(dl.y, DP.y, 0.012, fw.y);
  float dash = mix(pulseAA(p.y, 0.5, 0.42, fw.y), 0.84, smoothstep(0.3, 1.0, fw.y / 0.5));
  ink += lx * 0.55 * dash + ly * 0.3;
  // light pulses streaming along every district line (data traffic)
  {
    float lane = did.x * 7.13 + did.y * 3.71;
    float sp = mix(2.5, 6.0, h21(did + 11.0));
    float py = mod(p.y + t * sp + h21(did) * 40.0, 9.0) - 4.5;
    float px = mod(p.x - t * sp * 0.8 + h21(did + 5.0) * 40.0, 11.0) - 5.5;
    hot += lx * exp(-py * py / 0.18) * 1.6 * step(0.35, h21(vec2(lane, 1.0)));
    hot += ly * exp(-px * px / 0.2) * 1.2 * step(0.45, h21(vec2(lane, 2.0)));
  }

  // ---------------- hero axis lines (x = 0 and y = 0) ----------------
  float ax = lineAA(p.x, 0.0, 0.016 / uScale, fw.x);
  float ay = lineAA(p.y, 0.0, 0.012 / uScale, fw.y);
  float gx = exp(-abs(p.x) / 0.07);
  float gy = exp(-abs(p.y) / 0.06);
  hot += ax * 0.55 + ay * 0.05;
  ink += gx * 0.16 + gy * 0.03;
  // parallel thin rails beside the main axis
  ink += (lineAA(p.x, 0.12, 0.008, fw.x) + lineAA(p.x, -0.12, 0.008, fw.x)) * 0.45;
  // data pulses travelling along the axes
  for (int k = 0; k < 4; k++) {
    float fk = float(k);
    float sp = 2.2 + fk * 0.7;
    float pos = mod(t * sp + fk * 9.7, 36.0) - 18.0;
    float g = exp(-pow((p.y - pos) / 0.55, 2.0));
    hot += (ax * 2.5 + gx * 0.6) * g;
    float pos2 = mod(t * (sp * 0.8) + fk * 13.1, 32.0) - 16.0;
    float g2 = exp(-pow((p.x - pos2) / 0.5, 2.0));
    hot += (ay * 2.0 + gy * 0.4) * g2;
  }
  // crosshair glow at the origin
  float r0 = length(p);
  hot += exp(-r0 / 0.07) * 0.7 + exp(-r0 / 0.4) * 0.08;

  // ---------------- compose ----------------
  // per-fragment distance (a varying would be wrong on the huge floor quad)
  float fog = smoothstep(uFogNear, uFogFar, distance(cameraPosition, vWorld));
  vec3 col = mix(uBg, uBgFar, fog);
  col += uInk * panel * 0.003;
  col += uInk * ink;
  col += uHot * hot;
  col += uAccent * acc;
  col = mix(col, uBgFar, fog * 0.92);
  gl_FragColor = vec4(col, 1.0);
}`;

export const createHudMaterial = (
  pal: HudPalette,
  fogNear: number,
  fogFar: number,
  scale = 1,
  clearZones: [number, number, number, number][] = [],
) =>
  new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uTime: { value: 0 },
      uBg: { value: new THREE.Vector3(...pal.bg) },
      uBgFar: { value: new THREE.Vector3(...pal.bgFar) },
      uInk: { value: new THREE.Vector3(...pal.ink) },
      uHot: { value: new THREE.Vector3(...pal.hot) },
      uAccent: { value: new THREE.Vector3(...pal.accent) },
      uFogNear: { value: fogNear },
      uFogFar: { value: fogFar },
      uScale: { value: scale },
      uClear: {
        value: [0, 1, 2, 3].map((i) =>
          clearZones[i] ? new THREE.Vector4(...clearZones[i]) : new THREE.Vector4(999, 999, 0, 0),
        ),
      },
    },
  });
