// ONE configuration object driving all four versions. Mesh density, facet
// mode, label set and light mode are config values on a single mesh
// implementation — there is no separate "plexus" and "flare" component.
//
// Every hex literal in the project lives here. Nothing else hardcodes colour.

export type VariantName =
  | "plexusBlue"
  | "plexusGreen"
  | "flareBlue"
  | "flareAmber";

export type FacetMode = "on" | "off";
export type LightMode = "none" | "anamorphic" | "risingBloom";
export type LabelSet = "numericDominant" | "wordDominant";

export interface Palette {
  /** Flat base fill of the frame. */
  backgroundDeep: string;
  /** Large soft radial washes drifting over the base. */
  backgroundWash: string;
  /** Base node colour. */
  nodePale: string;
  /** Node colour at full pulse / flash. */
  nodeBright: string;
  /** Colour of short (strong) edges. */
  edgeMain: string;
  /** Colour of long (weak) edges. */
  edgeDim: string;
  /** Triangulated facet wash; only read when facetMode is "on". */
  facet?: string;
  labelPale: string;
  bokeh: string;
  /** Anamorphic flare; only read when lightMode is "anamorphic". */
  flareCore?: string;
  flareCyan?: string;
  flareMagenta?: string;
  /** Rising bloom; only read when lightMode is "risingBloom". */
  bloomCore?: string;
  bloomTint?: string;
}

export interface VariantConfig {
  palette: Palette;
  /** Node count across the frame plus its off-screen margin. */
  nodeCount: number;
  /** Max edge length in 4K pixels. Edge alpha falls to zero at this length. */
  connectionThreshold: number;
  /** Hard cap on edges per node so dense regions never go solid. */
  maxConnections: number;
  facetMode: FacetMode;
  /** Peak alpha of a facet wash. Deliberately tiny. */
  facetOpacity: number;
  labelSet: LabelSet;
  labelCount: number;
  lightMode: LightMode;
  /** Upward-drifting motes; v4 only. */
  dustMotes: boolean;
}

export const VARIANTS: Record<VariantName, VariantConfig> = {
  // v1 — dense, faceted, numeric. Dark navy dashboard.
  plexusBlue: {
    palette: {
      backgroundDeep: "#060E24",
      backgroundWash: "#102A52",
      nodePale: "#A8D4F0",
      nodeBright: "#E8F6FF",
      edgeMain: "#4F9FD4",
      edgeDim: "#24507A",
      facet: "#1A3F6B",
      labelPale: "#7FB8D4",
      bokeh: "#5FA8E8",
    },
    nodeCount: 220,
    connectionThreshold: 430,
    maxConnections: 5,
    facetMode: "on",
    facetOpacity: 0.03,
    labelSet: "numericDominant",
    labelCount: 54,
    lightMode: "none",
    dustMotes: false,
  },

  // v2 — denser and finer-grained, terminal green.
  plexusGreen: {
    palette: {
      backgroundDeep: "#01120A",
      backgroundWash: "#063A20",
      nodePale: "#A8F0C4",
      nodeBright: "#E8FFF0",
      edgeMain: "#3FB86A",
      edgeDim: "#145C30",
      facet: "#0F4A26",
      labelPale: "#6FD48F",
      bokeh: "#4FE87A",
    },
    nodeCount: 340,
    connectionThreshold: 320,
    maxConnections: 5,
    facetMode: "on",
    // ~40% below v1: with far more triangles, v1's alpha would fill the frame.
    facetOpacity: 0.018,
    labelSet: "wordDominant",
    labelCount: 58,
    lightMode: "none",
    dustMotes: false,
  },

  // v3 — sparse, luminous blue field crossed by a travelling anamorphic flare.
  flareBlue: {
    palette: {
      backgroundDeep: "#0A2A6B",
      backgroundWash: "#1A4FA8",
      nodePale: "#C8E0F5",
      nodeBright: "#FFFFFF",
      edgeMain: "#8AB4E0",
      edgeDim: "#4A78B0",
      labelPale: "#A8C8E8",
      bokeh: "#C8E0F5",
      flareCore: "#FFFFFF",
      flareCyan: "#7FD4FF",
      flareMagenta: "#E85FC4",
    },
    nodeCount: 90,
    connectionThreshold: 720,
    maxConnections: 4,
    facetMode: "off",
    facetOpacity: 0,
    labelSet: "numericDominant",
    labelCount: 46,
    lightMode: "anamorphic",
    dustMotes: false,
  },

  // v4 — same sparse mesh, warm brown field, soft bloom rising from below.
  flareAmber: {
    palette: {
      backgroundDeep: "#3A1E06",
      backgroundWash: "#7A4210",
      nodePale: "#FFE0B8",
      nodeBright: "#FFFFFF",
      edgeMain: "#E0B87F",
      edgeDim: "#A87A3F",
      labelPale: "#E8C48F",
      bokeh: "#FFB84F",
      bloomCore: "#FFF8E8",
      bloomTint: "#FFB84F",
    },
    nodeCount: 90,
    connectionThreshold: 720,
    maxConnections: 4,
    facetMode: "off",
    facetOpacity: 0,
    labelSet: "numericDominant",
    labelCount: 46,
    lightMode: "risingBloom",
    dustMotes: true,
  },
};
