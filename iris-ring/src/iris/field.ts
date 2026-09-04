import { mulberry32 } from "./random";
import { clamp01, fbm4, noise4, smootherstep } from "./noise";

export const TWO_PI = Math.PI * 2;

// --- Composition ---------------------------------------------------------
export const FPS = 30;
export const DURATION_IN_FRAMES = 300; // 10s
export const COMP_WIDTH = 3840;
export const COMP_HEIGHT = 2160;

// --- Layout (all fractions of frame height, so 1080p preview and 4K
// --- render are pixel-for-pixel proportional) ----------------------------
export const CENTER_X_FRAC = 0.5;
// Measured off the reference: its ring sits on the optical centre, a hair
// low if anything, not above it.
export const CENTER_Y_FRAC = 0.502;
// Measured off the reference: the lit body reaches ~0.315*H (25%-of-peak
// radius) and its faintest outer extent ~0.46*H, so the ring very nearly
// fills the frame height. Spikes and membrane are held inside 0.476*H so
// nothing touches the boundary.
export const OUTER_RADIUS_FRAC = 0.41;

// Pupil radius as a fraction of the outer radius. Breathes across the loop
// about a midpoint of 0.46, which puts the pupil diameter at ~0.377*H —
// the reference measures 0.374-0.378*H.
export const PUPIL_FRAC_MIN = 0.4;
export const PUPIL_FRAC_MAX = 0.478;

// --- Filament field ------------------------------------------------------
export const FILAMENT_COUNT = 3600;
// Dot spacing along a strand, as a fraction of frame height. Small enough
// that consecutive dots overlap and read as a continuous fibre.
export const DOT_SPACING_FRAC = 0.001;
export const SPIKE_COUNT = 11;

export type Filament = {
  angle: number; // base angle at the pupil edge
  curve: number; // tangential drift accumulated over its length
  startFrac: number; // where the strand begins, out from the pupil edge
  lengthFrac: number; // fraction of the pupil->edge span
  tipSharp: number; // how abruptly the strand ends
  width: number; // relative stroke weight
  brightness: number;
  shimmerCycles: number; // integer -> exactly periodic over the loop
  shimmerPhase: number;
  shimmerDepth: number;
  wobbleFreq: number;
  wobblePhase: number;
  wobbleAmp: number;
};

export type Spike = {
  angle: number;
  reach: number; // multiple of the outer radius
  brightness: number;
  width: number;
  cycles: number;
  phase: number;
};

export type IrisField = {
  filaments: Filament[];
  spikes: Spike[];
};

// Builds the static identity of every strand once, from a seed. Nothing
// here depends on the frame.
export const buildField = (seed: number): IrisField => {
  const rand = mulberry32(seed);

  // Phases for the density warp that pulls strands into bundles.
  const w1 = rand() * TWO_PI;
  const w2 = rand() * TWO_PI;
  const w3 = rand() * TWO_PI;
  const lenPhase = rand() * TWO_PI;

  const filaments: Filament[] = [];
  for (let i = 0; i < FILAMENT_COUNT; i++) {
    const u = (i + 0.5) / FILAMENT_COUNT;

    // Warping the uniform index->angle map compresses strands into dense
    // bundles and opens darker gaps between them. Harmonics are integers so
    // the warp stays continuous where the ring wraps.
    const warp =
      0.028 * Math.sin(u * TWO_PI * 3 + w1) +
      0.016 * Math.sin(u * TWO_PI * 7 + w2) +
      0.009 * Math.sin(u * TWO_PI * 13 + w3);
    const angle = (u + warp) * TWO_PI + (rand() - 0.5) * 0.011;

    // Length. Most strands run nearly the full depth so the field
    // terminates in a readable ragged edge; a minority stop far short,
    // and a few overshoot the boundary entirely.
    const bundleLen = 0.07 * Math.sin(u * TWO_PI * 5 + lenPhase);
    const long = rand() < 0.74;
    const lengthFrac =
      (long ? 0.8 + rand() * 0.2 : 0.34 + rand() * 0.42) + bundleLen;

    filaments.push({
      angle,
      curve: (rand() - 0.5) * 0.2,
      // Roots are staggered rather than all landing on the pupil circle.
      // 1700 strands at full width overlap ~1.6x on that circumference, and
      // the additive pile-up clips every channel to white, which is what
      // desaturates the brightest band.
      startFrac: Math.pow(rand(), 1.5) * 0.05,
      lengthFrac: Math.max(0.26, lengthFrac),
      tipSharp: 0.1 + rand() * 0.16,
      width: 0.55 + rand() * 0.85,
      brightness: 0.55 + Math.pow(rand(), 1.2) * 0.6,
      shimmerCycles: 2 + Math.floor(rand() * 6), // 2..7 cycles per loop
      shimmerPhase: rand() * TWO_PI,
      shimmerDepth: 0.15 + rand() * 0.25,
      wobbleFreq: 5 + rand() * 11,
      wobblePhase: rand() * TWO_PI,
      wobbleAmp: 0.0012 + rand() * 0.0034,
    });
  }

  const spikes: Spike[] = [];
  for (let i = 0; i < SPIKE_COUNT; i++) {
    spikes.push({
      angle: rand() * TWO_PI,
      reach: 1.03 + rand() * 0.07,
      brightness: 0.11 + rand() * 0.16,
      width: 0.6 + rand() * 1.0,
      cycles: 1 + Math.floor(rand() * 3),
      phase: rand() * TWO_PI,
    });
  }

  return { filaments, spikes };
};

// --- Per-frame animation -------------------------------------------------

// Pupil dilation: exactly one cycle per loop, eased at both ends so it
// never reads as a plain sine. A small second harmonic keeps it organic.
export const pupilDiameterFrac = (t: number): number => {
  const raw = 0.5 - 0.5 * Math.cos(t * TWO_PI);
  const eased = smootherstep(raw);
  const detail = 0.05 * Math.sin(t * TWO_PI * 2 + 0.9);
  const k = clamp01(eased + detail);
  return PUPIL_FRAC_MIN + (PUPIL_FRAC_MAX - PUPIL_FRAC_MIN) * k;
};

// The whole field turns a couple of degrees and comes back. Deliberately
// tiny — the reference barely rotates and that restraint is what keeps it
// from looking like a spinning graphic.
export const fieldRotation = (t: number): number =>
  (2.6 * Math.PI) / 180 * Math.sin(t * TWO_PI);

export type LoopTime = { cos: number; sin: number };

export const loopTime = (t: number): LoopTime => ({
  cos: Math.cos(t * TWO_PI),
  sin: Math.sin(t * TWO_PI),
});

// Angular lookup tables. Every per-angle field (pupil edge, outer edge, rim
// hotspots) is evaluated at N angles once per frame and interpolated, which
// keeps the noise cost off the per-dot path.
export const buildLut = (
  size: number,
  fn: (theta: number) => number,
): Float32Array => {
  const lut = new Float32Array(size);
  for (let i = 0; i < size; i++) lut[i] = fn((i / size) * TWO_PI);
  return lut;
};

export const sampleLut = (lut: Float32Array, theta: number): number => {
  const n = lut.length;
  let x = (theta / TWO_PI) * n;
  x = x - Math.floor(x / n) * n;
  const i0 = Math.floor(x);
  const f = x - i0;
  const a = lut[i0 % n];
  const b = lut[(i0 + 1) % n];
  return a + (b - a) * f;
};

// Pupil boundary: a circle perturbed by low-frequency noise, so it has a
// few gentle lobes instead of being perfectly round.
export const pupilEdgeLut = (lt: LoopTime, rotation: number): Float32Array =>
  buildLut(360, (theta) => {
    const a = theta - rotation;
    const n =
      noise4(
        Math.cos(a) * 1.5,
        Math.sin(a) * 1.5,
        lt.cos * 0.55,
        lt.sin * 0.55,
        17,
      ) *
        0.75 +
      noise4(
        Math.cos(a) * 3.4,
        Math.sin(a) * 3.4,
        lt.cos * 0.55,
        lt.sin * 0.55,
        29,
      ) *
        0.25;
    return 1 + n * 0.115;
  });

// Outer boundary: rougher, two octaves, undulating on looping noise.
export const outerEdgeLut = (lt: LoopTime, rotation: number): Float32Array =>
  buildLut(720, (theta) => {
    const a = theta - rotation;
    const n = fbm4(
      Math.cos(a) * 2.6,
      Math.sin(a) * 2.6,
      lt.cos * 0.7,
      lt.sin * 0.7,
      41,
    );
    return 1 + n * 0.055;
  });

// Inner-rim hotspots: 3-5 uneven bright arcs whose angles drift over the
// loop, so the hot points sit somewhere different from frame to frame.
export const rimHotLut = (lt: LoopTime, rotation: number): Float32Array =>
  buildLut(720, (theta) => {
    const a = theta - rotation;
    const n = noise4(
      Math.cos(a) * 2.1,
      Math.sin(a) * 2.1,
      lt.cos * 0.85,
      lt.sin * 0.85,
      73,
    );
    const n2 = noise4(
      Math.cos(a) * 4.3,
      Math.sin(a) * 4.3,
      lt.cos * 0.85,
      lt.sin * 0.85,
      131,
    );
    // Raised to a power so the field breaks into a few separated arcs
    // rather than an even ring.
    const v = clamp01(0.5 + 0.5 * (n * 0.78 + n2 * 0.32));
    return Math.pow(v, 4.5);
  });
