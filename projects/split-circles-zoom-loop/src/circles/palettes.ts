export type Palette = {
  name: string;
  /** Screen-space horizontal gradient shared by every "paper" layer. */
  left: string;
  right: string;
  /** Solid colour of the darker half of each split disk. */
  dark: string;
  /** Tight contact drop-shadow colour (light comes from the upper-left). */
  shadow: string;
  /** Wide, soft ambient shadow colour. */
  shadowWide: string;
  /** Faint paper-edge highlight. */
  rim: string;
};

// Version 1 - sampled from the reference footage.
export const VIOLET_PINK: Palette = {
  name: "Violet / Pink (reference)",
  left: "#9e64f8",
  right: "#f2a3f8",
  dark: "#965bfa",
  shadow: "rgba(22, 8, 78, 0.95)",
  shadowWide: "rgba(36, 12, 112, 0.62)",
  rim: "rgba(255, 255, 255, 0.07)",
};

// Version 2 - alternative colour palette: cobalt -> aqua-mint.
export const COBALT_AQUA: Palette = {
  name: "Cobalt / Aqua",
  left: "#2f5cf5",
  right: "#5ff0cf",
  dark: "#2a4ee6",
  shadow: "rgba(3, 12, 66, 0.95)",
  shadowWide: "rgba(5, 20, 96, 0.62)",
  rim: "rgba(255, 255, 255, 0.08)",
};
