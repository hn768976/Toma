import React, { useMemo } from "react";
import * as THREE from "three";
import { HASH, frag } from "../lib/glsl";
import { Post } from "../lib/post";
import { mulberry32, pick, range } from "../lib/random";
import { Stage, useAsset, useDrive } from "../lib/Stage";
import { ATLAS_GRID, BADGE_CELLS, CHART_CELLS, ICON_CELLS, TEXT_CELLS, TOWER_CELLS, fountainAtlas } from "./fountainAtlas";

/**
 * Look 1 — Data Fountain. A cloud of ~800 code-drawn icons / text blocks /
 * mini charts (+ 1600 dots) hangs over a glowing four-ring platform; a
 * fountain of 600 ribbon lines and 30k streaming points rises from its
 * centre into the cloud. Everything is a function of the frame:
 *   points:  s = fract(u0 + k·f/600), k ∈ {1,2,3} → whole cycles per loop
 *   rings:   angle = ±2π·n·f/600
 *   cloud:   drift/twinkle with integer frequencies on θ = 2π·f/600
 * Story mode adds a timeline (cloud → tilt down + rings light → fire → hold).
 */
export type FountainParams = {
  mode: "story" | "loop";
  bg: string;
  cyan: string;
  blue: string;
  icon: string;
  red: string;
  accentBlue: string;
};

const LOOP = 600;
const N_LINES = 600;
const SEG = 40;
const N_POINTS = 30000;
const N_SPRITES = 800;
const N_DOTS = 700;
const FOV = 36;

// ---------------------------------------------------------------- layout
type LineDef = { phi: number; R: number; H: number; p: number; twist: number; zs: number; phase: number; bright: number; delay: number };
const LINES: LineDef[] = (() => {
  const rng = mulberry32(0xf0a7);
  const out: LineDef[] = [];
  for (let i = 0; i < N_LINES; i++) {
    const wide = rng();
    out.push({
      phi: rng() * Math.PI * 2,
      R: 3.0 + Math.pow(wide, 0.7) * 14.0,
      H: range(rng, 3.2, 7.0),
      p: range(rng, 1.6, 2.4),
      twist: range(rng, -0.5, 0.5),
      zs: range(rng, 0.6, 1.0),
      phase: rng(),
      bright: range(rng, 0.25, 1.0) / (1.0 + Math.pow(wide, 0.7) * 1.6),
      delay: range(rng, 0, 26),
    });
  }
  return out;
})();

const PATH_GLSL = /* glsl */ `
// a = (phi0, R, H, p), b = (twist, zScale, phase, bright)
vec3 fountainPath(vec4 a, vec4 b, float s) {
  float r = a.y * pow(s, a.w);
  float phi = a.x + b.x * s;
  float y = a.z * (1.0 - pow(1.0 - s, 1.6)) - 0.18 * a.y * s * s * s;
  return vec3(r * cos(phi), y, r * sin(phi) * b.y);
}
`;

const COMMON_UNI = /* glsl */ `
uniform float uTheta;   // 2π·f/600
uniform float uLoopT;   // f/600
uniform float uFire;    // frames since the fountain fired (story) / large (loop)
uniform float uPx;      // output px per 720p px
uniform vec2 uRes;
uniform float uMirror;  // 1 normal, -1 floor reflection
uniform float uGain;
`;

// ---------------------------------------------------------------- lines
const LINE_VERT = /* glsl */ `
${COMMON_UNI}
${PATH_GLSL}
in vec2 corner;            // x: t∈{0,1}, y: side∈{-1,1}
in vec4 aA;
in vec4 aB;
in vec3 aSeg;              // s0, s1, delay
out float vS;
out float vSide;
out float vGrow;
out float vBright;
out float vPhase;
void main() {
  float grow = clamp((uFire - aSeg.z) / 42.0, 0.0, 1.0);
  grow = 1.0 - (1.0 - grow) * (1.0 - grow);
  vGrow = grow;
  float s0 = aSeg.x, s1 = aSeg.y;
  vec3 P0 = fountainPath(aA, aB, s0);
  vec3 P1 = fountainPath(aA, aB, s1);
  P0.y *= uMirror; P1.y *= uMirror;
  mat4 pv = projectionMatrix * viewMatrix;
  vec4 c0 = pv * vec4(P0, 1.0);
  vec4 c1 = pv * vec4(P1, 1.0);
  vec2 n0 = c0.xy / c0.w;
  vec2 n1 = c1.xy / c1.w;
  vec2 d = (n1 - n0) * uRes;
  d = length(d) > 1e-5 ? normalize(d) : vec2(0.0, 1.0);
  vec2 perp = vec2(-d.y, d.x);
  float t = corner.x;
  float s = mix(s0, s1, t);
  float widthPx = (0.55 + 0.6 * (1.0 - smoothstep(0.0, 0.15, s))) * uPx + 1.0;
  vec4 c = mix(c0, c1, t);
  c.xy += perp * corner.y * widthPx / uRes * 2.0 * c.w;
  gl_Position = c;
  vS = s;
  vSide = corner.y * widthPx / max(widthPx - 1.0, 0.5);
  vBright = aB.w;
  vPhase = aB.z;
}
`;

const LINE_FRAG = /* glsl */ `
${COMMON_UNI}
uniform vec3 uCyan;
uniform vec3 uBlue;
in float vS;
in float vSide;
in float vGrow;
in float vBright;
in float vPhase;
void main() {
  float vis = 1.0 - smoothstep(vGrow - 0.03, vGrow, vS);
  if (vGrow <= 0.0) vis = 0.0;
  float edge = 1.0 - smoothstep(0.55, 1.0, abs(vSide));
  float fadeTop = 1.0 - smoothstep(0.35, 0.98, vS);
  float stream = 0.45 + 0.55 * pow(0.5 + 0.5 * sin(6.2831853 * (vS * 5.0 - uLoopT * 3.0 + vPhase)), 2.0);
  vec3 col = mix(uCyan * 1.1, uBlue * 0.55, smoothstep(0.05, 0.5, vS));
  float a = vis * edge * fadeTop * stream * vBright * (0.35 + 0.65 * smoothstep(0.0, 0.25, vS));
  if (uMirror < 0.0) a *= 0.07 * exp(-vS * 9.0);
  gl_FragColor = vec4(col * a * 0.7 * uGain, 1.0);
}
`;

// ---------------------------------------------------------------- points
const POINT_VERT = /* glsl */ `
${COMMON_UNI}
${PATH_GLSL}
in vec4 aA;
in vec4 aB;
in vec4 aP;   // u0, k (cycles/loop), jitter angle, jitter amount
in vec2 aQ;   // size, delay
out float vA;
out float vS;
void main() {
  float s = fract(aP.x + aP.y * uLoopT);
  float grow = clamp((uFire - aQ.y) / 42.0, 0.0, 1.0);
  grow = 1.0 - (1.0 - grow) * (1.0 - grow);
  vec3 P = fountainPath(aA, aB, s);
  float rr = aA.y * pow(s, aA.w);
  P += vec3(cos(aP.z), 0.35 * sin(aP.z * 3.1), sin(aP.z)) * aP.w * (0.04 + 0.12 * rr);
  P.y *= uMirror;
  vec4 mv = viewMatrix * vec4(P, 1.0);
  gl_Position = projectionMatrix * mv;
  float dist = -mv.z;
  gl_PointSize = max(aQ.x * uPx * clamp(15.0 / dist, 0.5, 2.0), 1.0);
  float vis = (grow > 0.0 ? 1.0 - smoothstep(grow - 0.03, grow, s) : 0.0);
  float fade = smoothstep(0.0, 0.05, s) * (1.0 - smoothstep(0.55, 1.0, s));
  vA = vis * fade * aB.w;
  if (uMirror < 0.0) vA *= 0.06 * exp(-s * 9.0);
  vS = s;
}
`;

const POINT_FRAG = /* glsl */ `
${COMMON_UNI}
uniform vec3 uCyan;
uniform vec3 uBlue;
in float vA;
in float vS;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float a = exp(-dot(d, d) * 14.0);
  vec3 col = mix(uCyan * 1.2, uBlue * 1.0, smoothstep(0.05, 0.7, vS));
  gl_FragColor = vec4(col * a * vA * uGain, 1.0);
}
`;

// ---------------------------------------------------------------- cloud sprites
const SPRITE_VERT = /* glsl */ `
${COMMON_UNI}
uniform float uFocus;
uniform float uCocPx;
uniform float uProj;      // px per world unit at distance 1
uniform float uHitY;      // fountain front height (story) — elements below it brighten
uniform float uHitAmt;
in vec2 corner;
in vec3 aPos;
in vec4 aInfo;   // size, cell, tint idx, base brightness
in vec4 aAnim;   // k1, k2, k3 (integers), phase
out vec2 vUv;
out float vCocUv;
out float vCell;
out vec3 vTint;
out float vBright;
uniform vec3 uTints[3];
void main() {
  float th = uTheta;
  float ph = aAnim.w * 6.2831853;
  vec3 wp = aPos + vec3(sin(aAnim.x * th + ph) * 0.22, sin(aAnim.y * th + ph * 1.7) * 0.12, cos(aAnim.x * th + ph) * 0.1);
  vec4 mv = viewMatrix * vec4(wp, 1.0);
  float dist = max(-mv.z, 0.5);
  float near = max(1.0 - dist / uFocus, 0.0);
  float far = max(1.0 - uFocus / dist, 0.0);
  float cocPx = uCocPx * (near * 1.4 + far * 0.7) + 0.6 * uPx;
  float sizePx = aInfo.x * uProj / dist;
  float margin = 1.0 + min(2.0 * cocPx / max(sizePx, 1.0), 3.0);
  mv.xy += corner * aInfo.x * margin;
  gl_Position = projectionMatrix * mv;
  vUv = 0.5 + corner * margin;
  vCocUv = cocPx / max(sizePx, 1.0);
  vCell = aInfo.y;
  int ti = int(aInfo.z);
  vTint = uTints[ti];
  float tw = 0.62 + 0.38 * sin(aAnim.z * th + ph * 2.3);
  float r = length(wp.xz);
  float cone = 2.0 + 0.9 * max(wp.y - 1.0, 0.0);
  float hit = uHitAmt * smoothstep(uHitY, uHitY - 2.0, wp.y) * exp(-pow(r / cone, 2.0));
  float fog = exp(-max(dist - 22.0, 0.0) / 30.0);
  vBright = aInfo.w * tw * (1.0 + 1.6 * hit) * fog / (1.0 + 0.6 * vCocUv);
}
`;

const SPRITE_FRAG = /* glsl */ `
${COMMON_UNI}
uniform sampler2D uAtlas;
in vec2 vUv;
in float vCocUv;
in float vCell;
in vec3 vTint;
in float vBright;
const float G = ${ATLAS_GRID}.0;
vec4 cellTap(vec2 uvCell, float lod) {
  vec2 uvc = clamp(uvCell, 0.0, 1.0);
  float col = mod(vCell, G);
  float row = floor(vCell / G);
  vec2 a = vec2((col + uvc.x) / G, 1.0 - (row + 1.0 - uvc.y) / G);
  return textureLod(uAtlas, a, lod);
}
void main() {
  float cellPx = 2048.0 / G;
  vec2 tuv = vUv * cellPx;
  float texelsPerPx = max(length(dFdx(tuv)), length(dFdy(tuv)));
  float natLod = log2(max(texelsPerPx, 1e-4));
  float rTex = vCocUv * cellPx;
  vec4 t;
  if (rTex / max(texelsPerPx, 1e-4) < 0.6) {
    t = cellTap(vUv, clamp(natLod, 0.0, 4.0));
  } else {
    float lod = clamp(max(natLod, log2(max(rTex * 0.5, 1.0))), 0.0, 4.0);
    t = vec4(0.0);
    for (int i = 0; i < 12; i++) {
      float fi = float(i) + 0.5;
      float r = sqrt(fi / 12.0);
      float a = fi * 2.39996323;
      t += cellTap(vUv + vec2(cos(a), sin(a)) * r * vCocUv, lod);
    }
    t /= 12.0;
  }
  gl_FragColor = vec4(vTint * t.rgb * vBright * uGain, 1.0);
}
`;

// ---------------------------------------------------------------- cloud dots
const DOT_VERT = /* glsl */ `
${COMMON_UNI}
uniform float uFocus;
uniform float uCocPx;
uniform vec3 uTints[3];
in vec3 aPos;
in vec4 aInfo;  // size px, tint, k, phase
out vec3 vCol;
void main() {
  float th = uTheta;
  vec3 wp = aPos + vec3(sin(aInfo.z * th + aInfo.w * 6.28) * 0.2, cos(aInfo.z * th + aInfo.w * 4.0) * 0.1, 0.0);
  vec4 mv = viewMatrix * vec4(wp, 1.0);
  gl_Position = projectionMatrix * mv;
  float dist = max(-mv.z, 0.5);
  float coc = uCocPx * max(1.0 - dist / uFocus, 0.0) * 1.4;
  float sz = aInfo.x * uPx * clamp(18.0 / dist, 0.7, 2.2) * 1.6;
  float tot = sz + coc;
  gl_PointSize = max(tot, 1.5);
  float tw = 0.55 + 0.45 * sin(aInfo.z * 2.0 * th + aInfo.w * 9.0);
  float energy = (sz * sz + 1.0) / (tot * tot + 1.0);
  vCol = uTints[int(aInfo.y)] * tw * energy * exp(-max(dist - 22.0, 0.0) / 30.0);
}
`;
const DOT_FRAG = /* glsl */ `
${COMMON_UNI}
in vec3 vCol;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d) * 2.0;
  float a = smoothstep(0.75, 0.15, r) * 0.8 + 0.3 * exp(-r * r * 4.0);
  gl_FragColor = vec4(vCol * a * 1.7 * uGain, 1.0);
}
`;

// ---------------------------------------------------------------- platform
const PLATFORM_FRAG = /* glsl */ `
${COMMON_UNI}
${HASH}
uniform vec3 uCyan;
uniform vec4 uRingOn;
uniform float uCoreOn;
uniform float uOuterOn;
in vec3 vLocal;
float band(float r, float r0, float r1, float aa) {
  return smoothstep(r0 - aa, r0 + aa, r) * (1.0 - smoothstep(r1 - aa, r1 + aa, r));
}
float line(float r, float r0, float w, float aa) { return band(r, r0 - w, r0 + w, aa); }
// angular pattern helper, AA'd with the derivative of its own argument
float dashes(float x, float duty) {
  float f = fract(x);
  float w = fwidth(x) + 1e-4;
  return smoothstep(0.0, w, f) * (1.0 - smoothstep(duty - w, duty, f));
}
void main() {
  vec2 p = vLocal.xz;
  float r = length(p);
  float a = atan(p.y, p.x) / 6.2831853;   // -0.5..0.5
  float aa = fwidth(r) * 0.8 + 1e-4;
  float th = uLoopT;
  // ring A — inner segmented ring, turning +1 rev/loop
  float A = band(r, 0.50, 0.70, aa) * (0.55 + 0.45 * dashes((a + th) * 24.0, 0.62));
  A += line(r, 0.80, 0.012, aa) * 0.7;
  // ring B — tick ring, turning −1 rev/loop
  float B = line(r, 1.02, 0.014, aa) + line(r, 1.40, 0.014, aa) * 0.8;
  B += band(r, 1.08, 1.33, aa) * dashes((a - th) * 120.0, 0.28) * 0.75;
  // ring C — broken arcs, turning +2 rev/loop
  float segC = floor(fract(a + 2.0 * th) * 9.0);
  float onC = step(0.3, hash1(segC + 11.0));
  float C = band(r, 1.62, 1.86, aa) * (0.35 + 0.65 * onC * dashes(fract(a + 2.0 * th) * 9.0, 0.86)) * 0.7;
  C += line(r, 1.98, 0.012, aa) * 0.8 + line(r, 2.08, 0.008, aa) * 0.5;
  C += band(r, 1.62, 2.1, aa) * dashes((a + 2.0 * th) * 180.0, 0.18) * 0.25;
  float fine = 0.5 + 0.5 * sin(r * 58.0 - th * 6.2831853 * 4.0);
  // ring D — wide bright band with gaps, turning −1 rev/loop
  float D = band(r, 2.35, 2.62, aa) * (0.55 + 0.45 * dashes((a - th) * 6.0, 0.93)) * (0.6 + 0.4 * fine);
  D += line(r, 2.74, 0.016, aa) * 0.9;
  D += band(r, 2.2, 2.8, aa) * 0.10;
  // outer white ring + faint companion
    // many fine concentric ripples between the rings (liquid-like)
  float O = line(r, 3.7, 0.016, aa) + exp(-pow((r - 3.7) / 0.18, 2.0)) * 0.3;
  float F = band(r, 0.3, 3.0, aa) * pow(fine, 4.0) * 0.55 * (1.0 - smoothstep(fwidth(r) * 58.0 * 0.6, fwidth(r) * 58.0 * 1.2, 1.0));
  vec3 col = uCyan * (A * uRingOn.x * 1.6 + B * uRingOn.y * 1.3 + C * uRingOn.z * 1.4 + D * uRingOn.w * 1.5 + F * uRingOn.z);
  col += vec3(0.82, 0.8, 1.0) * O * uOuterOn * 1.3;
  // disc glow and hot centre spot
  col += uCyan * 0.10 * (1.0 - smoothstep(0.0, 2.9, r)) * max(max(uRingOn.x, uRingOn.w), 0.0);
  col += vec3(1.0, 0.55, 0.22) * (exp(-r * r / 0.012) * 12.0 + exp(-r * r / 0.08) * 1.4) * uCoreOn;
  col += vec3(0.9, 1.0, 1.0) * exp(-r * r / 0.02) * 1.2 * uCoreOn;
  col += uCyan * exp(-r * r / 0.6) * 0.5 * uCoreOn;
  gl_FragColor = vec4(col * uGain, 1.0);
}
`;
const LOCAL_VERT = /* glsl */ `
out vec3 vLocal;
out vec3 vWorld;
void main() {
  vLocal = position;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const HALO_FRAG = /* glsl */ `
${COMMON_UNI}
uniform vec3 uCyan;
uniform float uOn;
in vec3 vLocal;
void main() {
  float a = atan(vLocal.z, vLocal.x) / 6.2831853 + uLoopT;
  float seg = 0.55 + 0.45 * smoothstep(0.2, 0.5, abs(fract(a * 3.0) - 0.5));
  gl_FragColor = vec4(mix(uCyan, vec3(0.85, 0.9, 1.0), 0.6) * 0.6 * seg * uOn * uGain, 1.0);
}
`;

// ---------------------------------------------------------------- floor & sky glow
const FLOOR_FRAG = /* glsl */ `
${COMMON_UNI}
uniform vec3 uFloor;
uniform vec3 uCyan;
uniform vec3 uBg;
uniform float uGlowOn;
uniform vec3 uCamPos;
in vec3 vLocal;
in vec3 vWorld;
float gridLine(float x, float w) {
  float f = abs(fract(x) - 0.5);
  float fw = fwidth(x);
  return 1.0 - smoothstep(w - fw, w + fw, 0.5 - f);
}
void main() {
  vec2 p = vWorld.xz;
  float dist = length(vWorld - uCamPos);
  float g = max(gridLine(p.x / 11.0, 0.002), gridLine(p.y / 11.0, 0.002));
  float gridFade = exp(-dist / 28.0);
  vec3 col = uFloor + vec3(0.6, 0.7, 1.0) * g * 0.03 * gridFade;
  float r = length(p);
  col += uCyan * (0.03 * exp(-r / 2.2)) * uGlowOn;
  col += vec3(1.0, 0.55, 0.25) * 0.25 * exp(-(p.x * p.x) / 0.02) * exp(-max(p.y, 0.0) / 1.2) * step(0.0, p.y) * uGlowOn;
  // horizon haze
  col = mix(col, uBg * 1.6, smoothstep(30.0, 110.0, dist));
  gl_FragColor = vec4(col * uGain, 1.0);
}
`;

const SKY_FRAG = /* glsl */ `
uniform vec3 uBg;
uniform vec3 uGlowCol;
uniform float uGain;
in vec3 vLocal;
void main() {
  vec2 q = vLocal.xy;
  float g = exp(-dot(q, q) / 0.10) * 0.9 + exp(-dot(q, q) / 0.02) * 0.4;
  gl_FragColor = vec4(uGlowCol * g * uGain, 1.0);
}
`;

// ---------------------------------------------------------------- build
type Look = {
  update: (f: number) => void;
  render: (gl: THREE.WebGLRenderer, f: number) => void;
};

const easeInOut = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const ramp = (f: number, a: number, b: number) => easeInOut((f - a) / (b - a));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

class FountainLook implements Look {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.1, 400);
  post: Post;
  shared: Record<string, THREE.IUniform>;
  platformUni: Record<string, THREE.IUniform>;
  spriteUni: Record<string, THREE.IUniform>;
  floorUni: Record<string, THREE.IUniform>;
  haloUni: Record<string, THREE.IUniform>;
  allMats: THREE.ShaderMaterial[] = [];

  constructor(private p: FountainParams, atlas: THREE.Texture) {
    const cyan = new THREE.Color(p.cyan);
    const blue = new THREE.Color(p.blue);
    const bg = new THREE.Color(p.bg);
    this.shared = {
      uTheta: { value: 0 },
      uLoopT: { value: 0 },
      uFire: { value: 1e5 },
      uPx: { value: 1 },
      uRes: { value: new THREE.Vector2(1280, 720) },
      uGain: { value: 1 },
    };
    const mk = (vert: string, fragSrc: string, extra: Record<string, THREE.IUniform>, mirror = 1) => {
      const m = new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: vert,
        fragmentShader: frag(fragSrc),
        uniforms: { ...this.shared, uMirror: { value: mirror }, ...extra },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false,
      });
      this.allMats.push(m);
      return m;
    };

    // sky glow behind the fountain
    const sky = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      mk(LOCAL_VERT, SKY_FRAG, { uBg: { value: bg }, uGlowCol: { value: new THREE.Color(p.accentBlue).multiplyScalar(0.012) } }),
    );
    sky.scale.set(150, 85, 1);
    sky.position.set(0, 10, -60);
    sky.renderOrder = -20;
    this.scene.add(sky);

    // floor
    this.floorUni = {
      uFloor: { value: new THREE.Color("#0B1328") },
      uCyan: { value: cyan },
      uBg: { value: bg },
      uGlowOn: { value: 1 },
      uCamPos: { value: new THREE.Vector3() },
    };
    const floorMat = mk(LOCAL_VERT, FLOOR_FRAG, this.floorUni);
    floorMat.blending = THREE.NormalBlending;
    floorMat.transparent = false;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), floorMat);
    floor.renderOrder = -10;
    floor.frustumCulled = false;
    this.scene.add(floor);

    // platform
    this.platformUni = {
      uCyan: { value: cyan },
      uRingOn: { value: new THREE.Vector4(1, 1, 1, 1) },
      uCoreOn: { value: 1 },
      uOuterOn: { value: 1 },
    };
    const platform = new THREE.Mesh(new THREE.CircleGeometry(4.2, 256).rotateX(-Math.PI / 2), mk(LOCAL_VERT, PLATFORM_FRAG, this.platformUni));
    platform.position.y = 0.005;
    platform.scale.setScalar(1.6);
    platform.renderOrder = -5;
    this.scene.add(platform);
    // a faint second ring floating above the platform
    this.haloUni = { uCyan: { value: cyan }, uOn: { value: 1 } };
    const halo = new THREE.Mesh(new THREE.RingGeometry(3.3, 3.42, 256).rotateX(-Math.PI / 2), mk(LOCAL_VERT, HALO_FRAG, this.haloUni));
    halo.position.y = 1.7;
    halo.renderOrder = -4;
    this.scene.add(halo);

    // fountain lines (instanced ribbons): one instance per segment
    const lineGeo = new THREE.InstancedBufferGeometry();
    lineGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(12), 3));
    lineGeo.setAttribute("corner", new THREE.BufferAttribute(new Float32Array([0, -1, 1, -1, 0, 1, 1, 1]), 2));
    lineGeo.setIndex([0, 1, 2, 2, 1, 3]);
    const nInst = N_LINES * SEG;
    const aA = new Float32Array(nInst * 4);
    const aB = new Float32Array(nInst * 4);
    const aSeg = new Float32Array(nInst * 3);
    LINES.forEach((l, i) => {
      for (let k = 0; k < SEG; k++) {
        const j = i * SEG + k;
        aA.set([l.phi, l.R, l.H, l.p], j * 4);
        aB.set([l.twist, l.zs, l.phase, l.bright], j * 4);
        // denser segments near the base where the curve bends most
        const s0 = Math.pow(k / SEG, 1.25);
        const s1 = Math.pow((k + 1) / SEG, 1.25);
        aSeg.set([s0, s1, l.delay], j * 3);
      }
    });
    lineGeo.setAttribute("aA", new THREE.InstancedBufferAttribute(aA, 4));
    lineGeo.setAttribute("aB", new THREE.InstancedBufferAttribute(aB, 4));
    lineGeo.setAttribute("aSeg", new THREE.InstancedBufferAttribute(aSeg, 3));
    lineGeo.instanceCount = nInst;
    const lineUni = { uCyan: { value: cyan }, uBlue: { value: blue } };
    for (const mirror of [-1, 1]) {
      const m = new THREE.Mesh(lineGeo, mk(LINE_VERT, LINE_FRAG, lineUni, mirror));
      m.frustumCulled = false;
      m.renderOrder = mirror < 0 ? 0 : 10;
      this.scene.add(m);
    }

    // fountain points
    const rngP = mulberry32(0x9017);
    const pA = new Float32Array(N_POINTS * 4);
    const pB = new Float32Array(N_POINTS * 4);
    const pP = new Float32Array(N_POINTS * 4);
    const pQ = new Float32Array(N_POINTS * 2);
    for (let i = 0; i < N_POINTS; i++) {
      const l = LINES[Math.floor(rngP() * N_LINES) % N_LINES];
      pA.set([l.phi + range(rngP, -0.06, 0.06), l.R * range(rngP, 0.85, 1.15), l.H * range(rngP, 0.9, 1.08), l.p], i * 4);
      pB.set([l.twist, l.zs, l.phase, range(rngP, 0.35, 1.0)], i * 4);
      const k = pick(rngP, [1, 2, 2, 2, 3]);
      pP.set([rngP(), k, rngP() * Math.PI * 2, Math.pow(rngP(), 1.5)], i * 4);
      pQ.set([range(rngP, 1.4, 3.0), l.delay + range(rngP, 0, 6)], i * 2);
    }
    const ptGeo = new THREE.BufferGeometry();
    ptGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N_POINTS * 3), 3));
    ptGeo.setAttribute("aA", new THREE.BufferAttribute(pA, 4));
    ptGeo.setAttribute("aB", new THREE.BufferAttribute(pB, 4));
    ptGeo.setAttribute("aP", new THREE.BufferAttribute(pP, 4));
    ptGeo.setAttribute("aQ", new THREE.BufferAttribute(pQ, 2));
    for (const mirror of [-1, 1]) {
      const pts = new THREE.Points(ptGeo, mk(POINT_VERT, POINT_FRAG, lineUni, mirror));
      pts.frustumCulled = false;
      pts.renderOrder = mirror < 0 ? 1 : 11;
      this.scene.add(pts);
    }

    // cloud sprites
    const tints = [new THREE.Color(p.icon), new THREE.Color(p.red), new THREE.Color(p.cyan)];
    this.spriteUni = {
      uAtlas: { value: atlas },
      uFocus: { value: 21 },
      uCocPx: { value: 10 },
      uProj: { value: 900 },
      uHitY: { value: 100 },
      uHitAmt: { value: 1 },
      uTints: { value: tints },
    };
    const rngS = mulberry32(0x5c1d);
    const sp = new Float32Array(N_SPRITES * 3);
    const si = new Float32Array(N_SPRITES * 4);
    const sa = new Float32Array(N_SPRITES * 4);
    for (let i = 0; i < N_SPRITES; i++) {
      const z = -34 + Math.pow(rngS(), 0.75) * 36; // −34 … +2
      const depth = -z + 5;
      const x = range(rngS, -1, 1) * (13 + depth * 0.6);
      const y = range(rngS, 3.4, 9.6) + depth * 0.17;
      sp.set([x, y, z], i * 3);
      const c = rngS();
      const cell = c < 0.2 ? pick(rngS, TOWER_CELLS) : c < 0.4 ? pick(rngS, ICON_CELLS) : c < 0.72 ? pick(rngS, TEXT_CELLS) : c < 0.985 ? pick(rngS, CHART_CELLS) : pick(rngS, BADGE_CELLS);
      const isTower = cell >= 9 && cell < 25;
      const isIcon = cell < 9 || cell >= 56;
      const size = isTower ? range(rngS, 1.6, 3.4) : isIcon ? range(rngS, 0.22, 0.36) : range(rngS, 0.32, 0.7);
      if (isTower) sp[i * 3 + 1] += size * 0.35;
      const t = rngS();
      const tint = isTower ? 0 : t < 0.015 ? 1 : 0;
      const bright = isTower ? range(rngS, 0.035, 0.09) : range(rngS, 0.75, 1.3);
      si.set([size, cell, tint, bright], i * 4);
      sa.set([1 + Math.floor(rngS() * 2), 1 + Math.floor(rngS() * 2), 1 + Math.floor(rngS() * 6), rngS()], i * 4);
    }
    const spGeo = new THREE.InstancedBufferGeometry();
    spGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(12), 3));
    spGeo.setAttribute("corner", new THREE.BufferAttribute(new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]), 2));
    spGeo.setIndex([0, 1, 2, 2, 1, 3]);
    spGeo.setAttribute("aPos", new THREE.InstancedBufferAttribute(sp, 3));
    spGeo.setAttribute("aInfo", new THREE.InstancedBufferAttribute(si, 4));
    spGeo.setAttribute("aAnim", new THREE.InstancedBufferAttribute(sa, 4));
    spGeo.instanceCount = N_SPRITES;
    const sprites = new THREE.Mesh(spGeo, mk(SPRITE_VERT, SPRITE_FRAG, this.spriteUni));
    sprites.frustumCulled = false;
    sprites.renderOrder = 20;
    this.scene.add(sprites);

    // cloud dots
    const rngD = mulberry32(0xd075);
    const dp = new Float32Array(N_DOTS * 3);
    const di = new Float32Array(N_DOTS * 4);
    const dotTints = [new THREE.Color(p.icon), new THREE.Color(p.red), new THREE.Color(p.accentBlue)];
    for (let i = 0; i < N_DOTS; i++) {
      const z = -34 + Math.pow(rngD(), 0.75) * 36;
      const depth = -z + 5;
      const x = range(rngD, -1, 1) * (13 + depth * 0.6);
      const y = range(rngD, 2.8, 10.2) + depth * 0.17;
      dp.set([x, y, z], i * 3);
      const t = rngD();
      di.set([range(rngD, 2.2, 6.0), t < 0.06 ? 1 : t < 0.1 ? 2 : 0, 1 + Math.floor(rngD() * 4), rngD()], i * 4);
    }
    const dotGeo = new THREE.BufferGeometry();
    dotGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N_DOTS * 3), 3));
    dotGeo.setAttribute("aPos", new THREE.BufferAttribute(dp, 3));
    dotGeo.setAttribute("aInfo", new THREE.BufferAttribute(di, 4));
    const dots = new THREE.Points(dotGeo, mk(DOT_VERT, DOT_FRAG, { uFocus: this.spriteUni.uFocus, uCocPx: this.spriteUni.uCocPx, uTints: { value: dotTints } }));
    dots.frustumCulled = false;
    dots.renderOrder = 21;
    this.scene.add(dots);

    this.post = new Post({
      loopLength: LOOP,
      msaa: 4,
      clearColor: bg,
      bloom: { threshold: 0.7, knee: 0.4, levels: 5, radius: 1.0 },
      grain: 0.015,
      blueNoise: false,
      uniforms: { uHorizon: { value: 0.36 }, uHaze: { value: 1 } },
      grade: /* glsl */ `
uniform float uHorizon;
uniform float uHaze;
vec3 grade(vec3 hdr, vec3 bl, vec2 uv) {
  vec3 c = hdr + bl * 0.22;
  // misty band along the horizon that blends the burst into the floor
  float hb = exp(-pow((uv.y - uHorizon) / 0.045, 2.0)) * (0.55 + 0.45 * exp(-pow((uv.x - 0.5) / 0.45, 2.0)));
  c += vec3(0.012, 0.025, 0.05) * hb * uHaze * smoothstep(0.55, 0.0, uv.x);
  vec2 d = (uv - 0.5) * vec2(uAspect, 1.0);
  c *= 1.0 - 0.32 * dot(d, d);
  return c / (1.0 + max(c - 0.75, 0.0) * 0.7);
}`,
    });
  }

  update = (frame: number) => {
    const story = this.p.mode === "story";
    const f = story ? frame : ((frame % LOOP) + LOOP) % LOOP;
    const th = (2 * Math.PI * f) / LOOP;
    this.shared.uTheta.value = th;
    this.shared.uLoopT.value = f / LOOP;
    const ring = this.platformUni.uRingOn.value as THREE.Vector4;
    let camPos: THREE.Vector3;
    let look: THREE.Vector3;
    if (story) {
      // 0–3 s: looking up into the cloud; 3–5 s: tilt down, rings light;
      // 5–8 s: fountain fires; 8–15 s: hold, camera eases in.
      const tilt = ramp(f, 90, 150);
      const push = ramp(f, 240, 450);
      const z = lerp(22.5, 21.0, ramp(f, 0, 150)) - 2.8 * push;
      camPos = new THREE.Vector3(0.6 * Math.sin(th * 0.5), lerp(3.2, 2.7, tilt) + 0.2 * push, z);
      look = new THREE.Vector3(0, lerp(8.6, 4.3, tilt) + 0.2 * push, 0);
      ring.set(ramp(f, 100, 112), ramp(f, 110, 122), ramp(f, 120, 132), ramp(f, 130, 142));
      this.platformUni.uOuterOn.value = ramp(f, 92, 106);
      this.platformUni.uCoreOn.value = Math.max(ramp(f, 136, 150) * 0.5, ramp(f, 148, 160));
      this.floorUni.uGlowOn.value = ramp(f, 100, 150);
      this.shared.uFire.value = f - 150;
      const hitT = ramp(f, 158, 230);
      this.spriteUni.uHitY.value = hitT * 18;
      this.spriteUni.uHitAmt.value = hitT;
    } else {
      camPos = new THREE.Vector3(1.4 * Math.sin(th), 2.7 + 0.25 * Math.sin(2 * th), 20.5 + 0.8 * Math.cos(th));
      look = new THREE.Vector3(0.5 * Math.sin(th + 0.6), 4.3 + 0.2 * Math.sin(th), 0);
      ring.set(1, 1, 1, 1);
      this.platformUni.uOuterOn.value = 1;
      this.platformUni.uCoreOn.value = 1;
      this.floorUni.uGlowOn.value = 1;
      this.shared.uFire.value = 1e5;
      this.spriteUni.uHitY.value = 18;
      this.spriteUni.uHitAmt.value = 1;
    }
    this.camera.position.copy(camPos);
    this.camera.lookAt(look);
    this.camera.updateMatrixWorld();
    (this.floorUni.uCamPos.value as THREE.Vector3).copy(camPos);
    // screen height of the horizon (a far point on the floor) for the haze band
    const far = new THREE.Vector3(camPos.x, 0, camPos.z - 400).project(this.camera);
    this.post.uniforms.uHorizon.value = far.y * 0.5 + 0.5;
    const glow = this.platformUni.uRingOn.value as THREE.Vector4;
    this.haloUni.uOn.value = glow.w;
    this.post.uniforms.uHaze.value = story ? 0.35 + 0.65 * this.floorUni.uGlowOn.value : 1;
  };

  render = (gl: THREE.WebGLRenderer, frame: number) => {
    const size = gl.getDrawingBufferSize(new THREE.Vector2());
    this.camera.aspect = size.x / size.y;
    this.camera.updateProjectionMatrix();
    (this.shared.uRes.value as THREE.Vector2).copy(size);
    this.shared.uPx.value = size.y / 720;
    this.spriteUni.uCocPx.value = 9 * (size.y / 720);
    this.spriteUni.uProj.value = size.y / (2 * Math.tan(THREE.MathUtils.degToRad(FOV / 2)));
    this.post.render(gl, this.scene, this.camera, frame);
  };
}

const Inner: React.FC<FountainParams> = (p) => {
  const atlas = useAsset(fountainAtlas());
  const key = JSON.stringify(p);
  const look = useMemo(() => new FountainLook(p, atlas), [key, atlas]); // eslint-disable-line react-hooks/exhaustive-deps
  useDrive(look);
  return null;
};

export const DataFountain: React.FC<FountainParams> = (p) => (
  <Stage>
    <Inner {...p} />
  </Stage>
);
