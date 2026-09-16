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

  // 2. Deep navy: the mood inverts -- the cells become the light source.
  navy: {
    id: "navy",
    label: "Deep Navy",
    bgInner: "#102a63",
    bgOuter: "#050d24",
    bgCorner: "#01030b",
    bgHotspot: [0.5, 0.08],
    cellCore: "#050d22",
    cellLit: "#2b60b8",
    cellRim: "#7cc0ff",
    rimStrength: 0.9,
    rimFalloff: 4.6,
    litStrength: 0.8,
    litFalloff: 2.2,
    fogColor: "#02060f",
    fogDensity: 0.14,
    opacity: 1,
    lightDir: [-0.62, 0.55, 0.26],
  },

  // 3. Deep violet: same construction, shifted up the spectrum and run a
  //    touch hotter, so it reads as its own grade and not a hue slider.
  violet: {
    id: "violet",
    label: "Deep Violet",
    bgInner: "#341563",
    bgOuter: "#100628",
    bgCorner: "#060210",
    bgHotspot: [0.5, 0.08],
    cellCore: "#0c0420",
    cellLit: "#4b2489",
    cellRim: "#b184ff",
    rimStrength: 0.92,
    rimFalloff: 4.6,
    litStrength: 0.8,
    litFalloff: 2.2,
    fogColor: "#060213",
    fogDensity: 0.14,
    opacity: 1,
    lightDir: [-0.62, 0.55, 0.26],
  },
} satisfies Record<string, Theme>;

export type ThemeId = keyof typeof THEMES;

export const THEME_IDS = Object.keys(THEMES) as ThemeId[];
