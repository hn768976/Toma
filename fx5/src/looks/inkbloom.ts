import { FINISH, NOISE } from '../lib/glsl';
import { Pass, makeRT } from '../lib/pixi';
import type { SceneFactory } from '../lib/PixiStage';
import { hash01, hexToLinear, mulberry32, smoothstep } from '../lib/random';

export interface InkParams {
  scenes: [string, string, string]; // the three scene colours
  loopFrames: number;
}

// Seed points for the three scenes, fixed at module level.
const rnd = mulberry32(0x1b100d);
const SEEDS: number[] = [];
const SEED_LAYOUT = [
  [[-0.12, 0.1], [0.04, -0.02], [-0.05, 0.2]],
  [[-0.5, 0.05], [0.42, -0.12], [0.08, 0.32]],
  [[0.05, 0.0], [-0.45, -0.25], [0.5, 0.25]],
];
SEED_LAYOUT.forEach((sc) =>
  sc.forEach(([x, y]) => SEEDS.push(x + (rnd() - 0.5) * 0.06, y + (rnd() - 0.5) * 0.06)),
);

const INK_FRAG = /* glsl */ `
in vec2 vUV; out vec4 finalColor;
uniform vec2 uRes;
uniform float uT;
uniform vec3 uCol0; uniform vec3 uCol1; uniform vec3 uCol2;
uniform vec4 uGrow;   // per-scene grow amount (x,y,z), w unused
uniform vec4 uEat;    // per-scene hole amount
uniform vec2 uSeed[9];
${NOISE}

// round droplets: signed distance (frame-height units) to the nearest dot
float dots(vec2 p, float scale, float prob, float sd) {
  vec2 g = p * scale;
  vec2 i = floor(g);
  float best = 1e3;
  for (int y = -1; y <= 1; y++)
    for (int x = -1; x <= 1; x++) {
      vec2 c = i + vec2(x, y);
      vec3 h = hash33u(uvec3(uvec2(ivec2(c) + 8192), uint(sd * 97.0)));
      if (h.z > prob) continue;
      float rad = mix(0.07, 0.36, pow(h.z / prob, 2.0));
      best = min(best, length(g - c - 0.2 - h.xy * 0.6) - rad);
    }
  return min(best, 1.0) / scale;
}

// clustered round blots with spiky splatter edges; returns signed distance-ish
// (positive inside, frame-height units). rmul scales every blot's radius.
float blots(vec2 p, float scale, float sd, float rmul) {
  vec2 g = p * scale;
  vec2 i = floor(g);
  float best = -1.0;
  for (int y = -1; y <= 1; y++)
    for (int x = -1; x <= 1; x++) {
      vec2 c = i + vec2(x, y);
      vec3 h = hash33u(uvec3(uvec2(ivec2(c) + 4096), uint(sd * 31.0) + 5u));
      if (h.z > 0.7) continue;
      vec2 ctr = c + 0.2 + 0.6 * h.xy;
      vec2 dv = g - ctr;
      float a = atan(dv.y, dv.x);
      float r0 = mix(0.34, 0.66, pow(fract(h.z * 7.13), 0.7)) * rmul;
      // ragged rim: a few lobes plus many short spikes
      float rim = 1.0 + 0.1 * gnoise(vec2(a * 1.6, h.x * 40.0)) + 0.07 * gnoise(vec2(a * 9.0, h.y * 40.0))
                + 0.05 * max(gnoise(vec2(a * 26.0, h.z * 40.0)), 0.0);
      best = max(best, r0 * rim - length(dv));
    }
  return best / scale;
}

// one ink scene: returns rgb (already masked)
// spread: how strongly the seeds confine the blots (low = blobs all over)
vec3 scene(vec2 p, int si, float grow, float eat, vec3 base, float crackAmt, float dropMode, float spread, float pale, vec2 nz, float roundBlots) {
  float sd = float(si) * 17.3 + 3.1;
  float t = uT;
  // domain warp, slowly drifting
  vec2 w1 = vec2(fbm(p * 1.6 + sd + vec2(0.05 * t, 0.0), 4), fbm(p * 1.6 + sd + 5.2 - vec2(0.0, 0.04 * t), 4));
  vec2 q = p + 0.2 * w1;
  float n = fbm(q * nz.y + sd + 0.03 * t, 5);
  float d = 10.0;
  for (int k = 0; k < 3; k++) d = min(d, length(p - uSeed[si * 3 + k]));
  float f = grow - spread * d + nz.x * n;
  if (roundBlots > 0.5) {
    // grow scales the blots' radius; the seeds bias where the cluster is densest
    // blots near the seeds appear first and the bloom spreads outward
    float gr = clamp((grow + 0.55) / 0.6, 0.0, 1.2);
    float rmul = clamp(gr * 1.2 - d * 1.5 + 0.25 * n, 0.0, 0.88);
    f = max(blots(p + 0.04 * w1, 3.4, sd, rmul), blots(p + 0.04 * w1 + 3.7, 1.9, sd + 5.0, rmul * 0.92));
  }
  // ragged, splattery edge
  f += 0.035 * fbm(q * 14.0 + sd * 2.0, 3) + 0.014 * gnoise(q * 48.0 + sd);
  float aa = max(fwidth(f), 1e-4) * 0.7;
  float mask = smoothstep(-aa, aa, f);
  // large holes eating the blot
  float hf = eat - 0.55 + 0.5 * fbm(q * 2.6 + sd + 9.0 + 0.02 * t, 4);
  // round black droplets (mostly in drop mode)
  float cluster = smoothstep(-0.3, 0.5, gnoise(p * 3.0 + sd + 11.0));
  float bd = dots(p + 0.02 * w1, 9.0, (0.3 * dropMode) * cluster, sd);
  float holeF = max(hf, -bd * 4.0);
  float holeAA = max(fwidth(holeF), 1e-4) * 0.7;
  float hole = smoothstep(-holeAA, holeAA, holeF);
  // small splats sitting right against the edge
  float od = dots(p + 0.02 * w1, 10.0, 0.5 * exp(min(f, 0.0) * 60.0) * step(-0.03, f), sd + 31.0);
  float odAA = max(fwidth(od), 1e-5) * 0.7;
  float outDrop = smoothstep(odAA, -odAA, od) * (1.0 - mask) * smoothstep(-0.7, -0.2, grow) * (1.0 - roundBlots);
  // flat, pale interior; only a thin darker band at the very edge
  float k = smoothstep(0.0, mix(0.06, 0.012, roundBlots), f);
  vec3 paleCol = mix(base, mix(vec3(0.92, 0.95, 0.86), vec3(0.84, 0.92, 0.66), roundBlots), pale * mix(1.0, 0.75 + 0.35 * smoothstep(-0.4, 0.4, fbm(q * 1.7 + sd + 3.0, 2)), roundBlots));
  vec3 col = mix(base * 0.55, paleCol, k);
  float tone = smoothstep(-0.55, 0.55, fbm(q * 1.3 + sd + 40.0, 3));
  col *= mix(0.8, 1.08, tone);
  // fine crackle and dry-brush scratches inside
  float r = ridged(q * 5.0 + sd, 5);
  float crack = smoothstep(0.86, 0.94, r);
  vec2 sq = mat2(0.8, -0.6, 0.6, 0.8) * q;
  float scratch = smoothstep(0.55, 0.85, gnoise(vec2(sq.x * 70.0, sq.y * 7.0) + sd)) * smoothstep(-0.1, 0.4, fbm(q * 4.0 + sd + 21.0, 2));
  col = mix(col, base * 0.45, crackAmt * crack);
  col = mix(col, mix(base, vec3(0.5), 0.3) * 0.75, mix(0.5, 0.8, roundBlots) * scratch);
  // dry-brush streaks dragged across the blots (scene 1)
  float drag = smoothstep(0.35, 0.8, gnoise(vec2(sq.x * 3.0, sq.y * 38.0) + sd * 2.0)) * smoothstep(-0.2, 0.5, fbm(q * 2.2 + sd + 44.0, 2));
  col = mix(col, base * vec3(0.75, 0.85, 0.35), 0.55 * drag * roundBlots);
  // white droplets (drop mode)
  float wdd = dots(p + 0.02 * w1, 11.0, 0.3 * dropMode * (1.0 - cluster * 0.7), sd + 77.0);
  float wAA = max(fwidth(wdd), 1e-5) * 0.7;
  float wd = smoothstep(wAA, -wAA, wdd) * mask;
  col = mix(col, vec3(0.9, 0.88, 0.86), wd);
  float bigHole = smoothstep(-holeAA, holeAA, hf);
  float m = mask * (1.0 - max(bigHole, hole * (1.0 - wd)));
  vec3 c = col * m;
  // dark ink wash with grungy texture in the gaps around the blots
  float washF = f + mix(0.16, 0.14, roundBlots) + 0.22 * fbm(q * 2.0 + sd + 60.0, 3);
  float wash = smoothstep(0.0, 0.25, washF) * (1.0 - m) * smoothstep(-0.7, -0.15, grow);
  float grunge = smoothstep(-0.2, 0.6, fbm(q * 9.0 + sd + 13.0, 4)) * (0.6 + 0.4 * gnoise(q * 40.0));
  // scene 1: a few grainy, sponge-like olive patches on clean black instead of smoke
  float patchMask = smoothstep(0.05, 0.3, fbm(p * 1.4 + sd + 70.0, 3));
  float grain = smoothstep(-0.15, 0.45, gnoise(p * 160.0 + sd) + 0.6 * gnoise(p * 45.0 + sd));
  grunge = mix(grunge, patchMask * (0.35 + 0.75 * grain), roundBlots);
  vec3 washCol = mix(base * base * 0.22, base * vec3(0.58, 0.47, 0.22), roundBlots);
  c += washCol * wash * grunge * (1.0 - 0.7 * dropMode);
  if (roundBlots > 0.5) {
    vec2 gq = mat2(0.94, 0.34, -0.34, 0.94) * q;
    float blade = smoothstep(0.45, 0.7, gnoise(vec2(gq.x * 1.6, gq.y * 90.0) + sd)) * smoothstep(0.2, 0.7, fbm(q * 2.5 + sd + 90.0, 2));
    c += base * vec3(0.9, 1.15, 0.4) * 1.3 * blade * (1.0 - m) * smoothstep(0.1, -0.6, p.x) * smoothstep(-0.7, -0.2, grow);
  }
  c += paleCol * 0.85 * outDrop;
  return c;
}

void main() {
  vec2 p = (vUV - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  vec3 c = vec3(0.0);
  if (uGrow.x > -0.9) c += scene(p, 0, uGrow.x, uEat.x, uCol0, 0.35, 0.0, 0.3, 0.62, vec2(0.62, 4.2), 1.0);
  if (uGrow.y > -0.9) c += scene(p, 1, uGrow.y, uEat.y, uCol1, 0.4, 0.0, 0.6, 0.25, vec2(0.4, 3.2), 0.0);
  if (uGrow.z > -0.9) c += scene(p, 2, uGrow.z, uEat.z, uCol2, 0.3, 1.0, 1.0, 0.1, vec2(0.32, 3.2), 0.0);
  finalColor = vec4(c, 1.0);
}
`;

const OUT_FRAG = /* glsl */ `
in vec2 vUV; out vec4 finalColor;
uniform sampler2D uSrc;
uniform float uFrameMod;
uniform float uGlitch;    // 0..1
uniform float uGSeed;
${NOISE}
${FINISH}
void main() {
  vec2 uv = vUV;
  vec3 c;
  if (uGlitch > 0.0) {
    float band = floor(uv.y * 18.0 + hash21(vec2(uGSeed, 3.0)) * 4.0);
    float hb = hash21(vec2(band, uGSeed));
    float shift = (hb - 0.5) * 0.12 * uGlitch * step(0.45, hb);
    vec2 u2 = vec2(uv.x + shift, uv.y);
    float split = 0.008 * uGlitch;
    c = vec3(texture(uSrc, u2 + vec2(split, 0.0)).r, texture(uSrc, u2).g, texture(uSrc, u2 - vec2(split, 0.0)).b);
    if (hash21(vec2(uGSeed, 9.0)) > 0.6) c = c.gbr * 1.2;   // a colour-swapped flash frame
  } else {
    c = texture(uSrc, uv).rgb;
  }
  c = 1.0 - exp(-c * 1.6);
  finalColor = vec4(finishColor(linearToSrgb(c), uFrameMod, 0.015), 1.0);
}
`;

/** 0 → nothing, rises to `peak`, falls back below zero */
function growCurve(tau: number, up0: number, up1: number, peak: number, down0: number, down1: number, shrink: number) {
  return -0.55 + (peak + 0.55) * smoothstep(up0, up1, tau) - shrink * smoothstep(down0, down1, tau);
}

export const inkScene: SceneFactory<InkParams> = ({ renderer, w, h }, p) => {
  const rt = makeRT(w, h);
  const seedValue = [] as number[];
  for (let i = 0; i < 9; i++) seedValue.push(SEEDS[i * 2], SEEDS[i * 2 + 1]);
  const ink = new Pass(w, h, INK_FRAG, {
    uRes: { value: [w, h], type: 'vec2<f32>' },
    uT: { value: 0, type: 'f32' },
    uCol0: { value: hexToLinear(p.scenes[0]), type: 'vec3<f32>' },
    uCol1: { value: hexToLinear(p.scenes[1]), type: 'vec3<f32>' },
    uCol2: { value: hexToLinear(p.scenes[2]), type: 'vec3<f32>' },
    uGrow: { value: [-1, -1, -1, 0], type: 'vec4<f32>' },
    uEat: { value: [0, 0, 0, 0], type: 'vec4<f32>' },
    uSeed: { value: new Float32Array(seedValue), type: 'vec2<f32>', size: 9 },
  });
  const out = new Pass(
    w,
    h,
    OUT_FRAG,
    {
      uFrameMod: { value: 0, type: 'f32' },
      uGlitch: { value: 0, type: 'f32' },
      uGSeed: { value: 0, type: 'f32' },
    },
    { uSrc: rt.source },
  );
  return {
    render(frame) {
      const t = frame / 30;
      // scene 1: lime blot grows 0.2–2s, morphs, shrinks away 2.9–4.1s
      const g0 = t < 4.3 ? growCurve(t, 0.1, 1.6, 0.06, 3.0, 4.1, 0.8) : -1;
      // scene 2: sage shapes 3.9–8.1s, eaten by black holes from 6.6s
      const t1 = t - 3.9;
      const g1 = t1 > 0 && t < 8.3 ? growCurve(t1, 0.0, 1.8, 0.42, 3.4, 4.3, 0.75) : -1;
      const e1 = 0.42 + 0.6 * smoothstep(2.4, 4.1, t1);
      // scene 3: red field fills the frame 7.9–10s, dissolves to black 11.6–13.6s
      const t2 = t - 7.9;
      const g2 = t2 > 0 ? growCurve(t2, 0.0, 2.2, 1.5, 4.3, 5.9, 2.4) : -1;
      const e2 = 0.12 + 1.0 * smoothstep(3.9, 5.6, t2);
      ink.u.uT = t;
      ink.u.uGrow = [g0, g1, g2, 0];
      ink.u.uEat = [0.0, e1, e2, 0];
      ink.draw(renderer, rt);
      // a 2–3 frame glitch flicker at each scene change (frames 119–121, 239–241, 359–360)
      let glitch = 0;
      for (const c of [120, 240, 360]) {
        const d = frame - c;
        if (d >= -1 && d <= (c === 360 ? 0 : 1)) glitch = 0.6 + 0.4 * hash01(frame, 41);
      }
      out.u.uGlitch = glitch;
      out.u.uGSeed = Math.floor(hash01(frame, 7) * 1000);
      out.u.uFrameMod = frame % p.loopFrames;
      out.draw(renderer);
    },
  };
};
