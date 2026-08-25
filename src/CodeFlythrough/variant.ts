import * as C from './constants';

/**
 * A cut of the shot.
 *
 * Palette, tilt and length are the only things that differ between cuts. Tilt
 * carries a lot with it - the axis the whole field is rotated to, the axis it
 * drifts along, and how far the visible rectangle projects onto both axes - so
 * all of that is derived here rather than restated per cut.
 */

export interface Palette {
  bg: string;
  /** The dominant text colour. */
  code: string;
  /** Brighter fragments, closest to camera. */
  codeBright: string;
  /** The chatbot glyphs. */
  icon: string;
  /** Distant text. */
  dim: string;
  /** Rare, and only ever as small floating squares - never as text. */
  accents: readonly string[];
}

export interface Variant {
  id: VariantId;
  compositionId: string;
  durationInFrames: number;
  palette: Palette;

  tiltDeg: number;
  tiltRad: number;
  /** Unit vector along the stream's axis. */
  ax: number;
  ay: number;
  /** Unit vector perpendicular to it. */
  px: number;
  py: number;
  /** Elements travel along the negative axis direction. */
  motionX: number;
  motionY: number;
  /**
   * Projection of the visible rectangle onto each axis. An element has to cover
   * `axisView` plus its own length to go from fully off one side to fully off
   * the other.
   */
  axisView: number;
  perpView: number;
  /** Perpendicular spread the field is scattered across. */
  perpSpread: number;
  /** Whole caret blinks per loop. */
  caretBlinks: number;
  /** Half-width of a hero's stop, as a fraction of its crossing. */
  heroDwell: number;
}

const build = (o: {
  id: VariantId;
  compositionId: string;
  durationInFrames: number;
  tiltDeg: number;
  palette: Palette;
}): Variant => {
  const tiltRad = (o.tiltDeg * Math.PI) / 180;
  const ax = Math.cos(tiltRad);
  const ay = Math.sin(tiltRad);
  const px = -Math.sin(tiltRad);
  const py = Math.cos(tiltRad);
  const perpView = C.WIDTH * Math.abs(px) + C.HEIGHT * Math.abs(py);
  return {
    ...o,
    tiltRad,
    ax,
    ay,
    px,
    py,
    motionX: -ax,
    motionY: -ay,
    axisView: C.WIDTH * Math.abs(ax) + C.HEIGHT * Math.abs(ay),
    perpView,
    perpSpread: perpView + C.PERP_MARGIN,
    caretBlinks: C.caretBlinksFor(o.durationInFrames),
    heroDwell: C.heroDwellFor(o.durationInFrames),
  };
};

/** Dark teal, low key. */
const TEAL: Palette = {
  bg: '#05090C',
  code: '#4FD4D9',
  codeBright: '#E8F4F5',
  icon: '#2E9CA8',
  dim: '#14454A',
  accents: ['#E8862E', '#E8C84F', '#4FE07F'],
};

/** Dark blue, same low key. Accents are unchanged - they read as punctuation
 *  against blue exactly as they do against teal. */
const BLUE: Palette = {
  bg: '#05080F',
  code: '#4F9BE0',
  codeBright: '#E6EFFA',
  icon: '#2E6BA8',
  dim: '#16304F',
  accents: ['#E8862E', '#E8C84F', '#4FE07F'],
};

export type VariantId = 'teal-diagonal' | 'blue-straight';

export const VARIANTS: Record<VariantId, Variant> = {
  /** The original: dark teal, -28 degrees, nine seconds. */
  'teal-diagonal': build({
    id: 'teal-diagonal',
    compositionId: 'CodeFlythrough',
    durationInFrames: 540,
    tiltDeg: -28,
    palette: TEAL,
  }),
  /**
   * Dark blue, no tilt at all, ten seconds.
   *
   * At zero tilt the shared axis is horizontal, so the field reads left rather
   * than diagonally and drifts straight across. The handheld camera drift,
   * which is always perpendicular to the axis, becomes vertical.
   */
  'blue-straight': build({
    id: 'blue-straight',
    compositionId: 'CodeFlythroughBlue',
    durationInFrames: 600,
    tiltDeg: 0,
    palette: BLUE,
  }),
};

export const VARIANT_LIST = Object.values(VARIANTS);
