// Cell and virion builders.
//
// Geometry is deliberately shared: a scene makes a handful of variants and
// then instances them at different scales and orientations, so a shot with
// forty microbes still only uploads four meshes worth of vertices.
//
// Only three's built-in materials appear here. See createRenderer.ts for why.

import {
  AdditiveBlending,
  BackSide,
  Color,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
  type Texture,
} from "three";
import { createNoise3D, fbm } from "./noise";
import { mulberry32 } from "./rng";

export interface CellGeometryOptions {
  radius?: number;
  /** Longitude segments; latitude is half this. Drives silhouette detail. */
  segments?: number;
  seed: number;
  /** How far the surface pushes in and out, as a fraction of the radius. */
  lumpiness?: number;
  /** Noise frequency. Low is a few broad lobes, high is a knobbly morula. */
  frequency?: number;
  /** Ridged noise gives creases and folds instead of soft swells. */
  ridged?: boolean;
}

/**
 * A sphere pushed around by noise. Vertices are displaced purely as a function
 * of their direction from the centre, so the duplicated seam and pole vertices
 * all move together and the surface never tears.
 */
export const makeCellGeometry = ({
  radius = 1,
  segments = 96,
  seed,
  lumpiness = 0.12,
  frequency = 2.2,
  ridged = false,
}: CellGeometryOptions): BufferGeometry => {
  const geometry = new SphereGeometry(radius, segments, Math.max(8, segments >> 1));
  const noise = createNoise3D(seed);
  const position = geometry.attributes.position;
  const v = new Vector3();

  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i).normalize();
    let d = fbm(noise, v.x * frequency, v.y * frequency, v.z * frequency, 4, 2.1, 0.5);
    if (ridged) d = 1 - Math.abs(d) * 2;
    const r = radius * (1 + lumpiness * d);
    position.setXYZ(i, v.x * r, v.y * r, v.z * r);
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
};

export interface CellMaterialOptions {
  color: string | number;
  emissive?: string | number;
  emissiveIntensity?: number;
  roughness?: number;
  metalness?: number;
  bumpMap?: Texture | null;
  bumpScale?: number;
  opacity?: number;
  flatShading?: boolean;
}

export const makeCellMaterial = ({
  color,
  emissive = 0x000000,
  emissiveIntensity = 1,
  roughness = 0.62,
  metalness = 0,
  bumpMap = null,
  bumpScale = 0.35,
  opacity = 1,
  flatShading = false,
}: CellMaterialOptions) =>
  new MeshStandardMaterial({
    color: new Color(color),
    emissive: new Color(emissive),
    emissiveIntensity,
    roughness,
    metalness,
    bumpMap,
    bumpScale,
    transparent: opacity < 1,
    opacity,
    flatShading,
  });

/**
 * Back-facing additive shell that fakes the light bleeding through a
 * translucent membrane. Cheap, and it survives every renderer tier.
 *
 * Keep the scale generous. A shell only a per cent or two larger than the body
 * shows up as a hard drawn outline, because the sliver of it that escapes
 * occlusion is at full strength everywhere. Pushing it out and dropping the
 * opacity spreads that sliver into something that reads as glow.
 */
export const makeRimGlow = (
  geometry: BufferGeometry,
  color: string | number,
  opacity = 0.16,
  scale = 1.15,
) => {
  const mesh = new Mesh(
    geometry,
    new MeshBasicMaterial({
      color: new Color(color),
      transparent: true,
      opacity,
      blending: AdditiveBlending,
      side: BackSide,
      depthWrite: false,
      fog: false,
    }),
  );
  mesh.scale.setScalar(scale);
  return mesh;
};

/**
 * Evenly spread points over a sphere. Used for virion spikes, where a random
 * scatter would clump and read as damage rather than as a regular capsid.
 */
export const fibonacciSphere = (count: number): Vector3[] => {
  const points: Vector3[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / Math.max(1, count - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    points.push(new Vector3(Math.cos(theta) * r, y, Math.sin(theta) * r));
  }
  return points;
};

export interface VirionOptions {
  radius?: number;
  seed: number;
  spikeCount?: number;
  spikeLength?: number;
  spikeRadius?: number;
  coreColor: string | number;
  spikeColor: string | number;
  emissive?: string | number;
  emissiveIntensity?: number;
  bumpMap?: Texture | null;
  coreSegments?: number;
  glow?: { color: string | number; opacity: number } | null;
}

/**
 * A studded virion: lumpy capsid plus a ring of knobbed spikes carried on a
 * single InstancedMesh, which keeps the dense flythrough shot affordable.
 */
export const makeVirion = ({
  radius = 1,
  seed,
  spikeCount = 90,
  spikeLength = 0.17,
  spikeRadius = 0.075,
  coreColor,
  spikeColor,
  emissive = 0x000000,
  emissiveIntensity = 1,
  bumpMap = null,
  coreSegments = 72,
  glow = null,
}: VirionOptions): Group => {
  const group = new Group();

  const coreGeometry = makeCellGeometry({
    radius,
    segments: coreSegments,
    seed,
    lumpiness: 0.075,
    frequency: 3.4,
  });
  const core = new Mesh(
    coreGeometry,
    makeCellMaterial({
      color: coreColor,
      emissive,
      emissiveIntensity,
      roughness: 0.55,
      bumpMap,
      bumpScale: 0.22,
    }),
  );
  group.add(core);

  const knob = new IcosahedronGeometry(spikeRadius, 2);
  const spikes = new InstancedMesh(
    knob,
    makeCellMaterial({
      color: spikeColor,
      emissive,
      emissiveIntensity,
      roughness: 0.42,
    }),
    spikeCount,
  );

  const rng = mulberry32(seed ^ 0x9e37);
  const matrix = new Matrix4();
  const quaternion = new Quaternion();
  const scale = new Vector3();
  const directions = fibonacciSphere(spikeCount);

  for (let i = 0; i < spikeCount; i++) {
    const dir = directions[i];
    const jitter = 0.86 + rng() * 0.3;
    const position = dir.clone().multiplyScalar(radius * (1 + spikeLength * 0.6));
    quaternion.setFromUnitVectors(new Vector3(0, 1, 0), dir);
    scale.setScalar(jitter);
    matrix.compose(position, quaternion, scale);
    spikes.setMatrixAt(i, matrix);
  }
  spikes.instanceMatrix.needsUpdate = true;
  group.add(spikes);

  if (glow) {
    group.add(makeRimGlow(coreGeometry, glow.color, glow.opacity, 1.08));
  }

  return group;
};

/** Convenience wrapper so scenes can drift a body without touching children. */
export const wrap = (object: Object3D): Group => {
  const group = new Group();
  group.add(object);
  return group;
};
