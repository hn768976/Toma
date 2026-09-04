import { REFERENCE_HEIGHT } from "./constants";

export type Variant = "blue" | "mono";

export type Palette = {
  /** Background at the frame edges. */
  readonly bgOuter: string;
  /** Background at the vanishing point. */
  readonly bgInner: string;
  /** Element colour at the far end of the volume. */
  readonly colFar: string;
  /** Element colour in the mid field. */
  readonly colMid: string;
  /** Element colour close to the camera. */
  readonly colNear: string;
  /** Vanishing-point glow. */
  readonly glow: string;
  /** Colour the brightest streaks clip towards. */
  readonly streak: string;
  /**
   * How far individual elements may drift in hue away from the ramp above.
   * Zero for the monochrome version, which must stay genuinely neutral.
   */
  readonly tintAmount: number;
  /** Colour that tinted elements drift towards. */
  readonly tint: string;
  /** Global brightness trim, balancing the two versions against each other. */
  readonly intensity: number;
};

export const PALETTES: Record<Variant, Palette> = {
  // V1 - deep blue, matching the reference.
  blue: {
    bgOuter: "#020818",
    bgInner: "#06183a",
    colFar: "#1a3a8a",
    colMid: "#2a6fe8",
    colNear: "#8ab8ff",
    glow: "#78aaff",
    streak: "#dceaff",
    tintAmount: 0.35,
    tint: "#5fe0ff",
    intensity: 2.6,
  },
  // V2 - monochrome. The spec's greys (#050506 / #0d0e10 / #3a3d42 /
  // #9aa0a8) carry a slight cool cast, which conflicts with "no hue
  // anywhere". These are those same values collapsed to their exact
  // luminance, so the brightness ramp is preserved and the encoded output
  // is measurably neutral.
  mono: {
    bgOuter: "#050505",
    bgInner: "#121212",
    colFar: "#3d3d3d",
    colMid: "#9f9f9f",
    colNear: "#ffffff",
    glow: "#e8e8e8",
    streak: "#ffffff",
    tintAmount: 0,
    tint: "#ffffff",
    intensity: 2.2,
  },
};

/**
 * Parses a #rrggbb string to linear 0..1 components without any colour
 * management. Values are authored in display space and written straight to
 * the framebuffer (the canvases render with `linear` + `flat`), so three's
 * automatic sRGB conversion must not be applied on top.
 */
export const hexToRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

export const hexToRgba = (hex: string, alpha: number): string => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(
    b * 255,
  )}, ${alpha})`;
};

/** Scales a length authored at REFERENCE_HEIGHT to the actual frame height. */
export const scalePx = (px: number, frameHeight: number): number =>
  (px * frameHeight) / REFERENCE_HEIGHT;
