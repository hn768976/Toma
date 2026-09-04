/**
 * Every number that shapes the clip. World units are arbitrary but consistent:
 * the camera sits CAM_Y above a nominally flat ground plane at y = 0 and looks
 * across it, so "26" reads as roughly a camera-height above the surface.
 */

export const FPS = 30;
export const DURATION_IN_FRAMES = 450; // 15s
export const BASE_WIDTH = 3840;
export const BASE_HEIGHT = 2160;

// ---------------------------------------------------------------------------
// Camera. Fixed for the whole clip — all motion belongs to the flow and the
// relief. A shallow pitch is what compresses the far field toward the top of
// frame and turns circular vortices into ellipses.
// ---------------------------------------------------------------------------

export const CAM_Y = 26;
export const CAM_PITCH_DEG = 19;
export const CAM_VFOV_DEG = 30;

// ---------------------------------------------------------------------------
// Field domain. Wider than the visible ground so particles never advect out of
// the sampled region and the far edge is always beyond the fog blackout.
// ---------------------------------------------------------------------------

export const FIELD_X0 = -300;
export const FIELD_X1 = 300;
export const FIELD_Z0 = -470;
export const FIELD_Z1 = 40;

/** Grid resolution the curl field, relief and brightness field are sampled at. */
export const GRID_X = 288;
export const GRID_Z = 216;

/**
 * Particle seeding is done in *view depth*, not in a world-space rectangle. The
 * visible ground is a narrow trapezoid — a couple of dozen world units across at
 * the bottom of frame, hundreds at the top — so seeding a rectangle would put
 * the great majority of particles off the sides of the frame, and starve exactly
 * the near field that needs them most.
 *
 * Depths are drawn so that their density goes as 1/depth, which leaves the
 * perspective density gradient the reference has without letting the far field
 * outnumber the near field by the square of the depth ratio.
 */
export const SEED_DEPTH_NEAR = 30;
export const SEED_DEPTH_FAR = 405;
/** World units of bleed either side, so trails can drift in from off frame. */
export const SEED_X_MARGIN = 26;

// ---------------------------------------------------------------------------
// Curl field. Amplitudes are given as *velocity* weights; the potential
// amplitude is derived by dividing by frequency so each octave contributes the
// stated share of the flow speed rather than of the raw potential.
// ---------------------------------------------------------------------------

export const FIELD_OCTAVES: { wavelength: number; weight: number }[] = [
  { wavelength: 134, weight: 1.0 }, // broad sweeps and the big vortices
  { wavelength: 51, weight: 0.5 }, // eddies inside the sweeps
  { wavelength: 23, weight: 0.16 }, // per-line wobble
];

/** Radius of the circle walked through the noise's two time axes. */
export const FIELD_TIME_RADIUS = 0.62;

// ---------------------------------------------------------------------------
// Surface relief. Slopes stay under the camera pitch so the surface never folds
// back on itself.
// ---------------------------------------------------------------------------

export const RELIEF_OCTAVES: { wavelength: number; amplitude: number }[] = [
  { wavelength: 170, amplitude: 6.8 },
  { wavelength: 70, amplitude: 1.1 },
];

export const RELIEF_TIME_RADIUS = 0.34;

// ---------------------------------------------------------------------------
// Brightness field — low frequency, so hot filaments cluster into ribbons
// instead of scattering evenly.
// ---------------------------------------------------------------------------

export const BRIGHT_WAVELENGTH = 88;
export const BRIGHT_WAVELENGTH_2 = 27;
export const BRIGHT_TIME_RADIUS = 0.45;

// ---------------------------------------------------------------------------
// Particles.
// ---------------------------------------------------------------------------

export const PARTICLE_COUNT = 7000;

/**
 * Per-particle life lengths. Each divides evenly into DURATION_IN_FRAMES, so
 * every particle is back at its seed on frame 450; because several different
 * lengths are in play the *ensemble* only repeats at 450 rather than at the
 * shortest cycle.
 */
export const CYCLE_LENGTHS = [75, 90, 150, 225];

export const TRAIL_MIN = 28;
export const TRAIL_MAX = 100;

/** World units advanced along a streamline per frame, before per-particle scale. */
export const STEP = 0.34;
export const SPEED_MIN = 0.72;
export const SPEED_MAX = 1.5;

/** Frames a particle spends fading in at birth and out before its reset. */
export const FADE_IN_STEPS = 16;
export const FADE_OUT_STEPS = 20;

// ---------------------------------------------------------------------------
// Look. Pixel sizes are in *composition* pixels (i.e. at 3840x2160), so a 1080p
// preview is an exact downscale of the 4K render.
// ---------------------------------------------------------------------------

/** Gaussian sigma of a line at the near edge of frame, in composition pixels. */
export const LINE_SIGMA_NEAR = 0.9;
/** ...and at the far edge, which is what thins the far field to hairlines. */
export const LINE_SIGMA_FAR = 0.46;

/** Depth at which the fog has dimmed a line to 1/e. */
export const FOG_DISTANCE = 420;
export const FOG_POWER = 2.2;

/** Depth of field: sharp band, and how far either side it takes to go soft. */
export const FOCUS_DEPTH = 108;
export const DOF_NEAR_SPAN = 230;
export const DOF_FAR_SPAN = 150;
export const DOF_MAX_WIDEN = 3.8;

/** Bloom: the brightest filaments get a second, wider, much dimmer billboard. */
export const BLOOM_THRESHOLD = 0.45;
export const BLOOM_WIDTH_MULT = 9;
export const BLOOM_INTENSITY = 0.11;

/** ...and the very hottest get a third, very wide, very faint one. */
export const HALO_THRESHOLD = 0.84;
export const HALO_WIDTH_MULT = 40;
export const HALO_INTENSITY = 0.0072;

/**
 * Glows are drawn as round billboards, not as ribbons, so a single one covers
 * several trail segments. Emitting one per segment would be pure overdraw;
 * instead they are strided out to roughly one blob per blob-width of trail.
 */
export const GLOW_MAX_STRIDE = 12;

/** View-space depths the near/far line widths are anchored to. */
export const NEAR_DEPTH = 36;
export const FAR_DEPTH = 360;

/** Widest a bloom / halo quad is allowed to get, in composition pixels. */
export const BLOOM_SIGMA_CAP = 14;
export const HALO_SIGMA_CAP = 60;
