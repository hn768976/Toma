/**
 * Layout + palette constants.
 *
 * Every dimension is expressed as a fraction of the composition WIDTH, so the
 * exact same component renders identically at 1920x1080 and 3840x2160.
 * The fractions below were measured off the 898x506 reference clip:
 *   border rect  left 77px  right 817px  top 76px  bottom 426px
 *   stroke core  ~3px
 *   corner fade  ~130px radius at the top-right and bottom-left corners
 */

/** Uniform inset of the border rectangle, in units of composition width. */
export const INSET = 0.0857;
/** Stroke weight of the border, in units of composition width. */
export const STROKE = 0.0033;
/** Radius of the soft fade-out at the TR / BL corners, in units of width. */
export const CORNER_FADE = 0.185;

/** Reference clip metrics, used to keep motion speed resolution-independent. */
export const REF_WIDTH = 898;
export const REF_PERIMETER = 2184;

export type Palette = {
  /** Centre of the backdrop glow. */
  glow: string;
  /** Darkest part of the metal, used at the outer edge of the stroke. */
  deep: string;
  /** Body colour of the line. */
  core: string;
  /** Specular highlight that travels along the line. */
  hot: string;
  /** Colour of the soft bloom cast around the line. */
  bloom: string;
  /** Tint of the film grain / texture layer. */
  grain: string;
};

export const GOLD: Palette = {
  glow: 'rgba(6, 16, 17, 1)',
  deep: '#9A711C',
  core: '#E3B84E',
  hot: '#FFF2C8',
  bloom: 'rgba(230, 180, 78, 1)',
  grain: '#c9b184',
};

export const CYAN: Palette = {
  glow: 'rgba(6, 19, 22, 1)',
  deep: '#08343C',
  core: '#0E7C8A',
  hot: '#8CF3FF',
  bloom: 'rgba(28, 168, 190, 1)',
  grain: '#84c0c9',
};

export type Geometry = {
  x: number;
  y: number;
  w: number;
  h: number;
  stroke: number;
  fade: number;
  /** Path data for the border rectangle, drawn clockwise from the top-left. */
  d: string;
};

export const geometry = (width: number, height: number): Geometry => {
  const inset = width * INSET;
  const w = width - inset * 2;
  const h = height - inset * 2;
  return {
    x: inset,
    y: inset,
    w,
    h,
    stroke: width * STROKE,
    fade: width * CORNER_FADE,
    d: `M ${inset} ${inset} H ${inset + w} V ${inset + h} H ${inset} Z`,
  };
};

/**
 * The border path is declared with pathLength={PATH_LENGTH}, so dash arrays and
 * dash offsets are in virtual units that are identical at every resolution.
 */
export const PATH_LENGTH = 1000;

/** Maps a position along the perimeter (0..PATH_LENGTH) back to x/y pixels. */
export const pointAt = (g: Geometry, t: number): {x: number; y: number} => {
  const perim = 2 * (g.w + g.h);
  let d = ((t % PATH_LENGTH) + PATH_LENGTH) % PATH_LENGTH;
  d = (d / PATH_LENGTH) * perim;
  if (d < g.w) return {x: g.x + d, y: g.y};
  d -= g.w;
  if (d < g.h) return {x: g.x + g.w, y: g.y + d};
  d -= g.h;
  if (d < g.w) return {x: g.x + g.w - d, y: g.y + g.h};
  d -= g.w;
  return {x: g.x, y: g.y + g.h - d};
};
