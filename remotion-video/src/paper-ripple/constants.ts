// Timing, geometry and look configuration for the "Paper Ripple Relief"
// compositions.
//
// Everything here is expressed in *world units* rather than pixels, so the
// 1080p preview render and the 4K master render are pixel-for-pixel the same
// framing and the same relief — only the sampling rate changes.

export const FPS = 30;

// 10s loop. Every periodic term in the shader is a pure function of
// `frame / DURATION_IN_FRAMES`, so frame 300 lands exactly on frame 0.
export const DURATION_IN_FRAMES = 300;

// Composition is authored at 4K; the preview is rendered with `--scale=0.5`.
export const BASE_WIDTH = 3840;
export const BASE_HEIGHT = 2160;

// --- Camera -----------------------------------------------------------------
// Locked, straight down the -Z axis. No drift of any kind: the stillness is
// half the point of the clip.
export const CAMERA_FOV = 32;
export const CAMERA_DISTANCE = 10;

// Half-extents of what the camera sees at the plane (z = 0).
export const VISIBLE_HALF_HEIGHT =
  CAMERA_DISTANCE * Math.tan((CAMERA_FOV / 2) * (Math.PI / 180));
export const VISIBLE_HALF_WIDTH =
  (VISIBLE_HALF_HEIGHT * BASE_WIDTH) / BASE_HEIGHT;

// --- The surface ------------------------------------------------------------
// A single plane, far larger than the frame, so no edge is ever visible.
export const PLANE_SIZE = 13;

// Subdivision. High enough that the displaced geometry itself is smooth at 4K.
// (Shading normals are evaluated analytically per *fragment*, so crest
// faceting — the usual failure of a displaced plane — cannot occur here at all;
// this number only governs the geometric silhouette and parallax.)
export const PLANE_SEGMENTS = 512;

// Ripple centre, as a fraction of the frame: 40% across, 45% down.
export const CENTER_X_FRACTION = 0.4;
export const CENTER_Y_FRACTION = 0.45;

export const RIPPLE_CENTER: [number, number] = [
  (CENTER_X_FRACTION - 0.5) * 2 * VISIBLE_HALF_WIDTH,
  -(CENTER_Y_FRACTION - 0.5) * 2 * VISIBLE_HALF_HEIGHT,
];

// Ridge profile. `h(r, theta) = A(r) * sin(phase(r) - spiral * theta - rotation)`
//
//   phase'(r) = TAU * (RIDGE_FREQUENCY + RIDGE_TIGHTEN / (1 + r / RIDGE_TIGHTEN_FALLOFF))
//
// i.e. a constant base frequency plus an extra term that decays with radius,
// so ridge spacing tightens gently toward the centre.
export const RIDGE_FREQUENCY = 2.38; // ridges per world unit, far from centre
export const RIDGE_TIGHTEN = 0.5; // extra ridges per unit, at the centre
export const RIDGE_TIGHTEN_FALLOFF = 1.8; // how fast that extra term decays

// A single spiral arm. This is what stops the pattern being a bullseye: the
// ridges never quite close on themselves and the centre resolves into a slow
// vortex. It also makes the rotation legible — as the pattern turns, ridges
// migrate outward by exactly one ridge spacing per loop.
export const SPIRAL_ARMS = 1;

// Peak-to-peak relief is 2 x this, against a frame ~10.2 units wide: under 1%
// of the frame width, which is embossed paper, not corrugation.
export const RIDGE_AMPLITUDE = 0.045;

// Amplitude fades to zero inside this radius, so the vortex resolves into a
// smooth dome rather than an infinitely tight spiral singularity.
export const CORE_RADIUS = 0.62;

// --- Motion -----------------------------------------------------------------
// One full 360 deg turn across the loop. With a single spiral arm nothing
// shorter maps the pattern back onto itself.
export const ROTATIONS_PER_LOOP = 1;

// The breath: ridge amplitude swells and settles once across the loop, with a
// slight radial lag so it reads as a pulse spreading rather than a global fade.
export const PULSE_AMOUNT = 0.11;
export const PULSE_RADIAL_LAG = 0.22;

// --- Self-shadowing ---------------------------------------------------------
// Shadows are ray-marched against the analytic height field in the fragment
// shader rather than sampled from a shadow map. That costs a little more per
// pixel but it is resolution-independent, cannot alias or shadow-acne, and the
// penumbra widens with distance for free — which is exactly the soft, clean
// ridge shadow the paper illusion depends on.
export const SHADOW_STEPS = 20;
export const SHADOW_START = 0.012;
export const SHADOW_STEP = 0.027;
