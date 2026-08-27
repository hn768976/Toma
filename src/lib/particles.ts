import {snapToGrid} from './grid';
import type {MaskField} from './mask';
import {rnd, rndInt, rndRange} from './rng';
import {clamp, MASK_TO_CANVAS} from './space';
import {RESPAWN_FRACTION, RESPAWN_SLOTS, TWINKLE_PERIODS} from './timing';

export const PARTICLE_COUNT = 7000;

/** Density falls off this fast (mask px) away from the silhouette boundary. */
const EDGE_FALLOFF = 9;
/** How much density survives deep inside the form. Low = a dark, sparse core. */
const EDGE_FLOOR = 0.09;
const CREASE_GAIN = 0.95;
const CREASE_FALLOFF = 3.5;

export type ParticleSet = {
  count: number;
  /** Settled position, canvas px, already pulled onto the distorted grid. */
  tx: Float32Array;
  ty: Float32Array;
  /** Wide-scatter origin the particle drifts in from and dissolves back to. */
  sx: Float32Array;
  sy: Float32Array;
  radius: Float32Array;
  /** 0 primary, 1 white, 2 secondary. */
  colorIdx: Uint8Array;
  bright: Float32Array;
  twinklePeriod: Float32Array;
  twinklePhase: Float32Array;
  delay: Float32Array;
  /** -1 for a static particle, otherwise a frame offset into the respawn cycle. */
  respawnOffset: Float32Array;
  /** RESPAWN_SLOTS positions per particle, used only by respawners. */
  altX: Float32Array;
  altY: Float32Array;
};

const buildCdf = (field: MaskField): Float64Array => {
  const n = field.w * field.h;
  const cdf = new Float64Array(n);
  let acc = 0;
  for (let i = 0; i < n; i++) {
    if (field.inside[i]) {
      const edge = EDGE_FLOOR + (1 - EDGE_FLOOR) * Math.exp(-field.edge[i] / EDGE_FALLOFF);
      acc += edge + CREASE_GAIN * Math.exp(-field.crease[i] / CREASE_FALLOFF);
    }
    cdf[i] = acc;
  }
  return cdf;
};

const pickPixel = (cdf: Float64Array, target: number): number => {
  let lo = 0;
  let hi = cdf.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cdf[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
};

/** Edge-weighted sample on the mask, snapped onto the distorted grid. */
const sampleOne = (
  field: MaskField,
  cdf: Float64Array,
  total: number,
  seed: string,
): {x: number; y: number} => {
  const idx = pickPixel(cdf, rnd(`${seed}:pick`) * total);
  const px = idx % field.w;
  const py = (idx - px) / field.w;
  const mx = px + rnd(`${seed}:jx`) - 0.5;
  const my = py + rnd(`${seed}:jy`) - 0.5;

  const mode = rnd(`${seed}:mode`);
  const ax = mode < 0.82 ? rndRange(`${seed}:ax`, 0.6, 0.96) : 0;
  const ay = mode < 0.62 || mode >= 0.82 ? rndRange(`${seed}:ay`, 0.55, 0.94) : 0;

  const snapped = snapToGrid(field, mx, my, ax, ay);
  return {
    x: snapped.x * MASK_TO_CANVAS + (rnd(`${seed}:fx`) - 0.5) * 2.6,
    y: snapped.y * MASK_TO_CANVAS + (rnd(`${seed}:fy`) - 0.5) * 2.6,
  };
};

export const sampleParticles = (
  field: MaskField,
  seedPrefix: string,
  count: number = PARTICLE_COUNT,
): ParticleSet => {
  const cdf = buildCdf(field);
  const total = cdf[cdf.length - 1];

  const set: ParticleSet = {
    count,
    tx: new Float32Array(count),
    ty: new Float32Array(count),
    sx: new Float32Array(count),
    sy: new Float32Array(count),
    radius: new Float32Array(count),
    colorIdx: new Uint8Array(count),
    bright: new Float32Array(count),
    twinklePeriod: new Float32Array(count),
    twinklePhase: new Float32Array(count),
    delay: new Float32Array(count),
    respawnOffset: new Float32Array(count),
    altX: new Float32Array(count * RESPAWN_SLOTS),
    altY: new Float32Array(count * RESPAWN_SLOTS),
  };

  const cx = ((field.bbox.x0 + field.bbox.x1) / 2) * MASK_TO_CANVAS;
  const cy = ((field.bbox.y0 + field.bbox.y1) / 2) * MASK_TO_CANVAS;

  for (let i = 0; i < count; i++) {
    const seed = `${seedPrefix}:p${i}`;
    const home = sampleOne(field, cdf, total, seed);
    set.tx[i] = home.x;
    set.ty[i] = home.y;

    // Wide scatter the figure assembles out of and dissolves back into.
    const ang = rnd(`${seed}:sa`) * Math.PI * 2;
    const rad = 900 + Math.sqrt(rnd(`${seed}:sr`)) * 2100;
    set.sx[i] = cx + Math.cos(ang) * rad * 1.35;
    set.sy[i] = cy + Math.sin(ang) * rad * 0.85;

    set.radius[i] = 3 + Math.pow(rnd(`${seed}:rr`), 2.1) * 5;

    const bright = rnd(`${seed}:b`);
    if (bright < 0.075) {
      set.bright[i] = rndRange(`${seed}:bh`, 0.84, 1);
      set.colorIdx[i] = rnd(`${seed}:c`) < 0.72 ? 1 : 0;
    } else {
      set.bright[i] = rndRange(`${seed}:bl`, 0.16, 0.6);
      set.colorIdx[i] = rnd(`${seed}:c`) < 0.62 ? 0 : 2;
    }

    set.twinklePeriod[i] = TWINKLE_PERIODS[rndInt(`${seed}:tp`, TWINKLE_PERIODS.length)];
    set.twinklePhase[i] = rnd(`${seed}:tf`);
    set.delay[i] = rnd(`${seed}:d`);

    const respawns = rnd(`${seed}:rs`) < RESPAWN_FRACTION;
    set.respawnOffset[i] = respawns ? Math.floor(rnd(`${seed}:ro`) * 480) : -1;
    for (let s = 0; s < RESPAWN_SLOTS; s++) {
      const j = i * RESPAWN_SLOTS + s;
      if (!respawns || s === 0) {
        set.altX[j] = home.x;
        set.altY[j] = home.y;
      } else {
        const alt = sampleOne(field, cdf, total, `${seed}:alt${s}`);
        set.altX[j] = alt.x;
        set.altY[j] = alt.y;
      }
    }
  }

  return set;
};

/** Twinkle multiplier in roughly [0.45, 1.15]; period always divides 480. */
export const twinkle = (
  frame: number,
  period: number,
  phase: number,
): number => {
  const t = (frame / period + phase) * Math.PI * 2;
  return 0.8 + 0.35 * Math.sin(t);
};

/**
 * Where a respawning particle currently is, and how far through its fade it
 * has got. Positions only change while the particle is invisible.
 */
export const respawnState = (
  set: ParticleSet,
  i: number,
  frame: number,
): {x: number; y: number; alpha: number} => {
  const off = set.respawnOffset[i];
  if (off < 0) {
    return {x: set.tx[i], y: set.ty[i], alpha: 1};
  }
  const tt = (((frame + off) % 480) + 480) % 480;
  const cycle = tt / (480 / RESPAWN_SLOTS);
  const slot = Math.min(RESPAWN_SLOTS - 1, Math.floor(cycle));
  const local = cycle - slot;
  const fade =
    clamp(local / 0.18, 0, 1) * clamp((1 - local) / 0.18, 0, 1);
  const j = i * RESPAWN_SLOTS + slot;
  return {x: set.altX[j], y: set.altY[j], alpha: fade};
};
