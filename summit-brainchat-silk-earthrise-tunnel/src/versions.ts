// One data row per version. To add a colourway, copy a row, give it a new
// id and change the colours: that's it (see README).
import type { SummitParams } from "./looks/summit";
import type { SilkParams } from "./looks/silk";
import type { TunnelParams } from "./looks/tunnel";
import type { EarthParams } from "./looks/earth";
import type { BrainParams } from "./looks/brain";

export type VersionRow =
  | { id: string; file: string; look: "summit"; params: SummitParams }
  | { id: string; file: string; look: "silk"; params: SilkParams }
  | { id: string; file: string; look: "tunnel"; params: TunnelParams }
  | { id: string; file: string; look: "earth"; params: EarthParams }
  | { id: string; file: string; look: "brain"; params: BrainParams };

export const VERSIONS: VersionRow[] = [
  {
    id: "SummitPath-Blue",
    file: "SummitPath_Blue",
    look: "summit",
    params: {
      facets: ["#0A1A50", "#1A4AB0", "#3A8AD8", "#6AB8F0", "#9AD8FF"],
      facetByHeight: 0.15,
      edge: "#A8D8FF",
      node: "#DDF0FF",
      path: "#FFFFFF",
      halo: "#6AA8FF",
      haloIntensity: 1.0,
      bgTop: "#020A2A",
      bgBottom: "#0A2A6A",
      keyLight: "#CFE4FF",
      fill: "#3A6AD0",
      exposure: 0.9,
    },
  },
  {
    id: "SummitPath-GoldDawn",
    file: "SummitPath_GoldDawn",
    look: "summit",
    params: {
      facets: ["#2A1440", "#4A2A6A", "#C86A6A", "#F0B860"],
      facetByHeight: 1.0,
      edge: "#FFD8A8",
      node: "#FFF0D8",
      path: "#FFF4DC",
      halo: "#FFC870",
      haloIntensity: 1.0,
      bgTop: "#1A0E3A",
      bgBottom: "#B0502A",
      keyLight: "#FFE0C0",
      fill: "#8A4A9A",
      exposure: 0.9,
    },
  },
  {
    id: "AIBrainChat-NeonBlue",
    file: "AIBrainChat_NeonBlue",
    look: "brain",
    params: {
      bg: "#020A1A",
      brain: "#1E50E8",
      brainRim: "#3AE8FF",
      brainFold: "#3AC8FF",
      traceColors: ["#3AE8FF", "#FF4AC8", "#3AF08A", "#8A5AFF"],
      chipRimA: "#FF4AC8",
      chipRimB: "#3AF08A",
      cube: "#3AD8F0",
      bubble: "#3A8AFF",
      exposure: 1.0,
    },
  },
  {
    id: "BlackSilk-Black",
    file: "BlackSilk_Black",
    look: "silk",
    params: {
      cloth: "#0A0A0C",
      highlight: "#8A8A90",
      diffuse: 0.75,
      spec: 0.3,
      ambient: 0.18,
      exposure: 1.0,
      grainFadeLum: 0.03,
    },
  },
  {
    id: "BlackSilk-Champagne",
    file: "BlackSilk_Champagne",
    look: "silk",
    params: {
      cloth: "#D8C098",
      highlight: "#FFF4E0",
      diffuse: 0.75,
      spec: 0.5,
      ambient: 0.22,
      exposure: 1.0,
      grainFadeLum: 0,
    },
  },
  {
    id: "LightTunnel-White",
    file: "LightTunnel_White",
    look: "tunnel",
    params: {
      slat: "#EEEEF0",
      backing: "#D8D8DC",
      floor: "#E8E8EC",
      strip: "#FFFFFF",
      stripIntensity: 6,
      endLight: "#FFFFFF",
      endIntensity: 8,
      fog: "#F2F2F4",
      ambientSky: "#FFFFFF",
      ambientGround: "#B8B8C0",
      ambient: 2.0,
      areaIntensity: 2.2,
      reflect: 0.55,
      exposure: 1.0,
    },
  },
  {
    id: "LightTunnel-Graphite",
    file: "LightTunnel_Graphite",
    look: "tunnel",
    params: {
      slat: "#2A2C30",
      backing: "#1C1E22",
      floor: "#26282C",
      strip: "#C8F0FF",
      stripIntensity: 5,
      endLight: "#C8F0FF",
      endIntensity: 8,
      fog: "#0E1216",
      ambientSky: "#9AB0C0",
      ambientGround: "#202428",
      ambient: 1.1,
      areaIntensity: 9,
      reflect: 0.7,
      exposure: 1.0,
    },
  },
  {
    id: "EarthGridRise-Blue",
    file: "EarthGridRise_Blue",
    look: "earth",
    params: {
      skyTop: "#04102A",
      skyHorizon: "#0A2A6A",
      grid: "#5AD8FF",
      gridOpacity: 0.4,
      arc: "#FFA03A",
      ring: "#E8F6FF",
      rim: "#3AC8FF",
      oceanTint: "#081C48",
      landTint: "#1A4A8A",
      cityLights: "#FFB060",
      exposure: 1.0,
    },
  },
];
