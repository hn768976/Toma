import { ROW_PITCH_X, ROW_PITCH_Z, STACK_PITCH_Y } from "./constants";
import { CARRIERS, makeRandom } from "./textures";

/**
 * Yard layout generation.
 *
 * A real terminal stores containers in blocks: rows across, bays along, tiers
 * up, with aisles between blocks wide enough for a straddle carrier. Every
 * reference is some view of that grid, so one block generator plus a per-shot
 * arrangement of blocks covers all six.
 *
 * Everything is seeded. Remotion renders frames across several browser
 * instances and each one rebuilds the scene from scratch, so an unseeded
 * layout would change from frame to frame and the shot would boil.
 */

export type Placement = {
  /** Base centre of the container, metres, with y = 0 on the ground. */
  x: number;
  y: number;
  z: number;
  /** Yaw in radians. 0 puts the container's length along Z. */
  rotationY: number;
  /** Raw draw, resolved against a palette's weight table by the caller. */
  colorIndex: number;
  /** Noise offset, so no two containers weather identically. */
  seed: number;
  /** 0..1 multiplier on the weathering. */
  weather: number;
  /** Index into the carrier stencil atlas. */
  stencil: number;
};

export type BlockOptions = {
  /** Centre of the ground-tier container at row 0, bay 0. */
  originX: number;
  originZ: number;
  /** Stacks across the block's short axis. */
  rows: number;
  /** Stacks along the block's long axis. */
  bays: number;
  /** Tallest stack in the block. */
  tiers: number;
  /** Shortest stack, so the skyline is stepped rather than flat. */
  minTiers?: number;
  /** "z" runs each container's length along Z; "x" rotates the block 90 deg. */
  axis?: "x" | "z";
  /** Probability a ground slot is left empty. */
  gapChance?: number;
  /** Bias applied to every container's weathering in this block. */
  weatherBias?: number;
  seed: number;
};

/**
 * One rectangular block of stacks.
 *
 * Stack height varies per column, not per container, which is what produces
 * the stepped skyline in the references: a yard fills a stack at a time.
 */
export const buildBlock = ({
  originX,
  originZ,
  rows,
  bays,
  tiers,
  minTiers = 1,
  axis = "z",
  gapChance = 0,
  weatherBias = 0,
  seed,
}: BlockOptions): Placement[] => {
  const rand = makeRandom(seed);
  const out: Placement[] = [];

  // Across the block, stacks are separated by the container's width; along it,
  // by its length. Rotating the block swaps which world axis each maps to.
  const alongIsZ = axis === "z";
  const rotationY = alongIsZ ? 0 : Math.PI / 2;

  for (let r = 0; r < rows; r++) {
    for (let b = 0; b < bays; b++) {
      if (rand() < gapChance) continue;

      const across = r * ROW_PITCH_X;
      const along = b * ROW_PITCH_Z;
      const x = originX + (alongIsZ ? across : along);
      const z = originZ + (alongIsZ ? along : across);

      const height = minTiers + Math.floor(rand() * (tiers - minTiers + 1));

      for (let t = 0; t < height; t++) {
        // Boxes are never landed perfectly square. The tiny yaw error and
        // lateral slide are a large part of why a real stack does not read as
        // a tiled texture.
        const yawJitter = (rand() - 0.5) * 0.014;
        const slide = (rand() - 0.5) * 0.07;
        const creep = (rand() - 0.5) * 0.07;

        out.push({
          x: x + (alongIsZ ? slide : creep),
          y: t * STACK_PITCH_Y,
          z: z + (alongIsZ ? creep : slide),
          rotationY: rotationY + yawJitter,
          colorIndex: Math.floor(rand() * 100000),
          seed: rand() * 40,
          weather: Math.min(
            1.35,
            Math.max(0.15, 0.45 + rand() * 0.7 + weatherBias),
          ),
          stencil: Math.floor(rand() * CARRIERS.length),
        });
      }
    }
  }
  return out;
};

/** Convenience: several blocks separated by aisles running along Z. */
export const buildAisleBlocks = ({
  blocks,
  rows,
  bays,
  tiers,
  minTiers,
  aisle,
  originX,
  originZ,
  gapChance,
  seed,
}: {
  blocks: number;
  rows: number;
  bays: number;
  tiers: number;
  minTiers?: number;
  /** Clear width of the driving lane between blocks, metres. */
  aisle: number;
  originX: number;
  originZ: number;
  gapChance?: number;
  seed: number;
}): Placement[] => {
  const out: Placement[] = [];
  const blockWidth = (rows - 1) * ROW_PITCH_X;
  for (let i = 0; i < blocks; i++) {
    out.push(
      ...buildBlock({
        originX: originX + i * (blockWidth + aisle + ROW_PITCH_X),
        originZ,
        rows,
        bays,
        tiers,
        minTiers,
        gapChance,
        seed: seed + i * 7919,
      }),
    );
  }
  return out;
};
