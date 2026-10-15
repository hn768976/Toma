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

// one ink scene: returns rgb (already masked)
vec3 scene(vec2 p, int si, float grow, float eat, vec3 base, float crackAmt, float dropMode) {
  float sd = float(si) * 17.3 + 3.1;
  float t = uT;
  // domain warp, slowly drifting
  vec2 w1 = vec2(fbm(p * 1.6 + sd + vec2(0.05 * t, 0.0), 4), fbm(p * 1.6 + sd + 5.2 - vec2(0.0, 0.04 * t), 4));
  vec2 q = p + 0.3 * w1;
  float n = fbm(q * 2.4 + sd + 0.03 * t, 5);
  float d = 10.0;
  for (int k = 0; k < 3; k++) d = min(d, length(p - uSeed[si * 3 + k]));
  float f = grow - d + 0.2 * n;
  // ragged, feathery edge
  f += 0.035 * fbm(q * 13.0 + sd * 2.0, 3) + 0.012 * gnoise(q * 45.0 + sd);
  float aa = max(fwidth(f), 1e-4) * 0.7;
  float mask = smoothstep(-aa, aa, f);
  // large holes eating the blot
  float hf = eat - 0.55 + 0.5 * fbm(q * 2.6 + sd + 9.0 + 0.02 * t, 4);
  // round black droplets, densest near the edge (and everywhere in drop mode)
  float edgeBand = exp(-abs(f) * 7.0);
  float cluster = smoothstep(-0.3, 0.5, gnoise(p * 3.0 + sd + 11.0));
  float bd = dots(p + 0.02 * w1, 9.0, (0.08 + 0.4 * edgeBand + 0.15 * dropMode) * cluster, sd);
  float holeF = max(hf, -bd * 4.0);
  float holeAA = max(fwidth(holeF), 1e-4) * 0.7;
  float hole = smoothstep(-holeAA, holeAA, holeF);
  // coloured droplets scattered just outside the edge
  float od = dots(p + 0.02 * w1, 14.0, 0.5 * exp(min(f, 0.0) * 9.0) * step(-0.4, f), sd + 31.0);
  float odAA = max(fwidth(od), 1e-5) * 0.7;
  float outDrop = smoothstep(odAA, -odAA, od) * (1.0 - mask) * smoothstep(-0.7, -0.2, grow);
  // interior shading: lighter centre, darker edge
  float k = smoothstep(0.0, 0.3, f);
  vec3 col = base * mix(0.45, 1.15, k) + base * base * 0.45 * k * k;
  // broad tonal variation across the field
  float tone = smoothstep(-0.55, 0.55, fbm(q * 1.3 + sd + 40.0, 3));
  col *= mix(0.55, 1.2, tone);
  // crackle / veins (ridged noise) and mottling
  float r = ridged(q * 4.2 + sd, 5);
  float crack = smoothstep(0.78, 0.9, r);
  float mott = fbm(q * 22.0 + sd, 3);
  col *= (1.0 - crackAmt * crack) * (0.72 + 0.5 * mott);
  // white droplets (drop mode)
  float wdd = dots(p + 0.02 * w1, 11.0, 0.3 * dropMode * (1.0 - cluster * 0.7), sd + 77.0);
  float wAA = max(fwidth(wdd), 1e-5) * 0.7;
  float wd = smoothstep(wAA, -wAA, wdd) * mask;
  col = mix(col, vec3(0.9, 0.88, 0.86), wd);
  float bigHole = smoothstep(-holeAA, holeAA, hf);
  float m = mask * (1.0 - max(bigHole, hole * (1.0 - wd)));
  vec3 c = col * m;
  // slight glow hugging the edge
  c += base * 0.06 * exp(max(-f, 0.0) * -40.0) * (1.0 - mask) * smoothstep(-0.7, -0.2, grow);
  c += base * 0.75 * outDrop;
  return c;
}

void main() {
  vec2 p = (vUV - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  vec3 c = vec3(0.0);
  if (uGrow.x > -0.9) c += scene(p, 0, uGrow.x, uEat.x, uCol0, 0.8, 0.0);
  if (uGrow.y > -0.9) c += scene(p, 1, uGrow.y, uEat.y, uCol1, 0.5, 0.0);
  if (uGrow.z > -0.9) c += scene(p, 2, uGrow.z, uEat.z, uCol2, 0.35, 1.0);
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
      const g0 = t < 4.3 ? growCurve(t, 0.15, 2.2, 0.2, 3.0, 4.1, 0.85) : -1;
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
