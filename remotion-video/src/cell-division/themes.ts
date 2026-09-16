// The three deliverable looks. Everything that differs between versions
// lives here -- scene.ts and the material are theme-agnostic, so adding a
// fourth grade means adding an entry here and a <Composition> in Root.tsx.
//
// Colours are plain sRGB hex; scene.ts feeds them through THREE.Color,
// which converts them to the renderer's linear working space. Blending
// and the background gradient therefore happen in linear light, which is
// what keeps these large soft gradients free of the muddy midtones you
// get when compositing in sRGB.

export type Theme = {
  id: string;
  label: string;
  /** Backdrop: bright core of the gradient, its falloff, and the corners. */
  bgInner: string;
  bgOuter: string;
  bgCorner: string;
  /** Where the backdrop's bright spot sits, in screen UV (0..1, y down). */
  bgHotspot: [number, number];
  /** Cell body in shadow, and where the key light hits it. */
  cellCore: string;
  cellLit: string;
  /** Colour the fuzzy silhouette edge tends towards. */
  cellRim: string;
  /** Rim strength -- the dark grades carry a glow, the mono reference does not. */
  rimStrength: number;
  /** How tightly the rim glow hugs the silhouette. Higher = thinner edge. */
  rimFalloff: number;
  /** How hard the key light shapes the body. */
  litStrength: number;
  /**
   * Exponent on the key light's falloff. The mono grade wants a broad,
   * matte wrap; the dark grades want it concentrated into a crescent,
   * otherwise the whole cell floods to the lit colour and the look
   * collapses into flat pastel balloons.
   */
  litFalloff: number;
  /** Colour distant cells fade into, and how fast they get there. */
  fogColor: string;
  fogDensity: number;
  /** Overall cell opacity; the mono look is denser than the glow looks. */
  opacity: number;
  /**
   * Key light direction in view space. The mono grade points it towards
   * the camera for a broad matte wrap; the dark grades swing it to the
   * side so the body stays in shadow and the light reads as a crescent.
   */
  lightDir: [number, number, number];
};

export const THEMES = {
  // 1. Matches the reference: charcoal cells on a bright, hazy studio white.
  mono: {
    id: "mono",
    label: "Mono",
    bgInner: "#fcfcfc",
    bgOuter: "#d4d4d6",
    bgCorner: "#a6a6ab",
    bgHotspot: [0.5, 0.07],
    cellCore: "#282830",
    cellLit: "#5f5f6a",
    cellRim: "#94949e",
    rimStrength: 0.24,
    rimFalloff: 2.6,
    litStrength: 0.82,
    litFalloff: 1.6,
    fogColor: "#e6e6e7",
    fogDensity: 0.1,
    opacity: 1,
    lightDir: [-0.32, 0.72, 0.62],
  },

  // 2. Bright blue: the reference's construction held exactly -- bright
  //    hazy backdrop, broad matte key, barely any rim -- with the whole
  //    palette carried into blue. The cells sit at mid-tone rather than
  //    charcoal so the frame reads light and coloured, not just tinted.
  blue: {
    id: "blue",
    label: "Bright Blue",
    bgInner: "#fbfdff",
    bgOuter: "#cfe1f6",
    bgCorner: "#9cbde2",
    bgHotspot: [0.5, 0.07],
    cellCore: "#2f528f",
    cellLit: "#79a3dd",
    cellRim: "#b4cff0",
    rimStrength: 0.28,
    rimFalloff: 2.6,
    litStrength: 0.85,
    litFalloff: 1.6,
    fogColor: "#dcebfa",
    fogDensity: 0.1,
    opacity: 1,
    lightDir: [-0.32, 0.72, 0.62],
  },

  // 3. Bright violet: same construction again, shifted up the spectrum.
  //    Violet reads heavier than blue at equal lightness, so the cells are
  //    lifted a little to keep the two grades at a matching brightness.
  violet: {
    id: "violet",
    label: "Bright Violet",
    bgInner: "#fdfbff",
    bgOuter: "#ded2f5",
    bgCorner: "#b2a1de",
    bgHotspot: [0.5, 0.07],
    cellCore: "#553a99",
    cellLit: "#9a81df",
    cellRim: "#c9b7f2",
    rimStrength: 0.28,
    rimFalloff: 2.6,
    litStrength: 0.85,
    litFalloff: 1.6,
    fogColor: "#e9e1f9",
    fogDensity: 0.1,
    opacity: 1,
    lightDir: [-0.32, 0.72, 0.62],
  },
} satisfies Record<string, Theme>;

export type ThemeId = keyof typeof THEMES;

export const THEME_IDS = Object.keys(THEMES) as ThemeId[];
