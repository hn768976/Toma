// One data row per version. To add a colourway, copy a row, give it a new id
// and change the colours. To regenerate the city for all three city looks,
// change CITY_SEED (or set `citySeed` on a single row).

export const CITY_SEED = 7;
export const WORLD_SEED = 3;
export const TERRAIN_SEED = 11;

export interface CityHudPalette {
  ground: string;
  buildings: string[];
  local: string;
  avenue: string;
  arterial: string;
  water: string;
  park: string;
  grid: string;
  text: string;
  dim: string;
  accent: string;
}
export interface CityFlyoverPalette {
  local: string;
  avenue: string;
  ground: string;
  pin: string;
  pillA: string;
  pillB: string;
  label: string;
}
export interface CityTrackerPalette {
  local: string;
  avenue: string;
  block: string;
  water: string;
  dot: string;
  text: string;
  highlight: string;
  panel: string;
}
export interface WorldPalette {
  dots: string;
  cities: string;
  arcs: string;
  pulse: string;
  background: string;
  haze: string;
  beams: string;
}
export interface GlobePalette {
  land: string;
  rim: string;
  ocean: string;
  specks: string;
  bars: string;
  text: string;
  dim: string;
  background: string;
}
export interface TopoPalette {
  lines: string;
  index: string;
  background: string;
  hud: string;
  summit: string;
}

export type VersionRow =
  | { id: string; look: "CityHUD"; props: { citySeed: number; palette: CityHudPalette } }
  | { id: string; look: "CityFlyover"; props: { citySeed: number; palette: CityFlyoverPalette } }
  | { id: string; look: "CityTracker"; props: { citySeed: number; palette: CityTrackerPalette } }
  | { id: string; look: "WorldConnections"; props: { seed: number; palette: WorldPalette } }
  | { id: string; look: "HUDGlobe"; props: { seed: number; palette: GlobePalette } }
  | { id: string; look: "TopoContours"; props: { seed: number; palette: TopoPalette } };

export const VERSIONS: VersionRow[] = [
  {
    id: "CityHUD-SteelBlue",
    look: "CityHUD",
    props: {
      citySeed: CITY_SEED,
      palette: {
        ground: "#1C3240",
        buildings: ["#22394A", "#273F50", "#2C4656", "#324C5C", "#3A5A6A", "#44647A"],
        local: "#7A9AAC",
        avenue: "#9AB8C8",
        arterial: "#B8D4E2",
        water: "#05080B",
        park: "#080D11",
        grid: "#8AB8C8",
        text: "#8AE8F0",
        dim: "#4A8890",
        accent: "#F0D84A",
      },
    },
  },
  {
    id: "CityFlyover-Teal",
    look: "CityFlyover",
    props: {
      citySeed: CITY_SEED,
      palette: { local: "#1AC8B8", avenue: "#5AF0E0", ground: "#04181A", pin: "#F0E04A", pillA: "#F4F4EC", pillB: "#F09A4A", label: "#E8FFF8" },
    },
  },
  {
    id: "CityFlyover-Amber",
    look: "CityFlyover",
    props: {
      citySeed: CITY_SEED,
      palette: { local: "#C87A1A", avenue: "#FFC06A", ground: "#180C04", pin: "#5AE8FF", pillA: "#FFF4E4", pillB: "#5AE8FF", label: "#FFF0DC" },
    },
  },
  {
    id: "CityTracker-Teal",
    look: "CityTracker",
    props: {
      citySeed: CITY_SEED,
      palette: {
        local: "#7AC8C0",
        avenue: "#9AE8E0",
        block: "#1A2A2C",
        water: "#030606",
        dot: "#F0E04A",
        text: "#C8D0D0",
        highlight: "#5AD8C8",
        panel: "#0B0F10",
      },
    },
  },
  {
    id: "WorldConnections-Blue",
    look: "WorldConnections",
    props: {
      seed: WORLD_SEED,
      palette: { dots: "#C8D8F0", cities: "#E8F2FF", arcs: "#8AB8FF", pulse: "#E0F0FF", background: "#04102A", haze: "#1A3A6A", beams: "#C8E0FF" },
    },
  },
  {
    id: "WorldConnections-Gold",
    look: "WorldConnections",
    props: {
      seed: WORLD_SEED,
      palette: { dots: "#F0C878", cities: "#FFE8B8", arcs: "#E89A3A", pulse: "#FFE0A0", background: "#120A04", haze: "#3A2410", beams: "#FFD890" },
    },
  },
  {
    id: "HUDGlobe-Teal",
    look: "HUDGlobe",
    props: {
      seed: WORLD_SEED,
      palette: {
        land: "#8AF0D8",
        rim: "#2AF0C0",
        ocean: "#030909",
        specks: "#F0D86A",
        bars: "#3AC8A0",
        text: "#B8D8D0",
        dim: "#5A7470",
        background: "#050808",
      },
    },
  },
  {
    id: "TopoContours-GreenOrange",
    look: "TopoContours",
    props: {
      seed: TERRAIN_SEED,
      palette: { lines: "#A8E8A8", index: "#F08A2A", background: "#06100C", hud: "#C8D8C8", summit: "#F0FFF0" },
    },
  },
  {
    id: "TopoContours-IceBlue",
    look: "TopoContours",
    props: {
      seed: TERRAIN_SEED,
      palette: { lines: "#A8D8F0", index: "#F0F8FF", background: "#040A14", hud: "#C8D4E0", summit: "#F0F8FF" },
    },
  },
];
