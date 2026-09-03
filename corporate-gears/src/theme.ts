/**
 * Every geometric value in the scene is a fraction of the composition height
 * (`U`) or width, so the same layout holds at 1080p preview scale and at 4K.
 */
export type Theme = {
  /** Diagonal background ramp: lower-left -> middle -> upper-right. */
  gradient: [string, string, string];
  /** Colour of the very large soft lightening behind the centre word. */
  glow: string;
  glowOpacity: number;
  /** Stroke colour of the outlined gears. */
  gearStroke: string;
  gearStrokeOpacity: number;
  /** Fill of the floating discs (top and bottom of their vertical ramp). */
  discTop: string;
  discBottom: string;
  /** Thin ring drawn just outside each disc — the "raised plate" edge. */
  discRing: string;
  discRingOpacity: number;
  /** Near-black orbit arcs and node markers. */
  orbitStroke: string;
  orbitOpacity: number;
  /** White light streaks. */
  sweepStroke: string;
  sweepOpacity: number;
  /** Dark wave line crossing the frame. */
  waveStroke: string;
  waveOpacity: number;
  text: string;
  shadow: string;
};

export const GOLD: Theme = {
  gradient: ["#c8730d", "#e3a11c", "#efc84e"],
  glow: "#ffe6a3",
  glowOpacity: 0.26,
  gearStroke: "#2b2f36",
  gearStrokeOpacity: 0.85,
  discTop: "#3d3d3f",
  discBottom: "#2b2b2d",
  discRing: "#8a5a12",
  discRingOpacity: 0.4,
  orbitStroke: "#2b2f36",
  orbitOpacity: 0.72,
  sweepStroke: "#ffffff",
  sweepOpacity: 0.5,
  waveStroke: "#2b2f36",
  waveOpacity: 0.5,
  text: "#ffffff",
  shadow: "#4a2a05",
};

export const BLUE: Theme = {
  gradient: ["#0e2f4c", "#1d5a86", "#5da3c6"],
  glow: "#cfe9f7",
  glowOpacity: 0.3,
  gearStroke: "#131a24",
  gearStrokeOpacity: 0.85,
  discTop: "#2e363f",
  discBottom: "#1c222a",
  discRing: "#7fb8d8",
  discRingOpacity: 0.35,
  orbitStroke: "#131a24",
  orbitOpacity: 0.72,
  sweepStroke: "#ffffff",
  sweepOpacity: 0.5,
  waveStroke: "#131a24",
  waveOpacity: 0.42,
  text: "#ffffff",
  shadow: "#061520",
};
