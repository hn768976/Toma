// Composition, geometry and motion constants for the glitter ring.
//
// Geometry is expressed as a fraction of frame HEIGHT and multiplied by the
// live height from useVideoConfig() at draw time, so particle sizes, blur
// radii and the ring itself scale exactly with the render resolution.
//
// Every periodic term below completes a whole number of cycles across
// DURATION_IN_FRAMES, which is what makes the loop close.

export const FPS = 30;
export const DURATION_IN_FRAMES = 600; // 20s
export const WIDTH = 3840;
export const HEIGHT = 2160;

// --- Ring geometry (fractions of frame height) -----------------------------

// The centre is the product: buyers drop a logo or title inside it, so the
// ring stays wide and nothing is allowed to animate through the middle.
export const RING_DIAMETER_FRACTION = 0.55;
export const RING_RADIUS_FRACTION = RING_DIAMETER_FRACTION / 2;

// Radial scatter around the circular path. Most particles sit within
// RING_BAND_SIGMA of the path; a minority scatter much further out to give
// the ring wispy edges.
export const RING_BAND_SIGMA = 0.024;
export const RING_STRAY_FRACTION = 0.2;
export const RING_STRAY_SIGMA = 0.08;

// Particle pixel sizes at 4K (1-5px), converted to height fractions.
export const PARTICLE_MIN_SIZE = 1 / HEIGHT;
export const PARTICLE_MAX_SIZE = 5 / HEIGHT;

export const RING_PARTICLE_COUNT = 1200;

// The glitter is not evenly spread: most particles belong to one of a handful
// of angular clumps, which is what gives the reference ring its dense knots
// and thin gaps instead of a uniform dotted circle.
export const CLUSTER_COUNT = 24;
export const CLUSTER_FRACTION = 0.45;
export const CLUSTER_ANGULAR_SIGMA = 0.11;
export const CLUSTER_RADIAL_SIGMA = 0.013;
export const BOKEH_COUNT = 24;
export const FOREGROUND_COUNT = 9;

// --- Motion ----------------------------------------------------------------

// Whole laps per loop. Particles orbit twice while the arc highlights travel
// once, so the light appears to stream through the glitter at one relative
// lap per loop while nothing on screen ever spins.
export const ORBIT_LAPS = 2;
export const ARC_LAPS = 1;

// Inner particles run a touch ahead of outer ones and then fall back, so the
// ring shears gently instead of turning as a rigid disc. One cycle per loop,
// in radians at the band edges.
export const SHEAR_AMPLITUDE = 0.22;

// Ring radius breathes by +/-2% over the loop.
export const BREATHE_AMPLITUDE = 0.02;

// Per-particle angular wobble; cycle counts are whole numbers per loop.
export const WOBBLE_MAX_AMPLITUDE = 0.012;
export const WOBBLE_CYCLE_CHOICES = [1, 2, 3];

// Sparkles: a small fraction of particles flash near-white with a four-point
// cross. Periods all divide DURATION_IN_FRAMES so the schedule repeats exactly.
export const SPARKLE_FRACTION = 0.13;
export const SPARKLE_PERIOD_CHOICES = [60, 75, 100, 120, 150, 200];
export const SPARKLE_MIN_FRAMES = 2;
export const SPARKLE_MAX_FRAMES = 4;

// --- Arc highlights --------------------------------------------------------

// Short, much brighter segments on the ring where the light catches it. These
// are what stop the ring reading as a plain dotted circle.
export type ArcSpec = {
  phase: number; // starting angle, radians (0 = 3 o'clock, +y is down)
  sigma: number; // angular half-width
  intensity: number;
  pulseCycles: number; // whole cycles per loop
  pulsePhase: number;
};

export const ARCS: ArcSpec[] = [
  { phase: -Math.PI / 2, sigma: 0.13, intensity: 1, pulseCycles: 2, pulsePhase: 0 },
  { phase: Math.PI / 2, sigma: 0.12, intensity: 0.92, pulseCycles: 2, pulsePhase: Math.PI },
  { phase: -Math.PI / 2 + 2.45, sigma: 0.08, intensity: 0.45, pulseCycles: 3, pulsePhase: 1.1 },
];

// --- Sprite atlas ----------------------------------------------------------

export const SOFTNESS_LEVELS = 6;
export const COLOR_BUCKETS = 10;
export const SPRITE_SIZE = 96;

// --- Finishing -------------------------------------------------------------

export const GRAIN_TILE_SIZE = 256;
export const GRAIN_TILE_COUNT = 8;
export const GRAIN_STRENGTH = 0.015; // ~1.5%
export const VIGNETTE_STRENGTH = 0.55;
