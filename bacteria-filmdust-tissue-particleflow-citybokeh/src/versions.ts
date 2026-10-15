import type { LookName } from "./looks";

// One data row per version. To add a colourway, copy a row, give it a new id
// and change its colours — see README "Adding a colourway".
export type VersionRow = { id: string; look: LookName; params: Record<string, unknown> };

export const VERSIONS: VersionRow[] = [
  { id: "BacteriaChains-Red", look: "bacteria", params: { seed: 1101, ramp: ["#000000", "#5A0A0A", "#B0201C", "#E87A7A", "#FFE2DC"] } },
  { id: "BacteriaChains-Blue", look: "bacteria", params: { seed: 1101, ramp: ["#000000", "#04122A", "#1C5AA8", "#A8E0FF", "#EEF9FF"] } },
  { id: "FilmDust-Dense", look: "filmdust", params: { seed: 2201, count: 9000 } },
  { id: "FilmDust-Light", look: "filmdust", params: { seed: 2202, count: 1500 } },
  { id: "GlowingTissue-Orange", look: "tissue", params: { ramp: ["#000000", "#5A1A04", "#E8601A", "#FFE8B0", "#FFFBF0"] } },
  { id: "GlowingTissue-Blue", look: "tissue", params: { ramp: ["#000000", "#041A4A", "#2A8AE8", "#E0F8FF", "#FAFEFF"] } },
  { id: "ParticleFlow-Blue", look: "particleflow", params: { seed: 4401, count: 250000, deep: "#0A1A4A", sheet: "#2A6AE8", edge: "#FFFFFF", edge2: "#BFDCFF", haze: "#06102A" } },
  { id: "ParticleFlow-Gold", look: "particleflow", params: { seed: 4401, count: 250000, deep: "#2A1A04", sheet: "#C88A2A", edge: "#FFF0C8", edge2: "#FFFFFF", haze: "#1E1204" } },
  {
    id: "CityBokeh-Warm",
    look: "bokeh",
    params: {
      seed: 5501, bgTop: "#1A0E08", bgBottom: "#3A2010", glow: "#2A1408", blob: "#3A0806",
      colors: [{ c: "#FFF4E6", w: 4 }, { c: "#F0E0C8", w: 5 }, { c: "#D8E4F0", w: 2 }, { c: "#C8A880", w: 3 }, { c: "#E05030", w: 0.7 }],
    },
  },
  {
    id: "CityBokeh-Cool",
    look: "bokeh",
    params: {
      seed: 5501, bgTop: "#04080E", bgBottom: "#0A1A2A", glow: "#081A2C", blob: "#140A30",
      colors: [{ c: "#D8E8FF", w: 5 }, { c: "#9FE8F0", w: 3 }, { c: "#B8A8FF", w: 2 }, { c: "#F2F6FF", w: 3 }, { c: "#F0B060", w: 0.7 }],
    },
  },
];
