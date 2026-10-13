import type { CrystalBurstProps } from "./looks/CrystalBurst";
import type { CubeClusterProps } from "./looks/CubeCluster";
import type { DigitSwirlProps } from "./looks/DigitSwirl";
import type { RibbedDunesProps } from "./looks/RibbedDunes";
import type { SerumCapsuleProps } from "./looks/SerumCapsule";

// One data row per version. To add a colourway, copy a row, give it a new
// `id` and change the colours – nothing else needs touching.

export const W = 3840;
export const H = 2160;
export const FPS = 30;

export const SERUM_CAPSULE: { id: string; props: SerumCapsuleProps }[] = [
  {
    id: "SerumCapsule-SilverBlue",
    props: {
      bgCenter: "#E8ECF2",
      bgCorner: "#A8B8D0",
      rim: "#EEF6FF",
      shade: "#8C9CBC",
      molecule: "#C4D0E2",
      ring: "#A8D0FF",
      iridescence: 0.06,
    },
  },
  {
    id: "SerumCapsule-Gold",
    props: {
      bgCenter: "#F8EED8",
      bgCorner: "#C8A060",
      rim: "#FFEFC8",
      shade: "#B88A40",
      molecule: "#E8C888",
      ring: "#FFE8B0",
      iridescence: 0.05,
    },
  },
];

export const RIBBED_DUNES: { id: string; props: RibbedDunesProps }[] = [
  {
    id: "RibbedDunes-White",
    props: {
      surface: "#E8EEF8",
      shadow: "#9AA8C8",
      highlight: "#FFFFFF",
      skyTop: "#C8D0E0",
      skyHorizon: "#F0F2F8",
      keyStrength: 1.35,
    },
  },
  {
    id: "RibbedDunes-Graphite",
    props: {
      surface: "#3A3C42",
      shadow: "#141518",
      highlight: "#9AA0A8",
      skyTop: "#1A1C20",
      skyHorizon: "#2E3036",
      keyStrength: 1.5,
    },
  },
];

export const CUBE_CLUSTER: { id: string; props: CubeClusterProps }[] = [
  {
    id: "CubeCluster-Blue",
    props: { cube: "#2A6AF0", glow: "#5AC8F8", edge: "#1A5ADA", keyLight: "#C0EEFF", fill: "#9AD4FF" },
  },
];

export const CRYSTAL_BURST: { id: string; props: CrystalBurstProps }[] = [
  {
    id: "CrystalBurst-IceBlue",
    props: {
      base: "#3A7CC4",
      deep: "#030A18",
      strips: ["#FFFFFF", "#5A9AFF", "#3AD8E8", "#8AB8FF"],
      accents: ["#FF7AA0", "#FFC860", "#FFB060"],
      tint: "#2E4C72",
    },
  },
  {
    id: "CrystalBurst-AmethystRose",
    props: {
      base: "#6A3AB8",
      deep: "#1A0830",
      strips: ["#FFFFFF", "#B07AFF", "#FF8AC8", "#D8A8FF"],
      accents: ["#FFC860", "#3AD8C8", "#FF6AA0"],
      tint: "#3C2468",
    },
  },
];

export const DIGIT_SWIRL: { id: string; props: DigitSwirlProps }[] = [
  {
    id: "DigitSwirl-Teal",
    props: { digit: "#8AF0F0", streak: "#3AC8E8", ring: "#3AD8E8", bg: "#020A0E", haze: "#021620" },
  },
];
