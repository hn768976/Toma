/**
 * Tube geometry with a radius that varies along the curve.
 *
 * `TubeGeometry` cannot do this -- it sweeps a single constant radius -- so
 * the rings are built by hand: walk the curve, emit a ring of vertices at
 * each step using that step's radius, and stitch consecutive rings.
 *
 * Every branch of every neuron accumulates into ONE set of arrays, so the
 * whole dendrite field is a single BufferGeometry and a single draw call.
 * As separate meshes a ten-neuron field would be thousands of draw calls.
 */

import { BufferAttribute, BufferGeometry, CatmullRomCurve3, Vector3 } from "three";
import type { Field, Neuron } from "./types";

class TubeAccumulator {
  position: number[] = [];
  normal: number[] = [];
  /** x = arc 0..1 from soma, y = radius 0..1, z = junction proximity, w = junction phase */
  misc: number[] = [];
  pulseN: number[] = [];
  pulseOff: number[] = [];
  pulseAmp: number[] = [];
  index: number[] = [];
  vertexCount = 0;
}

const TMP_AXIS = new Vector3();
const TMP_A = new Vector3();
const TMP_B = new Vector3();

const perpendicular = (v: Vector3, out: Vector3) => {
  const ref = Math.abs(v.x) < 0.9 ? TMP_A.set(1, 0, 0) : TMP_A.set(0, 1, 0);
  return out.copy(ref).cross(v).normalize();
};

/** Radial resolution scales with how thick the branch actually is. */
const radialFor = (radius: number, baseRadius: number, cap: number) => {
  const f = radius / baseRadius;
  if (f > 0.55) return Math.min(cap, 12);
  if (f > 0.3) return Math.min(cap, 9);
  if (f > 0.15) return Math.min(cap, 6);
  if (f > 0.07) return Math.min(cap, 5);
  return Math.min(cap, 3);
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const sweepBranch = (
  acc: TubeAccumulator,
  points: Vector3[],
  radii: number[],
  arcNorm: number[],
  junction: number[],
  junctionPhase: number,
  pulse: { counts: number[]; offsets: number[]; amps: number[] },
  radialSegments: number,
  subdivisions: number,
  myelin: { amplitude: number; period: number } | null,
  baseRadius: number,
) => {
  if (points.length < 2) return;

  const curve = new CatmullRomCurve3(points, false, "centripetal", 0.5);
  const steps = Math.max(2, (points.length - 1) * subdivisions);
  const ringCount = steps + 1;

  const positions: Vector3[] = [];
  const tangents: Vector3[] = [];
  const scalars: { r: number; a: number; j: number }[] = [];

  let localArc = 0;
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const point = curve.getPoint(u);
    if (i > 0) localArc += point.distanceTo(positions[i - 1]);
    positions.push(point);
    tangents.push(curve.getTangent(u).normalize());

    const f = u * (points.length - 1);
    const i0 = Math.min(points.length - 2, Math.max(0, Math.floor(f)));
    const frac = f - i0;
    let r = lerp(radii[i0], radii[i0 + 1], frac);
    if (myelin) {
      // Repeating collars rather than a smooth tube: a narrow periodic
      // swelling along the branch, read as myelin segments.
      const w = 0.5 + 0.5 * Math.cos((localArc / myelin.period) * Math.PI * 2);
      r *= 1 + myelin.amplitude * w * w;
    }
    scalars.push({
      r,
      a: lerp(arcNorm[i0], arcNorm[i0 + 1], frac),
      j: lerp(junction[i0], junction[i0 + 1], frac),
    });
  }

  // Parallel-transport frame: carry the normal along the curve by the
  // minimal rotation between consecutive tangents, so the tube does not
  // spin at inflection points the way a Frenet frame does.
  const normals: Vector3[] = [];
  normals.push(perpendicular(tangents[0], new Vector3()));
  for (let i = 1; i < ringCount; i++) {
    const prev = normals[i - 1].clone();
    TMP_AXIS.copy(tangents[i - 1]).cross(tangents[i]);
    const sin = TMP_AXIS.length();
    if (sin > 1e-7) {
      const cos = Math.min(1, Math.max(-1, tangents[i - 1].dot(tangents[i])));
      prev.applyAxisAngle(TMP_AXIS.normalize(), Math.atan2(sin, cos));
    }
    // Re-orthogonalise against the tangent to stop drift accumulating.
    TMP_B.copy(tangents[i]).multiplyScalar(prev.dot(tangents[i]));
    prev.sub(TMP_B).normalize();
    normals.push(prev);
  }

  const base = acc.vertexCount;
  const binormal = new Vector3();

  for (let i = 0; i < ringCount; i++) {
    const p = positions[i];
    const n = normals[i];
    binormal.copy(tangents[i]).cross(n).normalize();
    const { r, a, j } = scalars[i];

    for (let k = 0; k < radialSegments; k++) {
      const theta = (k / radialSegments) * Math.PI * 2;
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);
      const nx = n.x * cos + binormal.x * sin;
      const ny = n.y * cos + binormal.y * sin;
      const nz = n.z * cos + binormal.z * sin;

      acc.position.push(p.x + nx * r, p.y + ny * r, p.z + nz * r);
      acc.normal.push(nx, ny, nz);
      acc.misc.push(a, Math.min(1, r / baseRadius), j, junctionPhase);
      acc.pulseN.push(pulse.counts[0], pulse.counts[1], pulse.counts[2]);
      acc.pulseOff.push(pulse.offsets[0], pulse.offsets[1], pulse.offsets[2]);
      acc.pulseAmp.push(pulse.amps[0], pulse.amps[1], pulse.amps[2]);
      acc.vertexCount++;
    }
  }

  for (let i = 0; i < ringCount - 1; i++) {
    const a0 = base + i * radialSegments;
    const b0 = base + (i + 1) * radialSegments;
    for (let k = 0; k < radialSegments; k++) {
      const k1 = (k + 1) % radialSegments;
      acc.index.push(a0 + k, b0 + k, a0 + k1);
      acc.index.push(a0 + k1, b0 + k, b0 + k1);
    }
  }
};

export type TubeBuildOptions = {
  /** Upper bound on radial resolution; lowered for very dense looks. */
  radialCap: number;
  /** Curve samples per source point. */
  subdivisions: number;
  /** Radius a primary dendrite starts at, used to scale radial resolution. */
  baseRadius: number;
  /** Ring-shaped thickenings, applied to a fraction of the branches. */
  myelinAmplitude: number;
  myelinPeriod: number;
  myelinFraction: number;
};

export const buildTubeGeometry = (
  neurons: Neuron[],
  options: TubeBuildOptions,
): { geometry: BufferGeometry; stats: Pick<Field["stats"], "tubeVertexCount" | "tubeTriangleCount" | "branchCount" | "segmentCount"> } => {
  const acc = new TubeAccumulator();
  let branchCount = 0;
  let segmentCount = 0;

  for (const neuron of neurons) {
    // Background neurons carry fewer curve samples -- they are blurred past
    // recognition and full detail there is wasted render time.
    const subdiv = Math.max(1, Math.round(options.subdivisions * neuron.detail));
    const cap = Math.max(3, Math.round(options.radialCap * neuron.detail));

    for (const branch of neuron.branches) {
      const pulse = neuron.trees[branch.treeIndex % neuron.trees.length];
      const radial = radialFor(branch.radii[0], options.baseRadius, cap);
      sweepBranch(
        acc,
        branch.points,
        branch.radii,
        branch.arcNorm,
        branch.junction,
        // Deterministic per-branch phase for look 4's junction flashes.
        ((branch.treeIndex * 7919 + branch.depth * 104729 + branchCount * 13) %
          628) / 100,
        pulse,
        radial,
        subdiv,
        options.myelinAmplitude > 0 &&
          (branchCount * 2654435761) % 1000 < options.myelinFraction * 1000
          ? { amplitude: options.myelinAmplitude, period: options.myelinPeriod }
          : null,
        options.baseRadius,
      );
      branchCount++;
      segmentCount += branch.points.length - 1;
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(new Float32Array(acc.position), 3),
  );
  geometry.setAttribute(
    "normal",
    new BufferAttribute(new Float32Array(acc.normal), 3),
  );
  geometry.setAttribute("aMisc", new BufferAttribute(new Float32Array(acc.misc), 4));
  geometry.setAttribute(
    "aPulseN",
    new BufferAttribute(new Float32Array(acc.pulseN), 3),
  );
  geometry.setAttribute(
    "aPulseOff",
    new BufferAttribute(new Float32Array(acc.pulseOff), 3),
  );
  geometry.setAttribute(
    "aPulseAmp",
    new BufferAttribute(new Float32Array(acc.pulseAmp), 3),
  );
  geometry.setIndex(new BufferAttribute(new Uint32Array(acc.index), 1));
  geometry.computeBoundingSphere();

  return {
    geometry,
    stats: {
      tubeVertexCount: acc.vertexCount,
      tubeTriangleCount: acc.index.length / 3,
      branchCount,
      segmentCount,
    },
  };
};
