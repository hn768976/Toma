// Timing matches the reference clip exactly: 6.0 s, re-timed to 30 fps.
export const FPS = 30;
export const DURATION_IN_FRAMES = 180;

// Compositions are authored at 4K; the 1080p deliverable is rendered
// from the same composition with --scale=0.5.
export const WIDTH = 3840;
export const HEIGHT = 2160;

// Fan geometry (world units): BLADE_COUNT thin blades radiate from a hub
// on the Y axis. Their top edges rise outward along a bowl profile
// (height BOWL_HEIGHT at BOWL_RADIUS, exponent BOWL_FLARE), and each one
// sweeps in plan view (BLADE_SWEEP radians per unit of radius) so the
// blades curve like gills.
export const BLADE_COUNT = 44;
export const BOWL_RADIUS = 12;
export const BOWL_HEIGHT = 0.8;
export const BOWL_FLARE = 2;
export const HUB_RADIUS = 0.2;
export const BLADE_DEPTH = 6;
export const BLADE_THICKNESS = 0.12;
export const BLADE_SWEEP = 0.06;

// The fan turns by a whole number of blade spacings per loop, so frame 0
// and frame DURATION_IN_FRAMES are identical and the clip loops
// seamlessly (same as the reference). 1 spacing matches the reference's
// on-screen drift speed at the bottom of frame.
export const SPACINGS_PER_LOOP = 1;
export const LOOP_ROTATION = (SPACINGS_PER_LOOP * Math.PI * 2) / BLADE_COUNT;
