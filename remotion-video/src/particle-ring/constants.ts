// Timing, sizing, and color config for the abstract particle-ring halo.
// Tune these to re-skin or re-time the loop.

export const FPS = 25;
export const WIDTH = 1920;
export const HEIGHT = 1080;

// 8s loop. All periodic motion below is designed to divide evenly into
// this so frame 0 and the last frame line up for a seamless loop.
export const DURATION_IN_FRAMES = 200;

export const CENTER = { x: WIDTH / 2, y: HEIGHT / 2 };

// Ring geometry.
export const RING_CORE_RADIUS = 260; // radius of the tightly-packed inner band
export const RING_BAND_WIDTH = 46; // soft spread of particles around the core radius
export const RING_PARTICLE_COUNT = 5200;

// Outer halo scatter.
export const HALO_PARTICLE_COUNT = 1600;
export const HALO_INNER_OFFSET = 30; // gap between ring band and halo start
export const HALO_DRIFT_DISTANCE = 230; // how far a halo particle travels before fading out
export const HALO_DRIFT_PERIOD = 100; // frames per drift-and-fade cycle (divides DURATION_IN_FRAMES)

// Motion periods (frames). Each must divide DURATION_IN_FRAMES evenly to
// keep the loop seamless.
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
