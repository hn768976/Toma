/** One row per version. `ramp` maps the light field (0 = deepest shadow, 1 = streak core) to colour. */
export type GrainGlowVersion = {
  id: string;
  ramp: Array<{ at: number; color: string }>; // exactly 5 stops, ascending
};

export const GRAIN_GLOW_VERSIONS: GrainGlowVersion[] = [
  {
    id: "GrainGlow-Violet",
    ramp: [
      { at: 0.0, color: "#24183F" }, // deep indigo
      { at: 0.3, color: "#4A3496" },
      { at: 0.56, color: "#8A6CFF" }, // violet
      { at: 0.82, color: "#D8C8FF" }, // lilac
      { at: 1.0, color: "#F7F2FF" },
    ],
  },
  {
    id: "GrainGlow-Sunset",
    ramp: [
      { at: 0.0, color: "#2E1230" }, // deep plum
      { at: 0.38, color: "#E84D9A" }, // pink
      { at: 0.62, color: "#FF6F6F" }, // coral
      { at: 0.86, color: "#FFD2B8" }, // peach
      { at: 1.0, color: "#FFF3EA" },
    ],
  },
];
