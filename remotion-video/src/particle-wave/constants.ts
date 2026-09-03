// Layout, motion and colour configuration for the particle wave field.
//
// The composition is authored at 4K. Everything below is either a
// fraction of the frame or a pixel value quoted at BASE_WIDTH, and is
// scaled by (width / BASE_WIDTH) at draw time, so a 1080p preview and a
// 4K master are the same picture at different resolutions.

export const FPS = 30;

// 20s. The whole loop is built around this number: every octave of the
// noise field travels a whole number of its own periods across it, so
// frame 600 is identical to frame 0.
export const DURATION_IN_FRAMES = 600;

export const BASE_WIDTH = 3840;
export const BASE_HEIGHT = 2160;

// --- Background -----------------------------------------------------
export const BACKGROUND_TOP = "#04060f";
export const BACKGROUND_BOTTOM = "#0a1020";

// Broad, very faint glow sitting under the brightest part of the wave,
// as if the dots were lighting the space around them.
export const GLOW_ALPHA = 0.055;
export const GLOW_RADIUS_FRACTION = 0.52; // of frame width
// The glows are squashed vertically so they hug the wave band.
export const GLOW_FLATTEN = 0.42;
export const BAND_GLOW_ALPHA = 0.022;

// Fine grain, purely to keep the background gradient from banding once
// the file has been through H.264.
export const GRAIN_ALPHA = 0.015;
export const GRAIN_TILE_SIZE = 256;

// --- Grid -----------------------------------------------------------
export const COLS = 320;
export const ROWS = 90;

// The field is wider than the frame so the wave never shows an edge.
export const OVERSCAN_X = 1.45;

// Baked projection. Row 0 is the far edge (at the horizon), the last row
// is the near edge. Rows are evenly spaced in "world" depth and the
// screen mapping is 1/Z, which is what crowds the far rows together.
export const HORIZON_Y_FRACTION = 0.47;
export const NEAR_ROW_Y_FRACTION = 0.87;
export const DEPTH_RATIO = 2.0; // Z(far) / Z(near)

// How much of the 1/Z scale is applied horizontally. Full convergence
// would pinch the far rows into the centre of frame and leave the top
// corners of the band empty; the reference keeps the far edge nearly
// full-width, so only a little is applied.
export const H_CONVERGENCE = 0.3;

// Dot size in px at BASE_WIDTH, far row -> near row.
export const DOT_MIN_PX = 1.2;
export const DOT_MAX_PX = 5.8;

// Per-dot jitter, as a fraction of the column/row spacing. Just enough
// to break up the moire the regular lattice would otherwise produce
// when the 4K field is downsampled to 1080p.
export const JITTER_X = 0.25;
export const JITTER_Y = 0.16;

// --- Displacement ---------------------------------------------------
// Peak vertical displacement of the nearest row, as a fraction of frame
// height. Far rows get AMP_DEPTH_FLOOR of it; that difference is what
// makes the grid read as a receding plane rather than a flat pattern,
// and it is also what keeps the top 40% of frame clear.
export const AMPLITUDE_FRACTION = 0.14;
export const AMP_DEPTH_FLOOR = 0.35;

// Depth (row) axis of the noise field, in noise units across the whole
// grid. Kept small on purpose: the surface has to stay coherent from the
// far rows to the near ones, or the crests break up into vertical
// streaks instead of reading as one sheet.
export const DEPTH_SPAN = 1.0;

export type WaveOctave = {
  // Spatial periods across the field. The wave translates by exactly
  // (travel / periods) of the field width over one loop, so this is the
  // knob that sets how slowly the crests roll.
  periods: number;
  // Radius of the circle the horizontal axis is sampled on. Roughly
  // 2*PI*radius features per period; also sets how "rough" the octave is.
  radius: number;
  // Whole circles travelled per loop. Must be an integer for the loop.
  travel: number;
  weight: number;
  depthScale: number;
  // Phase of this octave's slow breathing on the 4th noise axis.
  phase: number;
};

// Two broad rolling swells carrying most of the amplitude, plus two
// finer octaves for the rippled texture visible along the crests.
//
// The swell is split in two because a single octave sampled on a small
// circle passes through phases where it happens to be nearly flat, and
// the whole surface would go slack for a few seconds; two swells of
// slightly different wavelength never flatten at the same moment.
//
// All four travel at close to the same speed, so the texture rides the
// crests instead of sliding through them — but not at exactly the same
// speed, and that small difference is what makes the surface morph over
// the 20s instead of translating rigidly.
export const OCTAVES: WaveOctave[] = [
  {
    periods: 1.35,
    radius: 0.62,
    travel: 1,
    weight: 0.46,
    depthScale: 1.25,
    phase: 0,
  },
  {
    periods: 1.05,
    radius: 0.78,
    travel: 1,
    weight: 0.34,
    depthScale: 0.95,
    phase: 3.1,
  },
  {
    periods: 2.8,
    radius: 1.2,
    travel: 2,
    weight: 0.2,
    depthScale: 0.8,
    phase: 2.1,
  },
  {
    periods: 4.2,
    radius: 1.9,
    travel: 3,
    weight: 0.06,
    depthScale: 0.22,
    phase: 4.2,
  },
];

// Radius of the slow breathing circle on the 4th noise axis.
export const BREATH_RADIUS = 0.4;

// Maps the summed noise (roughly -0.75..0.75) onto 0..1.
export const NOISE_GAIN = 0.85;

// --- Brightness -----------------------------------------------------
export const HUE_STEPS = 64; // hue buckets across the frame
export const LEVEL_STEPS = 24; // brightness buckets

// Brightness of a dot sitting in a trough, relative to one on a crest.
export const LEVEL_FLOOR = 0.55;
export const LEVEL_EXP = 1.1;

// Extra brightness where the surface tilts up toward the camera. This is
// the density effect the reference gets for free from its geometry: rows
// bunch together on a face turned toward the viewer and spread apart on
// one turned away. Measured as the change in height from one row to the
// next, so it costs no extra noise samples.
export const SLOPE_GAIN = 0.45;

// Depth falloff of brightness and of dot size. Both run off the row
// index rather than off the 1/Z scale: the projection crowds the far
// rows together, and driving brightness off that as well would collapse
// the whole far half of the surface into one dim smear.
export const DEPTH_ALPHA_MIN = 0.14;
export const DEPTH_ALPHA_EXP = 1.05;
export const DOT_SIZE_EXP = 0.9;

// The nearest rows are pulled back down again, so the bottom of the band
// dissolves instead of ending on a hard edge.
export const NEAR_FADE_START = 0.82;
export const NEAR_FADE_AMOUNT = 0.25;

// Soft halo around the hottest dots, and a white-hot core above that.
export const HALO_MIN_ENERGY = 0.62;
export const HALO_ALPHA = 0.5;
export const HALO_SIZE_SCALE = 3.4;
export const HOT_MIN_ENERGY = 0.88;
export const HOT_ALPHA = 0.45;

export const NOISE_SEED = 20250903;
