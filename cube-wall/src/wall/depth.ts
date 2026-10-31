import { mulberry32, smoothstep } from "../random";
import { COLS, LOOP_SECONDS, MAX_DEPTH, ROWS } from "./constants";

const TAU = Math.PI * 2;

export type TileParams = {
  phaseA: number;
  phaseB: number;
  cyclesA: number; // integer -> periodic over the loop
  cyclesB: number;
  bias: number;
};

export const makeTileParams = (seed: number): TileParams[] => {
  const rand = mulberry32(seed);
  const out: TileParams[] = [];
  for (let i = 0; i < COLS * ROWS; i++) {
    out.push({
      phaseA: rand(),
      phaseB: rand(),
      cyclesA: 1 + Math.floor(rand() * 2),
      cyclesB: 2 + Math.floor(rand() * 2),
      bias: rand() * 2 - 1,
    });
  }
  return out;
};

// Depth of tile (col,row) at time t. Every term is periodic in LOOP_SECONDS so
// the last frame flows straight back into the first, like the reference loop.
// A smooth travelling field groups neighbouring tiles into blocks; a per-tile
// oscillation breaks it up; a soft threshold pushes tiles to rest on plateaus.
export const tileDepth = (
  col: number,
  row: number,
  t: number,
  p: TileParams,
) => {
  const u = t / LOOP_SECONDS;
  const x = col - COLS / 2 + 0.5;
  const y = row - ROWS / 2 + 0.5;
  const field =
    0.55 * Math.sin(TAU * u + x * 0.55 + y * 0.21) +
    0.45 * Math.sin(TAU * 2 * u - x * 0.23 + y * 0.62 + 1.3) +
    0.35 * Math.sin(TAU * u - (x * 0.4 - y * 0.47) + 4.1);
  const own =
    0.8 * Math.sin(TAU * (p.cyclesA * u + p.phaseA)) +
    0.35 * Math.sin(TAU * (p.cyclesB * u + p.phaseB));
  const v = 0.62 * field + 0.42 * own + 0.2 * p.bias;
  // A main soft step (two resting levels, like the reference) plus a small
  // secondary step so a few tiles poke out a little further.
  const level = 0.82 * smoothstep(-0.25, 0.25, v) + 0.18 * smoothstep(0.7, 1.1, v);
  return level * MAX_DEPTH;
};
