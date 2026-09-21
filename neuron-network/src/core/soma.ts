/**
 * Soma geometry.
 *
 * An icosphere with noise displacement for surface irregularity: heavy and
 * high-frequency for look 1A's matted, almost fibrous cell body; low-detail
 * and flat-shaded for 1B's faceted crystal; near-zero for 2B and look 5.
 *
 * All somas in a field merge into one BufferGeometry -- one draw call.
 */

import {
  BufferAttribute,
  BufferGeometry,
  IcosahedronGeometry,
  Vector3,
} from "three";
import { fbm, makeNoise3D, type Noise3D } from "./noise";
import { mulberry32 } from "./random";
import type { Neuron } from "./types";

export type SomaStyle = {
  /** Icosphere subdivision for a full-detail soma. */
  detail: number;
  /** Displacement as a fraction of the radius. */
  displacement: number;
  /** Spatial frequency of the displacement. */
  frequency: number;
  /** Octaves of fbm; more reads as grain, fewer as broad lumps. */
  octaves: number;
  /** Flat-shade the facets instead of smoothing them. */
  faceted: boolean;
};

export const buildSomaGeometry = (
  neurons: Neuron[],
  style: SomaStyle,
  seed: number,
): { geometry: BufferGeometry; triangleCount: number } => {
  const noise = makeNoise3D(mulberry32(seed));
  const positions: number[] = [];
  const normals: number[] = [];
  /** x = idle glow phase, y = surface noise -1..1, z = per-cell brightness */
  const attrs: number[] = [];

  const dir = new Vector3();
  const tangentA = new Vector3();
  const tangentB = new Vector3();
  const probeA = new Vector3();
  const probeB = new Vector3();
  const edgeA = new Vector3();
  const edgeB = new Vector3();
  const normal = new Vector3();

  neurons.forEach((neuron, neuronIndex) => {
    const detail = style.faceted
      ? Math.max(1, style.detail - 2)
      : Math.max(1, Math.round(style.detail * neuron.detail));
    // IcosahedronGeometry is already non-indexed, one triangle per face.
    const geo = new IcosahedronGeometry(neuron.somaRadius, detail);
    const pos = geo.getAttribute("position");

    const offset = new Vector3(
      neuronIndex * 11.3,
      neuronIndex * 7.1,
      neuronIndex * 3.7,
    );

    /** Displaced radius in the direction `d`. */
    const radiusAt = (d: Vector3, n: Noise3D) =>
      neuron.somaRadius *
      (1 +
        style.displacement *
          fbm(
            n,
            d.x * style.frequency + offset.x,
            d.y * style.frequency + offset.y,
            d.z * style.frequency + offset.z,
            style.octaves,
          ));

    const displaced = new Float32Array(pos.count * 3);
    const smoothNormals = new Float32Array(pos.count * 3);
    const noiseValues = new Float32Array(pos.count);
    const eps = 0.02;

    for (let i = 0; i < pos.count; i++) {
      dir.set(pos.getX(i), pos.getY(i), pos.getZ(i)).normalize();

      const n = fbm(
        noise,
        dir.x * style.frequency + offset.x,
        dir.y * style.frequency + offset.y,
        dir.z * style.frequency + offset.z,
        style.octaves,
      );
      noiseValues[i] = n;
      const r = neuron.somaRadius * (1 + style.displacement * n);

      displaced[i * 3] = neuron.center.x + dir.x * r;
      displaced[i * 3 + 1] = neuron.center.y + dir.y * r;
      displaced[i * 3 + 2] = neuron.center.z + dir.z * r;

      // Smooth normals by finite difference on the displacement field.
      // three's computeVertexNormals would give flat per-triangle normals
      // here, because the icosphere has no shared vertices to average over.
      tangentA
        .set(Math.abs(dir.x) < 0.9 ? 1 : 0, Math.abs(dir.x) < 0.9 ? 0 : 1, 0)
        .cross(dir)
        .normalize();
      tangentB.copy(dir).cross(tangentA).normalize();

      probeA.copy(dir).addScaledVector(tangentA, eps).normalize();
      probeB.copy(dir).addScaledVector(tangentB, eps).normalize();

      edgeA
        .copy(probeA)
        .multiplyScalar(radiusAt(probeA, noise))
        .sub(dir.clone().multiplyScalar(r));
      edgeB
        .copy(probeB)
        .multiplyScalar(radiusAt(probeB, noise))
        .sub(dir.clone().multiplyScalar(r));

      normal.copy(edgeA).cross(edgeB).normalize();
      if (normal.dot(dir) < 0) normal.negate();
      if (!Number.isFinite(normal.x)) normal.copy(dir);

      smoothNormals[i * 3] = normal.x;
      smoothNormals[i * 3 + 1] = normal.y;
      smoothNormals[i * 3 + 2] = normal.z;
    }

    let faceNormals: Float32Array | null = null;
    if (style.faceted) {
      // Flat facets: one normal per triangle, which is what makes the
      // crystalline look read as cut rather than merely bumpy.
      faceNormals = new Float32Array(pos.count * 3);
      for (let t = 0; t < pos.count; t += 3) {
        edgeA
          .set(displaced[(t + 1) * 3], displaced[(t + 1) * 3 + 1], displaced[(t + 1) * 3 + 2])
          .sub(new Vector3(displaced[t * 3], displaced[t * 3 + 1], displaced[t * 3 + 2]));
        edgeB
          .set(displaced[(t + 2) * 3], displaced[(t + 2) * 3 + 1], displaced[(t + 2) * 3 + 2])
          .sub(new Vector3(displaced[t * 3], displaced[t * 3 + 1], displaced[t * 3 + 2]));
        normal.copy(edgeA).cross(edgeB).normalize();
        for (let k = 0; k < 3; k++) {
          faceNormals[(t + k) * 3] = normal.x;
          faceNormals[(t + k) * 3 + 1] = normal.y;
          faceNormals[(t + k) * 3 + 2] = normal.z;
        }
      }
    }

    const useNormals = faceNormals ?? smoothNormals;
    for (let i = 0; i < pos.count; i++) {
      positions.push(
        displaced[i * 3],
        displaced[i * 3 + 1],
        displaced[i * 3 + 2],
      );
      normals.push(
        useNormals[i * 3],
        useNormals[i * 3 + 1],
        useNormals[i * 3 + 2],
      );
      attrs.push(neuron.somaPhase, noiseValues[i], neuron.detail);
    }

    geo.dispose();
  });

  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(new Float32Array(positions), 3),
  );
  geometry.setAttribute(
    "normal",
    new BufferAttribute(new Float32Array(normals), 3),
  );
  geometry.setAttribute("aSoma", new BufferAttribute(new Float32Array(attrs), 3));
  geometry.computeBoundingSphere();

  return { geometry, triangleCount: positions.length / 9 };
};
