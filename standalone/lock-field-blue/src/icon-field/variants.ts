/**
 * The single source of truth for this variant's look. No hex literal, icon
 * name, or tilt value may live anywhere else in the icon-field module.
 */

export type VariantKey = "blue" | "teal" | "breach";

export type IconName =
  | "padlock"
  | "shield"
  | "key"
  | "fingerprint"
  | "eye"
  | "warning"
  | "check";

export type IconState = "closed" | "open";

export type DriftMode = "rigid" | "separating";

export interface Palette {
  bgDeep: string;
  bgWash: string;
  tileDark: string;
  tileMid: string;
  tileLight: string;
  iconPale: string;
  iconWhite: string;
  outlinePale: string;
}

export interface IconWeight {
  name: IconName;
  weight: number;
}

export interface VariantConfig {
  palette: Palette;
  /** Plane rotation in degrees (negative = receding to the upper right). */
  tiltDeg: number;
  /** Horizontal shear in degrees, compressing the right side. */
  shearDeg: number;
  /** Zoom of the plane: 1 = the medium field of the blue version. */
  tileScale: number;
  /** Depth-of-field blur ceiling in px at 4K. */
  maxBlurPx: number;
  /** [min, max] fill alpha for the translucent tiles. */
  tileAlpha: readonly [number, number];
  /** Weighted icon vocabulary. Weights need not sum to 100. */
  iconSet: readonly IconWeight[];
  /** Rendered state of stateful icons (padlock open/closed, shield cracked). */
  iconState: IconState;
  /** "rigid": one sheet. "separating": per-tile outward creep, closed loop. */
  driftMode: DriftMode;
  /** Horizontal slice-shift glitch events. */
  glitch: boolean;
  /** Icon placements generated per layout block (controls on-screen count). */
  iconsPerBlock: number;
}

/** Seed prefix — keeps the generated layout identical to the source project. */
export const VARIANT_KEY: VariantKey = "blue";

export const VARIANT: VariantConfig = {
  palette: {
    bgDeep: "#1A1F52",
    bgWash: "#2E3585",
    tileDark: "#232A6B",
    tileMid: "#3A44A8",
    tileLight: "#5A66C4",
    iconPale: "#C8CEF5",
    iconWhite: "#F0F2FF",
    outlinePale: "#8A93D4",
  },
  tiltDeg: -20,
  shearDeg: 9,
  tileScale: 1.0,
  maxBlurPx: 30,
  tileAlpha: [0.25, 0.55],
  iconSet: [{ name: "padlock", weight: 100 }],
  iconState: "closed",
  driftMode: "rigid",
  glitch: false,
  iconsPerBlock: 64,
};
