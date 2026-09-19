import * as THREE from "three";
import { BOX_HEIGHT } from "./constants";
import type { ContainerLods } from "./geometry";
import type { Placement } from "./layout";
import { applyEnvironment, type EnvironmentSpec } from "./environment";
import { createContainerMaterial, createFallbackMaterial } from "./material";
import { resolvePalette, type PaletteId } from "./palette";
import type { RenderTier } from "./renderer";

export type CameraState = {
  position: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
};

export type ShotSpec = {
  palette: PaletteId;
  environment: EnvironmentSpec;
  buildPlacements: () => Placement[];
  /** Camera as a function of normalised shot progress, 0..1 inclusive. */
  camera: (progress: number) => CameraState;
  /** Scales the palette's baseline weathering. */
  weathering?: number;
  /** Aim the sun's shadow frustum at the action rather than the origin. */
  sunTarget?: THREE.Vector3;
};

export type ShotStats = {
  placed: number;
  drawn: number;
  triangles: number;
  byLod: [number, number, number, number];
};

export type BuiltShot = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  update: (progress: number) => void;
  stats: ShotStats;
  dispose: () => void;
};

/**
 * Detail bands, expressed as the fraction of frame height a container's
 * 2.567m side covers. Screen coverage rather than raw distance, because the
 * shots run from a 12-degree lens 56m back to a 36-degree lens 12m back: at
 * those settings a container 56m away fills more of the frame than one 26m
 * away, and a distance rule hands the long-lens shot flat boxes.
 *
 * The first band is set where it is on purpose: LOD1 still carries modelled
 * corrugation and door hardware, and is indistinguishable from LOD0 until a
 * container is most of the frame, so only genuinely hero containers pay for
 * 24k triangles.
 *
 * LOD is assigned once per shot, from each container's largest coverage over
 * the whole camera path, not per frame. A container can then never pop to a
 * coarser mesh as the camera closes on it, and the per-frame cost is nil --
 * no matrix rewrites, no buffer uploads, no re-sorting. It over-spends on
 * containers that are only briefly close, which is a good trade at these
 * counts.
 */
const LOD_BANDS = [0.28, 0.07, 0.022] as const;

/** Half-diagonal of a container, for the culling bounding sphere. */
const CONTAINER_RADIUS = 3.6;

const pickLod = (coverage: number): 0 | 1 | 2 | 3 => {
  if (coverage > LOD_BANDS[0]) return 0;
  if (coverage > LOD_BANDS[1]) return 1;
  if (coverage > LOD_BANDS[2]) return 2;
  return 3;
};

/**
 * Walks the camera path and works out, for every container, whether it is ever
 * on screen and how close the camera ever gets. Containers that never enter
 * any sampled frustum are dropped before a single triangle is submitted, which
 * is what makes the wide yard shots affordable.
 */
const analysePlacements = (
  placements: Placement[],
  spec: ShotSpec,
  aspect: number,
  samples = 36,
) => {
  const centre = new THREE.Vector3();
  const sphere = new THREE.Sphere(new THREE.Vector3(), CONTAINER_RADIUS * 1.35);
  const frustums: THREE.Frustum[] = [];
  const eyes: THREE.Vector3[] = [];
  /** 2*tan(fov/2) per sample: frame height in world units per unit depth. */
  const frameHeights: number[] = [];

  const probe = new THREE.PerspectiveCamera(50, aspect, 0.5, 2000);
  const matrix = new THREE.Matrix4();

  for (let i = 0; i < samples; i++) {
    const state = spec.camera(i / (samples - 1));
    probe.position.copy(state.position);
    probe.lookAt(state.target);
    // A little extra field of view so a container just off the edge of frame
    // is still kept -- it may be lit, and it will be visible in the 4K crop.
    probe.fov = Math.min(140, state.fov * 1.18);
    probe.aspect = aspect;
    probe.updateProjectionMatrix();
    probe.updateMatrixWorld(true);
    matrix.multiplyMatrices(probe.projectionMatrix, probe.matrixWorldInverse);
    frustums.push(new THREE.Frustum().setFromProjectionMatrix(matrix));
    eyes.push(state.position.clone());
    frameHeights.push(2 * Math.tan(THREE.MathUtils.degToRad(state.fov) / 2));
  }

  const kept: { placement: Placement; lod: 0 | 1 | 2 | 3; depth: number }[] = [];
  for (const p of placements) {
    centre.set(p.x, p.y + 1.28, p.z);
    sphere.center.copy(centre);

    let visible = false;
    let maxCoverage = 0;
    let minDistance = Infinity;
    for (let i = 0; i < frustums.length; i++) {
      if (!frustums[i].intersectsSphere(sphere)) continue;
      visible = true;
      const d = Math.max(0.5, eyes[i].distanceTo(centre));
      // Fraction of frame height the container's side spans at this sample.
      const coverage = BOX_HEIGHT / (d * frameHeights[i]);
      if (coverage > maxCoverage) maxCoverage = coverage;
      if (d < minDistance) minDistance = d;
    }
    if (!visible) continue;
    kept.push({ placement: p, lod: pickLod(maxCoverage), depth: minDistance });
  }
  return kept;
};

export const buildShot = (
  spec: ShotSpec,
  lods: ContainerLods,
  {
    aspect,
    tier,
    shadowMapSize,
  }: { aspect: number; tier: RenderTier; shadowMapSize?: number },
): BuiltShot => {
  const scene = new THREE.Scene();
  const palette = resolvePalette(spec.palette);

  const env = applyEnvironment(scene, {
    ...spec.environment,
    sun: {
      ...spec.environment.sun,
      shadowMapSize: shadowMapSize ?? spec.environment.sun.shadowMapSize,
    },
  });
  if (spec.sunTarget) env.sun.target.position.copy(spec.sunTarget);
  env.sun.target.updateMatrixWorld();

  const placements = spec.buildPlacements();
  const analysed = analysePlacements(placements, spec, aspect);

  // Depth-sorted front to back within each bucket. An InstancedMesh draws in
  // instance order and three cannot sort inside one, so without this the yard
  // is submitted in layout order and occluded containers are shaded before the
  // ones in front of them. Measured at roughly 7% here -- the software
  // rasteriser's early-Z does less for us than it would on real hardware --
  // but it is free at build time and costs nothing per frame.
  const buckets: { placement: Placement }[][] = [[], [], [], []];
  const ordered = [...analysed].sort((a, b) => a.depth - b.depth);
  for (const item of ordered) buckets[item.lod].push({ placement: item.placement });

  const meshes: THREE.InstancedMesh[] = [];
  const disposables: { dispose: () => void }[] = [];
  const byLod: [number, number, number, number] = [0, 0, 0, 0];
  let triangles = 0;

  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3(1, 1, 1);
  const axisY = new THREE.Vector3(0, 1, 0);

  buckets.forEach((bucket, lod) => {
    if (bucket.length === 0) return;

    // Each bucket owns its geometry clone: the instanced attributes below are
    // stored on the geometry, so sharing one would cross the buckets' wires.
    const geometry = lods.geometries[lod].clone();
    const material =
      tier === "webgl1"
        ? createFallbackMaterial()
        : createContainerMaterial({
            // The procedural LOD boxes have flat walls and need faked ridges;
            // the decimated source mesh already has them modelled.
            corrugationBands: lod >= 2,
            // Carrier marks are sub-pixel by the time the farthest LOD is used.
            stencils: lod <= 2,
            weathering: spec.weathering ?? 1,
          });

    const count = bucket.length;
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    // Culling already happened over the whole camera path; leaving it on lets
    // three drop a whole bucket when its collective bounds leave frame.
    mesh.frustumCulled = false;

    const seeds = new Float32Array(count);
    const colors = new Float32Array(count * 3);
    const weathers = new Float32Array(count);
    const stencils = new Float32Array(count);

    bucket.forEach(({ placement }, i) => {
      position.set(placement.x, placement.y, placement.z);
      quaternion.setFromAxisAngle(axisY, placement.rotationY);
      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(i, matrix);

      const colour =
        palette.colors[
          palette.table[placement.colorIndex % palette.table.length]
        ];
      // instanceColor covers the tier-3 fallback material; the aColor
      // attribute is what the node material actually reads.
      mesh.setColorAt(i, colour);
      colors[i * 3] = colour.r;
      colors[i * 3 + 1] = colour.g;
      colors[i * 3 + 2] = colour.b;

      seeds[i] = placement.seed;
      weathers[i] = placement.weather * palette.weathering;
      stencils[i] = placement.stencil;
    });

    geometry.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seeds, 1));
    geometry.setAttribute("aColor", new THREE.InstancedBufferAttribute(colors, 3));
    geometry.setAttribute("aWeather", new THREE.InstancedBufferAttribute(weathers, 1));
    geometry.setAttribute("aStencil", new THREE.InstancedBufferAttribute(stencils, 1));

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    scene.add(mesh);
    meshes.push(mesh);
    disposables.push(geometry, material);
    byLod[lod] = count;
    triangles += count * lods.triangles[lod];
  });

  const camera = new THREE.PerspectiveCamera(40, aspect, 0.5, 2200);
  const update = (progress: number) => {
    const state = spec.camera(progress);
    camera.position.copy(state.position);
    camera.lookAt(state.target);
    if (camera.fov !== state.fov) {
      camera.fov = state.fov;
      camera.updateProjectionMatrix();
    }
    camera.updateMatrixWorld(true);
  };
  update(0);

  return {
    scene,
    camera,
    update,
    stats: {
      placed: placements.length,
      drawn: analysed.length,
      triangles,
      byLod,
    },
    dispose: () => {
      meshes.forEach((m) => {
        m.dispose();
        scene.remove(m);
      });
      disposables.forEach((d) => d.dispose());
      env.dispose();
    },
  };
};
