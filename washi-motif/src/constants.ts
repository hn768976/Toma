/** The one canonical frame. 3:2, print-oriented, 4K on the long edge. */
export const WIDTH = 3840;
export const HEIGHT = 2560;

/**
 * Stills have no timing. Remotion still needs a fps/duration pair for the
 * composition, so these are the smallest meaningful values.
 */
export const FPS = 30;
export const DURATION_IN_FRAMES = 1;

/**
 * Every size in the generator is expressed relative to this height, so the
 * same drawing code produces a 4K still and a contact-sheet thumbnail.
 */
export const REFERENCE_HEIGHT = HEIGHT;

/** Contact sheet: 4 columns x 4 rows of 3:2 tiles, palette pairs adjacent. */
export const SHEET_COLUMNS = 4;
export const SHEET_ROWS = 4;
export const SHEET_TILE_WIDTH = 900;
export const SHEET_TILE_HEIGHT = 600;
export const SHEET_GUTTER = 24;
export const SHEET_PADDING = 40;
export const SHEET_LABEL_HEIGHT = 34;
