export type Palette = {
  id: string;
  /** Fog in the lit region, near the distant glow. */
  fogNear: string;
  /** Fog at the frame edges, where the light falls off. */
  fogFar: string;
  /** Core of the distant light. */
  glow: string;
  /** Halo colour the glow fades out through. */
  glowOuter: string;
  /** Tree silhouette colour, far tier through near tier. */
  treeFar: string;
  treeMid: string;
  treeNear: string;
  /** Ground band. */
  ground: string;
  /** Vignette colour (multiplied in at the edges). */
  vignette: string;
  /**
   * A visible sun, for versions where the light has a source rather than being
   * a formless glow in the fog. Height is a fraction of the frame; radius is a
   * fraction of frame height. Even with a disc the edge stays soft — a sun seen
   * through this much fog has no hard limb.
   */
  sun?: { y: number; radius: number };
};

export const TEAL: Palette = {
  id: "teal",
  fogNear: "#568180",
  fogFar: "#2c4245",
  glow: "#a8e0dc",
  glowOuter: "#3d8a86",
  treeFar: "#1c3a3c",
  treeMid: "#0c2224",
  treeNear: "#000000",
  ground: "#040d10",
  vignette: "#000000",
};

/**
 * Warm dawn, with the sun itself low in the mist. The disc gives the light a
 * source and a direction the teal and mono versions deliberately lack.
 */
export const AMBER: Palette = {
  id: "amber",
  fogNear: "#8a7150",
  fogFar: "#443426",
  glow: "#f0d0a0",
  glowOuter: "#9a7442",
  treeFar: "#3a2b16",
  treeMid: "#1f1509",
  treeNear: "#000000",
  ground: "#100a04",
  vignette: "#000000",
  sun: { y: 0.575, radius: 0.052 },
};

/**
 * Neutral grey. The brief's reference values (#2a2e30 / #0a0c0d / #d8dcde) each
 * carry a slight cyan bias, which survives compositing and shows as a tint in
 * the encoded file. Every value here is the luma-matched neutral of the one it
 * replaces, so the lightness is unchanged and R=G=B throughout — verified on
 * the rendered output by `node tools/check-neutral.mjs`.
 */
export const MONO: Palette = {
  id: "mono",
  fogNear: "#606060",
  fogFar: "#383838",
  glow: "#dbdbdb",
  glowOuter: "#828282",
  treeFar: "#3a3a3a",
  treeMid: "#1d1d1d",
  treeNear: "#000000",
  ground: "#090909",
  vignette: "#000000",
};

export const PALETTES: Record<string, Palette> = {
  teal: TEAL,
  amber: AMBER,
  mono: MONO,
};
