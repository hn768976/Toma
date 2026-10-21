import { Vector2, Vector4 } from "three";
import type { Look } from "../lib/ShaderOverlay";
import { TAU, clamp, hash01, lerp, mulberry32, range, smoothstep, type Rng } from "../lib/random";
import { getSprocketTexture } from "../lib/textures";
import { PALETTE, hexToRgb } from "../palette";

const MAX_BURNS = 4;
const MAX_SPARKS = 64;
const MAX_CURLS = 8;
const ASPECT = 16 / 9;

type Fn = (f: number) => number;

type Burn = {
  kind: 0 | 1; // 0 = burning hole, 1 = burn-away (eats the colour back to black)
  cx: number;
  cy: number;
  angle: number;
  stretch: number;
  seed: number;
  R: Fn;
  heat: Fn;
  flood?: { I: Fn; angle: number; lo: number; hi: number };
  sparks: number;
  sparkWindow: [number, number];
  curls: number;
};

type Diag = {
  start: number;
  end: number;
  angle: number; // direction of the strip's length
  width: number;
  vFrom: number; // offset along the normal, start -> end
  vTo: number;
  uFrom: number; // position of the clean end along the length
  uTo: number;
  seed: number;
  sparks: number;
  curls: number;
  flood?: { I: Fn; angle: number; lo: number; hi: number };
};

type Timeline = { name: string; burns: Burn[]; diag?: Diag; seed: number };

// Envelope helpers.
const env = (a: number, b: number, c: number, d: number): Fn => (f) =>
  smoothstep(a, b, f) * (1 - smoothstep(c, d, f));
const grow = (start: number, full: number, Rmax: number, pow = 0.7): Fn => (f) =>
  Rmax * Math.pow(clamp((f - start) / (full - start)), pow);

// --- 10 s sequence: four burns of different sizes and directions -----------
const SEQUENCE: Timeline = {
  name: "sequence",
  seed: 0xb5e0,
  burns: [
    {
      // Top-left corner, medium; floods yellow -> red.
      kind: 0, cx: -0.86, cy: 0.47, angle: -0.6, stretch: 1.25, seed: 1.3,
      R: grow(2, 52, 0.62, 0.8), heat: env(0, 8, 44, 82),
      flood: { I: env(18, 38, 46, 86), angle: Math.atan2(0.47, -0.86), lo: 0.32, hi: 0.86 },
      sparks: 70, sparkWindow: [4, 60], curls: 3,
    },
    {
      // Right edge, large; blows out nearly white then cools through orange and red.
      kind: 0, cx: 0.97, cy: -0.08, angle: 0.2, stretch: 1.1, seed: 7.9,
      R: grow(172, 214, 1.25, 0.75), heat: env(170, 178, 214, 246),
      flood: { I: env(186, 204, 214, 248), angle: 0.05, lo: 0.42, hi: 1.0 },
      sparks: 90, sparkWindow: [174, 232], curls: 3,
    },
    {
      // Small, from the bottom-left, dies away before the end.
      kind: 0, cx: -0.58, cy: -0.5, angle: 1.1, stretch: 1.4, seed: 4.2,
      R: grow(250, 280, 0.3, 0.8), heat: env(248, 256, 274, 299),
      flood: { I: env(258, 272, 276, 299), angle: Math.atan2(-0.5, -0.58), lo: 0.12, hi: 0.5 },
      sparks: 45, sparkWindow: [251, 290], curls: 2,
    },
  ],
  diag: {
    // A burning strip of film sweeping diagonally across, top-left to bottom-right.
    start: 96, end: 168, angle: 0.26, width: 0.34,
    vFrom: 0.66, vTo: -0.78, uFrom: 0.2, uTo: 0.5, seed: 3.3,
    sparks: 170, curls: 2,
  },
};

// --- 3 s transition: in from the right, full frame at 1.2-1.6 s, burns away --
const TRANSITION: Timeline = {
  name: "transition",
  seed: 0x7a45,
  burns: [
    {
      kind: 0, cx: 1.02, cy: 0.04, angle: 0.0, stretch: 1.15, seed: 2.7,
      R: (f) => 2.6 * Math.pow(clamp((f + 3) / 39), 1.35),
      heat: (f) => smoothstep(-3, 4, f) * (1 - 0.65 * smoothstep(48, 78, f)) * (1 - smoothstep(70, 86, f)),
      flood: { I: (f) => smoothstep(14, 35, f) * (1 - smoothstep(50, 84, f)), angle: 0.0, lo: 0.6, hi: 1.02 },
      sparks: 80, sparkWindow: [0, 40], curls: 3,
    },
    {
      kind: 1, cx: -0.62, cy: 0.12, angle: 0.5, stretch: 1.2, seed: 5.1,
      R: (f) => 2.4 * Math.pow(clamp((f - 49) / 35), 1.25),
      heat: (f) => smoothstep(48.5, 53, f) * (1 - smoothstep(78, 89, f)),
      sparks: 110, sparkWindow: [49, 82], curls: 4,
    },
  ],
};

// --- Particles: generated once per timeline -------------------------------
type Spark = { t0: number; life: number; x: number; y: number; vx: number; vy: number; drag: number; size: number; heat: number; wob: number };
type Curl = { t0: number; life: number; x: number; y: number; vx: number; vy: number; len: number; th: number; k1: number; k2: number; spin: number; gain: number };

const dirFromBurn = (b: Burn, th: number) => {
  // A point on an ellipse matching the burn's stretch/rotation.
  const ex = Math.cos(th) * b.stretch;
  const ey = Math.sin(th);
  const c = Math.cos(b.angle), s = Math.sin(b.angle);
  return [ex * c - ey * s, ex * s + ey * c] as const;
};

const makeCurl = (rng: Rng, t0: number, x: number, y: number, vx: number, vy: number): Curl => ({
  t0, life: range(rng, 14, 34), x, y, vx, vy,
  len: range(rng, 0.05, 0.13), th: rng() * TAU, k1: range(rng, -4, 4), k2: range(rng, -9, 9),
  spin: range(rng, -0.04, 0.04), gain: range(rng, 0.6, 1),
});

const buildParticles = (tl: Timeline) => {
  const rng = mulberry32(tl.seed);
  const sparks: Spark[] = [];
  const curls: Curl[] = [];
  for (const b of tl.burns) {
    for (let k = 0; k < b.sparks; k++) {
      const t0 = range(rng, b.sparkWindow[0], b.sparkWindow[1]);
      const th = rng() * TAU;
      const [dx, dy] = dirFromBurn(b, th);
      const R = b.R(t0) * range(rng, 0.85, 1.25);
      const x = b.cx + dx * R, y = b.cy + dy * R;
      const ember = rng() < 0.14;
      const sp = ember ? range(rng, 0.0015, 0.006) : range(rng, 0.004, 0.022);
      const n = Math.hypot(dx, dy) || 1;
      sparks.push({
        t0, life: ember ? range(rng, 18, 40) : range(rng, 6, 24), x, y,
        vx: (dx / n) * sp + range(rng, -0.004, 0.004), vy: (dy / n) * sp + range(rng, -0.003, 0.005),
        drag: range(rng, 0.02, 0.08), size: ember ? range(rng, 0.0035, 0.0075) : range(rng, 0.0011, 0.0032),
        heat: range(rng, 0.7, 1.1), wob: rng() * TAU,
      });
    }
    for (let k = 0; k < b.curls; k++) {
      const t0 = range(rng, b.sparkWindow[0], b.sparkWindow[1]);
      const th = rng() * TAU;
      const [dx, dy] = dirFromBurn(b, th);
      const R = b.R(t0) * range(rng, 0.9, 1.4);
      curls.push(makeCurl(rng, t0, b.cx + dx * R, b.cy + dy * R, dx * 0.003, dy * 0.003 + 0.001));
    }
  }
  const d = tl.diag;
  if (d) {
    const ax = [Math.cos(d.angle), Math.sin(d.angle)];
    const nm = [-ax[1], ax[0]];
    for (let k = 0; k < d.sparks; k++) {
      const t0 = range(rng, d.start + 4, d.end - 6);
      const s = (t0 - d.start) / (d.end - d.start);
      const v = lerp(d.vFrom, d.vTo, s) - d.width * range(rng, 0.6, 1.25);
      const u = lerp(d.uFrom, d.uTo, s) - range(rng, 0, 1.6);
      const x = ax[0] * u + nm[0] * v, y = ax[1] * u + nm[1] * v;
      const ember = rng() < 0.2;
      sparks.push({
        t0, life: ember ? range(rng, 16, 36) : range(rng, 6, 20), x, y,
        vx: -nm[0] * range(rng, 0.002, 0.012) + range(rng, -0.004, 0.004),
        vy: -nm[1] * range(rng, 0.002, 0.012) + range(rng, -0.004, 0.004),
        drag: range(rng, 0.02, 0.08), size: ember ? range(rng, 0.003, 0.0065) : range(rng, 0.001, 0.003),
        heat: range(rng, 0.7, 1.05), wob: rng() * TAU,
      });
    }
    for (let k = 0; k < d.curls; k++) {
      const t0 = range(rng, d.start + 10, d.end - 10);
      const s = (t0 - d.start) / (d.end - d.start);
      const v = lerp(d.vFrom, d.vTo, s) - d.width * range(rng, 1.1, 1.6);
      const u = lerp(d.uFrom, d.uTo, s) - range(rng, 0.2, 1.6);
      curls.push(makeCurl(rng, t0, ax[0] * u + nm[0] * v, ax[1] * u + nm[1] * v, -nm[0] * 0.003, -nm[1] * 0.003));
    }
  }
  return { sparks, curls };
};

const particles = new Map<string, ReturnType<typeof buildParticles>>();
const getParticles = (tl: Timeline) => {
  let p = particles.get(tl.name);
  if (!p) {
    p = buildParticles(tl);
    particles.set(tl.name, p);
  }
  return p;
};
// Generate at module load, not lazily per render.
getParticles(SEQUENCE);
getParticles(TRANSITION);

const makeBurn = (tl: Timeline): Look => ({
  createUniforms: () => {
    const c = PALETTE.FilmBurn;
    return {
      uStrip: { value: new Vector4() },
      uBurn: { value: Array.from({ length: MAX_BURNS }, () => new Vector4()) },
      uBurnB: { value: Array.from({ length: MAX_BURNS }, () => new Vector4()) },
      uFlood: { value: new Vector4() },
      uDiag: { value: new Vector4() },
      uDiag2: { value: new Vector4() },
      uSpark: { value: Array.from({ length: MAX_SPARKS }, () => new Vector4()) },
      uSparkV: { value: Array.from({ length: MAX_SPARKS }, () => new Vector2()) },
      uCurl: { value: Array.from({ length: MAX_CURLS }, () => new Vector4()) },
      uCurlB: { value: Array.from({ length: MAX_CURLS }, () => new Vector4()) },
      uSprocket: { value: getSprocketTexture() },
      uHot: { value: hexToRgb(c.whiteHot) },
      uYel: { value: hexToRgb(c.yellow) },
      uOra: { value: hexToRgb(c.orange) },
      uRed: { value: hexToRgb(c.red) },
      uChar: { value: hexToRgb(c.char) },
      uStripCol: { value: hexToRgb(c.strip) },
    };
  },
  update: (frame, u) => {
    const f = frame;
    // Film-strip edges: visible most of the time, flickering per frame.
    const fl = hash01(f, 0x5711);
    const vis = 0.72 + 0.28 * fl - 0.35 * (hash01(Math.floor(f / 7), 0x5712) < 0.18 ? 1 : 0);
    const jitter = 0.0035 * (hash01(f, 0x5713) - 0.5) + f * 0.0;
    // Frame line: jitters per frame and is only visible about half the time.
    const frameLine = hash01(Math.floor(f / 3), 0x5716) < 0.5 ? -1 : 0.31 + 0.05 * (hash01(f, 0x5714) - 0.5);
    (u.uStrip.value as Vector4).set(Math.max(0, vis), jitter, 0.9 + 0.2 * hash01(f, 0x5715), frameLine);

    // Burns.
    const B = u.uBurn.value as Vector4[];
    const BB = u.uBurnB.value as Vector4[];
    let flood = { I: 0, angle: 0, lo: 0, hi: 0 };
    for (let i = 0; i < MAX_BURNS; i++) {
      const b = tl.burns[i];
      if (!b) {
        B[i].set(0, 0, 0, 0);
        BB[i].set(0, 0, 1, 0);
        continue;
      }
      const heat = b.heat(f);
      B[i].set(b.cx, b.cy, b.R(f), heat > 0.001 ? heat : 0);
      BB[i].set(b.seed, b.angle, b.stretch, b.kind);
      if (b.flood) {
        const I = b.flood.I(f);
        if (I > flood.I) flood = { I, angle: b.flood.angle, lo: b.flood.lo, hi: b.flood.hi };
      }
    }
    // Diagonal strip.
    const d = tl.diag;
    if (d && f >= d.start && f <= d.end) {
      const s = (f - d.start) / (d.end - d.start);
      const heat = smoothstep(0, 0.08, s) * (1 - smoothstep(0.86, 1, s));
      (u.uDiag.value as Vector4).set(1, lerp(d.uFrom, d.uTo, s), d.angle, d.width);
      (u.uDiag2.value as Vector4).set(lerp(d.vFrom, d.vTo, s), heat, d.seed, 0);
      if (d.flood) {
        const I = d.flood.I(f);
        if (I > flood.I) flood = { I, angle: d.flood.angle, lo: d.flood.lo, hi: d.flood.hi };
      }
    } else {
      (u.uDiag.value as Vector4).set(0, 0, 0, 0);
      (u.uDiag2.value as Vector4).set(0, 0, 0, 0);
    }
    (u.uFlood.value as Vector4).set(flood.I, flood.angle, flood.lo, flood.hi);

    // Sparks: the hottest 64 alive this frame.
    const { sparks, curls } = getParticles(tl);
    const alive: { x: number; y: number; size: number; h: number; vx: number; vy: number }[] = [];
    for (const s of sparks) {
      const tau = f - s.t0;
      if (tau < 0 || tau > s.life) continue;
      const k = (1 - Math.exp(-s.drag * tau)) / s.drag;
      const x = s.x + s.vx * k + 0.002 * Math.sin(tau * 0.4 + s.wob);
      const y = s.y + s.vy * k + 0.00004 * tau * tau;
      const life = tau / s.life;
      const h = s.heat * (1 - life * life) * smoothstep(0, 2, tau + 0.5);
      const sp = Math.exp(-s.drag * tau);
      alive.push({ x, y, size: s.size * (1 - 0.4 * life), h, vx: s.vx * sp, vy: s.vy * sp });
    }
    alive.sort((a, b) => b.h - a.h);
    const SP = u.uSpark.value as Vector4[];
    const SV = u.uSparkV.value as Vector2[];
    for (let i = 0; i < MAX_SPARKS; i++) {
      const a = alive[i];
      if (a && Math.abs(a.x) < ASPECT / 2 + 0.05 && Math.abs(a.y) < 0.55) {
        SP[i].set(a.x, a.y, a.size, a.h);
        SV[i].set(a.vx * 0.7, a.vy * 0.7);
      } else {
        SP[i].set(0, 0, 0, 0);
        SV[i].set(0, 0);
      }
    }
    const CU = u.uCurl.value as Vector4[];
    const CB = u.uCurlB.value as Vector4[];
    let n = 0;
    for (const c of curls) {
      const tau = f - c.t0;
      if (tau < 0 || tau > c.life || n >= MAX_CURLS) continue;
      const life = tau / c.life;
      const g = c.gain * smoothstep(0, 0.15, life) * (1 - smoothstep(0.55, 1, life));
      CU[n].set(c.x + c.vx * tau, c.y + c.vy * tau, c.len, g);
      CB[n].set(c.th + c.spin * tau, c.k1, c.k2 + Math.sin(tau * 0.15) * 0.8, 0);
      n++;
    }
    for (; n < MAX_CURLS; n++) CU[n].set(0, 0, 0, 0);
  },
  fragment: /* glsl */ `
uniform vec4 uStrip;
uniform vec4 uBurn[${MAX_BURNS}];
uniform vec4 uBurnB[${MAX_BURNS}];
uniform vec4 uFlood;
uniform vec4 uDiag;
uniform vec4 uDiag2;
uniform vec4 uSpark[${MAX_SPARKS}];
uniform vec2 uSparkV[${MAX_SPARKS}];
uniform vec4 uCurl[${MAX_CURLS}];
uniform vec4 uCurlB[${MAX_CURLS}];
uniform sampler2D uSprocket;
uniform vec3 uHot, uYel, uOra, uRed, uChar, uStripCol;

// Temperature -> colour: black, red, orange, yellow, white-hot.
vec3 ramp(float T) {
  T = max(T, 0.0);
  vec3 c = uRed * smoothstep(0.0, 0.3, T);
  c = mix(c, uOra, smoothstep(0.26, 0.55, T));
  c = mix(c, uYel, smoothstep(0.52, 0.78, T));
  c = mix(c, uHot, smoothstep(0.76, 1.02, T));
  return c * (1.0 + 0.25 * smoothstep(1.0, 1.3, T));
}
float tAdd(float a, float b) { return max(a, b) + 0.3 * min(a, b); }

void main() {
  vec2 p = frameP();
  vec2 uv = frameUV();
  float A = aspect() * 0.5;
  float px = pxSize();
  float tm = uFrame / 30.0;
  uint key = uint(uFrame);

  float T = 0.0;
  float charMask = 0.0;

  // Full-frame colour flood: a gradient from the burn's side (hot) to the far side.
  if (uFlood.x > 0.0005) {
    vec2 dir = vec2(cos(uFlood.y), sin(uFlood.y));
    float g = clamp(dot(p, dir) / (A * 1.15) * 0.5 + 0.5, 0.0, 1.0);
    g += 0.07 * fbm4(vec3(p * 1.4, 2.0), tm * 0.4, 2);
    T = mix(uFlood.z, uFlood.w, smoothstep(0.0, 1.0, g)) * uFlood.x;
  }

  // Burning holes.
  for (int i = 0; i < ${MAX_BURNS}; i++) {
    vec4 b = uBurn[i];
    if (b.w <= 0.0) continue;
    vec4 bb = uBurnB[i];
    vec2 q = p - b.xy;
    float c = cos(-bb.y), s = sin(-bb.y);
    q = mat2(c, s, -s, c) * q;
    q.x /= bb.z;
    float dist = length(q);
    float R = max(b.z, 1e-4);
    float n = fbm4(vec3(q * 2.2, bb.x), tm * 0.5 + bb.x, 3);
    float n2 = fbm4(vec3(q * 11.0, bb.x + 3.0), tm * 0.9, 2);
    float e = dist - R * (1.0 + 0.5 * n) - 0.006 * n2 * min(R * 8.0, 1.0);
    float en = e / max(R, 0.03);
    if (bb.w < 0.5) {
      float inside = 1.0 - smoothstep(-0.035, 0.006, e);
      float Tin = mix(0.78, 1.2, smoothstep(0.0, -0.45, en)) * (0.94 + 0.1 * n2);
      float front = exp(-pow(e / 0.02, 2.0)) * (0.25 + 0.25 * n2);
      float og = (1.0 - inside) * exp(-max(e, 0.0) / (0.035 + 0.12 * R)) * (1.0 - smoothstep(0.25, 0.7, e));
      float Tb = (Tin * inside + 0.62 * og + front) * b.w;
      T = tAdd(T, Tb);
      // Thin melted, bubbled char ring just outside the burning edge.
      float bub = smoothstep(-0.2, 0.5, snoise(vec4(q * 60.0, bb.x, tm * 1.5)));
      charMask = max(charMask, exp(-pow((e - 0.014) / 0.009, 2.0)) * smoothstep(0.0, 0.3, b.w) * (0.2 + 0.4 * bub));
    } else {
      // Burn-away: inside goes back to black; its front glows.
      float inside = 1.0 - smoothstep(-0.004, 0.006, e);
      T *= 1.0 - inside;
      float front = exp(-pow(e / 0.008, 2.0)) * (0.7 + 0.4 * n2) + 0.5 * exp(-abs(e) / 0.03) * (1.0 - inside);
      T = tAdd(T, front * b.w * (1.0 - 0.4 * inside));
      charMask = max(charMask, exp(-pow((e + 0.01) / 0.008, 2.0)) * b.w * 0.9 * step(0.05, T));
    }
  }

  // Diagonal burning strip of film.
  if (uDiag.x > 0.5 && uDiag2.y > 0.0) {
    vec2 ax = vec2(cos(uDiag.z), sin(uDiag.z));
    vec2 nm = vec2(-ax.y, ax.x);
    float u = dot(p, ax) - uDiag.y;   // 0 at the clean end, body for u < 0
    float v = dot(p, nm) - uDiag2.x;  // 0 at the top edge, body for v < 0
    float W = uDiag.w;
    float er = fbm4(vec3(u * 9.0, v * 5.0, uDiag2.z), tm * 0.8, 4);
    float bottom = -W * (0.62 + 0.18 * er);
    float sp = fbm4(vec3(u * 52.0, v * 40.0, uDiag2.z + 5.0), tm * 1.5, 3);
    // Slightly warped, not ruler-straight, edges.
    float vw = v + 0.0035 * snoise(vec4(u * 7.0, 0.0, uDiag2.z, tm * 0.3)) + 0.0012 * snoise(vec4(u * 40.0, 2.0, uDiag2.z, tm));
    float uw = u + 0.004 * snoise(vec4(v * 9.0, 1.0, uDiag2.z, tm * 0.3));
    float inTop = 1.0 - smoothstep(-px * 1.5, px * 1.5, vw);
    float inBot = smoothstep(bottom - 0.016, bottom + 0.016, v);
    float inEnd = 1.0 - smoothstep(-px * 1.5, px * 1.5, uw);
    float body = inTop * inBot * inEnd;
    // Hot near the top edge, cooler and pitted towards the eroded edge.
    float depth = clamp(-v / W, 0.0, 1.0);
    float Ts = mix(0.95, 0.72, smoothstep(0.0, 0.75, depth));
    float sp2 = fbm4(vec3(u * 14.0, v * 11.0, uDiag2.z + 9.0), tm * 1.1, 2);
    float pits = smoothstep(-0.25, 0.3, sp + 0.6 * sp2 + (0.6 - depth) * 1.2);
    Ts *= mix(0.55, 1.0, pits);
    // Sprocket holes near the clean end.
    // Embers scattered below the eroded edge.
    float below = (1.0 - inBot) * inTop * inEnd * smoothstep(bottom - W * 1.1, bottom, v);
    float gl = 0.5 + 0.5 * snoise(vec4(u * 70.0, v * 70.0, tm * 2.0, uDiag2.z));
    float em = (0.35 * smoothstep(-0.1, 0.4, sp + 0.35 * sp2) + 0.6 * smoothstep(0.55, 0.85, gl)) * below * (0.45 + 0.5 * smoothstep(bottom - W * 1.1, bottom, v));
    // Soft bloom around the slab (rounded at the corner, no notch).
    float dOut = length(vec2(max(u, 0.0), max(v, 0.0)));
    float bloom = exp(-dOut / 0.055) * (1.0 - body) * smoothstep(bottom - W * 0.2, bottom + W * 0.3, v) * 0.58 * (0.7 + 0.45 * (0.5 + 0.5 * snoise(vec4(p * 6.0, uDiag2.z, tm * 0.6))));
    float Td = (Ts * body + em + bloom) * uDiag2.y;
    T = tAdd(T, Td);
  }

  // Film-strip edges: dark grey bands with sprocket holes, horizontal streaks, grain.
  float lb = 1.0 - smoothstep(0.062, 0.068, uv.x);
  float rb = smoothstep(0.932, 0.938, uv.x);
  float band = max(lb, rb);
  float bx = lb > 0.0 ? uv.x / 0.068 : (1.0 - uv.x) / 0.068;
  float hy = (p.y + 0.5 + uStrip.y) * 2.0;
  float hole = texture(uSprocket, vec2(bx, fract(hy))).r * band;
  float row = floor(gl_FragCoord.y / max(uRes.y / 540.0, 1.0));
  float streak = hash2(uvec2(uint(row), key), 11u);
  // Clumpy grain (two scales), resolution-independent.
  vec2 gp = p * 900.0;
  float grain = 0.5 + 0.35 * snoise(vec4(gp, float(key) * 1.7, 0.0)) + 0.15 * (hash2(uvec2(gl_FragCoord.xy), key * 3u + 1u) - 0.5);
  vec3 strip = uStripCol * (0.55 + 0.5 * streak) * (0.8 + 0.4 * grain) * uStrip.x * uStrip.z * band * (1.0 - hole);
  // Frame line between frames: a darker bar across the flood.
  float fl = uStrip.w < 0.0 ? 1.0 : 1.0 - 0.07 * (1.0 - smoothstep(0.002, 0.016, abs(p.y - (0.5 - uStrip.w))));

  vec3 col = ramp(T) * (1.0 - 0.32 * hole) * fl;
  // Charred rim just outside a burning edge.
  col = mix(col, uChar * step(0.02, T), clamp(charMask, 0.0, 1.0));
  col += strip * (1.0 - smoothstep(0.0, 0.15, T));
  // Grain in the colour too (multiplicative: black stays black).
  float lum = max(col.r, max(col.g, col.b));
  col *= 1.0 + (grain - 0.5) * 0.16 * (1.0 - smoothstep(0.8, 1.0, lum));

  // Sparks: short motion-blurred bright particles.
  for (int i = 0; i < ${MAX_SPARKS}; i++) {
    vec4 s = uSpark[i];
    if (s.w <= 0.0) continue;
    vec2 v = uSparkV[i];
    vec2 q = p - s.xy;
    float reach = s.z * 4.0 + length(v);
    if (abs(q.x) > reach || abs(q.y) > reach) continue;
    float d = sdSegment(p, s.xy, s.xy - v);
    float w = s.z + px * 0.5;
    float core = exp(-pow(d / w, 2.0));
    float halo = exp(-d / (w * 2.2)) * 0.25;
    col += ramp(0.45 + 0.45 * s.w) * (core + halo) * min(s.w * 1.4, 1.2);
  }
  // Glowing curls (burning fibres).
  for (int i = 0; i < ${MAX_CURLS}; i++) {
    vec4 cu = uCurl[i];
    if (cu.w <= 0.0) continue;
    if (length(p - cu.xy) > cu.z * 1.15) continue;
    vec4 cb = uCurlB[i];
    vec2 pt = cu.xy;
    float dmin = 1e9, sAt = 0.0;
    float segL = cu.z / 12.0;
    for (int k = 0; k < 12; k++) {
      float sk = (float(k) + 0.5) / 12.0;
      float th = cb.x + cb.y * sk + cb.z * sk * sk;
      vec2 nx = pt + segL * vec2(cos(th), sin(th));
      float dd = sdSegment(p, pt, nx);
      if (dd < dmin) { dmin = dd; sAt = sk; }
      pt = nx;
    }
    float w = 0.0012 + px * 0.5;
    float line = exp(-pow(dmin / w, 2.0)) + 0.35 * exp(-dmin / (w * 3.5));
    col += ramp(0.62 + 0.4 * (1.0 - sAt)) * line * cu.w * smoothstep(0.0, 0.15, sAt) ;
  }
  outColor = vec4(col, 1.0);
}
`,
});

export const filmBurnSequence = makeBurn(SEQUENCE);
export const filmBurnTransition = makeBurn(TRANSITION);
