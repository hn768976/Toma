// One data row per Vintage Map version. To add a region, add a row here and a
// <Composition> entry in Root.tsx (see README, "Adding a map region").

export type ProjectionSpec =
  | { type: "conicConformal"; rotate: [number, number]; center: [number, number]; parallels: [number, number] }
  | { type: "naturalEarth1"; rotate: [number, number]; center: [number, number] };

export type MapRegion = {
  id: string;
  title: string;
  // Which Natural Earth set to draw: "regional" = 1:10m, "world" = 1:50m.
  dataset: "regional" | "world";
  projection: ProjectionSpec;
  // Camera focus (screen centre on the paper) at the start and end, lon/lat.
  focusStart: [number, number];
  focusEnd: [number, number];
  // Visible paper width through the focus point, in degrees of longitude
  // measured at the focus latitude.
  viewWidthDeg: number;
  // Camera heading (degrees, clockwise from north) at start and end.
  headingStart: number;
  headingEnd: number;
  // Draw admin-1 (state/province) names and lines for these countries.
  admin1: string[];
  // Countries whose own name is left off (their admin-1 names carry the map).
  hideCountryLabels: string[];
  // Cities: national capitals always; other places above this population.
  cityMinPop: number;
  capitalMinPop: number;
  // Marine label classes and the largest Natural Earth scalerank to label.
  seaClasses: string[];
  seaMaxRank: number;
  // Label scale relative to the default.
  labelScale: number;
};

export const MAP_REGIONS: Record<string, MapRegion> = {
  Europe: {
    id: "Europe",
    title: "Europe",
    dataset: "regional",
    projection: { type: "conicConformal", rotate: [-15, 0], center: [0, 52], parallels: [40, 62] },
    focusStart: [11.0, 50.0],
    focusEnd: [17.0, 47.5],
    viewWidthDeg: 80,
    headingStart: -1.5,
    headingEnd: 1.5,
    admin1: [],
    hideCountryLabels: [],
    cityMinPop: 700000,
    capitalMinPop: 0,
    seaClasses: ["sea", "bay", "gulf", "ocean"],
    seaMaxRank: 4,
    labelScale: 1.08,
  },
  NorthAmerica: {
    id: "NorthAmerica",
    title: "North America",
    dataset: "regional",
    projection: { type: "conicConformal", rotate: [96, 0], center: [0, 40], parallels: [33, 45] },
    focusStart: [-101.5, 40.5],
    focusEnd: [-94.5, 38.0],
    viewWidthDeg: 42,
    headingStart: -1.5,
    headingEnd: 1.5,
    admin1: ["USA", "CAN"],
    hideCountryLabels: ["USA"],
    cityMinPop: 1200000,
    capitalMinPop: 0,
    seaClasses: ["sea", "bay", "gulf", "ocean"],
    seaMaxRank: 4,
    labelScale: 0.95,
  },
  World: {
    id: "World",
    title: "World",
    dataset: "world",
    projection: { type: "naturalEarth1", rotate: [30, 0], center: [0, 20] },
    focusStart: [-40, 24],
    focusEnd: [-24, 18],
    viewWidthDeg: 120,
    headingStart: -1.5,
    headingEnd: 1.5,
    admin1: [],
    hideCountryLabels: [],
    cityMinPop: 6000000,
    capitalMinPop: 1500000,
    seaClasses: ["ocean", "sea", "gulf", "bay"],
    seaMaxRank: 1,
    labelScale: 1.1,
  },
};
