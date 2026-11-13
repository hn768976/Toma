export type Variant = "v1" | "v2";

export type Palette = {
  /** Backdrop: defocused strands */
  bgDark: string;
  bgLight: string;
  /** Damaged cuticle */
  cuticleA: string;
  cuticleB: string;
  /** Repaired, glossy strand */
  smoothBase: string;
  sheen: string;
  /** Energy line + grid */
  glow: string;
  glowHot: string;
  /** Serum droplet */
  dropCore: string;
  dropEdge: string;
  dropHot: string;
  halo: string;
};

export const PALETTES: Record<Variant, Palette> = {
  // Reference look: golden serum on a cool slate-blue backdrop
  v1: {
    bgDark: "#1b202b",
    bgLight: "#5f7184",
    cuticleA: "#938068",
    cuticleB: "#3d352c",
    smoothBase: "#070605",
    sheen: "#c9c6c2",
    glow: "#ffc23a",
    glowHot: "#fff3c4",
    dropCore: "#ffd818",
    dropEdge: "#e89a00",
    dropHot: "#fff6b8",
    halo: "#ffe9a8",
  },
  // Alternative look: rose serum on a deep plum backdrop
  v2: {
    bgDark: "#24121f",
    bgLight: "#8a5378",
    cuticleA: "#8b6f72",
    cuticleB: "#4a3639",
    smoothBase: "#0a0406",
    sheen: "#e3c4d0",
    glow: "#ff5fa8",
    glowHot: "#ffe0ee",
    dropCore: "#ff4f9a",
    dropEdge: "#b3125e",
    dropHot: "#ffd9ea",
    halo: "#ffb3d6",
  },
};
