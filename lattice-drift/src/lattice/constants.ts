// Timing is locked to the reference clip: 270 frames @ 30 fps.
export const FPS = 30;
export const DURATION_IN_FRAMES = 270;

// Composition size (4K UHD). Final deliverables are downscaled to 1080p.
export const WIDTH = 3840;
export const HEIGHT = 2160;

// Lattice geometry, in grid units.
export const BAR = 0.22; // square cross-section of every bar
export const POST_HEIGHT = 1.3; // height of the upright posts
export const FIELD_RADIUS = 22; // pieces are scattered over [-R, R]^2

export type Palette = {
  background: string;
  groundA: string;
  groundB: string;
  bar: string;
  sky: string;
  groundBounce: string;
  keyLight: string;
  keyIntensity: number;
  hemiIntensity: number;
  ambientIntensity: number;
};

// Sampled from the reference: warm off-white bars on a cool grey-blue floor
// with fine diagonal pinstripes.
export const REFERENCE_PALETTE: Palette = {
  background: "#98a3a7",
  groundA: "#95a0a4",
  groundB: "#758186",
  bar: "#f7f6f3",
  sky: "#f4f4f2",
  groundBounce: "#7d888d",
  keyLight: "#fffaf3",
  keyIntensity: 2.6,
  hemiIntensity: 0.95,
  ambientIntensity: 0.18,
};
