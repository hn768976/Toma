// Timing matches the reference clip exactly: 6.0 s, re-timed to 30 fps.
export const FPS = 30;
export const DURATION_IN_FRAMES = 180;

// Compositions are authored at 4K; the 1080p deliverable is rendered
// from the same composition with --scale=0.5.
export const WIDTH = 3840;
export const HEIGHT = 2160;

// Fin dome geometry (world units): BLADE_COUNT thin blades radiate from
// a hub on the Y axis; their top edges trace a dome of DOME_RADIUS x
// DOME_HEIGHT.
export const BLADE_COUNT = 40;
export const DOME_RADIUS = 12;
export const DOME_HEIGHT = 3;
// >1 = profile falls steeply off the hub and flattens out at the rim.
export const DOME_FLARE = 2.6;
export const HUB_RADIUS = 0.35;
export const BLADE_DEPTH = 6;
export const BLADE_THICKNESS = 0.14;
// Plan-view sweep of each blade (radians per world unit of radius), so
// the blades curve like turbine vanes instead of running dead straight.
export const BLADE_SWEEP = -0.18;

// The dome turns by exactly one blade spacing per loop, so frame 0 and
// frame DURATION_IN_FRAMES are identical and the clip loops seamlessly
// (same as the reference).
export const LOOP_ROTATION = (Math.PI * 2) / BLADE_COUNT;
