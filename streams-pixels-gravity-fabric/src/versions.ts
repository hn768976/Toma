import type { LookFactory } from "./gl/Stage";
import { createFabricWaves } from "./looks/FabricWaves";
import { createGravityWell } from "./looks/GravityWell";
import { createLightStreams } from "./looks/LightStreams";
import { createPixelBurst } from "./looks/PixelBurst";

// One data row per version. To add a colourway, copy a row, give it a new id
// and change the colours - nothing else needs to change.
export type Version = { id: string; create: LookFactory };

export const VERSIONS: Version[] = [
  {
    id: "LightStreams-Blue",
    create: createLightStreams({
      lineA: "#2A7AFF",
      lineB: "#8FE8FF",
      packets: ["#FFFFFF", "#8FF4FF", "#C88AFF"],
      background: "#020822",
    }),
  },
  {
    id: "LightStreams-Emerald",
    create: createLightStreams({
      lineA: "#1AAF6A",
      lineB: "#9AFFD0",
      packets: ["#FFFFFF", "#B8FFE0", "#FFD27A"],
      background: "#02140C",
    }),
  },
  {
    id: "PixelBurst-Neon",
    create: createPixelBurst({
      core: "#FFFFFF",
      a: "#5FF0FF",
      b: "#FF3AD8",
      c: "#2AA89A",
      dark: "#030810",
      cloudDeep: "#2A4AD8",
    }),
  },
  {
    id: "PixelBurst-Gold",
    create: createPixelBurst({
      core: "#FFFFFF",
      a: "#FFC860",
      b: "#FF8A2A",
      c: "#FFF0D0",
      dark: "#0C0602",
      cloudDeep: "#B0501A",
    }),
  },
  {
    id: "GravityWell-Grid",
    create: createGravityWell({
      line: "#5FA8E8",
      deep: "#BFE8FF",
      glow: "#1A4AD8",
      k: 15,
      eps: 1.6,
      rMin: 1.55,
    }),
  },
  {
    id: "GravityWell-Planet",
    create: createGravityWell({
      line: "#5FA8E8",
      deep: "#BFE8FF",
      glow: "#1A5AC8",
      k: 7,
      eps: 2.5,
      rMin: 1.0,
      planet: {
        radius: 1.55,
        light: "#B8C6D6",
        dark: "#3A4A60",
        rim: "#8FC8FF",
        moon: "#A8ACB4",
      },
    }),
  },
  {
    id: "FabricWaves-VioletTeal",
    create: createFabricWaves({
      valley: "#2A0A6A",
      slope: "#4A3AE8",
      peak: "#2AE8C8",
      highlight: "#E85AE8",
      background: "#05020F",
    }),
  },
  {
    id: "FabricWaves-AmberRose",
    create: createFabricWaves({
      valley: "#4A0A1A",
      slope: "#E85A3A",
      peak: "#FFC860",
      highlight: "#FFE0F0",
      background: "#0F0402",
    }),
  },
];
