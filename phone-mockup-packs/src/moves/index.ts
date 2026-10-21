import { BLACK_MOVES } from "./black";
import { GRAPHITE_MOVES } from "./graphite";
import { GREEN_MOVES } from "./green";
import { Move } from "./types";
import { WHITE_MOVES } from "./white";

// Every move works on any background; the grouping is only by origin pack.
export const MOVES: Record<string, Move> = {
  ...WHITE_MOVES,
  ...BLACK_MOVES,
  ...GRAPHITE_MOVES,
  ...GREEN_MOVES,
};

export const MOVE_NAMES = Object.keys(MOVES);
