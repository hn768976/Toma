/**
 * The recursive branching generator.
 *
 * This runs once per look, at build time, from a seeded RNG. Every look in
 * the project is this same algorithm under different parameters -- adding a
 * look never touches this file.
 */

import { Vector3 } from "three";
import { mulberry32, range, rangeInt, type Rng } from "./random";
import type { Branch, Neuron, TreePulse } from "./types";

export type GrowParams = {
  /** Number of primary dendrites leaving the soma. */
  primariesMin: number;
  primariesMax: number;
  /** Chance per segment of ending the branch in a two-way split. */
  branchProbability: number;
  maxDepth: number;
  /** Segment length multiplier applied at each generation. */
  lengthDecay: number;
  /** Growth stops below this radius. Expressed as a fraction of baseRadius. */
  minRadiusFraction: number;
  /** Radius of a primary dendrite where it leaves the soma. */
  baseRadius: number;
  /** Length of one segment of a primary dendrite. */
  baseLength: number;
  /** Segments grown before a branch is forced to split or continue. */
  maxSegmentsPerBranch: number;
  /** Per-segment wander, radians. */
  wanderAngle: number;
  /** Half-angle of a split, radians. */
  branchAngle: number;
  /** Continuous thinning applied along a branch, per segment. */
  segmentTaper: number;
  /**
   * Leonardo's exponent. r_parent^n = sum(r_child^n). At n = 2.5 a symmetric
   * split keeps 76% of the radius; a flat 0.7 multiplier thins far too fast
   * and the result reads as a tree diagram rather than a cell.
   */
  radiusExponent: number;
  /** How strongly branches are pushed away from the soma, 0..1. */
  outwardBias: number;
  /** Hard ceiling on branches per neuron, so dense looks stay renderable. */
  maxBranches: number;
  somaRadius: number;
};

type PendingBranch = {
  points: Vector3[];
  radii: number[];
  arc: number[];
  depth: number;
  treeIndex: number;
  startIsJunction: boolean;
  endIsJunction: boolean;
  segLength: number;
};

/** A unit vector perpendicular to `v`, chosen deterministically. */
const perpendicular = (v: Vector3, out: Vector3) => {
  const ref =
    Math.abs(v.x) < 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0);
  return out.copy(ref).cross(v).normalize();
};

/** Rotate `dir` by `angle` around an axis perpendicular to it, chosen by `roll`. */
const deflect = (dir: Vector3, angle: number, roll: number) => {
  const axis = perpendicular(dir, new Vector3());
  axis.applyAxisAngle(dir, roll);
  return dir.clone().applyAxisAngle(axis, angle).normalize();
};

/** Evenly spread unit vectors on a sphere (Fibonacci), then jittered. */
const primaryDirections = (count: number, rng: Rng): Vector3[] => {
  const dirs: Vector3[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  const spin = rng() * Math.PI * 2;
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / Math.max(1, count - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i + spin;
    const d = new Vector3(Math.cos(theta) * r, y, Math.sin(theta) * r);
    dirs.push(deflect(d.normalize(), range(rng, 0, 0.35), rng() * Math.PI * 2));
  }
  return dirs;
};

export const growNeuron = (
  params: GrowParams,
  center: Vector3,
  seed: number,
  depthLimitOverride?: number,
): Omit<Neuron, "trees" | "somaPhase" | "detail"> => {
  const rng = mulberry32(seed);
  const maxDepth = depthLimitOverride ?? params.maxDepth;
  const minRadius = params.baseRadius * params.minRadiusFraction;
  const pending: PendingBranch[] = [];
  const junctions: Vector3[] = [];

  type Task = {
    point: Vector3;
    dir: Vector3;
    radius: number;
    segLength: number;
    depth: number;
    treeIndex: number;
    arc: number;
    startIsJunction: boolean;
  };

  // Breadth-first, so when the branch budget runs out it runs out at a
  // uniform depth across the whole cell. Depth-first growth spends the
  // whole budget on the first dendrite and leaves the rest stunted.
  const queue: Task[] = [];

  const growOne = (task: Task) => {
    const points: Vector3[] = [task.point.clone()];
    const radii: number[] = [task.radius];
    const arc: number[] = [task.arc];

    let p = task.point.clone();
    let dir = task.dir.clone().normalize();
    let r = task.radius;
    let a = task.arc;
    let split = false;

    for (let i = 0; i < params.maxSegmentsPerBranch; i++) {
      // Wander, then bias back outward so dendrites radiate rather than curl.
      dir = deflect(
        dir,
        range(rng, -params.wanderAngle, params.wanderAngle),
        rng() * Math.PI * 2,
      );
      const outward = p.clone().sub(center);
      if (outward.lengthSq() > 1e-6) {
        dir.addScaledVector(outward.normalize(), params.outwardBias).normalize();
      }

      p = p.clone().addScaledVector(dir, task.segLength);
      r *= params.segmentTaper;
      a += task.segLength;
      points.push(p.clone());
      radii.push(r);
      arc.push(a);

      if (
        task.depth < maxDepth &&
        r > minRadius &&
        rng() < params.branchProbability
      ) {
        split = true;
        break;
      }
    }

    const alive = task.depth < maxDepth && r > minRadius;

    pending.push({
      points,
      radii,
      arc,
      depth: task.depth,
      treeIndex: task.treeIndex,
      startIsJunction: task.startIsJunction,
      endIsJunction: split && alive,
      segLength: task.segLength,
    });

    if (!alive) return;

    if (split) {
      // Leonardo's rule: the two children share the parent's cross-section.
      // A flat 0.7 multiplier thins far too fast and reads as a tree diagram.
      const f = range(rng, 0.38, 0.62);
      const n = params.radiusExponent;
      const roll = rng() * Math.PI * 2;
      const spread = params.branchAngle * range(rng, 0.7, 1.3);
      const nextLen = task.segLength * params.lengthDecay;
      junctions.push(p.clone());
      queue.push({
        point: p.clone(),
        dir: deflect(dir, spread, roll),
        radius: r * Math.pow(f, 1 / n),
        segLength: nextLen,
        depth: task.depth + 1,
        treeIndex: task.treeIndex,
        arc: a,
        startIsJunction: true,
      });
      queue.push({
        point: p.clone(),
        dir: deflect(dir, -spread, roll),
        radius: r * Math.pow(1 - f, 1 / n),
        segLength: nextLen,
        depth: task.depth + 1,
        treeIndex: task.treeIndex,
        arc: a,
        startIsJunction: true,
      });
    } else {
      queue.push({
        point: p.clone(),
        dir: dir.clone(),
        radius: r * 0.98,
        segLength: task.segLength * params.lengthDecay,
        depth: task.depth + 1,
        treeIndex: task.treeIndex,
        arc: a,
        startIsJunction: false,
      });
    }
  };

  const primaries = rangeInt(rng, params.primariesMin, params.primariesMax);
  const dirs = primaryDirections(primaries, rng);
  dirs.forEach((dir, treeIndex) => {
    // Seat the base inside the soma so there is no visible join. The emissive
    // glow hides the overlap; a boolean union would cost build time for nothing.
    queue.push({
      point: center.clone().addScaledVector(dir, params.somaRadius * 0.35),
      dir,
      radius: params.baseRadius * range(rng, 0.85, 1.15),
      segLength: params.baseLength * range(rng, 0.85, 1.15),
      depth: 0,
      treeIndex,
      arc: 0,
      startIsJunction: false,
    });
  });

  let head = 0;
  while (head < queue.length && pending.length < params.maxBranches) {
    growOne(queue[head++]);
  }

  // Normalise arc length per primary dendrite, so a pulse at position t sits
  // at the same fraction of the way to the tip on every sub-branch. A single
  // pulse then fans out through the tree the way a real signal front does.
  const treeMax = new Map<number, number>();
  for (const b of pending) {
    const end = b.arc[b.arc.length - 1];
    treeMax.set(b.treeIndex, Math.max(treeMax.get(b.treeIndex) ?? 0, end));
  }

  const branches: Branch[] = pending.map((b) => {
    const max = Math.max(1e-6, treeMax.get(b.treeIndex) ?? 1);
    const arcNorm = b.arc.map((v) => v / max);

    // Junction proximity, measured along the branch rather than in 3D, so
    // this stays O(points). Drives look 5's nodes, look 4's flashes and
    // look 3A's flare as a pulse passes.
    const sigma = Math.max(1e-6, b.segLength * 0.55);
    const startArc = b.arc[0];
    const endArc = b.arc[b.arc.length - 1];
    const junction = b.arc.map((v) => {
      let j = 0;
      if (b.startIsJunction) {
        const d = (v - startArc) / sigma;
        j = Math.max(j, Math.exp(-0.5 * d * d));
      }
      if (b.endIsJunction) {
        const d = (v - endArc) / sigma;
        j = Math.max(j, Math.exp(-0.5 * d * d));
      }
      return j;
    });

    return {
      points: b.points,
      radii: b.radii,
      arcNorm,
      junction,
      depth: b.depth,
      treeIndex: b.treeIndex,
    };
  });

  return { center, somaRadius: params.somaRadius, branches, junctions };
};

/**
 * Pulse parameters for one primary dendrite.
 *
 * Traversal counts are integers so a pulse is exactly back where it started
 * at the end of the loop. `slots` chooses how many pulses ride the branch at
 * once and `counts` how fast each travels.
 */
export const makeTreePulse = (
  rng: Rng,
  slots: number,
  counts: readonly number[],
  amplitude: number,
): TreePulse => {
  const c: [number, number, number] = [1, 1, 1];
  const o: [number, number, number] = [0, 0, 0];
  const a: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    if (i < slots) {
      c[i] = counts[Math.floor(rng() * counts.length) % counts.length];
      o[i] = rng();
      a[i] = amplitude * range(rng, 0.75, 1.25);
    }
  }
  return { counts: c, offsets: o, amps: a };
};
