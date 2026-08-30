import type { StrokeSet } from "./theme";

export type ComponentKey =
  | "NodeGraph"
  | "RingAssembly"
  | "RadarDial"
  | "Reticle"
  | "CodePanel"
  | "DataTable"
  | "PercentReadout"
  | "BarStrip"
  | "SideRuler";

/** How an entry's (x, y) maps onto the element's box. Intrinsic per component. */
export type Anchor = "center" | "topLeft" | "line" | "span";

export type ElementConfig = {
  seed: string;
  /** NodeGraph */
  nodes?: number;
  edges?: number;
  /** CodePanel */
  lines?: number;
  cols?: number;
  fontSize?: number;
  leading?: number;
  /** DataTable */
  rows?: number;
  columns?: number;
  title?: string;
  /** SideRuler: the fraction of frame height the ruler ends at. */
  y2?: number;
};

/**
 * The layout is data. The renderer walks this array; v2 mirrors it and swaps
 * one entry, v3 culls it and scales it up. Neither touches a component.
 */
export type LayoutEntry = {
  id: string;
  component: ComponentKey;
  x: number;
  y: number;
  scale: number;
  props: ElementConfig;
};

export type ResolvedEntry = Omit<LayoutEntry, "props"> & {
  config: ElementConfig;
  mirrored: boolean;
};

export type Rect = { x: number; y: number; w: number; h: number };

export type PlacedEntry = ResolvedEntry & {
  left: number;
  top: number;
  w: number;
  h: number;
  /** Rects of neighbouring elements, in this element's own pixel space. */
  avoid: Rect[];
};

export type ElementRenderProps = {
  frame: number;
  scale: number;
  stroke: StrokeSet;
  config: ElementConfig;
  width: number;
  height: number;
  /** True while this element is inside a flicker event. */
  dimmed: boolean;
  avoid: Rect[];
};

export type Measurer = (
  entry: ResolvedEntry,
  frameWidth: number,
  frameHeight: number,
) => { w: number; h: number };
