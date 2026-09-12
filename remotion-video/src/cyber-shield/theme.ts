// Two visual treatments of the same motion design.
//
//  - "navy":  the reference look — glowing cyan emblem on a deep navy
//             circuit field, emblem centred, HUD split left/right.
//  - "cyan":  the alternate — a dark blue shield reading as a solid
//             object against a bright cyan field, emblem pushed left of
//             centre with the HUD restacked into a right-hand column
//             plus a full-width bottom ticker strip.

export type ThemeName = "navy" | "cyan";
export type LayoutName = "centered" | "offset";

export type Palette = {
  /** Page background, behind everything. */
  backdropTop: string;
  backdropBottom: string;
  /** Radial bloom in the upper-left corner of the field. */
  cornerGlow: string;
  cornerGlowOpacity: number;
  /** Circuit traces and dot-matrix in the far background. */
  circuit: string;
  circuitOpacity: number;
  matrixDot: string;
  matrixDotOpacity: number;
  /** HUD panel strokes, hairlines, and micro-text. */
  hudStroke: string;
  hudStrokeSoft: string;
  hudFill: string;
  hudFillOpacity: number;
  hudText: string;
  hudAccent: string;
  /** Emblem rings. */
  ringDim: string;
  ringBright: string;
  ringAccent: string;
  binaryText: string;
  /** Shield body. */
  shieldFill: string;
  shieldEdge: string;
  shieldStroke: string;
  /** Mosaic tiles inside the shield, dim -> bright. */
  mosaicDim: string;
  mosaicMid: string;
  mosaicHot: string;
  /** Keyhole cut-out. */
  keyholeFill: string;
  keyholeStroke: string;
  /** Glow colour used by the SVG bloom filters. */
  glow: string;
  glowStrength: number;
  /** Corner vignette. */
  vignette: string;
  vignetteOpacity: number;
};

export type Theme = {
  name: ThemeName;
  layout: LayoutName;
  palette: Palette;
  /** Emblem placement, in 1920x1080 design units. */
  emblem: { x: number; y: number; scale: number };
  /** Marks the shield as a solid plate rather than a glowing mesh. */
  solidShield: boolean;
};

const NAVY_PALETTE: Palette = {
  backdropTop: "#081a35",
  backdropBottom: "#03080f",
  cornerGlow: "#2f7fd6",
  cornerGlowOpacity: 0.55,
  circuit: "#2e6ea8",
  circuitOpacity: 0.3,
  matrixDot: "#4b9fd8",
  matrixDotOpacity: 0.42,
  hudStroke: "#a8d8f0",
  hudStrokeSoft: "#6fa8cf",
  hudFill: "#0b2a4a",
  hudFillOpacity: 0.35,
  hudText: "#cfe9fb",
  hudAccent: "#27e4ff",
  ringDim: "#1f7fc0",
  ringBright: "#3fd8ff",
  ringAccent: "#7ff2ff",
  binaryText: "#9fe9ff",
  shieldFill: "#0d3f6b",
  shieldEdge: "#5fe0ff",
  shieldStroke: "#8df0ff",
  mosaicDim: "#12639b",
  mosaicMid: "#2aa6dc",
  mosaicHot: "#7ff0ff",
  keyholeFill: "#04111f",
  keyholeStroke: "#6fe6ff",
  glow: "#31c8ff",
  glowStrength: 1,
  vignette: "#010509",
  vignetteOpacity: 0.72,
};

const CYAN_PALETTE: Palette = {
  backdropTop: "#63e6f2",
  backdropBottom: "#0c8fae",
  cornerGlow: "#eafdff",
  cornerGlowOpacity: 0.6,
  circuit: "#0a4f6d",
  circuitOpacity: 0.3,
  matrixDot: "#06384f",
  matrixDotOpacity: 0.34,
  hudStroke: "#0a3b58",
  hudStrokeSoft: "#136684",
  hudFill: "#0a4763",
  hudFillOpacity: 0.14,
  hudText: "#06293d",
  hudAccent: "#0b2f6b",
  ringDim: "#0d5c7c",
  ringBright: "#0b2f6b",
  ringAccent: "#123f8c",
  binaryText: "#0a3352",
  shieldFill: "#10265c",
  shieldEdge: "#0a1b45",
  shieldStroke: "#24408f",
  mosaicDim: "#0b1c48",
  mosaicMid: "#16307a",
  mosaicHot: "#3556b8",
  keyholeFill: "#8ef0fb",
  keyholeStroke: "#0a1b45",
  glow: "#0b2f6b",
  glowStrength: 0.45,
  vignette: "#05627d",
  vignetteOpacity: 0.5,
};

export const THEMES: Record<ThemeName, Theme> = {
  navy: {
    name: "navy",
    layout: "centered",
    palette: NAVY_PALETTE,
    emblem: { x: 960, y: 540, scale: 1 },
    solidShield: false,
  },
  cyan: {
    name: "cyan",
    layout: "offset",
    palette: CYAN_PALETTE,
    emblem: { x: 612, y: 548, scale: 0.94 },
    solidShield: true,
  },
};

export const getTheme = (name: ThemeName): Theme => THEMES[name];
