import { THEMES, type Theme, type ThemeName } from "./themes";

// What one variant changes. Everything else about the piece — stream count,
// depth spread, dot sizing, twinkle and flare rates, loop closure, bloom,
// vignette, grain, camera drift — is shared and lives in constants.ts.
//
// The split is deliberate: a new variant should be a data change here, never
// a code change in field.ts or draw.ts.

export type SourceGlowConfig = {
  /** Position of the off-screen light, as a fraction of frame size. */
  xFraction: number;
  yFraction: number;
  /** Wide, heavily blurred wash. */
  haloRadiusFraction: number;
  haloAlpha: number;
  /** Tighter hot centre. */
  coreRadiusFraction: number;
  coreAlpha: number;
};

export type VariantConfig = {
  theme: Theme;
  /**
   * The one signed value that decides which way the field travels:
   * `1` = down, `-1` = up. Every position, wrap and motion-blur calculation
   * multiplies by it — nothing anywhere else assumes a direction, so
   * reversing the piece is this line.
   */
  flowDirection: 1 | -1;
  /** Shared lean off vertical, in degrees. All streams lean the same way. */
  leanAngleDeg: number;
  /** Extra lean magnitude at the frame edges, same direction as the base. */
  edgeLeanBoostDeg: number;
  /**
   * Travel per frame at z = 1; a stream's speed is `z * this`. See the loop
   * floor documented on wrapGeometry in field.ts — below roughly
   * `(HEIGHT + 2 * WRAP_MARGIN_PX) / (Z_MIN * DURATION_IN_FRAMES)` the
   * slowest streams cannot fit a whole wrap cycle into the loop and are held
   * at the floor speed instead.
   */
  baseFallSpeedPx: number;
  sourceGlow: SourceGlowConfig;
};

const GLOW_SHAPE = {
  haloRadiusFraction: 0.46,
  haloAlpha: 0.2,
  coreRadiusFraction: 0.11,
  coreAlpha: 0.34,
};

export const VARIANTS: Record<ThemeName, VariantConfig> = {
  // Rain: falls from a light just above the top edge.
  cyan: {
    theme: THEMES.cyan,
    flowDirection: 1,
    leanAngleDeg: 6,
    edgeLeanBoostDeg: 5,
    baseFallSpeedPx: 42,
    sourceGlow: { xFraction: 0.56, yFraction: -0.04, ...GLOW_SHAPE },
  },
  // Embers: rise away from a light just below the bottom edge. The glow has
  // to move with the flow — left at the top it would fight the motion and
  // the piece would read as the rain running backwards.
  gold: {
    theme: THEMES.gold,
    flowDirection: -1,
    // Rising motion reads as buoyant; a strong lean makes it look
    // wind-blown instead of floating. The edge boost drops by the same
    // ratio so the outer columns stay proportionate to the base lean.
    leanAngleDeg: 4,
    edgeLeanBoostDeg: 3.3,
    // Embers rise more slowly than rain falls — this is most of the
    // difference between "rising sparks" and "inverted rain".
    baseFallSpeedPx: 33.6,
    sourceGlow: { xFraction: 0.44, yFraction: 1.04, ...GLOW_SHAPE },
  },
};
