import type { Vector3 } from "three";

/** One grown dendrite: a polyline with a radius and pulse data per point. */
export type Branch = {
  points: Vector3[];
  /** Radius at each point. Tapers along the branch and across generations. */
  radii: number[];
  /**
   * Distance from the soma to each point, measured along the path through
   * this branch's ancestors. Normalised by the owning primary dendrite's
   * longest root-to-tip path, so 0 is the soma and 1 the furthest tip.
   */
  arcNorm: number[];
  /** Proximity to the nearest branch junction, 0..1, per point. */
  junction: number[];
  /** Recursion depth, 0 for a primary dendrite. */
  depth: number;
  /** Index of the primary dendrite this branch descends from. */
  treeIndex: number;
};

export type Neuron = {
  center: Vector3;
  somaRadius: number;
  branches: Branch[];
  /** World positions of every branch split, for spark sprites. */
  junctions: Vector3[];
  /** Per-primary-dendrite pulse traversal counts and phase offsets. */
  trees: TreePulse[];
  /** Phase offset for this soma's idle glow. */
  somaPhase: number;
  /** 1 for foreground neurons, lower for blurred background ones. */
  detail: number;
};

/** Pulse parameters for one primary dendrite. Up to three simultaneous. */
export type TreePulse = {
  /** Complete traversals over the loop. Integers, so the loop closes. */
  counts: [number, number, number];
  /** Phase offsets in 0..1. */
  offsets: [number, number, number];
  /** Per-pulse amplitude; 0 disables that slot. */
  amps: [number, number, number];
};

export type Particle = {
  center: Vector3;
  amp: Vector3;
  /** Integer Lissajous frequencies, so particle paths close over the loop. */
  freq: Vector3;
  phase: Vector3;
  size: number;
  brightness: number;
};

export type Field = {
  neurons: Neuron[];
  particles: Particle[];
  /** Diagnostics reported in the README and the build log. */
  stats: {
    neuronCount: number;
    branchCount: number;
    segmentCount: number;
    tubeVertexCount: number;
    tubeTriangleCount: number;
    somaTriangleCount: number;
    particleCount: number;
    sparkCount: number;
    junctionCount: number;
  };
};
