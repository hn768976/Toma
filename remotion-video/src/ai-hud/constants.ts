// ---------------------------------------------------------------------------
// "AI Interface HUD" — global configuration.
//
// Everything in this composition is authored in a fixed BASE_WIDTH x
// BASE_HEIGHT coordinate space and drawn into SVGs that carry a matching
// viewBox, so a stroke of 4 base units is 2px at 1080p and 4px at 4K without
// any per-resolution branching. Components that need real CSS pixels (the
// depth-of-field blurs, the CSS 3D perspective) multiply by the `scale`
// returned from useHudScale().
//
// To re-skin the piece, change PALETTE. To re-time it, change
// DURATION_IN_FRAMES — but see the note on loop closure below.
// ---------------------------------------------------------------------------

export const BASE_WIDTH = 3840;
export const BASE_HEIGHT = 2160;
export const FPS = 30;

/**
 * 600 frames @ 30fps = 20s, matching the reference clip.
 *
 * LOOP CLOSURE: every periodic quantity in this project is driven by
 * `frame / DURATION_IN_FRAMES` multiplied by an INTEGER number of cycles, so
 * frame 600 is identical to frame 0. If you change this number the loop stays
 * closed, but the discrete steppers (icon highlight, grid block) read nicer
 * when the cycle count divides the duration evenly.
 */
export const DURATION_IN_FRAMES = 600;

/**
 * The interface is deliberately larger than the frame so that panels and
 * traces are cropped by the left and right edges. Layers are drawn into an
 * SVG that extends OVERSCAN_X / OVERSCAN_Y base units past every edge; the
 * outer AbsoluteFill does the cropping after the 3D tilt has been applied.
 */
export const OVERSCAN_X = 400;
export const OVERSCAN_Y = 230;

export const VIEW_BOX = [
  -OVERSCAN_X,
  -OVERSCAN_Y,
  BASE_WIDTH + OVERSCAN_X * 2,
  BASE_HEIGHT + OVERSCAN_Y * 2,
].join(" ");

// --- Core placement -------------------------------------------------------
// Off-centre, left of the middle of the frame. CORE_R is the radius of the
// bright filled disc; every other ring and the trace lengths are expressed as
// multiples of it, so scaling the core rescales the whole centrepiece.
export const CORE_X = BASE_WIDTH * 0.421;
export const CORE_Y = BASE_HEIGHT * 0.414;
export const CORE_R = 252;

// --- Camera / plane -------------------------------------------------------
// The interface plane is rotated on two axes so that neither the panel edges
// nor the axis-aligned trace runs end up parallel to the frame edges.
export const PERSPECTIVE = 3000; // base units
export const PLANE_ROT_X = 19.5; // deg — tilts the top of the plane away
export const PLANE_ROT_Y = -15.5; // deg — swings the right-hand side away
export const PLANE_ROT_Z = 5.0; // deg — in-plane skew

// --- Palette --------------------------------------------------------------
// Swap these to re-theme. `cyan` drives the traces and panel furniture,
// `coreHot` is the blown-out centre of the disc, `warm` is the handful of
// orange accents that keep the frame from going monochrome.
export const PALETTE = {
  bgCentre: "#062658",
  bgMid: "#030F28",
  bgEdge: "#010610",
  cyan: "#3FD2F2",
  cyanDim: "#1E7FAE",
  cyanDeep: "#11557F",
  coreFill: "#12C6F4",
  coreHot: "#DFFAFF",
  coreInk: "#03243F",
  line: "#63B4DE",
  text: "#B6DEF5",
  textDim: "#6FA6CC",
  warm: "#F0913A",
  warmDim: "#B3672A",
};

/** The blue haze band the reference lays across the middle of the frame. */
export const HAZE = "#063C96";

export const FONT_SANS = "HudSans";
export const FONT_MONO = "HudMono";
