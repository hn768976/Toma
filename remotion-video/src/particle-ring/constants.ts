// Timing, sizing, and color config for the abstract particle-ring halo.
// Geometry/particle-count values are defined at 1x (1080p) and derived
// for other resolutions via computeGeometry(), so the 1080p and 4K
// compositions always stay visually in sync.

export const FPS = 25;

// 8s loop. All periodic motion below is designed to divide evenly into
// this so frame 0 and the last frame line up for a seamless loop.
export const DURATION_IN_FRAMES = 200;

export const BASE_WIDTH = 1920;
export const BASE_HEIGHT = 1080;

// Ring geometry, at 1x.
export const BASE_RING_CORE_RADIUS = 260; // radius of the tightly-packed inner band
export const BASE_RING_BAND_WIDTH = 46; // soft spread of particles around the core radius
export const BASE_RING_PARTICLE_COUNT = 5200;

// Outer halo scatter, at 1x.
export const BASE_HALO_PARTICLE_COUNT = 1600;
export const BASE_HALO_INNER_OFFSET = 30; // gap between ring band and halo start
export const BASE_HALO_DRIFT_DISTANCE = 230; // how far a halo particle travels before fading out

export const BASE_BLUR_PX = 19; // glow-layer CSS blur radius, at 1x

// Motion periods (frames), resolution-independent. Each must divide
// DURATION_IN_FRAMES evenly to keep the loop seamless.
export const HALO_DRIFT_PERIOD = 100; // frames per drift-and-fade cycle
export const RIPPLE_PERIOD = 200; // one slow brightness ripple sweep per loop
export const SHIMMER_PERIOD = 50; // per-particle flicker cycle
export const WIGGLE_PERIOD = 40; // gentle reposition wiggle cycle

// Background: deep navy, held low but not fully crushed to black.
export const BACKGROUND_COLOR = "#05070f";
export const VIGNETTE_COLOR = "rgba(2, 3, 8, 0.55)";

// Gradient stops, top (t=0) -> bottom (t=1), used to color particles by
// their vertical position within the ring.
export const COLOR_STOPS: { t: number; h: number; s: number; l: number }[] = [
  { t: 0, h: 272, s: 82, l: 66 }, // violet-purple
  { t: 0.5, h: 218, s: 88, l: 60 }, // electric blue
  { t: 1, h: 187, s: 82, l: 55 }, // cyan-teal
];

export type RingGeometry = {
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  ringCoreRadius: number;
  ringBandWidth: number;
  ringParticleCount: number;
  haloParticleCount: number;
  haloInnerOffset: number;
  haloDriftDistance: number;
  sizeScale: number;
  blurPx: number;
};

// Derives full render geometry for a given resolution multiple
// (1 = 1080p, 2 = 4K/2160p, ...). Particle counts and the glow blur
// radius scale with resolution so density and glow read the same at any
// output size; explicit particleCount overrides skip that auto-scaling.
export const computeGeometry = (
  resolutionScale: number,
  ringParticleCountOverride?: number,
  haloParticleCountOverride?: number,
): RingGeometry => {
  const width = BASE_WIDTH * resolutionScale;
  const height = BASE_HEIGHT * resolutionScale;
  return {
    width,
    height,
    centerX: width / 2,
    centerY: height / 2,
    ringCoreRadius: BASE_RING_CORE_RADIUS * resolutionScale,
    ringBandWidth: BASE_RING_BAND_WIDTH * resolutionScale,
    ringParticleCount:
      ringParticleCountOverride ??
      Math.round(BASE_RING_PARTICLE_COUNT * resolutionScale * resolutionScale),
    haloParticleCount:
      haloParticleCountOverride ??
      Math.round(BASE_HALO_PARTICLE_COUNT * resolutionScale * resolutionScale),
    haloInnerOffset: BASE_HALO_INNER_OFFSET * resolutionScale,
    haloDriftDistance: BASE_HALO_DRIFT_DISTANCE * resolutionScale,
    sizeScale: resolutionScale,
    blurPx: BASE_BLUR_PX * resolutionScale,
  };
};
