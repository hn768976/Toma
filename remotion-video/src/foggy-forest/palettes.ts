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
};

export const TEAL: Palette = {
  id: "teal",
  fogNear: "#1a4a48",
  fogFar: "#08181c",
  glow: "#a8e0dc",
  glowOuter: "#3d8a86",
  treeFar: "#0d2426",
  treeMid: "#061214",
  treeNear: "#000000",
  ground: "#040d10",
  vignette: "#02080a",
};

export const AMBER: Palette = {
  id: "amber",
  fogNear: "#4a3a24",
  fogFar: "#1a1008",
  glow: "#f0d0a0",
  glowOuter: "#9a7442",
  treeFar: "#261b0d",
  treeMid: "#140c06",
  treeNear: "#000000",
  ground: "#100a04",
  vignette: "#0a0602",
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
  fogNear: "#2d2d2d",
  fogFar: "#0c0c0c",
  glow: "#dbdbdb",
  glowOuter: "#828282",
  treeFar: "#252525",
  treeMid: "#121212",
  treeNear: "#000000",
  ground: "#090909",
  vignette: "#060606",
};

export const PALETTES: Record<string, Palette> = {
  teal: TEAL,
  amber: AMBER,
  mono: MONO,
};
