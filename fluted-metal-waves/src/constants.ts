// 4K UHD master composition. Final deliverables are rendered with --scale=0.5 (1080p).
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
// Reference clip: 461 frames @ 30 fps = 15.3667 s
export const DURATION_IN_FRAMES = 461;
// The wave motion loops seamlessly every 230 frames (7.67 s), like the reference.
export const LOOP_FRAMES = 230;

export type Palette = "silver" | "gold";

type RGB = [number, number, number];
export const PALETTES: Record<
  Palette,
  { shadow: RGB; mid: RGB; light: RGB; spec: RGB }
> = {
  // cool neutral chrome
  silver: {
    shadow: [0.27, 0.29, 0.31],
    mid: [0.66, 0.68, 0.7],
    light: [0.9, 0.91, 0.925],
    spec: [1.0, 1.0, 1.0],
  },
  // warm polished gold
  gold: {
    shadow: [0.3, 0.15, 0.03],
    mid: [0.8, 0.54, 0.16],
    light: [0.98, 0.82, 0.45],
    spec: [1.0, 0.97, 0.84],
  },
};
