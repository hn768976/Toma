export type HudPalette = {
  /** Near-black field. */
  bg: string;
  /** The loud ring of blocks — the only layer that blooms. */
  block: string;
  /** Broken arc segments. */
  arc: string;
  /** Fine detail: ticks, most data blocks. */
  detail: string;
  /** A colour held back as a counterpoint so the frame never goes monochrome. */
  accent: string;
  /** Dim structural lines: outer circle, radials, corner marks. */
  dim: string;
  /** Dim off-white used by a minority of the scattered data blocks. */
  dimWhite: string;
};

export const PALETTES = {
  /** V1 — white / cyan / orange, matching the reference. */
  cyan: {
    bg: "#050708",
    block: "#f0f6ff",
    arc: "#f08a20",
    detail: "#22d3ee",
    accent: "#22d3ee",
    dim: "#2a3a48",
    dimWhite: "#7d94a8",
  },
  /** V2 — red / amber alert. Cyan is kept for a couple of elements only. */
  alert: {
    bg: "#050708",
    block: "#ffd9a0",
    arc: "#e02030",
    detail: "#f0a020",
    accent: "#22d3ee",
    dim: "#3a2020",
    dimWhite: "#a08878",
  },
} satisfies Record<string, HudPalette>;

export type PaletteName = keyof typeof PALETTES;
