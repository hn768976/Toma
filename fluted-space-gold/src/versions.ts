/**
 * One data row per version. To add a colourway, add a row here — Root.tsx
 * registers a composition for every row.
 */
import type { FlutedGlassProps } from "./fluted/FlutedGlass";
import type { FrostedFoilProps } from "./foil/FrostedFoil";
import type { SpaceProps } from "./space/SunToAlphaCentauri";

export const FLUTED_VERSIONS: { id: string; props: FlutedGlassProps }[] = [
  {
    id: "FlutedGlass-Sunset",
    props: {
      // magenta, violet, coral, cream, teal, warm yellow, + a second cream for balance
      colors: ["#E0207A", "#8A3FC8", "#FF6A4A", "#FFF0D0", "#3FC8C8", "#FFD860", "#FFF0D0"],
      weights: [1.6, 1.3, 0.55, 1.0, 1.1, 0.5, 0.8],
      ribs: 90,
      background: "#E0207A",
    },
  },
  {
    id: "FlutedGlass-CoolPastel",
    props: {
      // sky, mint, lilac, white, soft peach accent, + sky / white for balance
      colors: ["#8FC8FF", "#9FF0D0", "#C8B0FF", "#FFFFFF", "#FFC8B0", "#8FC8FF", "#FFFFFF"],
      weights: [1.4, 1.1, 1.2, 1.0, 0.6, 0.9, 0.8],
      ribs: 90,
      background: "#8FC8FF",
    },
  },
];

export const SPACE_VERSIONS: { id: string; props: SpaceProps }[] = [
  { id: "SunToAlphaCentauri-Clean", props: { labels: false } },
  { id: "SunToAlphaCentauri-Labelled", props: { labels: true } },
];

export const FOIL_VERSIONS: { id: string; props: FrostedFoilProps }[] = [
  { id: "FrostedFoil-Gold", props: { light: "#F0E8A0", mid: "#C8A040", dark: "#5A3810" } },
  { id: "FrostedFoil-Silver", props: { light: "#F0F2F5", mid: "#A8AEB8", dark: "#3A3E46" } },
];
