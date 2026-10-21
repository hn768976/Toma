import { Vector3, Vector4 } from "three";
import type { Look } from "../lib/ShaderOverlay";
import { LOOP, TAU, hash01, mulberry32, pairKey, pairRng, periodicNoise, range } from "../lib/random";
import { getScratchTexture } from "../lib/textures";
import { PALETTE, hexToRgb } from "../palette";

const SPECKS = 40;
const LEAKS = 5;
const ASPECT = 16 / 9;

// Vertical scratch events inside the 600-frame loop: one every 2-4 s,
// lasting 0.3-1 s, at a random x. None straddles the loop point.
const scratchRng = mulberry32(0x5c42);
const scratches: { start: number; dur: number; x: number; drift: number; variant: number; gain: number }[] = [];
for (let t = 20; t < LOOP - 40; ) {
  const dur = Math.floor(range(scratchRng, 9, 30));
  if (t + dur > LOOP - 4) break;
  scratches.push({
    start: t,
    dur,
    x: range(scratchRng, -0.8, 0.8),
    drift: range(scratchRng, -0.01, 0.01),
    variant: Math.floor(scratchRng() * 16),
    gain: range(scratchRng, 0.45, 0.85),
  });
  t += dur + Math.floor(range(scratchRng, 55, 115));
}

// Edge leaks: each sits on a point of the border that wanders (periodic), and breathes.
const leakRng = mulberry32(0x1ea4);
const leaks = Array.from({ length: LEAKS }, (_, i) => ({
  u0: (i + leakRng() * 0.6) / LEAKS,
  wander: periodicNoise(mulberry32(0x1e00 + i), 1, 2),
  breathe: periodicNoise(mulberry32(0x1e10 + i), 1, 4),
  size: periodicNoise(mulberry32(0x1e20 + i), 1, 3),
  colour: [0, 1, 2, 0, 1][i],
  gain: range(leakRng, 0.6, 1) * (i === 2 ? 0.6 : 1),
}));

// Point on the frame border for perimeter coordinate u in [0,1), pushed outside.
const borderPoint = (u: number): [number, number] => {
  const w = ASPECT, h = 1;
  const per = 2 * (w + h);
  let d = (((u % 1) + 1) % 1) * per;
  const out = 0.06;
  if (d < w) return [-w / 2 + d, h / 2 + out];
  d -= w;
  if (d < h) return [w / 2 + out, h / 2 - d];
  d -= h;
  if (d < w) return [w / 2 - d, -h / 2 - out];
  d -= w;
  return [-w / 2 - out, -h / 2 + d];
};

const vignetteBreath = periodicNoise(mulberry32(0x7166), 1, 3);

export const makeVintage = (mono: boolean): Look => ({
  createUniforms: () => {
    const c = mono ? PALETTE.VintageMono : PALETTE.VintageColour;
    return {
      uLeak: { value: Array.from({ length: LEAKS }, () => new Vector4()) },
      uLeakCol: { value: [hexToRgb(c.leakA), hexToRgb(c.leakB), hexToRgb(c.leakC)].map((v) => new Vector3(...v)) },
      uSpeck: { value: Array.from({ length: SPECKS }, () => new Vector4()) },
      uSpeckB: { value: Array.from({ length: SPECKS }, () => new Vector4()) },
      uSpeckCol: { value: [c.speckA, c.speckB, c.speckC, c.speckD].map((h) => new Vector3(...hexToRgb(h))) },
      uScratch: { value: [new Vector4(), new Vector4()] },
      uScratchTex: { value: getScratchTexture() },
      uVig: { value: 0.1 },
      uVigCol: { value: new Vector3(...hexToRgb(c.vignette)) },
      uFlicker: { value: 1 },
      uKey: { value: 0 },
    };
  },
  update: (frame, u) => {
    const t = frame % LOOP;
    const ph = t / LOOP;
    // Flicker +-4% from a hash of floor(frame / 2) mod 300.
    u.uFlicker.value = 1 + 0.04 * (2 * hash01(pairKey(frame), 0xf11c) - 1);
    u.uKey.value = pairKey(frame);
    u.uVig.value = 0.035 * (1 + 0.25 * vignetteBreath(ph));

    const L = u.uLeak.value as Vector4[];
    leaks.forEach((lk, i) => {
      const [x, y] = borderPoint(lk.u0 + 0.06 * lk.wander(ph));
      const inten = lk.gain * Math.max(0, 0.55 + 0.45 * lk.breathe(ph));
      const size = 0.2 + 0.08 * lk.size(ph);
      L[i].set(x, y, size, inten * inten);
    });

    // Dust: 20-40 specks, re-dealt every 2 frames.
    const rng = pairRng(frame, 0xd057);
    const count = 20 + Math.floor(rng() * 13);
    const S = u.uSpeck.value as Vector4[];
    const SB = u.uSpeckB.value as Vector4[];
    for (let i = 0; i < SPECKS; i++) {
      if (i >= count) {
        S[i].set(0, 0, 0, 0);
        continue;
      }
      const big = rng() < 0.15;
      const size = big ? range(rng, 0.004, 0.008) : range(rng, 0.0015, 0.0035);
      const colourRoll = rng();
      const colour = mono ? Math.floor(rng() * 4) : colourRoll < 0.5 ? 0 : colourRoll < 0.6 ? 1 : colourRoll < 0.88 ? 2 : 3;
      S[i].set(range(rng, -0.87, 0.87), range(rng, -0.49, 0.49), size, range(rng, 0.45, 1.0));
      // ~15% are fibres/hairs: long, thin and bent.
      const fibre = rng() < 0.15;
      if (fibre) S[i].z *= 2.6;
      SB[i].set(colour, rng() * TAU, fibre ? range(rng, 7, 12) : range(rng, 1, 2.6), rng() * 100);
    }

    const SC = u.uScratch.value as Vector4[];
    SC[0].set(0, 0, 0, 0);
    SC[1].set(0, 0, 0, 0);
    let n = 0;
    for (const s of scratches) {
      if (t >= s.start && t < s.start + s.dur && n < 2) {
        const k = (t - s.start) / s.dur;
        const on = Math.min(1, k * 6, (1 - k) * 6);
        const flick = 0.65 + 0.35 * hash01(pairKey(frame), 0x5c00 + s.start);
        SC[n++].set(s.x + s.drift * k, s.gain * on * flick, s.variant, (s.start * 0.137) % 1 + Math.floor(t / 2) * 0.031);
      }
    }
  },
  fragment: /* glsl */ `
uniform vec4 uLeak[${LEAKS}];
uniform vec3 uLeakCol[3];
uniform vec4 uSpeck[${SPECKS}];
uniform vec4 uSpeckB[${SPECKS}];
uniform vec3 uSpeckCol[4];
uniform vec4 uScratch[2];
uniform sampler2D uScratchTex;
uniform float uVig;
uniform vec3 uVigCol;
uniform float uFlicker;
uniform float uKey;

void main() {
  vec2 p = frameP();
  float A = aspect() * 0.5;
  float px = pxSize();
  vec3 col = vec3(0.0);

  // Distance to the nearest frame edge (0 at the border, 0.5 at the centre).
  float edge = -sdRoundBox(p, vec2(A, 0.5), 0.3);
  // Nothing from the vignette or the leaks reaches the middle of the frame.
  float keepOut = 1.0 - smoothstep(0.06, 0.3, edge);

  // Soft vignette: a dim lift towards the corners only (centre is exactly 0).
  vec2 e = p / vec2(A, 0.5);
  float rv = length(e * vec2(0.95, 0.9));
  float vig = smoothstep(0.62, 1.38, rv);
  vig *= 0.8 + 0.2 * nLoop(p * 1.6, 0.5, 11.0);
  col += uVigCol * vig * vig * uVig * 1.6 * keepOut;

  // Edge leaks breathing at the borders.
  for (int i = 0; i < ${LEAKS}; i++) {
    vec4 L = uLeak[i];
    vec2 q = p - L.xy;
    float w = 0.75 + 0.25 * nLoop(q * 3.0 + float(i), 0.6, float(i) * 2.0);
    float g = exp(-dot(q, q) / (L.z * L.z * w));
    col += uLeakCol[i % 3] * g * L.w * 0.4;
  }
  col *= keepOut;

  // Vertical scratches (Canvas-drawn profiles) - thin, bright, slightly wavy.
  for (int i = 0; i < 2; i++) {
    vec4 s = uScratch[i];
    if (s.y <= 0.0) continue;
    float x = s.x + 0.0016 * sin(p.y * 9.0 + s.w * 20.0) + 0.0008 * sin(p.y * 37.0 + s.w * 7.0);
    float w = (0.0007 + px * 0.6) * (0.6 + 0.8 * (0.5 + 0.5 * snoise(vec4(p.y * 14.0, s.w * 9.0, 0.0, 0.0))));
    float prof = exp(-pow((p.x - x) / w, 2.0));
    float along = texture(uScratchTex, vec2((s.z + 0.5) / 16.0, fract(p.y * 0.6 + s.w))).r;
    float span = smoothstep(-0.05, 0.08, p.y - (fract(s.w * 3.1) - 0.75)) * (1.0 - smoothstep(-0.08, 0.05, p.y - (fract(s.w * 3.1) - 0.75) - 0.55 - 0.4 * fract(s.w * 7.3)));
    vec3 tint = mod(s.z, 3.0) < 1.0 ? vec3(0.92, 0.95, 0.95) : uLeakCol[0] * 1.3;
    col += tint * prof * along * s.y * span;
  }

  // Dust specks: small irregular blobs, some elongated.
  for (int i = 0; i < ${SPECKS}; i++) {
    vec4 s = uSpeck[i];
    if (s.z <= 0.0) continue;
    vec2 q = p - s.xy;
    if (abs(q.x) > s.z * 4.0 || abs(q.y) > s.z * 4.0) continue;
    vec4 b = uSpeckB[i];
    float c = cos(b.y), sn = sin(b.y);
    q = mat2(c, sn, -sn, c) * q;
    q.y += (fract(b.w) - 0.5) * 3.0 * q.x * q.x / max(s.z, 1e-4) * step(5.0, b.z);
    q.y *= b.z;
    float ang = atan(q.y, q.x);
    float rr = s.z * (0.8 + 0.35 * snoise(vec4(cos(ang), sin(ang), b.w, 0.0)));
    float d = length(q) - rr;
    float soft = px * 1.0 + s.z * mix(0.6, 0.12, step(5.0, b.z));
    float m = 1.0 - smoothstep(-soft, soft, d);
    col += uSpeckCol[int(b.x + 0.5)] * m * s.w * 0.85;
  }

  // Grain on lit areas only (multiplicative, so empty black stays 0).
  float gr = hash2(uvec2(gl_FragCoord.xy), uint(uKey) * 7u + 3u) - 0.5;
  col *= (1.0 + 0.22 * gr) * uFlicker;
  outColor = vec4(col, 1.0);
}
`,
});

export const vintageColour = makeVintage(false);
export const vintageMono = makeVintage(true);
