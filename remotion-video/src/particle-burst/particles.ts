import { random } from "remotion";
import {
  PARTICLE_COLOR_MIX,
  PARTICLE_COUNT,
  PARTICLE_MAX_SIZE,
  PARTICLE_MIN_SIZE,
  type VariantConfig,
} from "./config";
import type { PaletteKey } from "./theme";

const TAU = Math.PI * 2;

export interface Particle {
  /** Evenly-spaced ideal angle; jitter is layered on at draw time. */
  angle: number;
  /** Radians of angular scatter, opened or closed by the variant's envelope. */
  angleJitter: number;
  /** Radians of tangential drift over a full travel span. */
  curl: number;
  /** Seeded speed multiplier — this is what keeps the ring from being a circle. */
  speedMul: number;
  startRadius: number;
  /** Frames added to the variant's travel start, so emission staggers. */
  startDelay: number;
  /** Frame this particle becomes visible. */
  appearFrame: number;
  deathFrame: number;
  fadeOutFrames: number;
  size: number;
  colorKey: PaletteKey;
  brightness: number;
  twinkleFreq: number;
  twinklePhase: number;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const pickColor = (r: number): PaletteKey => {
  let acc = 0;
  for (let i = 0; i < PARTICLE_COLOR_MIX.length; i++) {
    acc += PARTICLE_COLOR_MIX[i].weight;
    if (r < acc) return PARTICLE_COLOR_MIX[i].key;
  }
  return PARTICLE_COLOR_MIX[PARTICLE_COLOR_MIX.length - 1].key;
};

/**
 * Builds the swarm. Every value comes from Remotion's `random()` with a stable
 * string seed, so a particle's identity is a pure function of its index and is
 * identical in every worker and on every re-render.
 *
 * The seeds carry no variant name on purpose: burst and implosion get the same
 * 2200 grains, and only the config decides how they move.
 */
export const buildParticles = (cfg: VariantConfig): Particle[] => {
  const particles: Particle[] = new Array(PARTICLE_COUNT);

  // Two low-frequency lobes give the swarm coherent lumps rather than a
  // uniformly fuzzy annulus.
  const lobePhases = cfg.speedLobes.map(
    (_, i) => random(`lobe-phase-${i}`) * TAU,
  );

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const angle = (i / PARTICLE_COUNT) * TAU;

    let speedMul = lerp(
      cfg.speedRange[0],
      cfg.speedRange[1],
      random(`p${i}-speed`),
    );
    for (let l = 0; l < cfg.speedLobes.length; l++) {
      const lobe = cfg.speedLobes[l];
      speedMul *=
        1 + lobe.amplitude * Math.sin(lobe.harmonic * angle + lobePhases[l]);
    }

    // One draw staggers both emission and appearance, so a particle shows up
    // exactly when it starts moving.
    const stagger = random(`p${i}-stagger`);

    const isStraggler = random(`p${i}-straggler`) < cfg.stragglerFraction;
    const deathRange = isStraggler ? cfg.stragglerDeathRange : cfg.deathRange;
    const deathRoll = Math.pow(random(`p${i}-death`), cfg.deathSkew);

    particles[i] = {
      angle,
      angleJitter: (random(`p${i}-ajitter`) * 2 - 1) * cfg.angleJitter,
      curl: lerp(cfg.curlRange[0], cfg.curlRange[1], random(`p${i}-curl`)),
      speedMul,
      startRadius:
        cfg.startRadiusPx *
        (1 + (random(`p${i}-r0`) * 2 - 1) * cfg.startRadiusSpread),
      startDelay: stagger * cfg.travelStartJitter,
      appearFrame: cfg.appearStartFrame + stagger * cfg.fadeInJitter,
      deathFrame: lerp(deathRange[0], deathRange[1], deathRoll),
      fadeOutFrames: lerp(
        cfg.fadeOutRange[0],
        cfg.fadeOutRange[1],
        random(`p${i}-fadeout`),
      ),
      size: Math.round(
        lerp(PARTICLE_MIN_SIZE, PARTICLE_MAX_SIZE, random(`p${i}-size`)),
      ),
      colorKey: pickColor(random(`p${i}-color`)),
      brightness: lerp(0.72, 1, random(`p${i}-bright`)),
      twinkleFreq: lerp(
        cfg.twinkleFrequencyRange[0],
        cfg.twinkleFrequencyRange[1],
        random(`p${i}-twfreq`),
      ),
      twinklePhase: random(`p${i}-twphase`) * TAU,
    };
  }

  return particles;
};
