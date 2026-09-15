// Picks spawn points for particle effects off the arch itself.
//
// Bubbles that rise from nowhere look like a screensaver. Sampling real
// vertices means a cleaning bubble leaves the exact enamel surface it is
// scrubbing, and a gum-line effect sits in the sulcus where calculus
// actually forms. The baked attributes make the filtering trivial: aBand
// says whether a vertex is on a tooth, aGumT how far above the margin.

import { BufferAttribute, BufferGeometry } from "three";
import { mulberry32 } from "./random";

export type SurfaceRegion =
  /** Crown surfaces, above the margin. */
  | "teeth"
  /** The narrow band either side of the gum margin. */
  | "gumline"
  /** Gingiva below the margin. */
  | "gum"
  /** Interproximal and fissure spaces, found via baked occlusion. */
  | "crevice"
  | "all";

export type SurfaceSamples = {
  positions: Float32Array;
  normals: Float32Array;
  /** Arch angle of each sample, for gating emission behind a sweep. */
  thetas: Float32Array;
  count: number;
};

const CROWN = 0.146;

const accepts = (
  region: SurfaceRegion,
  gumT: number,
  band: number,
  ao: number,
): boolean => {
  switch (region) {
    case "teeth":
      return band > 0.6 && gumT > CROWN * 0.08;
    case "gumline":
      return band > 0.35 && gumT > -CROWN * 0.22 && gumT < CROWN * 0.3;
    case "gum":
      return band < 0.5 && gumT < 0;
    case "crevice":
      return ao < 0.45 && gumT > -CROWN * 0.4;
    default:
      return true;
  }
};

export const sampleSurface = (
  geometry: BufferGeometry,
  region: SurfaceRegion,
  count: number,
  seed: number,
): SurfaceSamples => {
  const position = geometry.getAttribute("position") as BufferAttribute;
  const normal = geometry.getAttribute("normal") as BufferAttribute;
  const gumT = geometry.getAttribute("aGumT") as BufferAttribute;
  const theta = geometry.getAttribute("aTheta") as BufferAttribute;
  const band = geometry.getAttribute("aBand") as BufferAttribute;
  const ao = geometry.getAttribute("aAo") as BufferAttribute;

  const total = position.count;
  const rand = mulberry32(seed);

  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const thetas = new Float32Array(count);

  // Rejection sampling over vertices. The mesh is uniform enough after
  // subdivision that vertex density stands in for surface area.
  let written = 0;
  let attempts = 0;
  const limit = count * 400;
  while (written < count && attempts < limit) {
    attempts++;
    const i = Math.floor(rand() * total);
    if (!accepts(region, gumT.getX(i), band.getX(i), ao.getX(i))) {
      continue;
    }
    positions[written * 3] = position.getX(i);
    positions[written * 3 + 1] = position.getY(i);
    positions[written * 3 + 2] = position.getZ(i);
    normals[written * 3] = normal.getX(i);
    normals[written * 3 + 1] = normal.getY(i);
    normals[written * 3 + 2] = normal.getZ(i);
    thetas[written] = theta.getX(i);
    written++;
  }

  if (written === 0) {
    throw new Error(
      `sampleSurface found no vertices for region "${region}" after ${attempts} attempts`,
    );
  }
  // If the region was tight, tile what we found rather than leaving holes.
  for (let i = written; i < count; i++) {
    const src = i % written;
    positions.copyWithin(i * 3, src * 3, src * 3 + 3);
    normals.copyWithin(i * 3, src * 3, src * 3 + 3);
    thetas[i] = thetas[src];
  }

  return { positions, normals, thetas, count };
};
