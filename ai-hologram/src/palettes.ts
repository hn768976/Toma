/**
 * The two deliverable palettes. Geometry is identical between versions; the
 * difference has to be carried by hue, so V2 sits noticeably greener rather
 * than merely darker.
 */
export type Palette = {
  readonly id: string;
  /** Background gradient: near-black at the corners... */
  readonly bgCorner: string;
  /** ...lifting to this behind the platform. */
  readonly bgCenter: string;
  /** Lit circuit traces. */
  readonly trace: string;
  /** Circuit traces before the build-on reaches them. */
  readonly traceUnlit: string;
  /** HUD rings and the holographic card's edge. */
  readonly ring: string;
  /** The platform core — the brightest thing in frame, clips to white. */
  readonly core: string;
  /** Orbiting node badges. */
  readonly node: string;
  /** Floating UI panels (low alpha). */
  readonly panel: string;
  /** Atmosphere particles. */
  readonly particle: string;
  /**
   * Exposure trim on the circuit plane. The two trace colours are the ones the
   * brief specifies, but #0f7a72 carries about 28% more luminance than #1b4fd0
   * — green dominates the luma weighting — so without this the cyan board would
   * sit brighter than the blue one and eat into the platform's contrast. The
   * hue is untouched; only the level is matched.
   */
  readonly boardGain: number;
};

export const DARK_BLUE: Palette = {
  id: "dark-blue",
  bgCorner: "#020610",
  bgCenter: "#071530",
  trace: "#1b4fd0",
  traceUnlit: "#0d2450",
  ring: "#2f7ae0",
  core: "#cfe4ff",
  node: "#4a8ff0",
  panel: "#9cc4ff",
  particle: "#8fb8ff",
  boardGain: 1,
};

export const DARK_CYAN: Palette = {
  id: "dark-cyan",
  bgCorner: "#01100f",
  bgCenter: "#052824",
  trace: "#0f7a72",
  traceUnlit: "#07332f",
  ring: "#18b0a4",
  core: "#d0fff8",
  node: "#22d3c0",
  panel: "#8ef0e2",
  particle: "#6fe0d2",
  boardGain: 0.78,
};

export const PALETTES = { "dark-blue": DARK_BLUE, "dark-cyan": DARK_CYAN };
export type PaletteId = keyof typeof PALETTES;
