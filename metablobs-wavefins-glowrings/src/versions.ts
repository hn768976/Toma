// One data row per version. To add a colourway, add a row here (see README).
import type { GlowRingsProps } from "./glowrings/GlowRings";
import type { MetaBlobsProps } from "./metablobs/MetaBlobs";
import type { WaveFinsProps } from "./wavefins/WaveFins";

export const WAVE_FINS: { id: string; props: WaveFinsProps }[] = [
  {
    id: "WaveFins-Blue",
    props: { metal: "#3A5A80", highlight: "#9AC8FF", panelA: "#4A8AE8", panelB: "#D8ECFF", keyLight: "#9AC8FF", background: "#000000", envIntensity: 9.0, edgeStrength: 1.3, bloom: 0.6, grain: 0.015 },
  },
  {
    id: "WaveFins-Copper",
    props: { metal: "#B8703A", highlight: "#FFE0C0", panelA: "#FF9A5A", panelB: "#F4E8D8", keyLight: "#FFE0C0", background: "#000000", envIntensity: 9.0, edgeStrength: 1.3, bloom: 0.6, grain: 0.015 },
  },
];

export const META_BLOBS: { id: string; props: MetaBlobsProps }[] = [
  {
    id: "MetaBlobs-NeonBlueMagenta",
    props: { mode: "neon", colorA: "#3A6AFF", colorB: "#F03AE0", background: "#000000", backgroundCentre: "#000000", glow: 0.4, bloom: 0.45, grain: 0.015 },
  },
  {
    id: "MetaBlobs-WhiteMatte",
    props: { mode: "white", colorA: "#F8F8F8", colorB: "#C8C8CC", background: "#E6E6E8", backgroundCentre: "#EEEEF0", glow: 0, bloom: 0, grain: 0.015 },
  },
  {
    id: "MetaBlobs-SunsetCoral",
    props: { mode: "neon", colorA: "#FF5A5A", colorB: "#FFB03A", background: "#000000", backgroundCentre: "#000000", glow: 0.4, bloom: 0.45, grain: 0.015 },
  },
];

export const GLOW_RINGS: { id: string; props: GlowRingsProps }[] = [
  { id: "GlowRings-Magenta", props: { ring: "#B8407A", tint: "#6A7A5A", background: "#050207", grain: 0.025 } },
  { id: "GlowRings-Violet", props: { ring: "#7A4AB8", tint: "#7A7A4A", background: "#04030A", grain: 0.025 } },
  { id: "GlowRings-Teal", props: { ring: "#2A9A9A", tint: "#4A6AB8", background: "#020607", grain: 0.025 } },
];
