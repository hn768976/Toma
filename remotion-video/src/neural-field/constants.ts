// Timing/sizing config for the "neural field" abstract tech background.
//
// The reference clip is 768x432, 250 frames at 25fps = exactly 10.000s.
// We keep the duration identical but retime to 30fps, so 300 frames.
//
// Everything that has a pixel or particle-count dimension is declared here
// at 1x (= 1080p) and derived for other resolutions through `resolutionScale`,
// so the 1080p and 4K compositions stay visually identical rather than the
// 4K one looking sparser (which is what happens if you only change the
// canvas size).

export const FPS = 30;

/** 10.000s at 30fps — same wall-clock length as the reference clip. */
export const DURATION_IN_FRAMES = 300;
export const DURATION_IN_SECONDS = DURATION_IN_FRAMES / FPS;

export const HD_WIDTH = 1920;
export const HD_HEIGHT = 1080;
export const UHD_WIDTH = 3840;
export const UHD_HEIGHT = 2160;

// ---------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------

export const CAMERA_FOV = 38;
export const CAMERA_Z = 14;

/** The ridge field sits here; the bokeh volume is in front of it. */
export const FIELD_Z = -4;

/**
 * View-space depth that is in perfect focus. Parked just in front of the
 * ridge field so the field reads sharp and everything drifting toward the
 * camera melts into big soft bokeh, which is what gives the reference its
 * depth.
 */
export const FOCAL_Z = -3.2;

/** Distance from FOCAL_Z at which a particle reaches full defocus. */
export const FOCAL_RANGE = 7.0;

// ---------------------------------------------------------------------------
// Bokeh particle volume (world units, measured at the focal plane)
// ---------------------------------------------------------------------------

export const BOKEH_COUNT = 2800; // at 1x
export const BOKEH_VOLUME_WIDTH = 34;
export const BOKEH_VOLUME_HEIGHT = 20;
export const BOKEH_Z_NEAR = 5.5; // closest to camera -> largest, softest discs
export const BOKEH_Z_FAR = -4.5; // just behind the ridge field

/** Fraction of particles that are tiny in-focus "sparkles" rather than bokeh. */
export const SPARKLE_FRACTION = 0.82;

// ---------------------------------------------------------------------------
// Ridge field
// ---------------------------------------------------------------------------

/** Plane subdivisions at 1x. Drives how much real relief the field has. */
export const FIELD_SEGMENTS_X = 220;
export const FIELD_SEGMENTS_Y = 130;

/** Peak vertex displacement along z, in world units. */
export const FIELD_RELIEF = 1.15;

/** How many concentric gyri bands the warped field is sliced into. */
export const FIELD_BAND_COUNT = 8.5;

// ---------------------------------------------------------------------------
// Motion — all periods divide DURATION_IN_SECONDS so the clip loops cleanly
// ---------------------------------------------------------------------------

/** One full revolution of the noise phase circle per clip = seamless loop. */
export const LOOP_PERIOD = DURATION_IN_SECONDS;

/** Vertical bokeh drift, in volume-heights per clip. Integer => seamless. */
export const BOKEH_DRIFT_CYCLES = 1;
