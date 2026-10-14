import { UniformGroup } from "pixi.js";
import type { LookFactory } from "../kit/engine";
import { DESIGN_H, DESIGN_W, hexToNum, hexToRgb, mod, pulse, TAU } from "../kit/loop";
import { addParticle, group, layer, setSize } from "../kit/particles";
import { mulberry32, pick, range } from "../kit/random";

export type SilkLightParams = { seed: number; light: string; base: string; deep: string; dust: string; angleDeg: number };

const NBANDS = 10;

const GLSL = /* glsl */ `
uniform vec3 uLight;
uniform vec3 uBase;
uniform vec3 uDeep;
uniform vec2 uNormal;
uniform vec4 uBands[${NBANDS}]; // centre (along normal), width, signed strength (+ light / - deep), skew

vec3 background(vec2 p) {
  vec2 c = p / DESIGN;
  // Base: deeper cyan-blue at the top, fading to near-white at the bottom;
  // corners slightly deeper at the top, blown-out hot spots bottom-left and bottom-right.
  float v = smoothstep(0.0, 1.0, c.y);
  vec3 col = mix(uBase, uLight, 0.2 + 0.55 * v);
  float topCorner = exp(-pow(length((c - vec2(0.0, 0.0)) * vec2(1.0, 1.6)) / 0.55, 2.0))
                  + exp(-pow(length((c - vec2(1.0, 0.0)) * vec2(1.0, 1.6)) / 0.45, 2.0)) * 0.6;
  col = mix(col, uDeep, 0.35 * clamp(topCorner, 0.0, 1.0));
  float hot = exp(-pow(length((c - vec2(0.75, 0.95)) * vec2(1.3, 1.1)) / 0.3, 2.0))
            + 0.85 * exp(-pow(length((c - vec2(0.13, 0.95)) * vec2(1.3, 1.1)) / 0.25, 2.0));
  float u = dot(p, uNormal);
  // Streaks: soft beams, uneven in strength, with a faint smeared ray texture along them.
  float smear = 0.85 + 0.15 * vnoisep(vec2(u / 38.0, 0.5), vec2(4096.0, 1.0));
  for (int i = 0; i < ${NBANDS}; i++) {
    vec4 b = uBands[i];
    float x = u - b.x;
    float w = b.y * (x > 0.0 ? b.w : 1.0);
    float prof = exp(-(x * x) / (w * w));
    if (b.z > 0.0) col = mix(col, vec3(1.0), clamp(b.z * prof * smear * (0.75 + 0.35 * v), 0.0, 1.0));
    else col = mix(col, mix(uDeep, vec3(dot(uDeep, vec3(0.333))), 0.25) * 0.93, -b.z * prof * (1.0 - 0.5 * v));
  }
  // Hazy bloom over the lower half.
  hot += 0.55 * exp(-pow(length((c - vec2(0.52, 0.5)) * vec2(1.0, 1.3)) / 0.22, 2.0));
  col = mix(col, vec3(1.0), clamp(0.95 * hot, 0.0, 0.97));
  return col;
}
`;

export const silkLight =
  (params: SilkLightParams): LookFactory =>
  (kit) => {
    const rng = mulberry32(params.seed);
    // Streak direction: about -55 degrees (falling to the right); normal is perpendicular.
    const a = (params.angleDeg * Math.PI) / 180;
    const dir = [Math.cos(a), Math.sin(a)]; // y-down screen space: falls to the right
    const normal = [-dir[1], dir[0]];
    const us = [0, DESIGN_W, 0, DESIGN_W].map((x, i) => x * normal[0] + (i < 2 ? 0 : DESIGN_H) * normal[1]);
    const uMin = Math.min(...us);
    const uMax = Math.max(...us);
    const MARGIN = 700;
    const wrap = uMax - uMin + 2 * MARGIN;

    type Band = { u0: number; w: number; s: number; skew: number; k: number; p: number };
    const bands: Band[] = [];
    for (let i = 0; i < NBANDS; i++) {
      const light = i % 2 === 0;
      bands.push({
        u0: (wrap * (i + range(rng, -0.1, 0.1))) / NBANDS,
        w: light ? range(rng, 110, 240) : range(rng, 160, 320),
        s: light ? range(rng, 0.5, 1.0) : -range(rng, 0.55, 0.9),
        skew: range(rng, 0.5, 0.85),
        k: pick(rng, [1, 2]),
        p: rng() * TAU,
      });
    }
    const bandData = new Float32Array(NBANDS * 4);

    const dust = layer(kit.dot);
    type Speck = { p: ReturnType<typeof addParticle>; x0: number; y0: number; nx: number; ny: number; size: number; a: number; k: number; phi: number };
    const specks: Speck[] = [];
    const WX = DESIGN_W + 80;
    const WY = DESIGN_H + 80;
    for (let i = 0; i < 120; i++) {
      const p = addParticle(dust, kit.dot);
      p.tint = hexToNum(params.dust);
      specks.push({ p, x0: range(rng, 0, WX), y0: WY * Math.pow(rng(), 2.2), nx: pick(rng, [1, 0, -1]), ny: 0, size: range(rng, 40, 95), a: range(rng, 0.55, 0.9), k: pick(rng, [1, 2, 3, 4]), phi: rng() * TAU });
    }

    const uniforms = new UniformGroup({
      uLight: { value: new Float32Array(hexToRgb(params.light)), type: "vec3<f32>" },
      uBase: { value: new Float32Array(hexToRgb(params.base)), type: "vec3<f32>" },
      uDeep: { value: new Float32Array(hexToRgb(params.deep)), type: "vec3<f32>" },
      uNormal: { value: new Float32Array(normal), type: "vec2<f32>" },
      uBands: { value: bandData, type: "vec4<f32>", size: NBANDS },
    });

    return {
      glsl: GLSL,
      uniforms,
      sprites: group(dust),
      post: { bloom1: 0.3, bloom2: 0, grain: 0.02, dither: true, spriteGain: 1, screen: true },
      update(frame) {
        const ph = frame / 600;
        bands.forEach((b, i) => {
          // Slide one whole wrap per loop along the normal; width breathes (whole cycles).
          const c = mod(b.u0 + wrap * ph, wrap) + uMin - MARGIN;
          bandData.set([c, b.w * (0.8 + 0.4 * pulse(ph, b.k, b.p, 1)), b.s, b.skew], i * 4);
        });
        for (const s of specks) {
          s.p.x = mod(s.x0 + s.nx * WX * ph, WX) - 40 + 25 * Math.sin(TAU * ph + s.phi);
          s.p.y = mod(s.y0 + s.ny * WY * ph, WY) - 40 + 25 * Math.cos(TAU * ph + s.phi);
          s.p.alpha = s.a * (0.5 + 0.5 * pulse(ph, s.k, s.phi, 1));
          setSize(s.p, s.size);
        }
      },
    };
  };
