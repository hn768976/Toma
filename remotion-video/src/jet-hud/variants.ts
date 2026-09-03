/**
 * The single source of truth for everything that differs between the two
 * versions of the piece: palette, jet render mode, signed flight direction,
 * HUD plane tilt and panel density.
 *
 * No hex literal may appear anywhere else in src/jet-hud — if you need a new
 * colour, add it here.
 */

export type VariantName = "blue" | "amber";
export type JetRenderMode = "solid" | "wireframe";

export type Palette = {
  bgDeep: string;
  bgWash: string;
  gridLine: string;
  panelFill: string;
  panelFillAlpha: number;
  panelBorder: string;
  textPale: string;
  textBright: string;
  /** Solid mode: the four tonal steps, darkest -> light. */
  jetDarkest: string;
  jetDark: string;
  jetMid: string;
  jetLight: string;
  /** Wireframe mode: stroke tones + translucent facet fill. */
  jetLine: string;
  jetLineDim: string;
  jetWireFill: string;
  jetWireFillAlpha: number;
  canopyPale: string;
  storeBand: string;
  engineGlow: string;
  /** The 2-3 small HUD elements that break the monochrome. */
  accent: string;
};

export type Variant = {
  name: VariantName;
  palette: Palette;
  jetMode: JetRenderMode;
  /**
   * +1 = enters lower-LEFT, exits upper-RIGHT.
   * -1 = enters upper-RIGHT, exits lower-LEFT, aircraft mirrored so the nose
   *      still leads and the bank inverts with it.
   * Never hardcode travel direction anywhere else.
   */
  flightDir: 1 | -1;
  /** HUD plane affine transform. */
  planeRotationDeg: number;
  planeSkewDeg: number;
  planeScaleX: number;
  /** Panel density: "high" fills the margins, "sparse" is ~half the count. */
  density: "high" | "sparse";
};

export const VARIANTS: Record<VariantName, Variant> = {
  blue: {
    name: "blue",
    jetMode: "solid",
    flightDir: 1,
    planeRotationDeg: -22,
    planeSkewDeg: -7.5,
    planeScaleX: 0.9,
    density: "high",
    palette: {
      bgDeep: "#030A16",
      bgWash: "#0A1E38",
      gridLine: "#10304A",
      panelFill: "#06182A",
      panelFillAlpha: 0.8,
      panelBorder: "#2E6B8A",
      textPale: "#5FA8C4",
      textBright: "#D8F0FF",
      jetDarkest: "#2A3644",
      jetDark: "#3D4C5E",
      jetMid: "#56687E",
      jetLight: "#8FA4BC",
      // Unused in solid mode, but the palette shape is shared.
      jetLine: "#8FA4BC",
      jetLineDim: "#3D4C5E",
      jetWireFill: "#2A3644",
      jetWireFillAlpha: 0.55,
      canopyPale: "#B8CEE0",
      storeBand: "#C4443A",
      engineGlow: "#4FC4F5",
      accent: "#F5A03F",
    },
  },
  amber: {
    name: "amber",
    jetMode: "wireframe",
    flightDir: -1,
    // Mirrored tilt: the plane now recedes to the upper-LEFT.
    planeRotationDeg: 18,
    planeSkewDeg: 7.5,
    planeScaleX: 0.9,
    density: "sparse",
    palette: {
      bgDeep: "#140A02",
      bgWash: "#3A2008",
      gridLine: "#4A2E10",
      panelFill: "#1C1004",
      panelFillAlpha: 0.8,
      panelBorder: "#8A5C2E",
      textPale: "#C4915F",
      textBright: "#FFF0D8",
      // Solid steps are unused in wireframe mode but kept for palette parity.
      jetDarkest: "#1A0E04",
      jetDark: "#8A5C1E",
      jetMid: "#C4913F",
      jetLight: "#FFB84F",
      jetLine: "#FFB84F",
      jetLineDim: "#8A5C1E",
      jetWireFill: "#1A0E04",
      jetWireFillAlpha: 0.55,
      canopyPale: "#FFE0A8",
      storeBand: "#FFB84F",
      engineGlow: "#FF7A3F",
      accent: "#3FC4E8",
    },
  },
};
