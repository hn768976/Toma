// Glitter Vortex particle layout: ~150k points in a flat disc with 4 loose
// logarithmic spiral arms, generated once at module level from a seed.
import { hexToLinear, mulberry32, pickWeighted } from "../../lib/random";

export const COUNT = 150_000;
export const DISC_R = 10;
export const STRIDE = 12; // floats per instance

export type GlitterVersion = {
  glitter: [number, string][]; // [weight, hex]
  haze: string;
  hazeCore: string;
};

const gauss = (rnd: () => number) => {
  const u = Math.max(rnd(), 1e-9), v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

/**
 * Instance data (STRIDE floats): r, theta0, y, turnsPerLoop,
 * size, id, sparkleBias, unused, colour rgb (linear), unused.
 */
export const buildParticles = (v: GlitterVersion) => {
  const rnd = mulberry32(0xf8e0a0);
  const out = new Float32Array(COUNT * STRIDE);
  const ARMS = 4;
  const pitch = 0.32; // tan of the spiral pitch angle (loose arms)
  const r0 = 0.6;
  for (let i = 0; i < COUNT; i++) {
    // radius: denser toward the centre
    const u = rnd();
    const r = 0.25 + (DISC_R * 1.25 - 0.25) * Math.pow(u, 0.6);
    let theta: number;
    if (rnd() < 0.6) {
      const arm = Math.floor(rnd() * ARMS);
      const spread = 0.22 + 0.12 * (r / DISC_R);
      theta = Math.log(r / r0) / pitch + (arm * 2 * Math.PI) / ARMS + gauss(rnd) * spread;
    } else {
      theta = rnd() * Math.PI * 2; // inter-arm dust
    }
    // differential rotation: whole turns per 600 frames.
    // inner 2, middle 1, outer 1; a soft mix zone avoids a visible seam.
    const inner = 1 - Math.min(1, Math.max(0, (r - 2.2) / 1.6));
    const k = rnd() < inner ? 2 : 1;
    // slight thickness plus gentle ripples that ride round with the disc
    const y = gauss(rnd) * (0.05 + 0.06 * Math.exp(-r / 2.5)) + 0.1 * Math.sin(r * 2.1 + theta * 2) * Math.min(1, r / 3);
    const s = rnd();
    const size = 0.55 + 1.6 * s * s * s;
    const col = hexToLinear(pickWeighted(rnd(), v.glitter));
    out.set([r, theta, y, k, size, i, rnd(), 0, col[0], col[1], col[2], 0], i * STRIDE);
  }
  return out;
};
