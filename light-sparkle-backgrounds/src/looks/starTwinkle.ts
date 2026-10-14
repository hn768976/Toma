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
    const cores = layer(kit.dot);
    const hRays = layer(kit.streak);
    const vRays = layer(kit.streakWarmCool);
    const hazes = layer(kit.dot);

    // Loose clusters with empty black between them.
    const clusters = Array.from({ length: 5 }, () => ({ x: range(rng, 0.05, 0.95) * DESIGN_W, y: range(rng, 0.05, 0.95) * DESIGN_H, s: range(rng, 350, 700) }));
    const place = () => {
      if (rng() < 0.45) return { x: range(rng, 0, DESIGN_W), y: range(rng, 0, DESIGN_H) };
      const c = pick(rng, clusters);
      const g = () => (rng() + rng() + rng() - 1.5) / 1.5;
      return { x: Math.min(DESIGN_W, Math.max(0, c.x + g() * c.s * 1.6)), y: Math.min(DESIGN_H, Math.max(0, c.y + g() * c.s)) };
    };

    type Pt = { p: ReturnType<typeof addParticle>; size: number; a: number; k: number; phi: number; sharp: number };
    const pts: Pt[] = [];
    for (let i = 0; i < 900; i++) {
      const p = addParticle(points, kit.dot);
      const at = place();
      p.x = at.x;
      p.y = at.y;
      p.tint = tintFor(range(rng, -0.8, 0.8));
      // Most points sit near black; a few are visible.
      pts.push({ p, size: 26 + 50 * Math.pow(rng(), 2.5), a: 0.015 + 0.45 * Math.pow(rng(), 5), k: pick(rng, CYCLES), phi: rng() * TAU, sharp: range(rng, 1, 3) });
    }

    type Star = { core: ReturnType<typeof addParticle>; h: ReturnType<typeof addParticle>; v: ReturnType<typeof addParticle>; hz: ReturnType<typeof addParticle>[]; scale: number; a: number; k: number; phi: number; sharp: number };
    const stars: Star[] = [];
    for (let i = 0; i < 120; i++) {
      const at = place();
      const tint = tintFor(range(rng, -0.4, 0.3));
      const core = addParticle(cores, kit.dot);
      const h = addParticle(hRays, kit.streak);
      const v = addParticle(vRays, kit.streakWarmCool);
      v.rotation = Math.PI / 2; // warm end up, cool end down
      const hz = [0xff8a70, 0x7090ff].map((t) => {
        const q = addParticle(hazes, kit.dot);
        q.tint = t;
        return q;
      });
      for (const q of [core, h, v]) q.tint = tint;
      [core, h, v, ...hz].forEach((q) => {
        q.x = at.x;
        q.y = at.y;
      });
      // Sizes vary 1-6x; brightness heavily skewed so only a few dozen stand out.
      const scale = 1 + 5 * Math.pow(rng(), 3);
      stars.push({ core, h, v, hz, scale, a: 0.04 + 0.96 * Math.pow(rng(), 3) * Math.min(1, scale / 2), k: pick(rng, [1, 2, 3, 4, 5]), phi: rng() * TAU, sharp: range(rng, 1, 2) });
    }
    // ~3 glints per second -> 60 per 600-frame loop.
    const glints: Glint[] = [];
    for (let i = 0; i < 60; i++) {
      glints.push({ target: Math.floor(rng() * stars.length), start: Math.floor(rng() * 600), dur: Math.floor(range(rng, 10, 18)), gain: range(rng, 0.8, 1.4) });
    }
    const boost = new Float32Array(stars.length);

    return {
      glsl: GLSL,
      uniforms: new UniformGroup({ uUnused: { value: 0, type: "f32" } }),
      sprites: group(hazes, points, hRays, vRays, cores),
      post: { bloom1: 0.35, bloom2: 0.12, grain: 0, dither: false, spriteGain: 1, screen: true },
      update(frame) {
        const ph = frame / 600;
        for (const s of pts) {
          const tw = pulse(ph, s.k, s.phi, s.sharp);
          s.p.alpha = s.a * (0.35 + 0.65 * tw);
          setSize(s.p, s.size * (0.85 + 0.15 * tw));
        }
        boost.fill(0);
        for (const g of glints) boost[g.target] = Math.max(boost[g.target], g.gain * glintEnvelope(frame, g));
        stars.forEach((s, i) => {
          const tw = pulse(ph, s.k, s.phi, s.sharp);
          const b = boost[i];
          const a = Math.min(1, s.a * (0.55 + 0.45 * tw) * (1 + 1.2 * b));
          const L = s.scale * (0.8 + 0.2 * tw) * (1 + 0.9 * b);
          s.core.alpha = Math.min(1, a * 1.3);
          setSize(s.core, 70 + 40 * s.scale);
          // Hair-thin rays; the horizontal ones run much longer at a faint level.
          s.h.alpha = a * 0.8;
          setSize(s.h, 170 * L * (1 + 0.3 * s.scale), 22);
          s.v.alpha = a * 0.8;
          setSize(s.v, 160 * L, 22);
          s.hz[0].alpha = a * 0.12;
          s.hz[0].y = s.v.y - 30 * s.scale;
          s.hz[1].alpha = a * 0.12;
          s.hz[1].y = s.v.y + 30 * s.scale;
          setSize(s.hz[0], 160 * s.scale);
          setSize(s.hz[1], 160 * s.scale);
        });
      },
    };
  };
