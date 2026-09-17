// Timing, geometry and palette for the "cyber alert" LED wall.
//
// Every geometric value here is in DOT UNITS — one unit is one LED pitch
// on the panel. Nothing is in pixels. The projection converts dots to
// pixels once per frame using the output width, so the 1080p and 4K
// compositions are the same picture at two sampling rates rather than
// two differently-tuned videos.

export const FPS = 30;
export const DURATION_IN_FRAMES = 210; // 7.00s, matching the reference

export const BASE_WIDTH = 1920;
export const BASE_HEIGHT = 1080;

// --- Panel layout, in dots -------------------------------------------

// Data is set tighter than the headline: the hex dump should read as
// dense blocks of figures, while the headline needs the extra dot of
// sidebearing its bold weight eats up.
export const DATA_CELL_W = 6; // 5-dot glyph + 1-dot gap
export const HEADLINE_CELL_W = 7; // 6-dot bold glyph + 1-dot gap
export const ROW_PITCH = 12; // 7-dot glyph + 5-dot gap between text rows

// Rows of data, indexed relative to the headline. Row 0 and row 1 carry
// the headline itself; the rest are the scrolling hex dump. The wall is
// built wider and taller than any camera move can reveal so the panel
// never shows an edge.
export const ROW_MIN = -6;
export const ROW_MAX = 7;
export const WALL_U_HALF = 130; // dots left/right of centre

// Reserved run of the headline rows that the data must not draw into.
export const HEADLINE_GAP = 4; // dots of clearance around the headline block
export const ICON_TEXT_GAP = 5; // dots between the icon and the first letter

// --- Camera -----------------------------------------------------------

// Pixels-per-dot at the wall's nominal depth works out to FOCAL / DIST,
// so these two together set how many characters fit across the frame.
// ~19.6 px/dot at 1080p puts about 14 characters across, as in the
// reference crop.
export const FOCAL = 5100;
export const BASE_DIST = 260;

export const DOT_RADIUS = 0.33; // half-width of an LED, in dots

// --- Palette ----------------------------------------------------------

export const BACKGROUND = "#01030a";
// Unlit LEDs are not black: the panel's own substrate catches a little
// of the light from its neighbours. Without this the wall reads as text
// floating in a void rather than as a screen.
export const DOT_UNLIT = "rgba(22, 48, 92, 0.11)";

export const DATA_HUE = 204; // cool electric blue
export const DATA_HUE_SPREAD = 13; // per-column drift toward cyan

export type Variant = {
  id: string;
  sprite: "bug" | "padlock";
  lines: [string, string];
  // Hue of the alert colour. Both references sit in the same red, but
  // keeping it a parameter makes re-skinning a one-line change.
  alertHue: number;
};

export const VARIANTS: Record<string, Variant> = {
  cyberAttack: {
    id: "cyberAttack",
    sprite: "bug",
    lines: ["CYBER", "ATTACK"],
    alertHue: 356,
  },
  securityBreach: {
    id: "securityBreach",
    sprite: "padlock",
    lines: ["SECURITY", "BREACH"],
    alertHue: 356,
  },
};
