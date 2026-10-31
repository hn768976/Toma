// 4K UHD master compositions.
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
// Reference clip: 480 frames (16.016 s @ 29.97 fps). We keep the exact
// frame count at a true 30 fps -> 480 frames = 16.000 s.
export const DURATION_IN_FRAMES = 480;

type RGB = [number, number, number];
type Palette = [RGB, RGB, RGB, RGB, RGB];

export const PALETTES: Record<"poolBlue" | "emeraldLagoon", Palette> = {
  // Sampled from the reference (G 85..223, B 155..244, R ~0).
  poolBlue: [
    [0.0, 0.27, 0.54],
    [0.0, 0.4, 0.68],
    [0.0, 0.6, 0.83],
    [0.02, 0.8, 0.93],
    [0.4, 0.93, 0.98],
  ],
  // Version 2: deep emerald shadows rising to mint and pale-gold caustics.
  emeraldLagoon: [
    [0.0, 0.2, 0.15],
    [0.02, 0.36, 0.27],
    [0.05, 0.56, 0.4],
    [0.3, 0.78, 0.52],
    [0.9, 0.97, 0.7],
  ],
};
