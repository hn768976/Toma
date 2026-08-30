import type React from "react";
import type { Anchor, ComponentKey, ElementRenderProps, Measurer } from "./layout";
import { NodeGraph, measureNodeGraph } from "./components/NodeGraph";
import { RingAssembly, measureRingAssembly } from "./components/RingAssembly";
import { RadarDial, measureRadarDial } from "./components/RadarDial";
import { Reticle, measureReticle } from "./components/Reticle";
import { CodePanel, measureCodePanel } from "./components/CodePanel";
import { DataTable, measureDataTable } from "./components/DataTable";
import { PercentReadout, measurePercentReadout } from "./components/PercentReadout";
import { BarStrip, measureBarStrip } from "./components/BarStrip";
import { SideRuler, measureSideRuler } from "./components/SideRuler";

type Registration = {
  Comp: React.FC<ElementRenderProps>;
  measure: Measurer;
  anchor: Anchor;
  /** Elements that place their own internals around their neighbours. */
  avoidsNeighbours?: boolean;
};

export const REGISTRY: Record<ComponentKey, Registration> = {
  NodeGraph: {
    Comp: NodeGraph,
    measure: measureNodeGraph,
    anchor: "center",
    avoidsNeighbours: true,
  },
  RingAssembly: { Comp: RingAssembly, measure: measureRingAssembly, anchor: "center" },
  RadarDial: { Comp: RadarDial, measure: measureRadarDial, anchor: "center" },
  Reticle: { Comp: Reticle, measure: measureReticle, anchor: "center" },
  CodePanel: { Comp: CodePanel, measure: measureCodePanel, anchor: "topLeft" },
  DataTable: { Comp: DataTable, measure: measureDataTable, anchor: "topLeft" },
  PercentReadout: {
    Comp: PercentReadout,
    measure: measurePercentReadout,
    anchor: "topLeft",
  },
  BarStrip: { Comp: BarStrip, measure: measureBarStrip, anchor: "span" },
  SideRuler: { Comp: SideRuler, measure: measureSideRuler, anchor: "line" },
};
