// Shared timing / geometry constants for the geodata HUD compositions.
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
// 900 frames @ 30fps = 30.0s. Every animation period must divide this so the
// composition loops seamlessly (frame 0 and frame 900 are pixel-identical).
export const DURATION_IN_FRAMES = 900;

// Periods that divide 900 evenly - the only cycle lengths used anywhere.
export const PERIODS = [30, 45, 50, 60, 75, 90, 100, 150, 180, 225, 300, 450] as const;
