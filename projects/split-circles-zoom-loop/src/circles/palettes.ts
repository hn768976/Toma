export type Palette = {
  name: string;
  /** Screen-space horizontal gradient shared by every "paper" layer. */
  left: string;
  right: string;
  /** Near-flat fill of the raised planes (trail strips and platform). */
  planeLeft: string;
  planeRight: string;
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
  right: "#f5a6f6",
  planeLeft: "#cb89fa",
  planeRight: "#c07ef6",
  dark: "#965bfa",
  shadow: "rgba(24, 8, 82, 0.85)",
  shadowWide: "rgba(38, 12, 116, 0.55)",
  rim: "rgba(255, 255, 255, 0.07)",
};

// Version 2 - alternative colour palette: cobalt -> aqua-mint.
export const COBALT_AQUA: Palette = {
  name: "Cobalt / Aqua",
  left: "#2f5cf5",
  right: "#5ff0cf",
  planeLeft: "#4cace6",
  planeRight: "#40a0dc",
  dark: "#2a4ee6",
  shadow: "rgba(4, 14, 70, 0.85)",
  shadowWide: "rgba(6, 22, 100, 0.55)",
  rim: "rgba(255, 255, 255, 0.08)",
};
