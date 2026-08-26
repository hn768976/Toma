import { seededRandom } from "./random";
import { gradientColorAt } from "./color";
import type { RingGeometry } from "./constants";

export type RingParticle = {
  baseAngle: number;
  baseRadius: number;
  size: number;
  fillStyle: string;
  brightnessBase: number; // 0-1, denser/brighter near the core radius
  shimmerPhase: number;
  wiggleRPhase: number;
  wiggleAPhase: number;
  wiggleRAmp: number;
  wiggleAAmp: number;
};

export type HaloParticle = {
  angle: number;
  wobblePhase: number;
  wobbleAmp: number;
  phase: number; // fixed offset into the drift-and-fade cycle, 0-1
  size: number;
};

// Approximates a bell-curve sample in [-1, 1] from three uniform draws
// (Irwin-Hall-ish), so particles cluster toward the core radius instead
// of spreading uniformly across the band.
const gaussianish = (index: number, salt: number) => {
  const a = seededRandom(index, salt);
  const b = seededRandom(index, salt + 1);
  const c = seededRandom(index, salt + 2);
  return ((a + b + c) / 3 - 0.5) * 2;
};

export const generateRingParticles = (geometry: RingGeometry): RingParticle[] => {
  const { ringParticleCount: count, ringCoreRadius, ringBandWidth, centerY, sizeScale } = geometry;
  const particles: RingParticle[] = [];
  for (let i = 0; i < count; i++) {
    const angleJitter = (seededRandom(i, 1) - 0.5) * (Math.PI * 2) / count * 2;
    const baseAngle = (i / count) * Math.PI * 2 + angleJitter;
    const radialSample = gaussianish(i, 10); // roughly in [-1, 1], clustered near 0
    const baseRadius = ringCoreRadius + radialSample * ringBandWidth;

    const y = centerY + baseRadius * Math.sin(baseAngle);
    const t = (y - (centerY - ringCoreRadius - ringBandWidth)) /
      ((ringCoreRadius + ringBandWidth) * 2);

    const brightnessBase = Math.max(0.35, 1 - Math.abs(radialSample) * 0.75);
    const size = (1.1 + seededRandom(i, 20) * 1.7) * sizeScale;

    particles.push({
      baseAngle,
      baseRadius,
      size,
      fillStyle: gradientColorAt(t),
      brightnessBase,
      shimmerPhase: seededRandom(i, 30) * Math.PI * 2,
      wiggleRPhase: seededRandom(i, 40) * Math.PI * 2,
      wiggleAPhase: seededRandom(i, 50) * Math.PI * 2,
      wiggleRAmp: (1.5 + seededRandom(i, 60) * 2.5) * sizeScale,
      wiggleAAmp: 0.004 + seededRandom(i, 70) * 0.006, // angular, resolution-independent
    });
  }
  return particles;
};

export const generateHaloParticles = (geometry: RingGeometry): HaloParticle[] => {
  const { haloParticleCount: count, sizeScale } = geometry;
  const particles: HaloParticle[] = [];
  for (let i = 0; i < count; i++) {
    particles.push({
      angle: (i / count) * Math.PI * 2 + (seededRandom(i, 100) - 0.5) * 0.35,
      wobblePhase: seededRandom(i, 110) * Math.PI * 2,
      wobbleAmp: 0.03 + seededRandom(i, 120) * 0.05,
      phase: seededRandom(i, 130),
      size: (0.8 + seededRandom(i, 140) * 1.3) * sizeScale,
    });
  }
  return particles;
};

export const haloStartRadius = (geometry: RingGeometry) =>
  geometry.ringCoreRadius + geometry.ringBandWidth + geometry.haloInnerOffset;
