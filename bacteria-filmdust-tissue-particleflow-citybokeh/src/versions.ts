import type { LookName } from "./looks";

// One data row per version. To add a colourway, copy a row, give it a new id
// and change its colours — see README "Adding a colourway".
export type VersionRow = { id: string; look: LookName; params: Record<string, unknown> };

export const VERSIONS: VersionRow[] = [
  { id: "BacteriaChains-Red", look: "bacteria", params: { seed: 1101, ramp: ["#000000", "#5A0A0A", "#9A2A22", "#E88A84", "#F2B4AC"] } },
  { id: "BacteriaChains-Blue", look: "bacteria", params: { seed: 1101, ramp: ["#000000", "#04122A", "#18509A", "#A8E0FF", "#D4F0FF"] } },
  { id: "FilmDust-Dense", look: "filmdust", params: { seed: 2201, count: 9000 } },
  { id: "FilmDust-Light", look: "filmdust", params: { seed: 2202, count: 1500 } },
  { id: "GlowingTissue-Orange", look: "tissue", params: { ramp: ["#000000", "#5A1A04", "#E8601A", "#FFE8B0", "#FFFBF0"] } },
  { id: "GlowingTissue-Blue", look: "tissue", params: { ramp: ["#000000", "#041A4A", "#2A8AE8", "#E0F8FF", "#FAFEFF"] } },
  { id: "ParticleFlow-Blue", look: "particleflow", params: { seed: 4401, count: 250000, deep: "#0A1A4A", sheet: "#2A6AE8", edge: "#FFFFFF", edge2: "#BFDCFF", grey: "#6B8594", haze: "#06102A" } },
  { id: "ParticleFlow-Gold", look: "particleflow", params: { seed: 4401, count: 250000, deep: "#2A1A04", sheet: "#C88A2A", edge: "#FFF0C8", edge2: "#FFFFFF", grey: "#8E8270", haze: "#1E1204" } },
  {
    id: "CityBokeh-Warm",
    look: "bokeh",
    params: {
      seed: 5501, bgTop: "#1A0E08", bgBottom: "#3A2010", glow: "#3A2C20", blob: "#3A0806",
      colors: [{ c: "#FFF6EC", w: 4 }, { c: "#F0E0C8", w: 4 }, { c: "#DCEAF6", w: 3 }, { c: "#A89888", w: 3 }, { c: "#D04030", w: 0.25 }],
    },
  },
  {
    id: "CityBokeh-Cool",
    look: "bokeh",
    params: {
      seed: 5501, bgTop: "#04080E", bgBottom: "#0A1A2A", glow: "#14263A", blob: "#140A30",
      colors: [{ c: "#D8E8FF", w: 5 }, { c: "#9FE8F0", w: 2.5 }, { c: "#B8A8FF", w: 1.5 }, { c: "#F2F6FF", w: 3 }, { c: "#8898A8", w: 2 }, { c: "#F0B060", w: 0.25 }],
    },
  },
];
