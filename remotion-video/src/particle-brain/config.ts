/**
 * Top-level dials for the ParticleBrain composition.
 *
 * Everything periodic uses a period that divides DURATION_IN_FRAMES
 * exactly, which is what makes the 600-frame loop seamless.
 */

export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
/** 20.0s. Every cycle below divides into this. */
export const DURATION_IN_FRAMES = 600;

// ---------------------------------------------------------------- subject

/** Brain silhouette height as a fraction of frame height. */
export const BRAIN_HEIGHT_FRACTION = 0.37;
/** Silhouette centre, as fractions of the frame — centre-right. */
export const BRAIN_CENTER_X = 0.665;
export const BRAIN_CENTER_Y = 0.415;

export const BRAIN_PARTICLE_COUNT = 5200;
/** Coarse lattice the particles snap to, in 4K pixels. */
export const BRAIN_GRID = 9;
export const BRAIN_PARTICLE_MIN_SIZE = 3;
export const BRAIN_PARTICLE_MAX_SIZE = 9;
/** Share of brain particles that sit just outside the silhouette. */
export const FREE_PARTICLE_FRACTION = 0.03;
/** How far outside the silhouette those free particles may sit, in px. */
export const FREE_PARTICLE_REACH = 52;

/** Interior guide curves. Density is pulled onto these without drawing them. */
export const GYRI_COUNT = 50;
export const CEREBELLUM_FOLIA_COUNT = 5;

/** Density weighting: how sharply particles crowd the outline / the gyri. */
export const EDGE_FALLOFF = 17;
export const EDGE_WEIGHT = 0.85;
export const GYRI_WEIGHT = 0.88;
/** Floor density in the flat regions between folds. */
export const FLAT_WEIGHT = 0.2;

// ------------------------------------------------------------------ title

export const TITLE_TEXT = "AI";
export const TITLE_PARTICLE_COUNT = 900;
export const TITLE_GRID = 12;
export const TITLE_CAP_HEIGHT = 430;
export const TITLE_CENTER_Y = 0.765;
/** Extra tracking between the letters, as a fraction of cap height. */
export const TITLE_TRACKING = 0.12;
export const TITLE_PARTICLE_MIN_SIZE = 3;
export const TITLE_PARTICLE_MAX_SIZE = 8;

// ---------------------------------------------------------------- ribbons

export const RIBBON_COUNT = 28;
/** Of those, how many pass in front of the brain at low opacity. */
export const RIBBON_FRONT_COUNT = 6;
export const RIBBON_MIN_WIDTH = 2;
export const RIBBON_MAX_WIDTH = 5;
export const RIBBON_HIGHLIGHTS_MIN = 2;
export const RIBBON_HIGHLIGHTS_MAX = 3;
/** Fraction of a ribbon's length a highlight covers. */
export const RIBBON_HIGHLIGHT_SPAN = 0.085;
/** Legal highlight travel periods, all divisors of DURATION_IN_FRAMES. */
export const RIBBON_HIGHLIGHT_PERIODS = [600, 300, 300, 200, 150, 120];
/** Ribbons stay in the left part of frame so the brain reads clear. */
export const RIBBON_REGION_RIGHT = 0.72;

// ------------------------------------------------------------- glyph field

export const GLYPH_COUNT = 40;
export const GLYPH_MIN_SIZE = 30;
export const GLYPH_MAX_SIZE = 72;
export const GLYPH_MIN_OPACITY = 0.2;
export const GLYPH_MAX_OPACITY = 0.6;
/** Flickers per second; each lasts GLYPH_FLICKER_FRAMES. */
export const GLYPH_FLICKER_RATE = 2.5;
export const GLYPH_FLICKER_FRAMES = 3;
/** Keep glyphs off the brain: exclusion radius around it, in px. */
export const GLYPH_EXCLUSION_RADIUS = 780;

// ---------------------------------------------------------------- motion

/** Per-particle twinkle. Periods divide DURATION_IN_FRAMES. */
export const TWINKLE_PERIODS = [50, 60, 75, 100, 120, 150];
export const TWINKLE_MIN_AMP = 0.1;
export const TWINKLE_MAX_AMP = 0.3;

/** Per-particle closed drift orbit. */
export const ORBIT_PERIODS = [150, 200, 300, 600];
export const ORBIT_MIN_RADIUS = 3;
export const ORBIT_MAX_RADIUS = 10;

/** Share of particles that fade out and reappear elsewhere during the loop. */
export const CHURN_FRACTION = 0.02;

/**
 * Signal pulses. Each is a band of raised brightness crossing the brain
 * from a different direction; all four finish inside the loop, so frame 0
 * and frame 600 both sit in the quiet between pulses.
 */
export const PULSES: {
  angle: number;
  start: number;
  duration: number;
  width: number;
  strength: number;
}[] = [
  { angle: -0.32, start: 20, duration: 70, width: 0.11, strength: 0.6 },
  { angle: 2.5, start: 165, duration: 84, width: 0.1, strength: 0.52 },
  { angle: 1.32, start: 310, duration: 66, width: 0.13, strength: 0.58 },
  { angle: -2.05, start: 448, duration: 78, width: 0.115, strength: 0.55 },
];
/** Comet-tail length behind a pulse front, as a multiple of its width. */
export const PULSE_TAIL = 1.7;
/** How far a pulse nudges particles along its direction of travel, in px. */
export const PULSE_DISPLACEMENT = 4;

/** Ambient camera drift: a closed path, this many px in each axis. */
export const CAMERA_DRIFT_X = 10;
export const CAMERA_DRIFT_Y = 7;

// ---------------------------------------------------------------- finish

/**
 * Bloom is drawn at a fraction of full resolution and scaled back up.
 * A blur is low-frequency by definition, so the downscale is invisible
 * and costs a sixteenth of the memory and fill of a full-size pass.
 */
export const BLOOM_SCALE = 0.25;
export const BLOOM_TIGHT_BLUR = 9;
export const BLOOM_WIDE_BLUR = 34;
export const BLOOM_TIGHT_OPACITY = 0.75;
export const BLOOM_WIDE_OPACITY = 0.55;
/** Particles at or above this brightness contribute to the bloom. */
export const BLOOM_THRESHOLD = 0.62;

export const VIGNETTE_STRENGTH = 0.22;
export const GRAIN_ALPHA = 0.04;
/** Grain is generated at this size and scaled up; keeps it cheap at 4K. */
export const GRAIN_TILE_WIDTH = 960;
export const GRAIN_TILE_HEIGHT = 540;

export const BACKGROUND_SCALE = 0.25;
