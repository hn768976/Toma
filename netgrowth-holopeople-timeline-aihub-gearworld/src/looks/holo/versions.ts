// One data row per colourway.
export type HoloVersion = {
  id: string;
  figure: string; // figures, rings, plexus highlights
  plexusAlt: string; // secondary plexus tint
  hud: string; // HUD tags
  bokeh: [string, string];
};

export const HOLO_VERSIONS: HoloVersion[] = [
  { id: "HoloPeople-Amber", figure: "#FFA03A", plexusAlt: "#6AB8B0", hud: "#9ADCE0", bokeh: ["#2AB8E8", "#FF5A3A"] },
  { id: "HoloPeople-Cyan", figure: "#3AE8FF", plexusAlt: "#6A8AFF", hud: "#BFEFFF", bokeh: ["#3A6AFF", "#9A4AFF"] },
];
