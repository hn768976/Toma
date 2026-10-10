import { RIBBONS } from "./curtainShader";
import { mulberry32, range } from "./rng";

/**
 * Seeded ribbon parameters for the Light Curtain, built once at module level.
 * Packed as four vec4 per ribbon (see curtainShader.ts).
 */
export type RibbonSet = {
  a: Float32Array; // x0, bend, w0, w1
  b: Float32Array; // swayAmp, swayFreq, swayPhase, gain
  c: Float32Array; // rampShift, waveTrips (integer), wavePhase, thin
  d: Float32Array; // swayAmp2, swayFreq2, swayPhase2, fadeLen
};

// 8 broad, 16 medium and 36 thin ribbons (12 bright filaments, 24 faint): 60.
const BROAD = 8;
const MEDIUM = 16;

const make = (): RibbonSet => {
  const r = mulberry32(0x510e527f);
  const a = new Float32Array(RIBBONS * 4);
  const b = new Float32Array(RIBBONS * 4);
  const c = new Float32Array(RIBBONS * 4);
  const d = new Float32Array(RIBBONS * 4);
  for (let i = 0; i < RIBBONS; i++) {
    const broad = i < BROAD;
    const medium = !broad && i < BROAD + MEDIUM;
    const thin = !broad && !medium;
    const purple = i % 17 === 4; // a few stay purple all the way
    // Stratified base positions along the bottom edge, a little outside it.
    const x0 = broad ? 0.08 + 0.84 * (((i + 0.5) * 0.618033988749895) % 1) : -0.1 + 1.2 * ((i * 0.618033988749895) % 1);
    // The curtain fans out: ribbons lean away from the middle, with variety.
    const bend = (x0 - 0.5) * range(r, 1.0, 2.2) + range(r, -0.3, 0.3);
    const w0 = broad ? range(r, 0.01, 0.022) : medium ? range(r, 0.005, 0.015) : range(r, 0.0015, 0.003);
    const w1 = broad ? range(r, 0.05, 0.095) : medium ? range(r, 0.02, 0.04) : range(r, 0.002, 0.008);
    a.set([x0, bend, w0, w1], i * 4);
    b.set(
      [
        thin ? range(r, 0.006, 0.014) : range(r, 0.014, 0.034),
        range(r, 0.3, 0.7),
        range(r, 0, 6.283),
        broad ? range(r, 1.1, 2.0) : medium ? range(r, 0.12, 0.3) : i % 3 === 0 ? range(r, 0.8, 1.3) : range(r, 0.06, 0.16),
      ],
      i * 4,
    );
    c.set(
      [
        purple ? range(r, 0.45, 0.6) : i % 5 === 0 ? range(r, -0.04, 0.06) : range(r, 0.04, 0.17),
        1 + Math.floor(r() * 3), // whole trips per loop
        r(),
        thin ? 1 : 0,
      ],
      i * 4,
    );
    d.set(
      [
        thin ? range(r, 0.003, 0.008) : range(r, 0.006, 0.016),
        range(r, 0.5, 1.2),
        range(r, 0, 6.283),
        broad ? range(r, 2.0, 2.6) : medium ? range(r, 1.0, 1.8) : range(r, 0.22, 0.55),
      ],
      i * 4,
    );
  }
  return { a, b, c, d };
};

export const RIBBON_SET: RibbonSet = make();
