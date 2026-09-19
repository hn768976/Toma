/**
 * Deterministic glitch model.
 *
 * Remotion renders frames out of order across parallel workers, so nothing
 * here may depend on Math.random(), Date.now() or any mutable module state.
 * Every value is a pure function of the frame number, which is also why the
 * shader and the DOM banner can be driven from the same numbers and stay in
 * lockstep without sharing a render pass.
 */

/**
 * Integer avalanche hash (the murmur3 finaliser, mixed over two inputs).
 *
 * This is NOT interchangeable with seeding a small PRNG from `index * k`:
 * doing that feeds the generator an arithmetic progression, and mulberry32's
 * single round leaves enough lattice structure that the strongest bursts all
 * landed on frames 36, 72, 108, 144 — a metronomic 1.2s beat instead of a
 * random one. A full avalanche mix has no such correlation between
 * neighbouring indices.
 */
const rand = (index: number, salt: number) => {
  let h = Math.imul(index ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h ^ salt, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};

/** Frames per glitch slot. A burst can start at the head of any slot. */
const SLOT = 9;

/** How likely a slot is to fire a burst. */
const BURST_CHANCE = 0.55;

export type GlitchState = {
  /** Overall burst intensity, 0..1. Drives everything else. */
  intensity: number;
  /** Chromatic aberration, as a fraction of frame width. */
  split: number;
  /** Mosaic coarsening multiplier; 1 = base grid, >1 = chunkier blocks. */
  pixel: number;
  /** Horizontal slice-tear amount, as a fraction of frame width. */
  tear: number;
  /** Per-frame brightness flicker multiplier, around 1. */
  flicker: number;
  /** Vertical jump of the banner, as a fraction of frame height. */
  jump: number;
  /** True on the handful of frames where the banner hard-cuts / inverts. */
  hardCut: boolean;
};

/**
 * Envelope of the glitch bursts. Looks back a few slots so a burst that
 * started earlier can still be decaying on this frame.
 */
const burstEnvelope = (frame: number) => {
  let peak = 0;
  for (let back = 0; back <= 3; back += 1) {
    const slot = Math.floor(frame / SLOT) - back;
    if (slot < 0) continue;
    if (rand(slot, 991) > BURST_CHANCE) continue;

    const start = slot * SLOT;
    const length = 2 + Math.floor(rand(slot, 77) * 8);
    const age = frame - start;
    if (age < 0 || age >= length) continue;

    // Bursts hit instantly and decay — a linear ramp down reads as a
    // digital drop-out, an eased one reads as a fade, which is wrong here.
    const decay = 1 - age / length;
    const strength = 0.45 + 0.55 * rand(slot, 313);
    peak = Math.max(peak, strength * decay);
  }
  return peak;
};

export const glitchAt = (frame: number): GlitchState => {
  const burst = burstEnvelope(frame);

  // A low-level shimmer runs the whole time so the piece never sits still
  // between bursts, matching the reference's constant unease.
  const idle = 0.14 + 0.06 * Math.sin(frame * 0.37) + 0.05 * Math.sin(frame * 1.13);
  const intensity = Math.min(1, Math.max(idle, burst));

  const jitter = rand(frame, 4211);
  const jitter2 = rand(frame, 8123);

  return {
    intensity,
    // Base chroma split is always present (the reference is never clean),
    // and bursts push it up — but only so far. The reference's worst frames
    // still read "SYSTEM HACKED" cleanly; it is a damaged broadcast, not a
    // destroyed one, and pushing these past roughly these values turns the
    // plate into abstract noise that no longer matches the source.
    split: (0.0009 + 0.0040 * burst * burst) * (0.6 + 0.8 * jitter),
    pixel: 1 + 1.0 * burst * burst * (0.6 + 0.8 * jitter2),
    tear: 0.07 * burst,
    flicker: 1 - 0.18 * burst * jitter + 0.05 * Math.sin(frame * 2.1),
    jump: (jitter - 0.5) * 0.012 * burst,
    hardCut: burst > 0.88 && jitter > 0.80,
  };
};

/**
 * Horizontal tear slices for the banner. Returns the slices that are actually
 * displaced on this frame; between bursts that is usually an empty list, which
 * keeps the DOM small on quiet frames.
 */
export type Slice = {
  /** Top edge of the slice, as a fraction of the banner's height. */
  top: number;
  /** Height of the slice, as a fraction of the banner's height. */
  height: number;
  /** Horizontal offset, as a fraction of the banner's width. */
  offset: number;
  /** Extra hue push: 0 = untinted, 1 = fully channel-separated. */
  tint: number;
};

export const bannerSlices = (frame: number, intensity: number): Slice[] => {
  if (intensity < 0.24) return [];

  const count = 1 + Math.floor(rand(frame, 5501) * 3);
  const slices: Slice[] = [];
  for (let i = 0; i < count; i += 1) {
    const a = rand(frame * 31 + i, 1777);
    const b = rand(frame * 31 + i, 2999);
    const c = rand(frame * 31 + i, 6473);
    slices.push({
      top: a * 0.92,
      height: 0.02 + b * 0.10,
      offset: (c - 0.5) * 0.14 * intensity,
      tint: rand(frame * 31 + i, 8951),
    });
  }
  return slices;
};
