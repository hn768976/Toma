// Timing is locked to the reference clip: 270 frames @ 30 fps.
export const FPS = 30;
export const DURATION_IN_FRAMES = 270;
export const LOOP_SECONDS = DURATION_IN_FRAMES / FPS;

// Composition size (4K UHD). Final deliverables are downscaled to 1080p.
export const WIDTH = 3840;
export const HEIGHT = 2160;

// Lattice geometry, in grid units.
export const BAR = 0.16; // square cross-section of every bar
export const POST_HEIGHT = 1.25; // height of the upright posts
export const ROW_PITCH = 0.5; // spacing of the frame rows along Z
// The camera drifts exactly this far along Z over the clip and the field
// repeats with this period along Z, so the last frame flows into the first.
export const LOOP_PERIOD_Z = 5.5;
export const FIELD_RADIUS = 24; // pieces are scattered over [-R, R]^2

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
  groundA: "#a6b1b4",
  groundB: "#838f93",
  bar: "#f6f6f4",
  sky: "#f2f6f7",
  groundBounce: "#7f8c90",
  keyLight: "#fffdf8",
  keyIntensity: 1.45,
  hemiIntensity: 1.75,
  ambientIntensity: 0.22,
};
