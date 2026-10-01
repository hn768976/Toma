// Timing + layout for the "AI data flow" loop.
//
// All geometry is authored in a 1920x1080 design space and multiplied by
// `k = width / 1920` at draw time, so the same code drives the 4K master
// composition and any scaled render (e.g. `--scale=0.5` for 1080p).

export const FPS = 30;

// 15s, matching the reference. Every periodic motion below completes a
// whole number of cycles in this window, so the last frame flows straight
// back into frame 0 (seamless loop).
export const DURATION_IN_FRAMES = 450;

export const WIDTH_4K = 3840;
export const HEIGHT_4K = 2160;

export const DESIGN_WIDTH = 1920;
export const DESIGN_HEIGHT = 1080;

// Central chip, in design px.
export const CHIP_SIZE = 116;
export const CHIP_RADIUS = 16;
// Streams start/stop this far from the centre (just outside the chip).
export const CHIP_GAP = 62;
export const RING_RADIUS = 150;

// Stream envelope: half-height at the chip and at the frame edge.
export const ENVELOPE_AT_CHIP = 40;
export const ENVELOPE_AT_EDGE = 365;
// Paths run a little past the frame edge so streaks enter/exit off-screen.
export const PATH_OVERSHOOT = 1.12;

export const LANES_PER_SIDE = 150;
export const PARTICLES_PER_LANE_MIN = 1;
export const PARTICLES_PER_LANE_MAX = 3;
