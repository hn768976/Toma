// Timing, camera and depth-of-field configuration for the "code wall"
// motion graphic: a slowly drifting 3D field of translucent code panels
// and HUD frames, shot with a shallow depth of field.
//
// Every geometric value here is expressed in BASE_WIDTH/BASE_HEIGHT
// (1080p) units. The renderer scales the whole scene by `resolutionScale`
// so the 1080p and 4K compositions are pixel-for-pixel the same framing.

export const FPS = 30;

// Matches the 20.000s reference clip exactly (600 frames @ 30fps).
export const DURATION_IN_SECONDS = 20;
export const DURATION_IN_FRAMES = FPS * DURATION_IN_SECONDS;

export const BASE_WIDTH = 1920;
export const BASE_HEIGHT = 1080;

// --- Projection -----------------------------------------------------------
// Pinhole camera looking down +Z. A panel at depth z projects with
// scale = FOCAL / z, so a panel is drawn at its authored size when it
// sits exactly at z = FOCAL.
export const FOCAL = 1200;

// Panels are seeded between these depths. NEAR_Z is deliberately very
// close so there is always a big, heavily defocused slab of code sliding
// through the foreground, like in the reference.
export const NEAR_Z = 300;
export const FAR_Z = 2700;

// --- Depth of field -------------------------------------------------------
// A real lens has a single focal plane, but the reference was clearly shot
// (or rendered) with enough depth of field that a broad slab of the wall
// reads sharp while the near and far layers smear. So instead of one focus
// distance there is a focus *band*: everything between FOCUS_NEAR_Z and
// FOCUS_FAR_Z is crisp, and outside it the circle of confusion grows as
// distance-from-the-band over depth — the same 1/z falloff a thin lens has,
// which is what makes the near field defocus so much faster than the far.
export const FOCUS_NEAR_Z = 800;
export const FOCUS_FAR_Z = 1120;
export const APERTURE = 30;
export const MAX_BLUR_PX = 46;

// Panels closer than this are pure light smear; drawing them costs a lot
// of blur for almost no readable detail, so they get culled.
export const CULL_NEAR_Z = 190;

// --- Camera move ----------------------------------------------------------
// The reference is a slow downward drift with a gentle push-in. Content
// travels down-screen, so the camera rises through the field.
export const CAMERA_Y_DRIFT = 520; // world units travelled over the full clip
export const CAMERA_Z_PUSH = 70; // forward dolly over the full clip
export const CAMERA_X_SWAY = 70; // lateral sway amplitude
export const CAMERA_SWAY_PERIOD = 13.5; // seconds per lateral sway cycle
export const CAMERA_Y_BOB = 26; // vertical easing wobble on top of the drift
export const CAMERA_BOB_PERIOD = 7.5; // seconds

// --- Field ----------------------------------------------------------------
export const PANEL_COUNT = 185;
// Panels are seeded in normalised screen space at their own depth and
// then unprojected, so coverage stays even from the near slab to the far
// wall. These are the half-extents of that normalised box: >0.5 means the
// field spills past the frame edges so nothing pops in at the borders.
export const FIELD_X_SPREAD = 0.62;
export const FIELD_Y_SPREAD = 0.62;

// Panel bitmaps are pre-rendered once at this multiple of their authored
// size so in-focus text stays crisp. Capped so a 4K render doesn't blow
// up canvas memory (panels near focus are the only ones that could show
// the difference, and bloom softens them anyway).
export const BITMAP_OVERSAMPLE = 1.25;
export const BITMAP_SCALE_CAP = 1.8;

// --- Bloom ----------------------------------------------------------------
// Bloom is screen-blended back over the frame from a small, blurred copy of
// it. DOWNSCALE is how much smaller that copy is. Two taps rather than one:
// a tight halo that keeps the text looking emissive, plus a wide, weak wash
// that supplies the atmospheric haze the reference has between panels. A
// single radius can do one or the other, never both.
export const BLOOM_DOWNSCALE = 4;
export const BLOOM_TIGHT_BLUR_PX = 6;
export const BLOOM_TIGHT_STRENGTH = 0.46;
export const BLOOM_WIDE_BLUR_PX = 22;
export const BLOOM_WIDE_STRENGTH = 0.22;

// --- Light streaks --------------------------------------------------------
export const STREAK_COUNT = 18;
