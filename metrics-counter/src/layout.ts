/**
 * Every dimension below is expressed as a fraction of composition height (or, for
 * horizontal placement, of composition width) so the whole design scales from the
 * 1080p preview render straight to 4K without a single hard-coded pixel.
 */

/** Plane orientation. Fixed for the whole clip — no rotation changes. */
export const ROTATE_X = 12; // degrees; positive tips the far edge away from camera
export const ROTATE_Z = -8; // degrees; lines run slightly uphill to the right
export const PERSPECTIVE = 2.9; // × height

/** The plane deliberately overfills the frame so the type is cropped on all sides. */
export const PLANE_W = 3.1; // × width
export const PLANE_H = 2.6; // × height

/** Type. */
export const FONT_SIZE = 0.355; // × height
export const LINE_HEIGHT = 1.075; // × font size
export const LETTER_SPACING = -0.016; // × font size
/** Gap between the number and its label, in em. */
export const LABEL_GAP = 0.3;

/** Where the three-line block sits inside the plane, relative to the plane centre. */
export const TEXT_OFFSET_X = -0.58; // × width
export const TEXT_OFFSET_Y = 0.0; // × height

/** Graph-paper ruling. */
export const GRID_CELL = 0.034; // × height
export const GRID_MAJOR_EVERY = 5;
export const GRID_LINE = 0.0014; // × height

/**
 * The depth-of-field stack. Each slice re-renders the whole plane at one blur
 * radius and is painted over everything below `start`, cross-fading in over
 * `FEATHER`. Because every slice paints over the full remaining frame there are
 * no gaps, and because the blur is applied before the mask the band edges carry
 * blurred neighbouring content instead of fading to nothing.
 *
 * `start` and `feather` are fractions of composition height; `blur` likewise, so
 * the optics survive the change of render scale.
 */
export type Slice = {start: number; blur: number};

export const SLICES: Slice[] = [
  {start: 0.0, blur: 0.0152}, // far edge — unreadable soft shapes
  {start: 0.19, blur: 0.0058},
  {start: 0.33, blur: 0.0014},
  {start: 0.44, blur: 0.0}, // the sharp band, sitting over "Likes"
  {start: 0.6, blur: 0.0042},
  {start: 0.72, blur: 0.019}, // near edge — unreadable again
];

export const FEATHER = 0.045; // × height

/** Where the sharp band sits, used for the V2 glow. */
export const SHARP_BAND: [number, number] = [0.44, 0.6];

/** Slow float, so it reads as a camera rather than a static render. */
export const DRIFT_X = 0.013; // × width, peak-to-centre
export const DRIFT_Y = 0.009; // × height
export const PUSH_IN = 0.055; // × height of z travel over the full clip
