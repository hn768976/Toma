import { Capsules, SEG_DIST, type Seg } from '../lib/capsules';
import { FINISH, NOISE } from '../lib/glsl';
import { Bloom, Pass, makeRT } from '../lib/pixi';
import type { SceneFactory } from '../lib/PixiStage';
import { hash01, hexToLinear, mulberry32 } from '../lib/random';

export interface NeuralParams {
  highlight: string; // blown-out highlight colour
  mid: string;       // mid tone, falls to black at the edges
  loopFrames: number;
}

/* ---------------- brain silhouette (brain units, y down) ---------------- */
// [cx, cy, rx, ry, rotation]
const LOBES: [number, number, number, number, number][] = [
  [0.02, -0.06, 0.9, 0.5, -0.04],  // cerebrum
  [-0.58, 0.04, 0.36, 0.4, 0.0],   // frontal
  [-0.14, 0.22, 0.55, 0.23, 0.1],  // temporal
  [0.62, 0.34, 0.27, 0.16, -0.15], // cerebellum
  [0.32, 0.52, 0.085, 0.22, -0.35],// brainstem
];
const SMOOTH_K = 0.09;

function ellipseSd(x: number, y: number, l: (typeof LOBES)[number]) {
  const [cx, cy, rx, ry, rot] = l;
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const dx = x - cx;
  const dy = y - cy;
  const u = (dx * c + dy * s) / rx;
  const v = (-dx * s + dy * c) / ry;
  return (Math.hypot(u, v) - 1) * Math.min(rx, ry);
}
function smin(a: number, b: number, k: number) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}
function brainSd(x: number, y: number) {
  let d = ellipseSd(x, y, LOBES[0]);
  for (let i = 1; i < LOBES.length; i++) d = smin(d, ellipseSd(x, y, LOBES[i]), SMOOTH_K);
  return d;
}

/* ---------------- pathway tree, seeded once at module level ---------------- */
const rnd = mulberry32(0x0ae11a1);
interface Path { pts: [number, number][]; w0: number; w1: number; s0: number; ds: number; }
const PATHS: Path[] = [];

function grow(x: number, y: number, ang: number, len: number, w0: number, s0: number, depth: number) {
  const step = 0.014;
  const n = Math.max(3, Math.floor(len / step));
  const pts: [number, number][] = [[x, y]];
  let a = ang;
  let cx = x;
  let cy = y;
  let curl = (rnd() - 0.5) * 0.06;
  for (let i = 0; i < n; i++) {
    a += curl + (rnd() - 0.5) * 0.16;
    curl = curl * 0.9 + (rnd() - 0.5) * 0.06;
    cx += Math.cos(a) * step;
    cy += Math.sin(a) * step;
    if (brainSd(cx, cy) > -0.035) break;
    pts.push([cx, cy]);
  }
  if (pts.length < 3) return;
  const w1 = w0 * (depth === 0 ? 0.45 : 0.3);
  PATHS.push({ pts, w0, w1, s0, ds: step });
  if (depth >= 2) return;
  // side branches, plus many short spurs on the trunks
  const kids = depth === 0 ? 1 + Math.floor(rnd() * 2) : rnd() < 0.4 ? 1 : 0;
  for (let k = 0; k < kids; k++) {
    const j = 1 + Math.floor(rnd() * (pts.length - 2));
    const t = j / (pts.length - 1);
    const side = rnd() < 0.5 ? -1 : 1;
    const [px, py] = pts[j];
    const prev = pts[j - 1];
    const base = Math.atan2(py - prev[1], px - prev[0]);
    grow(px, py, base + side * (0.5 + 0.6 * rnd()), len * (0.3 + 0.35 * rnd()),
      w0 * (1 - 0.5 * t) * 0.65, s0 + j * step, depth + 1);
  }
  const spurs = depth === 1 ? Math.floor(rnd() * 3) : 0;
  for (let k = 0; k < spurs; k++) {
    const j = 1 + Math.floor(rnd() * (pts.length - 2));
    const side = rnd() < 0.5 ? -1 : 1;
    const [px, py] = pts[j];
    const prev = pts[j - 1];
    const base = Math.atan2(py - prev[1], px - prev[0]);
    grow(px, py, base + side * (0.5 + 0.5 * rnd()), 0.03 + 0.05 * rnd(), w0 * 0.45, s0 + j * step, 2);
  }
}
// four tree-like root systems: a trunk each, with ~10 main branches leaving
// it (40 in all), each carrying a few sub-branches
const ROOTS: [number, number, number][] = [
  [-0.25, 0.24, -2.3], [0.0, 0.22, -1.65], [0.28, 0.14, -1.0], [-0.4, 0.05, -2.9],
];
for (const [rx, ry, ra] of ROOTS) {
  const before = PATHS.length;
  grow(rx, ry, ra, 0.6 + 0.2 * rnd(), 0.022, 0, 2); // trunk only (no auto children)
  const trunk = PATHS[before];
  if (!trunk) continue;
  for (let k = 0; k < 10; k++) {
    const j = 1 + Math.floor(((k + rnd()) / 10) * (trunk.pts.length - 2));
    const [px, py] = trunk.pts[j];
    const prev = trunk.pts[j - 1];
    const base = Math.atan2(py - prev[1], px - prev[0]);
    const side = k % 2 === 0 ? -1 : 1;
    grow(px, py, base + side * (0.35 + 0.7 * rnd()), 0.25 + 0.35 * rnd(),
      0.02 * (1 - 0.5 * (j / trunk.pts.length)), j * trunk.ds, 1);
  }
}
// fine black specks scattered around the surface
const SPECKS: [number, number, number][] = [];
while (SPECKS.length < 2600) {
  const x = (rnd() * 2 - 1) * 1.0;
  const y = (rnd() * 2 - 1) * 0.65;
  if (brainSd(x, y) < -0.02) SPECKS.push([x, y, 0.0025 + 0.004 * rnd() * rnd()]);
}

function pathSegs(): Seg[] {
  const segs: Seg[] = [];
  for (const p of PATHS) {
    const n = p.pts.length - 1;
    for (let i = 0; i < n; i++) {
      const fa = i / n;
      const fb = (i + 1) / n;
      const ta = Math.min(1, 0.55 + fa * 6);
      const tb = Math.min(1, 0.55 + fb * 6);
      const wa = (p.w0 + (p.w1 - p.w0) * fa) * ta;
      const wb = (p.w0 + (p.w1 - p.w0) * fb) * tb;
      segs.push({
        ax: p.pts[i][0], ay: p.pts[i][1], bx: p.pts[i + 1][0], by: p.pts[i + 1][1],
        w: (wa + wb) / 2, ia: 1, ib: 1, kind: 0,
        sa: p.s0 + i * p.ds, sb: p.s0 + (i + 1) * p.ds,
      });
    }
  }
  for (const [x, y, r] of SPECKS) {
    segs.push({ ax: x, ay: y, bx: x + r * 0.6, by: y + r * 0.3, w: r, ia: 0.85, ib: 0.85, kind: 1 });
  }
  return segs;
}

/* ---------------- camera: closed path, push in / drift / pull back ---------------- */
// keys: time (s), centre x, centre y, zoom
const KEYS: [number, number, number, number][] = [
  [0, 0.02, 0.06, 1.15],
  [8, -0.28, 0.02, 2.5],
  [14, 0.24, -0.08, 2.3],
];
const LOOP = 20;
function camera(t: number): [number, number, number] {
  // periodic Catmull-Rom (non-uniform) through the keys; zoom in log space
  const n = KEYS.length;
  const tt = ((t % LOOP) + LOOP) % LOOP;
  let i = n - 1;
  for (let k = 0; k < n; k++) if (tt >= KEYS[k][0]) i = k;
  const key = (k: number) => {
    const m = ((k % n) + n) % n;
    const wrap = Math.floor(k / n) * LOOP;
    const [kt, x, y, z] = KEYS[m];
    return [kt + wrap, x, y, Math.log(z)];
  };
  const p0 = key(i - 1), p1 = key(i), p2 = key(i + 1), p3 = key(i + 2);
  const h = p2[0] - p1[0];
  const u = (tt - p1[0]) / h;
  const out = [0, 0, 0];
  for (let c = 1; c <= 3; c++) {
    const m1 = ((p2[c] - p0[c]) / (p2[0] - p0[0])) * h;
    const m2 = ((p3[c] - p1[c]) / (p3[0] - p1[0])) * h;
    const u2 = u * u, u3 = u2 * u;
    out[c - 1] = (2 * u3 - 3 * u2 + 1) * p1[c] + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * p2[c] + (u3 - u2) * m2;
  }
  return [out[0], out[1], Math.exp(out[2])];
}

const UNIT = 1500; // design px per brain unit at zoom 1

const PATH_FRAG = /* glsl */ `
in vec2 vP; in vec4 vSeg; in vec4 vProp; in vec2 vPath;
out vec4 finalColor;
uniform float uS; uniform float uPhase;
${SEG_DIST}
void main() {
  vec2 dh = segDist(vP, vSeg.xy, vSeg.zw);
  float w = max(vProp.x, 0.8 / uS);
  float x = dh.x / w;
  float core = exp(-pow(x, 4.0) * 0.8) * min(vProp.x / w, 1.0);
  float s = mix(vPath.x, vPath.y, dh.y);
  float pulse = vProp.w < 0.5 ? pow(0.5 + 0.5 * cos(6.2831853 * (s * 1.6 - uPhase)), 14.0) : 0.0;
  pulse *= exp(-x * x * 4.0);  // the pulse glows along the vein's centre only
  finalColor = vec4(core * vProp.y, core * pulse, 0.0, 1.0);
}
`;

const BRAIN_FRAG = /* glsl */ `
in vec2 vUV; out vec4 finalColor;
uniform vec2 uRes; uniform float uS;
uniform vec3 uCam;    // centre x, centre y, zoom
uniform sampler2D uPaths;
uniform vec3 uHi; uniform vec3 uMid;
uniform float uFlick;
${NOISE}
float ellipseSd(vec2 p, vec4 e, float rot) {
  float c = cos(rot), s = sin(rot);
  vec2 d = p - e.xy;
  vec2 q = vec2(d.x * c + d.y * s, -d.x * s + d.y * c) / e.zw;
  return (length(q) - 1.0) * min(e.z, e.w);
}
float smin(float a, float b, float k) { float h = max(k - abs(a - b), 0.0) / k; return min(a, b) - h * h * k * 0.25; }
float brainSd(vec2 p) {
  float d = ellipseSd(p, vec4(0.02, -0.06, 0.9, 0.5), -0.04);
  d = smin(d, ellipseSd(p, vec4(-0.58, 0.04, 0.36, 0.4), 0.0), ${SMOOTH_K.toFixed(3)});
  d = smin(d, ellipseSd(p, vec4(-0.14, 0.22, 0.55, 0.23), 0.1), ${SMOOTH_K.toFixed(3)});
  d = smin(d, ellipseSd(p, vec4(0.62, 0.34, 0.27, 0.16), -0.15), ${SMOOTH_K.toFixed(3)});
  d = smin(d, ellipseSd(p, vec4(0.32, 0.52, 0.085, 0.22), -0.35), ${SMOOTH_K.toFixed(3)});
  return d;
}
void main() {
  vec2 px = vUV * uRes / uS;                       // design px
  vec2 b = (px - vec2(1920.0, 1080.0)) / (uCam.z * ${UNIT.toFixed(1)}) + uCam.xy;
  // silhouette with bumpy gyri edge
  float sd = brainSd(b) + 0.045 * fbm(b * 5.0 + 3.0, 4) + 0.012 * gnoise(b * 26.0);
  float aa = fwidth(sd) * 0.8 + 1e-5;
  float inside = smoothstep(aa, -aa, sd);
  // gyri: folds from warped noise; sulci are the zero lines
  vec2 wv = vec2(fbm(b * 2.2 + 1.7, 3), fbm(b * 2.2 + 8.3, 3));
  float g = fbm(b * 6.0 + wv * 0.9, 4);
  float gw = fwidth(g) + 1e-5;
  float sulcus = 1.0 - smoothstep(0.0, 0.035 + gw, abs(g));
  float rim = smoothstep(0.03, 0.09, abs(g)) * (1.0 - smoothstep(0.09, 0.16, abs(g)));
  // harsh lighting: blown out centre-low, falling off to the edges
  vec2 lc = vec2(-0.32, 0.14);
  vec2 lc2 = vec2(0.02, 0.3);
  float L = 0.85 * exp(-dot(b - lc, b - lc) / 0.12) + 0.6 * exp(-dot(b - lc2, b - lc2) / 0.06)
          + 0.4 * exp(-dot(b - vec2(-0.15, -0.05), b - vec2(-0.15, -0.05)) / 0.5) + 0.16;
  L *= smoothstep(0.0, 0.1, -sd) * 0.45 + 0.55;
  L *= 1.0 - 0.6 * smoothstep(0.15, 0.85, b.x);  // occipital side falls into deep shadow
  // gritty speckle texture: mottled patches plus fine dark specks
  float sp = fbm(b * 30.0 + 5.0, 3);
  float sp2 = gnoise(b * 110.0);
  float grit = smoothstep(0.3, 0.6, sp2 + 0.4 * sp);
  L *= (0.75 + 0.5 * sp) * (1.0 - 0.35 * grit);
  L *= 1.0 - 0.6 * sulcus;
  L += 0.12 * rim * smoothstep(0.2, 0.8, L);
  // dark pathways (and their travelling pulse)
  vec4 pth = texture(uPaths, vUV);
  float dark = clamp(pth.r, 0.0, 1.0);
  L *= 1.0 - 0.97 * dark;
  L += 0.13 * pth.g * dark;
  L *= uFlick;
  // posterise into ~5 levels, anti-aliased at the steps
  float x = clamp(L, 0.0, 1.3) * 4.0;
  float fx = fract(x);
  float fw = fwidth(x) * 0.75 + 1e-4;
  // slightly soft steps so the posterised look reads as photographic grit
  float Lq = (floor(x) + smoothstep(0.5 - fw - 0.08, 0.5 + fw + 0.08, fx)) / 4.0;
  // palette ramp: black → deep mid → mid → yellow-tinted light → highlight
  vec3 deep = uMid * 0.12;
  vec3 warm = mix(uHi, uHi * vec3(1.0, 0.95, 0.45) + uMid * 0.1, 0.7);
  vec3 col = Lq < 0.25 ? mix(vec3(0.0), deep, Lq / 0.25)
           : Lq < 0.5 ? mix(deep, uMid, (Lq - 0.25) / 0.25)
           : Lq < 0.75 ? mix(uMid, warm, (Lq - 0.5) / 0.25)
           : mix(warm, uHi, clamp((Lq - 0.75) / 0.25, 0.0, 1.0)) * (1.0 + 0.3 * max(Lq - 1.0, 0.0));
  // cool tint toward the lower edge, like the reference's cyan fringe
  col = mix(col, col * vec3(0.7, 1.0, 1.25), smoothstep(0.0, 0.3, b.y) * smoothstep(0.25, 0.0, -sd) * 0.6);
  // brownish speckle and warm tint in the lit areas
  col *= mix(vec3(1.0), vec3(1.05, 0.85, 0.45), grit * smoothstep(0.3, 0.8, Lq) * 0.6);
  col *= inside;
  // edge glow round the silhouette
  // uneven rim: bright teal-tinted in places, absent elsewhere
  float rimVar = smoothstep(0.0, 0.5, fbm(b * 3.0 + 7.0, 2));
  col += mix(uMid, uHi, 0.5) * vec3(0.8, 1.0, 1.1) * 0.35 * rimVar * exp(-abs(sd) * 220.0) * smoothstep(0.05, 0.4, L + 0.15);
  finalColor = vec4(col, 1.0);
}
`;

const OUT_FRAG = /* glsl */ `
in vec2 vUV; out vec4 finalColor;
uniform sampler2D uSrc;
uniform sampler2D uB0; uniform sampler2D uB1; uniform sampler2D uB2; uniform sampler2D uB3;
uniform float uFrameMod;
${NOISE}
${FINISH}
void main() {
  vec3 c = texture(uSrc, vUV).rgb;
  vec3 bl = texture(uB0, vUV).rgb * 0.5 + texture(uB1, vUV).rgb * 0.5 + texture(uB2, vUV).rgb * 0.45 + texture(uB3, vUV).rgb * 0.4;
  // bloom only the highlights
  vec3 hi = max(bl - 0.35, 0.0);
  c += hi * 0.7;
  c = 1.0 - exp(-c * 1.5);
  finalColor = vec4(finishColor(linearToSrgb(c), uFrameMod, 0.015), 1.0);
}
`;

export const neuralScene: SceneFactory<NeuralParams> = ({ renderer, w, h, s }, p) => {
  const pathRT = makeRT(w, h);
  const brainRT = makeRT(w, h);
  const bloom = new Bloom(w, h, 4, 2);
  const caps = new Capsules(PATH_FRAG, { uPhase: { value: 0, type: 'f32' } }, s);
  caps.set(pathSegs(), 0.03);
  const brain = new Pass(
    w,
    h,
    BRAIN_FRAG,
    {
      uRes: { value: [w, h], type: 'vec2<f32>' },
      uS: { value: s, type: 'f32' },
      uCam: { value: [0, 0, 1], type: 'vec3<f32>' },
      uHi: { value: hexToLinear(p.highlight), type: 'vec3<f32>' },
      uMid: { value: hexToLinear(p.mid), type: 'vec3<f32>' },
      uFlick: { value: 1, type: 'f32' },
    },
    { uPaths: pathRT.source },
  );
  const out = new Pass(
    w,
    h,
    OUT_FRAG,
    { uFrameMod: { value: 0, type: 'f32' } },
    {
      uSrc: brainRT.source,
      uB0: bloom.levels[0].source,
      uB1: bloom.levels[1].source,
      uB2: bloom.levels[2].source,
      uB3: bloom.levels[3].source,
    },
  );
  return {
    render(frame) {
      const f = frame % 600;
      const t = f / 30;
      const [cx, cy, z] = camera(t);
      const sc = z * UNIT;
      caps.u.uView = [sc, 1920 - cx * sc, 1080 - cy * sc];
      caps.u.uPhase = (f / 600) * 5; // 5 whole pulse cycles per loop
      renderer.render({ container: caps.root, target: pathRT, clear: true, clearColor: [0, 0, 0, 0] });
      brain.u.uCam = [cx, cy, z];
      const bucket = Math.floor(f / 2);
      brain.u.uFlick =
        1 + 0.06 * (hash01(bucket, 3) - 0.5) + 0.03 * Math.sin((2 * Math.PI * 3 * f) / 600);
      brain.draw(renderer, brainRT);
      bloom.run(renderer, brainRT, 1);
      out.u.uFrameMod = frame % p.loopFrames;
      out.draw(renderer);
    },
  };
};
