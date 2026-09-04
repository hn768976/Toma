import { hexToRgb } from "./color";

/**
 * The composition is authored at 3840x2160. Every size below is expressed in
 * those design units and converted through `useScale()` so the layout is a pure
 * fraction of the frame — a 1080p preview (`--scale=0.5`) and a 4K render are
 * the same picture, blur radii included.
 */
export const DESIGN_WIDTH = 3840;
export const DESIGN_HEIGHT = 2160;

export const COLORS = {
  bgDeep: hexToRgb("#050d1a"),
  bgLift: hexToRgb("#0a1c30"),
  /** The ground is painted a few levels below the nominal colours; the dither
      pass in Overlays lifts it back, so the black point lands where it should
      but every value in the gradient is randomised. */
  bgDeepFloor: hexToRgb("#010916"),
  bgLiftFloor: hexToRgb("#06182c"),
  panel: hexToRgb("#08111e"),
  hud: hexToRgb("#3a7ac0"),
  white: hexToRgb("#ffffff"),
  red: hexToRgb("#e0202f"),
  green: hexToRgb("#22c55e"),
} as const;

/** Plane the whole scene sits on. */
export const PLANE = {
  perspective: 5200,
  rotateX: 10,
  rotateZ: -6,
  /** Compensates for the corners the tilt would otherwise pull into frame. */
  coverScale: 1.16,
};

export const PANEL = {
  width: 2560,
  height: 672,
  centerY: 1060,
  padding: 92,
  radius: 10,
  border: 3,
  shieldColumn: 600,
  fieldWidth: 1360,
  fieldHeight: 146,
  labelSize: 58,
  labelTracking: 0.42,
  maskSize: 72,
  maskTracking: 0.3,
};

export const FONTS = {
  hud: '"Rajdhani HUD", "Segoe UI", system-ui, sans-serif',
  mono: '"Share Tech HUD", ui-monospace, monospace',
};

/** Depth-of-field slices for the background, near to far. */
export const DOF_SLICES = [
  { z: -140, blur: 0, opacity: 1 },
  { z: -900, blur: 5, opacity: 0.86 },
  { z: -1900, blur: 13, opacity: 0.66 },
  { z: -3200, blur: 26, opacity: 0.46 },
] as const;
