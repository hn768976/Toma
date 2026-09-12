// Timing and sizing for the "Digital Data Charts" dashboard motion graphic.
// Everything is authored at 1x (1920x1080). The 4K compositions render the
// exact same scene through a 2x CSS scale, so all geometry below stays in
// 1080p pixels regardless of the output resolution.

export const FPS = 30;

// 10 seconds, matching the reference clip.
export const DURATION_IN_FRAMES = 300;

export const BASE_WIDTH = 1920;
export const BASE_HEIGHT = 1080;

// The virtual "floor" the dashboard panels sit on. Larger than the board of
// panels so the grid keeps going past the visible edges once it is tilted
// into perspective.
export const FLOOR_WIDTH = 4200;
export const FLOOR_HEIGHT = 4200;

// Panel grid (in floor pixels, at 1x).
export const PANEL_WIDTH = 540;
export const PANEL_HEIGHT = 320;
export const PANEL_GAP = 48;
export const GRID_COLUMNS = 5;
export const GRID_ROWS = 4;

// Fine grid drawn on the floor and inside each panel.
export const GRID_CELL = 36;
export const GRID_CELL_MAJOR = GRID_CELL * 4;

// Camera: fixed tilt with a slow drift over the whole clip.
export const CAMERA_PERSPECTIVE = 1500;
export const CAMERA_TILT_X = 55; // degrees, tips the floor away from the viewer
export const CAMERA_ROTATE_Z = -16; // degrees, turns the grid diagonally

// How long the charts take to build in at the start (frames).
export const BUILD_IN_FRAMES = 70;
