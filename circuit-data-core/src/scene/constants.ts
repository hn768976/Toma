// Composition timing. The reference clip is 450 frames long (15.015 s at
// 29.97 fps). At the required 30 fps the same 450 frames last 15.000 s, so the
// motion matches the reference frame for frame.
export const FPS = 30;
export const DURATION_IN_FRAMES = 450;

// Master compositions are authored in UHD 4K.
export const WIDTH = 3840;
export const HEIGHT = 2160;

// Scene scale (world units).
export const CUBE_W = 2.0; // footprint X
export const CUBE_D = 2.0; // footprint Z
export const CUBE_H = 0.8; // height
export const SUBSTRATE_W = 3.2;
export const SUBSTRATE_H = 0.07;
export const CUBE_BASE_Y = SUBSTRATE_H;

export type Variant = "dolly" | "orbit";
