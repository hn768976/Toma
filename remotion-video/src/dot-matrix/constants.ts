// Geometry, timing and palettes for the "LED Dot Matrix Wall" background.
//
// Everything here is expressed in DEVICE PIXELS of the 4K composition
// (3840x2160). The 1080p deliverables are produced by rendering the same
// composition with `--scale=0.5`, which halves every coordinate — so the
// numbers below are chosen so that halving them stays on whole pixels.

export const FPS = 30;

// 20s. Every periodic term in the animation has a period that divides this
// (or is phrased as a fraction of it), so frame 600 is identical to frame 0.
export const DURATION_IN_FRAMES = 600;

export const WIDTH = 3840;
export const HEIGHT = 2160;

// ---------------------------------------------------------------------------
// The grid
// ---------------------------------------------------------------------------
//
// The pitch has to land on whole pixels at 4K *and* at 1080p, otherwise the
// cells round unevenly and the grid beats against the pixel raster (a moire
// shimmer that is very obvious on a static grid).
//
// That means the 1080p pitch must divide both 1920 and 1080 exactly. The only
// candidates are 10, 12, 15, 20, 24, 30 and 40. The reference sits at roughly
// 120 columns, but 120 is not reachable: 1920 / 120 = 16 and 1080 / 16 = 67.5.
// A pitch of 15 (128 x 72) is the closest reachable grid and is what we use.
export const COLS = 128;
export const ROWS = 72;
export const PITCH = WIDTH / COLS; // 30 at 4K, 15 at 1080p

// Dot size scales with brightness: dim dots are small specks, hot dots are
// chunky squares. This is what makes the reference read as an LED panel with
// varying drive current rather than a grid of identical squares fading in and
// out. The spec's "~40% of pitch" is the middle of the ladder.
//
// Every size is EVEN so that it halves to a whole pixel at 1080p.
export const SIZE_LADDER = [8, 10, 12, 14, 16, 18]; // 27% .. 60% of pitch

// Number of quantised brightness levels. Drawing is batched one fillStyle per
// bucket, so this is also the number of draw batches per frame.
export const BUCKETS = 48;

// A dot feeds the bloom pass only when its own hot pulse is actually firing —
// not merely when it is bright. Deriving "hot" from the brightness bucket
// couples bloom to the cluster tuning: raise the cluster gain and suddenly
// whole patches bloom, neighbouring dots merge, and the panel read is gone.
// This is the pulse strength (envelope * gate) above which a dot blooms.
export const BLOOM_PULSE_THRESHOLD = 0.45;

export const BLOOM_DOWNSCALE = 4;
// CSS blur, applied to the *displayed* element (i.e. in composition pixels),
// not to the 1/4-size backing store. The 4x upscale already softens the layer,
// so this stays small — heavy bloom merges neighbouring dots.
export const BLOOM_BLUR_PX = 5;
export const BLOOM_OPACITY = 0.7;

// ---------------------------------------------------------------------------
// Brightness model
// ---------------------------------------------------------------------------
export const BASE_LEVEL = 0.05; // every dot is always lit at least this much
export const GLOW_GAIN = 0.3; // how much the broad light mass adds
export const CLUSTER_GAIN = 0.82; // how much the noise-driven patches add

// Static per-dot brightness multiplier range. Without this every dot inside a
// cluster lights identically and the patch reads as a flat rectangle, and the
// lit half of the frame collapses to one flat mid-tone. The range runs almost
// to zero, and the draw is skewed hard toward the bottom of it, so that even
// inside the brightest region most dots stay near-invisible specks and the
// bright ones stay countable — which is what the reference actually looks like.
export const DOT_GAIN_MIN = 0.06;

// Per-dot multiplier on the cluster contribution, mildly skewed. Kept separate
// from DOT_GAIN_MIN so a patch passing over the grid produces genuinely bright
// dots instead of inheriting the ambient field's hard skew toward black.
export const CLUSTER_GAIN_MIN = 0.22;
export const CLUSTER_GAIN_EXP = 0.55;
export const DOT_GAIN_MAX = 1;

// Slow per-dot shimmer. Periods must divide DURATION_IN_FRAMES.
export const SHIMMER_PERIODS = [75, 100, 120, 150, 200];
export const SHIMMER_DEPTH = 0.18;

// Hot dots: the sparkle. 13% of dots are eligible and each spends ~35% of its
// cycle pulsing; after the gate below removes the ones sitting in unlit parts
// of the frame, that lands ~2% at near-white at any given instant.
export const HOT_ELIGIBLE_FRACTION = 0.13;
export const HOT_PERIODS = [20, 24, 25, 30, 40, 50, 60, 75]; // all divide 600
export const HOT_DUTY = 0.35;
export const HOT_STRENGTH = 0.62;

// Hot dots only fire where there is light to begin with, so they pool with the
// clusters rather than sparkling in the dark corners. The window is wide: a
// tight gate silently deletes most of the sparkle, since the steep glow falloff
// means most of the frame sits low.
export const HOT_GATE_LO = 0.06;
export const HOT_GATE_HI = 0.38;

// ---------------------------------------------------------------------------
// The glow (broad light mass behind the grid)
// ---------------------------------------------------------------------------
// Centre, in normalised frame coords. "Just above centre", per the reference.
export const GLOW_CX = 0.46;
export const GLOW_CY = 0.27;
export const GLOW_DRIFT_X = 0.075; // returns exactly to start at frame 600
export const GLOW_DRIFT_Y = 0.05;
export const GLOW_RADIUS_X = 0.82;
export const GLOW_RADIUS_Y = 0.92;
export const GLOW_FALLOFF = 2.6;

// The visible haze painted behind the dots, so the gaps between dots are not
// flat background. This is the same mass the dots inherit brightness from.
export const HAZE_OPACITY = 0.7;

// ---------------------------------------------------------------------------
// Cluster patches
// ---------------------------------------------------------------------------
// Noise frequency across the frame width. The Y frequency is scaled by the
// frame aspect so the noise cells stay square and the patches do not look
// stretched. At 3.2 adjacent cells merge into one sprawling mass across most
// of the frame; 4.4 keeps two or three separate patches, which is the read.
export const CLUSTER_FREQ_X = 4.4;
export const CLUSTER_FREQ_Y = (CLUSTER_FREQ_X * HEIGHT) / WIDTH;

// Lattice depth along the (periodic) time axis of the noise.
export const CLUSTER_NOISE_PERIOD = 4;

// Migration of the patches across the field over one loop, in noise units.
export const CLUSTER_DRIFT_X = 0.4;
export const CLUSTER_DRIFT_Y = 0.3;

// Soft knee: only the top of the noise field lights up, so the patches pool
// into discrete clumps instead of washing the whole grid evenly.
//
// These are percentiles of the actual field, not round numbers. Interpolated
// value noise is clustered around 0.5 (measured: mean 0.49, sd 0.16, max 0.92),
// so a "high" threshold like 0.88 is reached by 0.3% of dots and produces no
// visible patches at all. 0.58 -> 0.76 is roughly p70 -> p95: about a third of
// the grid gets some lift and a few percent reaches the top.
export const CLUSTER_KNEE_LO = 0.56;
export const CLUSTER_KNEE_HI = 0.72;

// ---------------------------------------------------------------------------
// Grain (anti-banding dither)
// ---------------------------------------------------------------------------
export const GRAIN_TILE_SIZE = 512;
export const GRAIN_TILE_COUNT = 8; // divides 600, so the grain loops too
export const GRAIN_MAX = 6; // out of 255, ~2.4%

// ---------------------------------------------------------------------------
// Invariants
// ---------------------------------------------------------------------------
// The whole-pixel requirement is a correctness property, not a style choice,
// so it is checked rather than left as a comment. `insetForSize` is the rule
// that keeps every dot's origin on an even 4K pixel (and therefore a whole
// 1080p pixel) while staying centred in its cell to within 1px at 4K.
export const insetForSize = (size: number) =>
  2 * Math.floor((PITCH - size) / 4);

export const assertWholePixelGrid = () => {
  const problems: string[] = [];
  const whole = (n: number) => Number.isInteger(n);

  if (!whole(WIDTH / COLS) || !whole(HEIGHT / ROWS)) {
    problems.push(
      `pitch is not whole at 4K (${WIDTH / COLS} x ${HEIGHT / ROWS})`,
    );
  }
  if (!whole(WIDTH / 2 / COLS) || !whole(HEIGHT / 2 / ROWS)) {
    problems.push("pitch is not whole at 1080p");
  }
  if (WIDTH / COLS !== HEIGHT / ROWS) {
    problems.push("cells are not square");
  }
  for (const size of SIZE_LADDER) {
    // Even size + even inset => every drawn edge sits on an even 4K pixel, so
    // the 2:1 downscale to 1080p is exact and the square edges stay hard.
    if (size % 2 !== 0) problems.push(`dot size ${size} is odd`);
    if (insetForSize(size) % 2 !== 0)
      problems.push(`inset for size ${size} is odd`);
    if (size >= PITCH) problems.push(`dot size ${size} leaves no gap`);
  }
  if (DURATION_IN_FRAMES % GRAIN_TILE_COUNT !== 0) {
    problems.push("grain tile cycle does not divide the loop");
  }
  for (const p of [...HOT_PERIODS, ...SHIMMER_PERIODS]) {
    if (DURATION_IN_FRAMES % p !== 0)
      problems.push(`period ${p} does not divide the loop`);
  }

  if (problems.length > 0) {
    throw new Error(
      `Dot matrix grid is not whole-pixel safe: ${problems.join("; ")}`,
    );
  }
};
