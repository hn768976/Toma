import type { GlyphName } from "../components/Glyph";
import { boundsOf, curve, ortho, type OrthoMode, type PathGeom } from "./path";

/** A node's visual treatment. */
export type NodeShape =
  /** Filled capsule with the label inside it (V1). */
  | "blob"
  /** Bare bracketed text, no plate behind it (V2). */
  | "bare"
  /** Stroked ring with a glyph inside (both). */
  | "ring";

export type NodeSpec = {
  id: string;
  kind: "label" | "icon" | "hero";
  shape: NodeShape;
  /** Board coordinates of the node's centre. */
  x: number;
  y: number;
  /** Diameter for round nodes, height for capsules. */
  size: number;
  tier: number;
  /**
   * Paint order, back to front. Depth tier alone cannot decide this: a
   * badly out-of-focus shape may be a long way behind the network or
   * right in front of the lens, and both look the same until you say
   * which. Defaults to -tier, i.e. blurrier means further back.
   */
  layer?: number;
  color: string;
  text?: string;
  glyph?: GlyphName;
  /** Extra opacity on top of the tier default. */
  fade?: number;
  glow?: number;
  /** Small looping drift: whole cycles over the composition. */
  driftCycles: number;
  driftPhase: number;
  driftRadius: number;
};

export type ConnectorSpec = {
  from: string;
  to: string;
  tier: number;
  /** Paint order, back to front; see NodeSpec.layer. */
  layer?: number;
  /** Perpendicular bow of the sweep (V1 only). */
  bow?: number;
  sway?: number;
  /** Right-angle routing (V2 only). */
  mode?: OrthoMode;
  split?: number;
  width: number;
  /** Preferred dash period in board units; snapped to fit the path. */
  dash: number;
  /** Fraction of the period that is ink. */
  dashRatio?: number;
  /**
   * Whole dash periods travelled over the whole composition. Integer, so
   * the march is seamless at the loop point; negative reverses it.
   */
  march: number;
  /** Travelling dots: whole trips over the composition. */
  dots?: { count: number; trips: number; phase: number; radius?: number };
  /** Positions along the path (0-1) for direction chevrons. */
  chevrons?: number[];
  /** Round terminals, as in the reference's schematic runs. */
  caps?: boolean;
  color?: string;
  fade?: number;
};

export type Scene = {
  nodes: NodeSpec[];
  connectors: ConnectorSpec[];
  /** Curved sweeps (V1) or right-angle schematic runs (V2). */
  routing: "curved" | "ortho";
};

/** A connector with its geometry and per-frame constants precomputed. */
export type ResolvedConnector = {
  spec: ConnectorSpec;
  geom: PathGeom;
  /** Bounding box of the connector's own <svg>, in board units. */
  box: { x: number; y: number; width: number; height: number };
  dashLength: number;
  gapLength: number;
  period: number;
};

/**
 * Arrivals a node receives, so it can brighten as each dot lands. Filled
 * in from the connector list rather than declared twice.
 */
export type Arrival = { trips: number; phase: number };

export type ResolvedScene = {
  nodes: NodeSpec[];
  byId: Map<string, NodeSpec>;
  connectors: ResolvedConnector[];
  arrivals: Map<string, Arrival[]>;
  routing: Scene["routing"];
};

/**
 * Turns the declarative scene into geometry.
 *
 * Runs once per scene at module scope -- not per frame, and never inside
 * a component that a render thread might evaluate at a different time.
 */
export const resolveScene = (scene: Scene): ResolvedScene => {
  const byId = new Map(scene.nodes.map((n) => [n.id, n]));

  const connectors: ResolvedConnector[] = scene.connectors.map((spec) => {
    const a = byId.get(spec.from);
    const b = byId.get(spec.to);
    if (!a || !b) {
      throw new Error(`Connector references unknown node: ${spec.from} -> ${spec.to}`);
    }
    const from = { x: a.x, y: a.y };
    const to = { x: b.x, y: b.y };

    const geom =
      scene.routing === "curved"
        ? curve(from, to, spec.bow ?? 0, spec.sway ?? 0)
        : ortho(from, to, spec.mode ?? "HV", spec.split ?? 0.5);

    // Snap the dash period so a whole number of dashes spans the path.
    const repeats = Math.max(2, Math.round(geom.length / spec.dash));
    const period = geom.length / repeats;
    const ratio = spec.dashRatio ?? 0.42;

    return {
      spec,
      geom,
      box: boundsOf(geom, Math.max(spec.width * 6, 90)),
      dashLength: period * ratio,
      gapLength: period * (1 - ratio),
      period,
    };
  });

  const arrivals = new Map<string, Arrival[]>();
  for (const c of connectors) {
    if (!c.spec.dots) continue;
    const { count, trips, phase } = c.spec.dots;
    const list = arrivals.get(c.spec.to) ?? [];
    for (let i = 0; i < count; i++) {
      list.push({ trips, phase: phase + i / count });
    }
    arrivals.set(c.spec.to, list);
  }

  return { nodes: scene.nodes, byId, connectors, arrivals, routing: scene.routing };
};
