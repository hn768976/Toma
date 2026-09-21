/**
 * Tunable rig parameters.
 *
 * Everything downstream (geometry, camera framing, motion) derives from these,
 * so a variation is a one-line edit here. See README "Making variations".
 */

/** Loop radius — the primary scale. All other lengths are fractions of it. */
export const R = 1;

/**
 * Saddle amplitude as a fraction of R. This is the vertical waviness that makes
 * the loop read as a saddle rather than a flat hoop, and it is what makes the
 * band appear to cross itself in projection.
 * Too small -> plain ring. Too large -> pretzel.
 */
export const A_RATIO = 0.4;

/**
 * Small odd-harmonic perturbation on the X/Z terms, as a fraction of R.
 * Must stay integer-harmonic (and odd, to preserve the two-fold Y symmetry the
 * loop relies on). 0 disables it.
 */
export const H3_RATIO = 0.05;

/**
 * Number of half-turns of the cross-section around the loop.
 * MUST be an integer or the band will not close.
 * Even -> orientable (both faces stay distinct). Odd -> Mobius, normals flip.
 */
export const K = 2;

/**
 * Constant roll of the cross-section in DEGREES, on top of the k half-turns.
 * Purely a framing control: it chooses which part of the loop shows its wide
 * face to the camera, without moving the camera or changing the silhouette.
 */
export const TWIST_PHASE_DEG = 50;

/** Band width as a fraction of R. The single strongest proportion cue. */
export const WIDTH_RATIO = 0.3;

/**
 * Band thickness as a fraction of the WIDTH (not of R). Non-zero on purpose:
 * the thin edge face is what catches the bright line along the silhouette.
 */
export const THICKNESS_RATIO = 0.015;

/**
 * Segments along the curve. Must be EVEN — the exact two-fold symmetry
 * construction mirrors ring i onto ring i + SEGMENTS/2.
 */
export const SEGMENTS = 1800;

/**
 * Constant offset added to the rotation, in DEGREES. Chooses which composition
 * lands on frame 0 without touching the 180-degree sweep that closes the loop.
 */
export const ROTATION_PHASE_DEG = 45;

export const FPS = 30;
export const DURATION_IN_FRAMES = 300;
export const COMP_WIDTH = 3840;
export const COMP_HEIGHT = 2160;
