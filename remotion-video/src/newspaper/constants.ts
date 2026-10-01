// Timing, canvas, and palette config for the newspaper-headline shot.
// The compositions are authored at 4K (3840x2160). The 1080p deliverable
// is rendered from the same 4K composition with `--scale=0.5`, so every
// pixel value in this folder is in 4K units.

export const FPS = 30;

// Matches the 10s reference clip.
export const DURATION_IN_FRAMES = 300;

export const WIDTH = 3840;
export const HEIGHT = 2160;

// The "world" is the flat tabletop the newspaper sits on. The camera
// rig moves/rotates this plane under a fixed CSS perspective.
export const WORLD_WIDTH = 7200;
export const WORLD_HEIGHT = 4600;
export const PERSPECTIVE_PX = 3400;

// Page layout (world coordinates).
export const SHEET_TOP = 1500; // top edge of the headline sheet
export const HEADLINE_LEFT = 900;
export const HEADLINE_TOP = 1720;
export const HEADLINE_BIG_SIZE = 430;
export const HEADLINE_SMALL_SIZE = 250;
export const BODY_COLUMN_LEFT = 4300;
export const BODY_FONT_SIZE = 96;

// Muted, warm newsprint palette.
export const COLORS = {
  desk: "#2c2b2a",
  paper: "#f1e6d2",
  paperBack: "#e2d6c0",
  ink: "#24232a",
  photo: "#77736d",
  photoDark: "#5f5c58",
  rule: "#4a4744",
};

export const HEADLINE_FONT = "Montserrat";
export const BODY_FONT = "PT Serif";
