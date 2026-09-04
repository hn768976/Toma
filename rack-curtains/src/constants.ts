// Composition is authored at 4K so it can be rendered at full size later;
// the preview here is produced with --scale=0.5.
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
export const DURATION_IN_FRAMES = 300;

// --- Panel grid -----------------------------------------------------------
// Aisles of racks: PANEL_COLS across, PANEL_ROWS receding. All panels are
// parallel planes facing +Z, so the camera looks down the aisles between them.
export const PANEL_COLS = 6;
export const PANEL_ROWS = 7;
export const PANEL_COUNT = PANEL_COLS * PANEL_ROWS;

export const PANEL_WIDTH = 3.2;
export const PANEL_HEIGHT = 5.6;
export const SPACING_X = 4.0;
export const SPACING_Z = 3.6;

// Whole grid is yawed slightly so the rows recede diagonally rather than
// straight back, which is what gives the reference its depth.
export const GRID_YAW = -0.32;

// --- Dot grid inside each panel -------------------------------------------
export const DOT_COLS = 42;
export const DOT_ROWS = 74;

// --- Depth of field -------------------------------------------------------
// Sharp band in the mid-distance, softening toward the camera and into the
// far aisles. Quantised into DOF_BUCKETS steps per panel.
export const DOF_FOCUS = 17.5;
export const DOF_RANGE = 12.0;
export const DOF_BUCKETS = 5;

// --- Light shafts ---------------------------------------------------------
export const SHAFT_COUNT = 7;
// Each shaft is several stacked transparent planes rather than a true
// volumetric pass - far cheaper and, at this softness, indistinguishable.
export const SHAFT_LAYERS = 3;
