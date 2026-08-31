import { random } from "remotion";
import {
  ALONG_X,
  ALONG_Y,
  BAND_LENGTH,
  DOWN_X,
  DOWN_Y,
  EDGE_AMPLITUDE_RATIO,
  GRAIN_TILE_COUNT,
  GRAIN_TILE_SIZE,
  HEIGHT,
  TAU,
  WIDTH,
  type DepthBucket,
} from "./constants";
import type { VariantConfig, VariantName } from "./variants";

/** One of the parallel bands, resolved into screen space. */
export interface Band {
  index: number;
  bucket: DepthBucket;
  /** Where this band's leading edge crosses s = 0. */
  anchorX: number;
  anchorY: number;
  /** Nearer bands are larger: drives particle size and dot size and spacing. */
  scale: number;
  /** This band's own phase offset, in turns, so bands never move in lockstep. */
  phase: number;
  /** Extra whole cycles per 450 frames, so each band advances at its own rate. */
  rateOffset: number;
}

export interface Particle {
  band: number;
  /** Position along the band at frame 0. */
  s0: number;
  /** Depth below the leading edge, in 4K pixels. */
  d: number;
  /** Depth as a fraction of band thickness. */
  dNorm: number;
  halfLength: number;
  /** Whole traversals of the band completed in 450 frames. */
  loops: number;
  /** Frames between flashes; 0 for a particle that never flashes. */
  flashPeriod: number;
  flashOffset: number;
}

/** Particles pre-sorted by stroke style so a frame is a few hundred paths. */
export interface ParticleBatch {
  bucket: DepthBucket;
  color: string;
  alpha: number;
  width: number;
  particles: Particle[];
}

export interface EdgeDots {
  band: number;
  /** Uniform spacing within a band: this is the one place regularity is right. */
  positions: number[];
  radius: number;
}

export interface MeshCurve {
  offset: number;
  alpha: number;
  harmonics: { spatial: number; temporal: number; amp: number; phase: number }[];
}

export interface Field {
  bands: Band[];
  batches: ParticleBatch[];
  edges: EdgeDots[];
  mesh: MeshCurve[];
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Only the single nearest band carries the full depth-of-field blur; the back
 * half of the stack stays sharp, which is what sells the depth.
 */
const bucketFor = (index: number, count: number): DepthBucket => {
  if (index === count - 1) return "near";
  if (index >= (count - 1) / 2) return "mid";
  return "far";
};

const pickTone = (tones: { weight: number }[], r: number): number => {
  let total = 0;
  for (const tone of tones) total += tone.weight;
  let acc = 0;
  for (let i = 0; i < tones.length; i++) {
    acc += tones[i].weight / total;
    if (r < acc) return i;
  }
  return tones.length - 1;
};

const quantize = (value: number, min: number, max: number, steps: number) => {
  const t = Math.round(((value - min) / (max - min)) * (steps - 1)) / (steps - 1);
  return min + t * (max - min);
};

const ALPHA_STEPS = 8;
const WIDTH_STEPS = 4;
/** Particles trail past the strands so a band fades out rather than stopping. */
const PARTICLE_DEPTH_OVERHANG = 1.6;

export const buildBands = (cfg: VariantConfig, variant: VariantName): Band[] => {
  const bands: Band[] = [];
  for (let i = 0; i < cfg.bandCount; i++) {
    const q = (i - (cfg.bandCount - 1) / 2) * cfg.bandPitch;
    const t = cfg.bandCount <= 1 ? 1 : i / (cfg.bandCount - 1);
    bands.push({
      index: i,
      bucket: bucketFor(i, cfg.bandCount),
      anchorX: WIDTH / 2 + q * DOWN_X,
      anchorY: HEIGHT / 2 + q * DOWN_Y,
      scale: lerp(cfg.depthScale[0], cfg.depthScale[1], t),
      phase: random(`band-phase-${variant}-${i}`),
      rateOffset: cfg.bandRateOffsets[i % cfg.bandRateOffsets.length],
    });
  }
  return bands;
};

const buildParticles = (
  cfg: VariantConfig,
  variant: VariantName,
  bands: Band[],
): ParticleBatch[] => {
  const byKey = new Map<string, ParticleBatch>();

  for (let i = 0; i < cfg.particleCount; i++) {
    const seed = `${variant}-particle-${i}`;
    const band = bands[Math.floor(random(`${seed}-band`) * bands.length) % bands.length];

    // Density is highest at the leading edge and thins downward, so each band
    // fades into the space below it instead of ending at a hard boundary.
    const dNorm = Math.pow(random(`${seed}-depth`), 2.4) * PARTICLE_DEPTH_OVERHANG;
    const d = dNorm * cfg.bandThickness;

    const fade = Math.pow(1 - 0.62 * Math.min(1, dNorm), 1.4);
    const rawAlpha =
      lerp(cfg.particleAlpha[0], cfg.particleAlpha[1], random(`${seed}-alpha`)) * fade;
    const rawWidth =
      lerp(cfg.particleWidth[0], cfg.particleWidth[1], random(`${seed}-width`)) * band.scale;

    const alpha = quantize(
      rawAlpha,
      cfg.particleAlpha[0] * 0.45,
      cfg.particleAlpha[1],
      ALPHA_STEPS,
    );
    const width = quantize(
      rawWidth,
      cfg.particleWidth[0] * cfg.depthScale[0],
      cfg.particleWidth[1] * cfg.depthScale[1],
      WIDTH_STEPS,
    );

    const toneIndex = pickTone(cfg.palette.particleTones, random(`${seed}-tone`));
    const color = cfg.palette.particleTones[toneIndex].color;

    // Occasional particles flash brighter for 4 frames. Every period divides
    // 450, and every offset is a whole frame, so flashes repeat exactly.
    const flashRoll = random(`${seed}-flash`);
    const flashPeriod = flashRoll < 0.06 ? [90, 150, 225][Math.floor(flashRoll * 50) % 3] : 0;
    const flashOffset = flashPeriod
      ? Math.floor(random(`${seed}-flash-offset`) * flashPeriod)
      : 0;

    const particle: Particle = {
      band: band.index,
      s0: (random(`${seed}-s`) - 0.5) * BAND_LENGTH,
      d,
      dNorm,
      halfLength:
        (lerp(cfg.particleLength[0], cfg.particleLength[1], random(`${seed}-len`)) *
          band.scale) /
        2,
      loops: 1 + Math.floor(random(`${seed}-speed`) * 3),
      flashPeriod,
      flashOffset,
    };

    const key = `${band.bucket}|${color}|${alpha.toFixed(3)}|${width.toFixed(2)}`;
    let batch = byKey.get(key);
    if (!batch) {
      batch = { bucket: band.bucket, color, alpha, width, particles: [] };
      byKey.set(key, batch);
    }
    batch.particles.push(particle);
  }

  const batches: ParticleBatch[] = [];
  byKey.forEach((batch) => batches.push(batch));
  // Dimmest first, so the brightest particles land on top within a buffer.
  batches.sort((a, b) => a.alpha - b.alpha);
  return batches;
};

const buildEdges = (cfg: VariantConfig, bands: Band[]): EdgeDots[] =>
  bands.map((band) => {
    const spacing = cfg.dotSpacing * band.scale;
    const count = Math.max(2, Math.round(BAND_LENGTH / spacing));
    const step = BAND_LENGTH / count;
    const positions: number[] = [];
    for (let j = 0; j <= count; j++) positions.push(-BAND_LENGTH / 2 + j * step);
    return { band: band.index, positions, radius: cfg.dotRadius * band.scale };
  });

const buildMesh = (cfg: VariantConfig, variant: VariantName): MeshCurve[] => {
  if (cfg.meshMode === "none") return [];
  const span = cfg.bandPitch * (cfg.bandCount - 1) + cfg.bandThickness * 2 + 1400;
  const curves: MeshCurve[] = [];
  for (let i = 0; i < cfg.meshCount; i++) {
    const seed = `${variant}-mesh-${i}`;
    const t = cfg.meshCount <= 1 ? 0.5 : i / (cfg.meshCount - 1);
    curves.push({
      offset: (t - 0.5) * span,
      alpha: cfg.meshAlpha * lerp(0.55, 1, random(`${seed}-alpha`)),
      // Longer wavelengths and larger amplitudes than the bands themselves, so
      // the mesh reads as a separate, deeper surface.
      harmonics: [
        { spatial: 1, temporal: 1, amp: 260, phase: random(`${seed}-p0`) },
        { spatial: 2, temporal: -1, amp: 150, phase: random(`${seed}-p1`) },
        { spatial: 3, temporal: 2, amp: 70, phase: random(`${seed}-p2`) },
      ],
    });
  }
  return curves;
};

export const buildField = (cfg: VariantConfig, variant: VariantName): Field => {
  const bands = buildBands(cfg, variant);
  return {
    bands,
    batches: buildParticles(cfg, variant, bands),
    edges: buildEdges(cfg, bands),
    mesh: buildMesh(cfg, variant),
  };
};

// --- wave sampling ---------------------------------------------------------

export interface WaveSample {
  /** Vertical displacement of the surface, in 4K pixels. */
  h: number;
  /** dh/ds, used to tilt particles and strands along the surface. */
  slope: number;
}

/**
 * Layered sines. A single sine reads as a perfect wave; three at different
 * frequencies and phases read as a surface. `t` is the loop position in [0, 1).
 */
export const sampleWave = (
  cfg: VariantConfig,
  band: Band,
  s: number,
  dNorm: number,
  t: number,
): WaveSample => {
  const ramp = EDGE_AMPLITUDE_RATIO + (1 - EDGE_AMPLITUDE_RATIO) * Math.min(1, dNorm);
  let h = 0;
  let slope = 0;
  for (const k of cfg.harmonics) {
    const w =
      TAU *
      ((k.spatial * s) / BAND_LENGTH -
        (k.temporal + band.rateOffset) * t +
        k.phase +
        band.phase);
    h += k.amp * Math.sin(w);
    slope += ((k.amp * TAU * k.spatial) / BAND_LENGTH) * Math.cos(w);
  }
  return { h: h * ramp, slope: slope * ramp };
};

export const bandPointX = (band: Band, s: number, d: number) =>
  band.anchorX + s * ALONG_X + d * DOWN_X;

export const bandPointY = (band: Band, s: number, d: number, h: number) =>
  band.anchorY + s * ALONG_Y + d * DOWN_Y - h;

/** Wrap a drifted position back into [-BAND_LENGTH / 2, BAND_LENGTH / 2). */
export const wrapAlong = (s: number) => {
  const shifted = s + BAND_LENGTH / 2;
  return (((shifted % BAND_LENGTH) + BAND_LENGTH) % BAND_LENGTH) - BAND_LENGTH / 2;
};

// --- grain -----------------------------------------------------------------

export const buildGrainTiles = (variant: VariantName): HTMLCanvasElement[] => {
  const tiles: HTMLCanvasElement[] = [];
  for (let i = 0; i < GRAIN_TILE_COUNT; i++) {
    const canvas = document.createElement("canvas");
    canvas.width = GRAIN_TILE_SIZE;
    canvas.height = GRAIN_TILE_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    const image = ctx.createImageData(GRAIN_TILE_SIZE, GRAIN_TILE_SIZE);
    const data = image.data;
    for (let p = 0; p < GRAIN_TILE_SIZE * GRAIN_TILE_SIZE; p++) {
      const value = Math.floor(random(`${variant}-grain-${i}-${p}`) * 256);
      data[p * 4] = value;
      data[p * 4 + 1] = value;
      data[p * 4 + 2] = value;
      data[p * 4 + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    tiles.push(canvas);
  }
  return tiles;
};
