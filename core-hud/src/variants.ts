import type { ComponentKey, LayoutEntry, ResolvedEntry } from "./layout";
import type { StrokeSet } from "./theme";

export type VariantName = "nodes" | "rings" | "sparse";

export type VariantSpec = {
  /** Which component fills the `centre` layout slot. */
  centre: ComponentKey;
  /** Flips every entry's x to (1 - x). Coordinates only — never the canvas. */
  mirror: boolean;
  /** Multiplies every entry's scale. */
  elementScale: number;
  panelDensity: "full" | "sparse";
  /** Exactly the entry ids present in this variant. */
  panels: string[];
  /** Stroke weights step, they do not scale with elementScale. */
  stroke: StrokeSet;
  /** Per-entry position and config overrides for this variant. */
  overrides: Record<string, Partial<Omit<LayoutEntry, "id" | "props">> & {
    props?: Partial<LayoutEntry["props"]>;
  }>;
};

/**
 * The single source of layout truth. No layout coordinate is hard-coded
 * anywhere else.
 */
export const BASE_LAYOUT: LayoutEntry[] = [
  {
    id: "centre",
    component: "NodeGraph",
    x: 0.3,
    y: 0.32,
    scale: 1,
    props: { seed: "centre", nodes: 9, edges: 14 },
  },
  {
    id: "dial",
    component: "RadarDial",
    x: 0.16,
    y: 0.62,
    scale: 1,
    props: { seed: "dial" },
  },
  {
    id: "reticle",
    component: "Reticle",
    x: 0.36,
    y: 0.68,
    scale: 0.7,
    props: { seed: "reticle" },
  },
  {
    id: "codeA",
    component: "CodePanel",
    x: 0.02,
    y: 0.14,
    scale: 1,
    props: { seed: "code-a", lines: 30, cols: 50, fontSize: 14, leading: 24 },
  },
  {
    id: "codeB",
    component: "CodePanel",
    x: 0.5,
    y: 0.1,
    scale: 1,
    props: { seed: "code-b", lines: 22, cols: 60, fontSize: 16, leading: 30 },
  },
  {
    id: "codeC",
    component: "CodePanel",
    x: 0.5,
    y: 0.55,
    scale: 1,
    props: { seed: "code-c", lines: 14, cols: 60, fontSize: 16, leading: 30 },
  },
  {
    id: "percent",
    component: "PercentReadout",
    x: 0.86,
    y: 0.06,
    scale: 1,
    props: { seed: "percent" },
  },
  {
    id: "tableA",
    component: "DataTable",
    x: 0.84,
    y: 0.18,
    scale: 1,
    props: { seed: "table-a", rows: 10, columns: 3, title: "SECTOR A" },
  },
  {
    id: "tableB",
    component: "DataTable",
    x: 0.84,
    y: 0.6,
    scale: 1,
    props: { seed: "table-b", rows: 10, columns: 3, title: "SECTOR D" },
  },
  {
    id: "ruler",
    component: "SideRuler",
    x: 0.8,
    y: 0.2,
    scale: 1,
    props: { seed: "ruler", y2: 0.75 },
  },
  {
    id: "bars",
    component: "BarStrip",
    x: 0,
    y: 0.86,
    scale: 1,
    props: { seed: "bars" },
  },
];

const FULL_PANELS = BASE_LAYOUT.map((e) => e.id);

export const VARIANTS: Record<VariantName, VariantSpec> = {
  nodes: {
    centre: "NodeGraph",
    mirror: false,
    elementScale: 1,
    panelDensity: "full",
    panels: FULL_PANELS,
    stroke: { structure: 2, emphasis: 3 },
    overrides: {},
  },
  rings: {
    centre: "RingAssembly",
    mirror: true,
    elementScale: 1,
    panelDensity: "full",
    panels: FULL_PANELS,
    stroke: { structure: 2, emphasis: 3 },
    overrides: {},
  },
  sparse: {
    centre: "NodeGraph",
    mirror: false,
    elementScale: 1.55,
    panelDensity: "sparse",
    panels: ["centre", "dial", "codeA", "percent", "tableA", "bars"],
    stroke: { structure: 3, emphasis: 4 },
    overrides: {
      // A larger assembly needs more nodes, or the line work thins out as it
      // grows. The extra nodes keep detail-per-unit-area roughly constant.
      centre: { x: 0.36, y: 0.36, props: { nodes: 13, edges: 21 } },
      dial: { x: 0.2, y: 0.7 },
      codeA: { x: 0.04, y: 0.1, props: { lines: 18 } },
      percent: { x: 0.8, y: 0.12 },
      tableA: { x: 0.78, y: 0.3 },
      bars: { y: 0.88 },
    },
  },
};

export const buildLayout = (variant: VariantName): ResolvedEntry[] => {
  const v = VARIANTS[variant];
  return BASE_LAYOUT.filter((e) => v.panels.includes(e.id)).map((e) => {
    const o = v.overrides[e.id] ?? {};
    const x = o.x ?? e.x;
    return {
      id: e.id,
      component: e.id === "centre" ? v.centre : (o.component ?? e.component),
      x: v.mirror ? 1 - x : x,
      y: o.y ?? e.y,
      scale: (o.scale ?? e.scale) * v.elementScale,
      config: { ...e.props, ...o.props },
      mirrored: v.mirror,
    };
  });
};
