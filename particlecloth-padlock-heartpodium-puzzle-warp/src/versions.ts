// One data row per version. To add a colourway, copy a row, give it a new id
// and fileName, and change the colours. Root.tsx registers every row.
import type { ParticleClothProps } from "./looks/particle-cloth/ParticleCloth";
import type { CircuitPadlockProps } from "./looks/circuit-padlock/CircuitPadlock";
import type { HeartPodiumProps } from "./looks/heart-podium/HeartPodium";
import type { PuzzleSurfaceProps } from "./looks/puzzle-surface/PuzzleSurface";
import type { WarpStreaksProps } from "./looks/warp-streaks/WarpStreaks";

export type Version =
  | { id: string; fileName: string; look: "particleCloth"; props: ParticleClothProps }
  | { id: string; fileName: string; look: "circuitPadlock"; props: CircuitPadlockProps }
  | { id: string; fileName: string; look: "heartPodium"; props: HeartPodiumProps }
  | { id: string; fileName: string; look: "puzzleSurface"; props: PuzzleSurfaceProps }
  | { id: string; fileName: string; look: "warpStreaks"; props: WarpStreaksProps };

export const VERSIONS: Version[] = [
  { id: "ParticleCloth-IceBlue", fileName: "ParticleCloth_IceBlue", look: "particleCloth", props: { light: "#F0F8FF", deep: "#8AB8E8" } },
  { id: "ParticleCloth-Gold", fileName: "ParticleCloth_Gold", look: "particleCloth", props: { light: "#FFF4D8", deep: "#E8B860" } },
  { id: "CircuitPadlock-Cyan", fileName: "CircuitPadlock_Cyan", look: "circuitPadlock", props: { glass: "#3AE8F0", board: "#04181E", trace: "#2AC8D8", glow: "#40D8FF" } },
  {
    id: "HeartPodium-PinkValentine", fileName: "HeartPodium_PinkValentine", look: "heartPodium",
    props: { backdrop: "#D8A0A8", podium: "#D8303A", podiumRim: null, heart: "#D8303A", heartMetal: false, box: "#D8303A", ribbon: "#F4F2F0", ribbonMetal: false },
  },
  {
    id: "HeartPodium-WhiteGold", fileName: "HeartPodium_WhiteGold", look: "heartPodium",
    props: { backdrop: "#F4EEE8", podium: "#F8F6F2", podiumRim: "#E8C070", heart: "#E8C070", heartMetal: true, box: "#F8F6F2", ribbon: "#E8C070", ribbonMetal: true },
  },
  { id: "PuzzleSurface-White", fileName: "PuzzleSurface_White", look: "puzzleSurface", props: { piece: "#F0F2F6", dark: false } },
  { id: "PuzzleSurface-Graphite", fileName: "PuzzleSurface_Graphite", look: "puzzleSurface", props: { piece: "#2E3036", dark: true } },
  {
    id: "WarpStreaks-Blue", fileName: "WarpStreaks_Blue", look: "warpStreaks",
    props: { palette: [["#3A6AFF", 0.5], ["#3AE8FF", 0.3], ["#C8F06A", 0.1], ["#FFFFFF", 0.1]], bokeh: "#6A5AD8", background: "#000000" },
  },
];
