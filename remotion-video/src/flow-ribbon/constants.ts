// Timing, layout and geometry config for the flowing-ribbon motion graphic.
//
// The reference clip is 768x432 @ 25fps / 358 frames (14.32s). This piece
// re-times it to 30fps and 430 frames (14.333s) - the nearest whole frame
// count at 30fps - and keeps the 16:9 framing.
//
// Everything here is resolution-independent. The scene is authored in world
// units and framed by a perspective camera, and nothing below is denominated
// in pixels, so the 4K compositions are the same image as the 1080p ones,
// sampled more finely. (Two things outside this file had to be corrected for
// that to hold - see the bloom pyramid in scene.ts and the speck grid in
// specks.ts.)

export const FPS = 30;

// 430 frames @ 30fps = 14.333s, matching the 14.32s reference. Every animated
// term in the scene uses a temporal frequency that is an integer multiple of
// one cycle per loop, so this frame lands exactly where frame 0 started.
export const DURATION_IN_FRAMES = 430;

export const BASE_WIDTH = 1920;
export const BASE_HEIGHT = 1080;

// --- Band layout, in world units ------------------------------------------
// The band runs along +X. The camera sits on +Z looking at the origin.

/** Half-length of the band along X. It overshoots the frame so it bleeds off both edges. */
export const BAND_HALF_LENGTH = 9;

/**
 * Spatial period of the wave field along X. BAND_HALF_LENGTH * 2 is an exact
 * multiple of this, which is what lets particles drift one full period over
 * the loop and wrap invisibly.
 */
export const WAVE_PERIOD = 9;

/** Number of ribbon strands stacked across the band. */
export const STRAND_COUNT = 19;

/** Centre-to-centre spacing between strands, in world units. */
export const STRAND_PITCH = 0.21;

/** Radius of each strand's half-tube cross-section. */
export const STRAND_RADIUS = 0.088;

/** Vertices along X per strand. Drives how smooth the crests read. */
export const STRAND_SEGMENTS_U = 420;

/** Vertices across each strand's half-tube. */
export const STRAND_SEGMENTS_C = 9;

/**
 * Depth offset applied per strand, so the stack recedes from the camera
 * instead of being a flat wall. This is what gives the bundle its volume.
 */
export const STRAND_DEPTH_PITCH = 0.07;

/** Extra phase lag per strand, in radians. Makes the bundle fan out and gather. */
export const STRAND_PHASE_LAG = 0.055;

// --- Upper sheet -----------------------------------------------------------
//
// Above the strand bundle the band is a single smooth surface that rolls away
// from camera as it rises - the reference's specks sit ON that surface rather
// than floating in front of it, which is what keeps the cloud inside the
// band's silhouette instead of scattering over the background.

/** Radius of the roll. Larger values make a broader, flatter upper surface. */
export const SHEET_RADIUS = 3.4;

/**
 * How far around the roll the sheet sweeps, in radians, measured from
 * camera-facing. At 0 the sheet meets the top strand face-on; by SHEET_ARC it
 * has turned to face upward and reads as the band's crest.
 */
export const SHEET_ARC = 0.82;

export const SHEET_SEGMENTS_U = 420;
export const SHEET_SEGMENTS_V = 40;

// --- Particle cloud --------------------------------------------------------

/**
 * Particle count is deliberately NOT scaled with resolution: density is a
 * design property of the shot, so 1080p and 4K render the same cloud.
 */
export const PARTICLE_COUNT = 9500;

/**
 * How far past the sheet's own top edge particles may sit, as a fraction of
 * the sheet sweep. A little overshoot lets the densest part of the cloud
 * break the silhouette softly, as it does in the reference.
 */
export const PARTICLE_SHEET_OVERSHOOT = 0.08;

/** Outward offset of a particle from the sheet surface, in world units. */
export const PARTICLE_SURFACE_LIFT = 0.1;

/** Depth spread of the cloud around the band. */
/** Cloud depth range, as [behind focal plane, toward camera]. Asymmetric so near particles bloom into large bokeh discs. */
export const PARTICLE_DEPTH_RANGE: readonly [number, number] = [-2.2, 3.4];

/** Base sprite radius in world units, before depth-of-field spreading. */
export const PARTICLE_BASE_SIZE = 0.016;

/** How aggressively out-of-focus particles spread. Higher = shallower depth of field. */
export const BOKEH_STRENGTH = 0.4;

/** Largest circle-of-confusion multiplier, so near particles stay bounded. */
export const BOKEH_MAX = 11;

// --- Haze sheet ------------------------------------------------------------

export const HAZE_SEGMENTS_U = 220;
export const HAZE_SEGMENTS_V = 60;

/** How far the additive haze extends above the strand stack. */
export const HAZE_RISE = 3.2;

// --- Camera ----------------------------------------------------------------

export const CAMERA_FOV = 32;
export const CAMERA_POSITION: readonly [number, number, number] = [0, 0.55, 11.8];
export const CAMERA_TARGET: readonly [number, number, number] = [0, -0.15, 0];

/**
 * Camera roll, in radians. Rolling the camera rather than the band keeps the
 * band's local space identical to world space, so every layer can do its
 * lighting maths without a model-matrix round trip. Combined with the wave
 * shape this produces the reference's upper-left-to-lower-right diagonal.
 */
export const CAMERA_ROLL = 0.19;

// --- Post ------------------------------------------------------------------

export const BLOOM_STRENGTH = 0.5;
export const BLOOM_RADIUS = 0.75;
export const BLOOM_THRESHOLD = 0.18;

/** Strength of the corner darkening, 0 = off. */
export const VIGNETTE_STRENGTH = 0.7;

export type Variant = "reference" | "cyan";
