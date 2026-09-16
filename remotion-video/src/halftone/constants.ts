// Timing, grid and palette for the "halftone dots" motion background.
//
// Everything here is derived from the reference clip that was matched:
//   898 x 506, 29.97 fps, 15.015 s, a *static* square dot lattice of 48 rows
//   where only the dot radii animate.
// Measured on the reference (grid period 10.51 px at 898 px wide):
//   - lattice pitch  = height / 48
//   - largest dot    ~= 0.39 * pitch in radius (diameter ~0.78 * pitch)
//   - smallest dot   ~= 0.04 * pitch in radius (dots shrink, never vanish)

export const FPS = 30;

/** 450 frames @ 30 fps = 15.000 s, matching the 15.015 s reference. */
export const DURATION_IN_FRAMES = 450;

/** Master ("project") resolution. The 1080p comps render the same thing at 1/2. */
export const UHD_WIDTH = 3840;
export const UHD_HEIGHT = 2160;

export const HD_WIDTH = 1920;
export const HD_HEIGHT = 1080;

/**
 * Rows of dots down the frame. Resolution independent: the pitch is always
 * `height / ROWS`, so 4K and 1080p are pixel-for-pixel the same picture.
 */
export const ROWS = 48;

/** Dot radius, as a fraction of the lattice pitch. */
export const RADIUS_MIN = 0.0;
export const RADIUS_MAX = 0.45;

export type HalftonePalette = {
  background: string;
  dot: string;
};

/** Variant A - matches the reference: white dots on black. */
export const PALETTE_MONO: HalftonePalette = {
  background: "#000000",
  dot: "#FFFFFF",
};

/** Variant B - dark blue: luminous blue dots on a deep navy field. */
export const PALETTE_BLUE: HalftonePalette = {
  background: "#04101F",
  dot: "#3D9BF5",
};
