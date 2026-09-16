// Builds the block field.
//
// The field is generated once as a tile that is FIELD_HALF_WIDTH*2 cells
// wide and exactly LOOP_CELLS cells deep, then repeated along -Z to fill
// the visible range. Because the tile is generated with the z axis
// wrapping, the field is genuinely periodic: the view after the camera has
// travelled LOOP_CELLS is identical to the view it started from, which is
// what lets the clip loop without a cut.
//
// Blocks may claim a neighbouring cell to become rectangular slabs, so an
// occupancy pass runs over the tile first — also with z wrapping, or the
// seam between tile repeats would show as a row of mismatched blocks.

import {
  BLOCK_FOOTPRINT,
  HEIGHT_CYCLE_CHOICES,
  HEIGHT_DELTA_BANDS,
  CELL,
  EMPTY_CELL_CHANCE,
  FIELD_HALF_WIDTH,
  FIELD_Z_FAR,
  FIELD_Z_NEAR,
  HEIGHT_BANDS,
  LOOP_CELLS,
  MAX_BLOCK_HEIGHT,
  MIN_BLOCK_HEIGHT,
  WIDE_BLOCK_CHANCE,
} from "./constants";
import { chance, mulberry32, pick, range, type Rng } from "./random";

export type Block = {
  /** Centre in world units. y is the base, blocks grow upward from y = 0. */
  x: number;
  z: number;
  /** Footprint and height in world units. */
  sx: number;
  sy: number;
  sz: number;
  /** Base emissive gain for this block. */
  brightness: number;
  /** Phase offsets into the loop-periodic pulses, in turns. */
  pulsePhase: number;
  /** Second height this block morphs to, as a multiple of sy. */
  heightRatio: number;
  /** Whole height cycles per loop, so the block ends where it started. */
  heightCycles: number;
  /** Random window into the code sheet, in sheet UV. */
  uvOffsetX: number;
  uvOffsetY: number;
};

/** Draws from a weighted list of [min, max, weight] bands. */
const pickBanded = (
  rng: Rng,
  bands: readonly [number, number, number][],
): number => {
  const total = bands.reduce((sum, band) => sum + band[2], 0);
  let roll = rng() * total;
  for (const [min, max, weight] of bands) {
    if (roll < weight) return range(rng, min, max);
    roll -= weight;
  }
  return range(rng, bands[0][0], bands[0][1]);
};

const pickBrightness = (rng: Rng) => {
  const roll = rng();
  // A fifth of the field stays nearly dark. The reference leans on those
  // dead blocks for contrast — without them the field turns into an even
  // glowing carpet.
  if (roll < 0.2) return range(rng, 0.05, 0.16);
  if (roll < 0.75) return range(rng, 0.3, 0.72);
  return range(rng, 0.8, 1.05);
};

/** One entry of the periodic tile, in tile-local cell coordinates. */
type TileBlock = Omit<Block, "z"> & { cz: number };

const buildTile = (seed: number): TileBlock[] => {
  const rng = mulberry32(seed);
  const width = FIELD_HALF_WIDTH * 2;
  const depth = LOOP_CELLS;

  // occupancy[cz * width + cx]
  const occupied = new Uint8Array(width * depth);
  const at = (cx: number, cz: number) =>
    ((cz % depth) + depth) % depth * width + cx;

  const blocks: TileBlock[] = [];

  for (let cz = 0; cz < depth; cz++) {
    for (let cx = 0; cx < width; cx++) {
      if (occupied[at(cx, cz)]) continue;
      if (chance(rng, EMPTY_CELL_CHANCE)) {
        occupied[at(cx, cz)] = 1;
        continue;
      }

      let cellsX = 1;
      let cellsZ = 1;
      if (chance(rng, WIDE_BLOCK_CHANCE)) {
        const alongX = chance(rng, 0.5);
        if (alongX && cx + 1 < width && !occupied[at(cx + 1, cz)]) {
          cellsX = 2;
        } else if (!alongX && !occupied[at(cx, cz + 1)]) {
          cellsZ = 2;
        }
      }

      for (let dz = 0; dz < cellsZ; dz++) {
        for (let dx = 0; dx < cellsX; dx++) {
          occupied[at(cx + dx, cz + dz)] = 1;
        }
      }

      // Footprint jitter keeps the gutters between blocks uneven, which is
      // what stops the field reading as a spreadsheet.
      const inset = BLOCK_FOOTPRINT * range(rng, 0.94, 1.02);

      // The block animates between this height and `height + delta`,
      // clamped so it can neither invert nor spike out of the field. The
      // ratio is what the shader interpolates towards, since the base
      // height is already baked into the instance matrix.
      const height = pickBanded(rng, HEIGHT_BANDS);
      const delta = pickBanded(rng, HEIGHT_DELTA_BANDS) * (chance(rng, 0.5) ? 1 : -1);
      const target = Math.min(
        MAX_BLOCK_HEIGHT,
        Math.max(MIN_BLOCK_HEIGHT, height + delta),
      );

      blocks.push({
        x: (cx - FIELD_HALF_WIDTH + (cellsX - 1) * 0.5 + 0.5) * CELL,
        cz: cz + (cellsZ - 1) * 0.5,
        sx: cellsX * CELL * inset,
        sy: height,
        sz: cellsZ * CELL * inset,
        brightness: pickBrightness(rng),
        pulsePhase: rng(),
        heightRatio: target / height,
        heightCycles: pick(rng, HEIGHT_CYCLE_CHOICES),
        uvOffsetX: rng(),
        uvOffsetY: rng(),
      });
    }
  }

  return blocks;
};

/**
 * The full field: the periodic tile repeated along -Z and clipped to the
 * range the camera actually flies through.
 */
export const buildField = (seed: number): Block[] => {
  const tile = buildTile(seed);
  const blocks: Block[] = [];

  const firstRepeat = Math.floor(FIELD_Z_FAR / LOOP_CELLS) - 1;
  const lastRepeat = Math.ceil(FIELD_Z_NEAR / LOOP_CELLS) + 1;

  for (let repeat = firstRepeat; repeat <= lastRepeat; repeat++) {
    const zOffset = repeat * LOOP_CELLS * CELL;
    for (const block of tile) {
      const z = block.cz * CELL + zOffset;
      if (z < FIELD_Z_FAR || z > FIELD_Z_NEAR) continue;
      blocks.push({ ...block, z });
    }
  }

  return blocks;
};
