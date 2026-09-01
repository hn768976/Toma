/**
 * The single source of truth for everything that differs between the two
 * versions of the piece: palette, centre form, panel content and rail style.
 *
 * RULE: this file holds every colour literal in the project. Nothing else
 * anywhere writes a hex value — components take colours off `palette`.
 */

export type VariantName = "blue" | "amber";

export type Palette = {
  /** deep background field */
  bgDeep: string;
  /** soft radial wash behind the centre form */
  bgWash: string;
  panelFill: string;
  panelBorder: string;
  /** dominant chart / bar colour */
  element: string;
  /** highlights and the centre form's arcs */
  accent: string;
  /** pale tint for secondary strokes */
  pale: string;
  textPale: string;
  textBright: string;
  railDim: string;
  /** pure black, for vignette / shadow / knockouts */
  void: string;
};

export type CentreForm = "concentricDial" | "hexCore";
export type RailStyle = "ticked" | "segmented";

export type PanelKind =
  | "areaChart"
  | "pieRow"
  | "barChart"
  | "ringPair"
  | "barRow"
  | "dataTable"
  | "lineSpike"
  | "miniLines";

export type PanelSpec = {
  kind: PanelKind;
  /** text of the label strip along the panel's top edge */
  label: string;
  /** shown at the right end of the label strip */
  code: string;
};

export type PanelContent = {
  left: PanelSpec[];
  right: PanelSpec[];
  /** data table shape, right column */
  table: { cols: number; rows: number };
  /** horizontal bar row, right column */
  barRowCount: number;
  /** multiplier on every piece of panel text */
  textScale: number;
  /** samples in the scrolling area/line charts */
  chartSamples: number;
};

export type Variant = {
  name: VariantName;
  palette: Palette;
  centreForm: CentreForm;
  railStyle: RailStyle;
  panels: PanelContent;
  /** readouts printed around the centre form */
  centreLabels: { top: string; bottom: string; core: string };
};

const BLUE_PANELS: PanelContent = {
  left: [
    { kind: "areaChart", label: "FLUX DECAY", code: "L-01" },
    { kind: "pieRow", label: "CHANNEL LOAD", code: "L-02" },
    { kind: "barChart", label: "SPECTRUM BINS", code: "L-03" },
  ],
  right: [
    { kind: "ringPair", label: "CORE SYNC", code: "R-01" },
    { kind: "barRow", label: "BUS ALLOCATION", code: "R-02" },
    { kind: "dataTable", label: "TELEMETRY GRID", code: "R-03" },
    { kind: "lineSpike", label: "PULSE TRACE", code: "R-04" },
  ],
  table: { cols: 3, rows: 8 },
  barRowCount: 5,
  textScale: 1,
  chartSamples: 130,
};

const AMBER_PANELS: PanelContent = {
  left: [
    { kind: "areaChart", label: "THERMAL DECAY", code: "L-01" },
    { kind: "pieRow", label: "CHANNEL LOAD", code: "L-02" },
    { kind: "barChart", label: "SPECTRUM BINS", code: "L-03" },
    { kind: "miniLines", label: "DRIFT / BIAS", code: "L-04" },
  ],
  right: [
    { kind: "ringPair", label: "CORE SYNC", code: "R-01" },
    { kind: "barRow", label: "BUS ALLOCATION", code: "R-02" },
    { kind: "dataTable", label: "TELEMETRY GRID", code: "R-03" },
    { kind: "lineSpike", label: "PULSE TRACE", code: "R-04" },
  ],
  table: { cols: 4, rows: 11 },
  barRowCount: 8,
  textScale: 0.85,
  chartSamples: 130,
};

export const VARIANTS: Record<VariantName, Variant> = {
  blue: {
    name: "blue",
    palette: {
      bgDeep: "#050B1A",
      bgWash: "#0A1830",
      panelFill: "#06101F",
      panelBorder: "#2E5C8A",
      element: "#2E7FD4",
      accent: "#4FD4E8",
      pale: "#A8D8F0",
      textPale: "#7FB8D4",
      textBright: "#E8F4FF",
      railDim: "#1A3A5C",
      void: "#000000",
    },
    centreForm: "concentricDial",
    railStyle: "ticked",
    panels: BLUE_PANELS,
    centreLabels: { top: "SYS.0417", bottom: "REF.2290", core: "" },
  },
  amber: {
    name: "amber",
    palette: {
      bgDeep: "#140A02",
      bgWash: "#3A2008",
      panelFill: "#1C1004",
      panelBorder: "#8A5C2E",
      element: "#E8942E",
      accent: "#F5C44F",
      pale: "#FFE0A8",
      textPale: "#C4956A",
      textBright: "#FFF4E0",
      railDim: "#5C3A14",
      void: "#000000",
    },
    centreForm: "hexCore",
    railStyle: "segmented",
    panels: AMBER_PANELS,
    centreLabels: { top: "CORE.881", bottom: "REF.4471", core: "88.4" },
  },
};
