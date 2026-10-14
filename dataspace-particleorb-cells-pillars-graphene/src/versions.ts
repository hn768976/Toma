// One data row per version. To add a colourway, copy a row of the same
// `look`, give it a new `id` / `file` and change the palette.

export type DataGridPalette = {
  bgTop: string; bgBottom: string; line: string; point: string; pointAlt: string;
  blocks: [string, string, string]; horizon: string;
};
export type OrbPalette = { top: string; mid: string; bottom: string };
export type CellPalette = {
  bgTop: string; bgBottom: string; nucleus: string; membrane: string; cytoplasm: string; fleck: string;
};
export type PillarPalette = { top: string; sideA: string; sideB: string; trim: string; bg: string };
export type GraphenePalette = {
  atom: string; core: string; bond: string; bgA: string; bgB: string; bokeh: string;
};

export type Version =
  | { look: "datagrid"; id: string; file: string; palette: DataGridPalette }
  | { look: "orb"; id: string; file: string; palette: OrbPalette }
  | { look: "cells"; id: string; file: string; palette: CellPalette }
  | { look: "pillars"; id: string; file: string; palette: PillarPalette }
  | { look: "graphene"; id: string; file: string; palette: GraphenePalette };

export const VERSIONS: Version[] = [
  {
    look: "datagrid", id: "DataGridSpace-Blue", file: "DataGridSpace_Blue",
    palette: {
      bgTop: "#02081A", bgBottom: "#06143A", line: "#3AD8E8", point: "#FFFFFF", pointAlt: "#BFF4FF",
      blocks: ["#3A6AFF", "#FFA03A", "#E83A3A"], horizon: "#8AF0FF",
    },
  },
  { look: "orb", id: "ParticleOrb-VioletBlue", file: "ParticleOrb_VioletBlue", palette: { top: "#C878E8", mid: "#7A5AE8", bottom: "#4A8AFF" } },
  { look: "orb", id: "ParticleOrb-TealGold", file: "ParticleOrb_TealGold", palette: { top: "#FFD86A", mid: "#5AD8B8", bottom: "#2A8AC8" } },
  {
    look: "cells", id: "CellCluster-MicroscopeBlue", file: "CellCluster_MicroscopeBlue",
    palette: { bgTop: "#B8C8E8", bgBottom: "#8A9AD8", nucleus: "#1A1A6A", membrane: "#C8D0FF", cytoplasm: "#4A52C8", fleck: "#14143A" },
  },
  { look: "pillars", id: "PillarField-BlueViolet", file: "PillarField_BlueViolet", palette: { top: "#5AD8FF", sideA: "#2A5AE8", sideB: "#6A3AC8", trim: "#C88A4A", bg: "#0A0A30" } },
  { look: "pillars", id: "PillarField-CopperGold", file: "PillarField_CopperGold", palette: { top: "#FFD08A", sideA: "#B8642A", sideB: "#5A2A10", trim: "#6A4A2A", bg: "#140804" } },
  {
    look: "graphene", id: "GrapheneLattice-TealGold", file: "GrapheneLattice_TealGold",
    palette: { atom: "#E8C878", core: "#FF9A3A", bond: "#E8D8A8", bgA: "#0A4A5A", bgB: "#2A8A8A", bokeh: "#F8E0B0" },
  },
  {
    look: "graphene", id: "GrapheneLattice-BlueSilver", file: "GrapheneLattice_BlueSilver",
    palette: { atom: "#E8F0F8", core: "#5AE8FF", bond: "#D0E0F0", bgA: "#0A1A4A", bgB: "#2A4A9A", bokeh: "#B8D8FF" },
  },
];
