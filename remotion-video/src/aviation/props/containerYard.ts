import {
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Quaternion,
  Vector3,
  type BufferGeometry,
  type Texture,
} from "three/webgpu";
import { loadModel } from "../three/assets";
import { createRng, type Rng } from "../three/rng";
import {
  CONTAINER_INSTANCE_ATTRIBUTES,
  CONTAINER_PALETTE,
  createPaintedSteelMaterial,
} from "../materials/paintedSteel";

/**
 * A container yard built as stacks of 20ft boxes.
 *
 * All three container references are shot from the ground looking up a wall of
 * stacked boxes, so the geometry that matters is the *skyline*: the ragged top
 * edge where stacks of different heights meet the sky, and the vertical seams
 * between adjacent stacks. Everything here exists to make that edge read.
 *
 * The whole yard is one InstancedMesh. Colour and wear arrive as instanced
 * attributes, so several hundred boxes cost a single draw call and still look
 * individually weathered.
 */

export type YardOptions = {
  readonly seed: number;
  /** Bays across X. */
  readonly columns: number;
  /** Bays along Z. */
  readonly rows: number;
  /** Stack height range, in containers. */
  readonly minTiers: number;
  readonly maxTiers: number;
  /** Gap between adjacent stacks across X, in metres. */
  readonly bayGapX?: number;
  /** Gap between adjacent stacks along Z, in metres. */
  readonly bayGapZ?: number;
  /** Probability that a bay is left empty, which breaks up the skyline. */
  readonly gapChance?: number;
  readonly markings: Texture;
  /** Use the light mesh; true for anything that never fills the frame. */
  readonly lod?: boolean;
  readonly grime?: number;
  /** Restricts the palette, so one yard can read as a single operator's stock. */
  readonly palette?: readonly Vector3[];
};

export type ContainerYard = {
  readonly object: InstancedMesh;
  /** Footprint size in metres, for placing the camera relative to the stacks. */
  readonly extent: Vector3;
  /** Height of one container, in metres. */
  readonly tierHeight: number;
  dispose(): void;
};

type Placement = {
  readonly position: Vector3;
  /** Yaw in radians; boxes are loaded either way round in a real yard. */
  readonly yaw: number;
  readonly colorIndex: number;
  readonly atlasIndex: number;
  readonly wearSeed: number;
  readonly rust: number;
  readonly bleach: number;
};

const planStacks = (
  options: YardOptions,
  size: Vector3,
  rng: Rng,
): { placements: Placement[]; extent: Vector3 } => {
  const {
    columns,
    rows,
    minTiers,
    maxTiers,
    bayGapX = 0.22,
    bayGapZ = 0.9,
    gapChance = 0.08,
    palette = CONTAINER_PALETTE,
  } = options;

  const pitchX = size.x + bayGapX;
  const pitchZ = size.z + bayGapZ;
  const placements: Placement[] = [];

  for (let cx = 0; cx < columns; cx++) {
    for (let cz = 0; cz < rows; cz++) {
      if (rng.chance(gapChance)) continue;

      // Stacks in a yard are not independent: a tall stack tends to sit beside
      // another tall one, because they are built bay by bay. Biasing the height
      // by the bay's X index produces those runs instead of white noise.
      const runBias = Math.sin(cx * 1.7 + options.seed * 0.11) * 0.5 + 0.5;
      const span = maxTiers - minTiers;
      const tiers = Math.max(
        1,
        Math.round(minTiers + span * (runBias * 0.55 + rng.next() * 0.45)),
      );

      // One operator's boxes arrive together, so a stack is mostly one or two
      // colours rather than a random spread.
      const stackColor = rng.int(0, palette.length - 1);
      const altColor = rng.int(0, palette.length - 1);

      const baseX = (cx - (columns - 1) / 2) * pitchX;
      const baseZ = (cz - (rows - 1) / 2) * pitchZ;

      for (let tier = 0; tier < tiers; tier++) {
        // Corner castings interlock, so boxes sit square; the millimetre of
        // slop that is left shows up as a slight yaw, not a gap.
        const jitterX = rng.float(-0.035, 0.035);
        const jitterZ = rng.float(-0.06, 0.06);
        placements.push({
          position: new Vector3(baseX + jitterX, tier * size.y, baseZ + jitterZ),
          yaw: rng.float(-0.006, 0.006) + (rng.chance(0.5) ? 0 : Math.PI),
          colorIndex: rng.chance(0.72) ? stackColor : altColor,
          atlasIndex: rng.int(0, 7),
          wearSeed: rng.float(0, 64),
          // Boxes higher in a stack have been rained on from above for longer.
          rust: Math.min(0.92, rng.float(0.08, 0.62) + tier * 0.04),
          bleach: rng.float(0.15, 0.9),
        });
      }
    }
  }

  const extent = new Vector3(columns * pitchX, maxTiers * size.y, rows * pitchZ);
  return { placements, extent };
};

export const createContainerYard = async (options: YardOptions): Promise<ContainerYard> => {
  const model = await loadModel(options.lod === false ? "container-hero" : "container-lod");
  const rng = createRng(options.seed);
  const { placements, extent } = planStacks(options, model.size, rng);

  const geometry = model.geometry.clone() as BufferGeometry;
  const material = createPaintedSteelMaterial({
    markings: options.markings,
    length: model.size.z,
    height: model.size.y,
    grime: options.grime,
  });

  const mesh = new InstancedMesh(geometry, material, placements.length);
  mesh.frustumCulled = false;

  const palette = options.palette ?? CONTAINER_PALETTE;
  const paints = new Float32Array(placements.length * 3);
  const variations = new Float32Array(placements.length * 4);
  const matrix = new Matrix4();
  const quaternion = new Quaternion();
  const scale = new Vector3(1, 1, 1);
  const axis = new Vector3(0, 1, 0);

  placements.forEach((p, i) => {
    quaternion.setFromAxisAngle(axis, p.yaw);
    matrix.compose(p.position, quaternion, scale);
    mesh.setMatrixAt(i, matrix);

    const color = palette[p.colorIndex % palette.length];
    paints[i * 3] = color.x;
    paints[i * 3 + 1] = color.y;
    paints[i * 3 + 2] = color.z;

    variations[i * 4] = p.atlasIndex;
    variations[i * 4 + 1] = p.wearSeed;
    variations[i * 4 + 2] = p.rust;
    variations[i * 4 + 3] = p.bleach;
  });

  mesh.instanceMatrix.needsUpdate = true;
  geometry.setAttribute(
    CONTAINER_INSTANCE_ATTRIBUTES.paint,
    new InstancedBufferAttribute(paints, 3),
  );
  geometry.setAttribute(
    CONTAINER_INSTANCE_ATTRIBUTES.variation,
    new InstancedBufferAttribute(variations, 4),
  );

  return {
    object: mesh,
    extent,
    tierHeight: model.size.y,
    dispose() {
      geometry.dispose();
      material.dispose();
      mesh.dispose();
    },
  };
};
