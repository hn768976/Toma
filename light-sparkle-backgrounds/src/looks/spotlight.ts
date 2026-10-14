import { UniformGroup } from "pixi.js";
import type { LookFactory } from "../kit/engine";
import { CYCLES, DESIGN_H, DESIGN_W, glintEnvelope, hexToNum, hexToRgb, mod, pulse, TAU, type Glint } from "../kit/loop";
import { addParticle, group, layer, setSize } from "../kit/particles";
import { mulberry32, pick, range } from "../kit/random";

export type SpotlightParams = {
  seed: number;
  bgEdge: string;
  bgCenter: string;
  rays: string;
  sparkles: string[]; // tints, white -> coloured
};

const NRAYS = 24;
const SOURCE = { x: DESIGN_W * 0.5, y: -0.05 * DESIGN_H };

const GLSL = /* glsl */ `
uniform vec3 uBgEdge;
uniform vec3 uBgCenter;
uniform vec3 uRayColor;
uniform vec4 uRays[${NRAYS}]; // angle (rad, 0 = straight down), width (rad), intensity, -
uniform float uShimmer;

float rayField(vec2 p) {
  vec2 v = p - vec2(${SOURCE.x.toFixed(1)}, ${SOURCE.y.toFixed(1)});
  float ang = atan(v.x, v.y);
  float s = 0.0;
  for (int i = 0; i < ${NRAYS}; i++) {
    float d = (ang - uRays[i].x) / uRays[i].y;
    s += uRays[i].z * exp(-d * d);
  }
  return s;
}

vec3 background(vec2 p) {
  vec2 v = p - vec2(${SOURCE.x.toFixed(1)}, ${SOURCE.y.toFixed(1)});
  float r = length(v) / 2160.0;
  float ang = atan(v.x, v.y);
  // Background: deep at the edges, blue pooled under the source.
  vec2 q = (p - vec2(1920.0, 380.0)) / vec2(2350.0, 1650.0);
  float gd = clamp(length(q), 0.0, 1.4);
  vec3 bg = mix(uBgCenter, uBgEdge, smoothstep(0.0, 1.0, pow(gd, 0.85)));
  // Rays: ~140 degree fan, strong falloff to ~80% of the frame height.
  float cone = smoothstep(1.32, 1.02, abs(ang));
  float fall = exp(-pow(r / 0.56, 1.7));
  float rays = rayField(p);
  float haze = 0.22 * exp(-pow(r / 0.45, 1.5)) * smoothstep(1.5, 0.6, abs(ang));
  float glow = 0.9 * exp(-r * r / 0.006) + 0.35 * exp(-r * r / 0.04);
  vec3 col = bg + uRayColor * (rays * cone * fall * 0.30 * uShimmer + haze) + mix(uRayColor, vec3(1.0), 0.6) * glow;
  return col;
}
`;

export const spotlight =
  (params: SpotlightParams): LookFactory =>
  (kit) => {
    const rng = mulberry32(params.seed);
    const tints = params.sparkles.map(hexToNum);

    // ---- Rays: fixed parameters, whole-cycle sway and flicker -----------------
    type Ray = { a0: number; w: number; i0: number; swayA: number; swayK: number; swayP: number; flK: number; flP: number };
    const rays: Ray[] = [];
    const halfFan = (70 * Math.PI) / 180;
    for (let i = 0; i < NRAYS; i++) {
      const base = -halfFan + (2 * halfFan * (i + 0.5)) / NRAYS;
      rays.push({
        a0: base + range(rng, -0.04, 0.04),
        w: range(rng, 0.012, 0.05),
        i0: range(rng, 0.35, 1.0) * (1 - 0.35 * Math.abs(base / halfFan)),
        swayA: range(rng, 0.008, 0.025),
        swayK: pick(rng, [1, 1, 2]),
        swayP: rng() * TAU,
        flK: pick(rng, [2, 3, 4, 5, 6]),
        flP: rng() * TAU,
      });
    }
    const rayData = new Float32Array(NRAYS * 4);
    const rayAt = (ph: number) => {
      rays.forEach((r, i) => {
        rayData[i * 4] = r.a0 + r.swayA * Math.sin(TAU * r.swayK * ph + r.swayP);
        rayData[i * 4 + 1] = r.w;
        rayData[i * 4 + 2] = r.i0 * (0.7 + 0.3 * Math.cos(TAU * r.flK * ph + r.flP));
        rayData[i * 4 + 3] = 0;
      });
    };
    // Same field as the shader (without cone/falloff), used to brighten sparkles inside rays.
    const rayField = (x: number, y: number) => {
      const vx = x - SOURCE.x;
      const vy = y - SOURCE.y;
      const ang = Math.atan2(vx, vy);
      const r = Math.hypot(vx, vy) / DESIGN_H;
      let s = 0;
      for (let i = 0; i < NRAYS; i++) {
        const d = (ang - rayData[i * 4]) / rayData[i * 4 + 1];
        s += rayData[i * 4 + 2] * Math.exp(-d * d);
      }
      const cone = Math.min(1, Math.max(0, (1.32 - Math.abs(ang)) / 0.3));
      return Math.min(1.5, s) * cone * Math.exp(-Math.pow(r / 0.75, 1.7));
    };

    // ---- Sparkles --------------------------------------------------------------
    const specks = layer(kit.dot);
    const flares4 = layer(kit.flare4);
    const flares6 = layer(kit.flare6);
    const cores = layer(kit.dot);
    const streaks = layer(kit.streak);

    const WRAP_M = 120;
    const wrapH = DESIGN_H + 2 * WRAP_M;
    type Speck = { p: ReturnType<typeof addParticle>; x0: number; y0: number; n: number; swA: number; swK: number; swP: number; size: number; a: number; k: number; phi: number; sh: number };
    const sp: Speck[] = [];
    for (let i = 0; i < 5000; i++) {
      const p = addParticle(specks, kit.dot);
      const roll = rng();
      // 55% fall one cycle per loop, 15% two cycles, 30% hover (closed bob path).
      const n = roll < 0.55 ? 1 : roll < 0.7 ? 2 : 0;
      p.tint = pick(rng, tints);
      sp.push({
        p,
        x0: range(rng, 0, DESIGN_W),
        y0: range(rng, 0, wrapH),
        n,
        swA: range(rng, 6, 30),
        swK: pick(rng, [1, 2, 3]),
        swP: rng() * TAU,
        size: 36 + 80 * Math.pow(rng(), 2.6),
        a: 0.25 + 0.75 * Math.pow(rng(), 1.5),
        k: pick(rng, CYCLES),
        phi: rng() * TAU,
        sh: range(rng, 1, 4),
      });
    }

    type Flare = { p: ReturnType<typeof addParticle>; x: number; y: number; size: number; a: number; k: number; phi: number; bobP: number };
    const meds: Flare[] = [];
    for (let i = 0; i < 150; i++) {
      const six = rng() < 0.22;
      const tex = six ? kit.flare6 : kit.flare4;
      const p = addParticle(six ? flares6 : flares4, tex);
      p.rotation = range(rng, -0.08, 0.08) + (six ? Math.PI / 6 : 0);
      p.tint = pick(rng, tints);
      meds.push({ p, x: range(rng, 0, DESIGN_W), y: range(rng, 0, DESIGN_H * 0.95), size: 130 + 300 * Math.pow(rng(), 1.8), a: range(rng, 0.3, 0.7), k: pick(rng, CYCLES), phi: rng() * TAU, bobP: rng() * TAU });
    }

    type Big = { core: ReturnType<typeof addParticle>; h: ReturnType<typeof addParticle>; v: ReturnType<typeof addParticle>; x: number; y: number; core0: number; len: number; a: number; k: number; phi: number; bobP: number };
    const bigs: Big[] = [];
    for (let i = 0; i < 25; i++) {
      const core = addParticle(cores, kit.dot);
      const h = addParticle(streaks, kit.streak);
      const v = addParticle(streaks, kit.streak);
      const tilt = range(rng, -0.05, 0.05);
      h.rotation = tilt;
      v.rotation = Math.PI / 2 + tilt;
      const t = pick(rng, tints);
      core.tint = t;
      h.tint = t;
      v.tint = t;
      // Big flares sit mostly in the ray fan.
      const ang = range(rng, -1.0, 1.0);
      const rr = range(rng, 0.15, 0.85) * DESIGN_H;
      bigs.push({ core, h, v, x: Math.min(DESIGN_W - 150, Math.max(150, SOURCE.x + Math.sin(ang) * rr * 1.5)), y: SOURCE.y + Math.cos(ang) * rr, core0: range(rng, 260, 480), len: range(rng, 700, 1700), a: range(rng, 0.45, 0.8), k: pick(rng, [1, 2, 3, 4]), phi: rng() * TAU, bobP: rng() * TAU });
    }

    // ~6 glints per second on the flares -> 120 per loop.
    const nFl = meds.length + bigs.length;
    const glints: Glint[] = [];
    for (let i = 0; i < 120; i++) glints.push({ target: Math.floor(rng() * nFl), start: Math.floor(rng() * 600), dur: Math.floor(range(rng, 9, 16)), gain: range(rng, 0.7, 1.3) });
    const boost = new Float32Array(nFl);

    const uniforms = new UniformGroup({
      uBgEdge: { value: new Float32Array(hexToRgb(params.bgEdge)), type: "vec3<f32>" },
      uBgCenter: { value: new Float32Array(hexToRgb(params.bgCenter)), type: "vec3<f32>" },
      uRayColor: { value: new Float32Array(hexToRgb(params.rays)), type: "vec3<f32>" },
      uRays: { value: rayData, type: "vec4<f32>", size: NRAYS },
      uShimmer: { value: 1, type: "f32" },
    });

    return {
      glsl: GLSL,
      uniforms,
      sprites: group(cores, streaks, specks, flares4, flares6),
      post: { bloom1: 0.7, bloom2: 0.45, grain: 0.015, dither: true, spriteGain: 1, screen: true },
      update(frame) {
        const ph = frame / 600;
        rayAt(ph);
        uniforms.uniforms.uShimmer = 0.92 + 0.08 * Math.cos(TAU * 3 * ph);
        for (const s of sp) {
          let x = s.x0;
          let y: number;
          if (s.n > 0) {
            y = mod(s.y0 + s.n * wrapH * ph, wrapH) - WRAP_M;
            x += s.swA * Math.sin(TAU * s.swK * ph + s.swP);
          } else {
            y = s.y0 - WRAP_M + s.swA * 0.6 * Math.sin(TAU * ph + s.swP);
            x += s.swA * 0.5 * Math.cos(TAU * ph + s.swP);
          }
          s.p.x = x;
          s.p.y = y;
          const tw = pulse(ph, s.k, s.phi, s.sh);
          const lit = 0.3 + 0.9 * rayField(x, y);
          s.p.alpha = Math.min(1, s.a * (0.25 + 0.75 * tw) * lit);
          setSize(s.p, s.size * (0.8 + 0.25 * tw));
        }
        boost.fill(0);
        for (const g of glints) boost[g.target] = Math.max(boost[g.target], g.gain * glintEnvelope(frame, g));
        meds.forEach((m, i) => {
          const tw = pulse(ph, m.k, m.phi, 2);
          const b = boost[i];
          m.p.x = m.x + 10 * Math.cos(TAU * ph + m.bobP);
          m.p.y = m.y + 14 * Math.sin(TAU * ph + m.bobP);
          const lit = 0.55 + 0.6 * rayField(m.p.x, m.p.y);
          m.p.alpha = Math.min(1, m.a * (0.35 + 0.65 * tw) * lit * (1 + 1.0 * b));
          setSize(m.p, m.size * (0.75 + 0.25 * tw) * (1 + 0.9 * b));
        });
        bigs.forEach((g, j) => {
          const tw = pulse(ph, g.k, g.phi, 1.5);
          const b = boost[meds.length + j];
          const x = g.x + 12 * Math.cos(TAU * ph + g.bobP);
          const y = g.y + 16 * Math.sin(TAU * ph + g.bobP);
          for (const q of [g.core, g.h, g.v]) {
            q.x = x;
            q.y = y;
          }
          const a = Math.min(1, g.a * (0.5 + 0.5 * tw) * (1 + 0.8 * b));
          g.core.alpha = a;
          setSize(g.core, g.core0 * (0.85 + 0.15 * tw) * (1 + 0.5 * b));
          g.h.alpha = a * 0.9;
          g.v.alpha = a * 0.75;
          const L = g.len * (0.7 + 0.3 * tw) * (1 + 1.2 * b);
          setSize(g.h, L, 56);
          setSize(g.v, L * 0.8, 56);
        });
      },
    };
  };
