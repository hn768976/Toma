/**
 * The single source of truth for every colour, layout mode, readout domain and
 * render mode in the project.
 *
 * RULE: no hex literal may appear anywhere else in src/geo-hud. If you need a
 * new colour, add it to a palette here.
 */

export type VariantName = "blue" | "green" | "tilted";

/** "flat2D" draws straight to the composition canvas. "plane3D" draws to an
 *  offscreen buffer that is mapped onto a plane in @remotion/three. */
export type RenderMode = "flat2D" | "plane3D";

/** "centred" = map in the middle, panels flanking. "offset" = map pushed left,
 *  dense data column on the right, full-width trace along the bottom. */
export type LayoutMode = "centred" | "offset";

/** Which vocabulary the readout cells and text panels draw from. */
export type ReadoutDomain = "geodata" | "network";

/** "sonar" = expanding pulse ring. "blink" = small marker that blinks. */
export type MarkerMode = "sonar" | "blink";

export type Palette = {
  background: string;
  panelFill: string;
  panelBorder: string;
  mapLand: string;
  mapOutline: string;
  mapGraticule: string;
  highlight: string;
  accent: string;
  textPale: string;
  textDim: string;
  trace: string;
  /** Used only for the vignette ramp. */
  shadow: string;
};

export type Variant = {
  name: VariantName;
  palette: Palette;
  layout: LayoutMode;
  domain: ReadoutDomain;
  renderMode: RenderMode;
  /** Short invented label shown in the title plate above the map. */
  title: string;
  /** Secondary label drawn inside the map panel. */
  subtitle: string;
  markers: {
    mode: MarkerMode;
    /** Number of ring / node markers placed on the map. */
    count: number;
    /** Outer radius of a marker, in composition pixels. */
    radius: number;
  };
  /** Draw connector lines between the currently highlighted countries. */
  connectors: boolean;
};

const BLUE_PALETTE: Palette = {
  background: "#04060C",
  panelFill: "#0A1018",
  panelBorder: "#4A6A8F",
  mapLand: "#D8E8F5",
  mapOutline: "#FFFFFF",
  mapGraticule: "#1E3550",
  highlight: "#F58FB4",
  accent: "#F5487A",
  textPale: "#C8D8E8",
  textDim: "#5A7090",
  trace: "#7FA8D4",
  shadow: "#000000",
};

const GREEN_PALETTE: Palette = {
  background: "#01080A",
  panelFill: "#061418",
  panelBorder: "#2E7A6B",
  mapLand: "#C8F5E4",
  mapOutline: "#FFFFFF",
  mapGraticule: "#103830",
  highlight: "#F5C47F",
  accent: "#F5A02E",
  textPale: "#A8E8D4",
  textDim: "#46806F",
  trace: "#4FD4A8",
  shadow: "#000000",
};

export const VARIANTS: Record<VariantName, Variant> = {
  blue: {
    name: "blue",
    palette: BLUE_PALETTE,
    layout: "centred",
    domain: "geodata",
    renderMode: "flat2D",
    title: "TARGET IDENTIFICATION",
    subtitle: "GEODATA ANALYTICS",
    markers: { mode: "sonar", count: 4, radius: 46 },
    connectors: false,
  },
  green: {
    name: "green",
    palette: GREEN_PALETTE,
    layout: "offset",
    domain: "network",
    renderMode: "flat2D",
    title: "NODE MESH INTEGRITY",
    subtitle: "RELAY NETWORK",
    markers: { mode: "blink", count: 9, radius: 28 },
    connectors: true,
  },
  // v3 re-renders the v1 dashboard as a texture on a plane; it shares the blue
  // palette, layout and domain exactly and differs only in render mode.
  tilted: {
    name: "tilted",
    palette: BLUE_PALETTE,
    layout: "centred",
    domain: "geodata",
    renderMode: "plane3D",
    title: "TARGET IDENTIFICATION",
    subtitle: "GEODATA ANALYTICS",
    markers: { mode: "sonar", count: 4, radius: 46 },
    connectors: false,
  },
};

/** The variant whose dashboard content v3 re-renders (v1). */
export const TEXTURE_SOURCE_VARIANT: VariantName = "blue";
