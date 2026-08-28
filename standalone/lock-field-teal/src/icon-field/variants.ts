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
export const VARIANT_KEY: VariantKey = "teal";

export const VARIANT: VariantConfig = {
  palette: {
    bgDeep: "#062B2E",
    bgWash: "#0C4A50",
    tileDark: "#0A3B40",
    tileMid: "#14666E",
    tileLight: "#2E96A0",
    iconPale: "#A8F0EC",
    iconWhite: "#E8FFFD",
    outlinePale: "#5FC4C4",
  },
  tiltDeg: -28,
  shearDeg: 9,
  tileScale: 1.6,
  maxBlurPx: 38,
  tileAlpha: [0.25, 0.55],
  iconSet: [
    { name: "padlock", weight: 40 },
    { name: "shield", weight: 15 },
    { name: "key", weight: 12 },
    { name: "fingerprint", weight: 12 },
    { name: "eye", weight: 10 },
    { name: "warning", weight: 6 },
    { name: "check", weight: 5 },
  ],
  iconState: "closed",
  driftMode: "rigid",
  glitch: false,
  iconsPerBlock: 92,
};
