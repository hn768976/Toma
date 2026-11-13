// 4K UHD master composition. Final deliverables are rendered with --scale=0.5 (1080p).
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
// Reference clip: 259 frames @ 30 fps = 8.6333 s
export const DURATION_IN_FRAMES = 259;

// ---- timeline (frames) -----------------------------------------------------
export const SCOPE_MOVE_START = 6;
export const SCOPE_MOVE_END = 152;
export const RING_IN_START = 46;
export const RING_IN_END = 66;
export const RING_OUT_START = 172;
export const RING_OUT_END = 204;

// ---- world layout ----------------------------------------------------------
export const TUBE_RADIUS = 1;
export const WALL_THICKNESS = 0.075;
export const SEGMENT_LENGTH = 1.9;
export const FOLD_OFFSET = 0.9; // x position of one haustral fold
export const POLYP_X = FOLD_OFFSET + SEGMENT_LENGTH * 0.45;
export const POLYP_THETA = 0.13; // radians above the centre of the back wall
export const SCOPE_TIP_START_X = -1.72;
export const SCOPE_TIP_END_X = 1.0;

export type CameraMode = "reference" | "orbit";
