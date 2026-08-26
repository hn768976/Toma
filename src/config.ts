import type {Variant} from './theme';

export const FPS = 30;
export const DURATION_IN_FRAMES = 372; // 12.4s — the whole piece loops on this.
export const WIDTH = 3840;
export const HEIGHT = 2160;

/**
 * The tilted plane. A single affine transform: rotate up toward the right,
 * shear, and compress vertically so the far side reads as receding. Because it
 * is affine, parallel lines stay parallel — that is fine, it is not meant to be
 * a true perspective projection and the difference is invisible at this blur
 * level.
 */
export const PLANE = {
  rotationDeg: -14,
  shearX: 0.16,
  /** Vertical compression — the "right side compresses ~8%" term. */
  compressY: 0.92,
} as const;

/**
 * Per-variant configuration. `flowDirection` is the single signed value the
 * whole composition is mirrored around: +1 sends the flow left-to-right,
 * -1 right-to-left. It governs which frame edge the fibre fan sits on, which
 * side of centre the chip sits on, where the panels distribute, which way the
 * connector dots run and which way the fibre pulses run. Nothing in the piece
 * hardcodes a left-to-right assumption.
 */
export type VariantConfig = {
  flowDirection: 1 | -1;
};

export const VARIANT_CONFIG: Record<Variant, VariantConfig> = {
  violet: {flowDirection: 1},
  teal: {flowDirection: -1},
};

/* ------------------------------------------------------------ composition */

/** Chip size as a fraction of frame height. */
export const CHIP_HEIGHT_FRACTION = 0.16;

/** Distance of the chip from frame centre, as a fraction of frame width. */
export const CHIP_OFFSET_FRACTION = 0.22;

/** Fibre-fan origin, as a fraction of frame width from centre. Just off-frame. */
export const FAN_ORIGIN_FRACTION = 0.64;

export const STRAND_COUNT = 140;

/** Depth-of-field: blur radius in px at 4K for each of the three buckets. */
export const DOF_BLUR = [0, 10, 24] as const;

/**
 * Screen-space displacement of the background over one full loop — and the
 * period the background texture is built to tile at.
 *
 * Both components are whole pixels, and the vector is one 372nd per frame, so
 * at frame 372 the blit offset is an exact integer multiple of the texture
 * period and the plate resamples identically to frame 0. A fractional step
 * would land the last frame on a different sub-pixel phase and the loop would
 * not close bit-for-bit. The direction (atan2(-93, 372) = -14.04deg) tracks the
 * plane's own x axis, so the texture slides along the plane rather than across
 * it.
 */
export const DRIFT_STEP = {x: 372, y: -93} as const;

/* ---------------------------------------------------------------- layout */

export type PanelKind =
  | 'robot'
  | 'code'
  | 'dashboard'
  | 'list'
  | 'glyph'
  | 'icon'
  | 'stat'
  | 'strip';

export type PanelSpec = {
  id: string;
  kind: PanelKind;
  /**
   * Offset from the chip in *flow space*: `du` is downstream distance (always
   * positive — it is multiplied by flowDirection at layout time) and `dv` is
   * the perpendicular offset. Mirroring the piece therefore needs no second
   * table of coordinates.
   */
  du: number;
  dv: number;
  w: number;
  h: number;
  /** Depth-of-field bucket: 0 sharp, 1 mid, 2 far. */
  depth: 0 | 1 | 2;
  /** Bias of the connector's mid-run, 0..1 from chip to panel. */
  routeBias: number;
};

/**
 * Nine floating panels, all downstream of the chip. Distances are in screen px
 * at 4K before the plane transform tilts them.
 */
export const PANELS: readonly PanelSpec[] = [
  {id: 'robot', kind: 'robot', du: 660, dv: -130, w: 470, h: 470, depth: 0, routeBias: 0.55},
  {id: 'code-a', kind: 'code', du: 1180, dv: -600, w: 690, h: 420, depth: 1, routeBias: 0.4},
  {id: 'code-b', kind: 'code', du: 1250, dv: 450, w: 650, h: 400, depth: 0, routeBias: 0.46},
  {id: 'dash', kind: 'dashboard', du: 2000, dv: -230, w: 560, h: 470, depth: 1, routeBias: 0.62},
  {id: 'list', kind: 'list', du: 590, dv: 590, w: 470, h: 350, depth: 0, routeBias: 0.34},
  {id: 'glyph', kind: 'glyph', du: 1730, dv: 790, w: 300, h: 300, depth: 1, routeBias: 0.72},
  {id: 'icon-a', kind: 'icon', du: 330, dv: -700, w: 215, h: 215, depth: 2, routeBias: 0.3},
  {id: 'icon-b', kind: 'icon', du: 1430, dv: -760, w: 265, h: 265, depth: 2, routeBias: 0.66},
  {id: 'stat', kind: 'stat', du: 2190, dv: 400, w: 400, h: 290, depth: 1, routeBias: 0.58},
];

/** Vertical strip of icon buttons hugging the downstream frame edge. */
export const ICON_STRIP = {
  du: 2680,
  dv: -60,
  count: 7,
  size: 118,
  gap: 44,
  depth: 1,
} as const;

/* ------------------------------------------------------------- animation */

/** Ambient camera drift — a closed ellipse, ±10px, no zoom. */
export const CAMERA_DRIFT = {ampX: 10, ampY: 7, freqX: 1, freqY: 2} as const;

/** Chip glow breathes ±12% on a sine whose period divides 372. */
export const CHIP_PULSE = {amount: 0.12, freq: 3} as const;

/** Panel-content flicker: ~2.5 events per second across 12.4s. */
export const FLICKER_EVENT_COUNT = 31;
export const FLICKER_EVENT_FRAMES = 9;

/** Fibre undulation envelope, in px. */
export const STRAND_UNDULATION = 30;

export const VIGNETTE_STRENGTH = 0.2;
export const GRAIN_ALPHA = 0.04;
/** 12 divides 372, so the grain tile cycle closes with the loop. */
export const GRAIN_TILE_COUNT = 12;
export const GRAIN_TILE_SIZE = 512;
