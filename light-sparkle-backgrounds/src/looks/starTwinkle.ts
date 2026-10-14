import { UniformGroup } from "pixi.js";
import type { LookFactory } from "../kit/engine";
import { CYCLES, DESIGN_H, DESIGN_W, glintEnvelope, pulse, TAU, type Glint } from "../kit/loop";
import { addParticle, group, layer, setSize } from "../kit/particles";
import { mulberry32, pick, range } from "../kit/random";

export type StarTwinkleParams = { seed: number };

const GLSL = /* glsl */ `
uniform float uUnused;
// Pure black. Nothing is added here so the empty sky stays exactly (0,0,0).
vec3 background(vec2 p) { return vec3(0.0); }
`;

const tintFor = (t: number) => {
  // t in [-1,1]: warm .. cool white
  const warm = [1.0, 0.9, 0.78];
  const cool = [0.8, 0.88, 1.0];
  const a = t < 0 ? warm : cool;
  const k = Math.abs(t);
  const c = [0, 1, 2].map((i) => 1 + (a[i] - 1) * k);
  return (Math.round(c[0] * 255) << 16) | (Math.round(c[1] * 255) << 8) | Math.round(c[2] * 255);
};

export const starTwinkle =
  (params: StarTwinkleParams): LookFactory =>
  (kit) => {
    const rng = mulberry32(params.seed);
    const points = layer(kit.dot);
    const flares = layer(kit.flare4Chroma);

    type Star = { p: ReturnType<typeof addParticle>; size: number; a: number; k: number; phi: number; sharp: number };
    const pts: Star[] = [];
    for (let i = 0; i < 900; i++) {
      const p = addParticle(points, kit.dot);
      p.x = range(rng, 0, DESIGN_W);
      p.y = range(rng, 0, DESIGN_H);
      p.tint = tintFor(range(rng, -0.8, 0.8));
      pts.push({ p, size: 30 + 70 * Math.pow(rng(), 2.2), a: 0.25 + 0.75 * Math.pow(rng(), 1.5), k: pick(rng, CYCLES), phi: rng() * TAU, sharp: range(rng, 1, 3) });
    }
    const fls: Star[] = [];
    for (let i = 0; i < 120; i++) {
      const p = addParticle(flares, kit.flare4Chroma);
      p.x = range(rng, 0, DESIGN_W);
      p.y = range(rng, 0, DESIGN_H);
      p.rotation = range(rng, -0.06, 0.06);
      p.tint = tintFor(range(rng, -0.7, 0.7));
      fls.push({ p, size: 110 * (1 + 5 * Math.pow(rng(), 3)), a: range(rng, 0.35, 0.6), k: pick(rng, [1, 2, 3, 4, 5]), phi: rng() * TAU, sharp: range(rng, 1, 2) });
    }
    // ~3 glints per second -> 60 per 600-frame loop.
    const glints: Glint[] = [];
    for (let i = 0; i < 60; i++) {
      glints.push({ target: Math.floor(rng() * fls.length), start: Math.floor(rng() * 600), dur: Math.floor(range(rng, 10, 18)), gain: range(rng, 0.8, 1.4) });
    }
    const boost = new Float32Array(fls.length);

    return {
      glsl: GLSL,
      uniforms: new UniformGroup({ uUnused: { value: 0, type: "f32" } }),
      sprites: group(points, flares),
      post: { bloom1: 0.5, bloom2: 0.25, grain: 0, dither: false, spriteGain: 1, screen: true },
      update(frame) {
        const ph = frame / 600;
        for (const s of pts) {
          const tw = pulse(ph, s.k, s.phi, s.sharp);
          s.p.alpha = s.a * (0.35 + 0.65 * tw);
          setSize(s.p, s.size * (0.85 + 0.15 * tw));
        }
        boost.fill(0);
        for (const g of glints) boost[g.target] = Math.max(boost[g.target], g.gain * glintEnvelope(frame, g));
        fls.forEach((s, i) => {
          const tw = pulse(ph, s.k, s.phi, s.sharp);
          const b = boost[i];
          s.p.alpha = Math.min(1, s.a * (0.55 + 0.45 * tw) * (1 + 1.2 * b));
          setSize(s.p, s.size * (0.8 + 0.2 * tw) * (1 + 0.9 * b));
        });
      },
    };
  };
