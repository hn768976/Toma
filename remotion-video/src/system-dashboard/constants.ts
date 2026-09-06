// Design-space constants for the "Monochrome System Dashboard" clip.
//
// Everything in this composition is authored in a fixed 3840x2160 design
// space and the whole layout is scaled by `width / BASE_W` at render time,
// so a 1080p preview is a pixel-exact half-scale of the 4K render.

export const BASE_W = 3840;
export const BASE_H = 2160;
export const FPS = 30;
export const DURATION_IN_FRAMES = 600; // 20s

// Stroke weights, in design units. At 4K (scale 1) a design unit is one
// device pixel; at 1080p (scale 0.5) two design units are one pixel. So
// HAIRLINE renders as a 1px line in the 1080p preview and 2px at 4K.
export const HAIRLINE = 2;
export const FINE = 1.4; // sub-hairline: grid paper and low-contrast texture
export const BORDER = 4; // panel borders: 2px at 1080p, 4px at 4K

export const FONT_SANS = '"Barlow Semi Condensed", "Arial Narrow", sans-serif';
export const FONT_MONO = '"Roboto Mono", "Courier New", monospace';
