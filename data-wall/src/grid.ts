import { rnd, rndInt } from "./rng";
import { DURATION, FPS } from "./plane";
import type { Plane } from "./plane";
import type { VariantConfig } from "./variants";

export type Tone = "mid" | "bright" | "accent";

/** A change of value at a given frame of the cycle. */
export type Reroll = { frame: number; value: string; tone: Tone };

export type Cell = {
  col: number;
  row: number;
  /** Roughly `emptyRatio` of positions are blank — real boards have gaps. */
  empty: boolean;
  /** State the cell holds at the top of the cycle. */
  value: string;
  tone: Tone;
  /** Rerolls within the cycle, ascending by frame. Usually empty. */
  rerolls: Reroll[];
};

export type GridModel = {
  cols: number;
  rows: number;
  cells: Cell[];
  /** Cell indices rerolling on each frame of the cycle. */
  schedule: number[][];
};

/** How long a cell stays lit after it rerolls. */
export const FLASH_FRAMES = 3;

/** Percentage strings: two or three digits, a point, two more, a percent. */
const makeValue = (seed: string): string => {
  const threeDigit = rnd(`${seed}-w`) < 0.85;
  const whole = threeDigit
    ? rndInt(`${seed}-a`, 100, 1000)
    : rndInt(`${seed}-b`, 10, 100);
  const frac = rndInt(`${seed}-c`, 0, 100);
  return `${whole}.${String(frac).padStart(2, "0")}%`;
};

const pickTone = (r: number, config: VariantConfig): Tone => {
  const { brightRatio, accentRatio } = config.grid;
  if (r < accentRatio) return "accent";
  if (r < accentRatio + brightRatio) return "bright";
  return "mid";
};

export const buildGrid = (
  plane: Plane,
  config: VariantConfig,
  seed = "datawall-grid",
): GridModel => {
  const cols = plane.tileCols;
  const rows = plane.tileRows;
  const total = cols * rows;

  const cells: Cell[] = new Array(total);
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const i = row * cols + col;
      const key = `${seed}-${col}-${row}`;
      cells[i] = {
        col,
        row,
        empty: rnd(`${key}-empty`) < config.grid.emptyRatio,
        value: makeValue(`${key}-v0`),
        tone: pickTone(rnd(`${key}-tone`), config),
        rerolls: [],
      };
    }
  }

  // The reroll rate is specified against the *visible* cells, but the tile
  // holds more than fits in frame, so scale it up by that ratio.
  const visible = config.grid.columns * config.grid.rows;
  const perCycle = Math.round(
    ((config.grid.rerollsPerSecond * DURATION) / FPS) * (total / visible),
  );

  const schedule: number[][] = Array.from({ length: DURATION }, () => []);
  for (let k = 0; k < perCycle; k += 1) {
    // Spread rerolls evenly over the cycle, then jitter, so they never clump
    // into a visible pulse.
    const base = Math.floor((k * DURATION) / perCycle);
    const frame =
      (base + rndInt(`${seed}-jit-${k}`, 0, Math.max(1, Math.floor(DURATION / perCycle)))) %
      DURATION;
    const cellIndex = rndInt(`${seed}-cell-${k}`, 0, total);
    if (cells[cellIndex].empty) continue;
    cells[cellIndex].rerolls.push({
      frame,
      value: makeValue(`${seed}-r-${k}`),
      tone: pickTone(rnd(`${seed}-rtone-${k}`), config),
    });
    schedule[frame].push(cellIndex);
  }

  // Sort each cell's rerolls and fold the last one back onto the start of the
  // cycle, so frame 0 and frame 600 show identical text.
  for (const cell of cells) {
    if (cell.rerolls.length === 0) continue;
    cell.rerolls.sort((x, y) => x.frame - y.frame);
    const last = cell.rerolls[cell.rerolls.length - 1];
    cell.value = last.value;
    cell.tone = last.tone;
  }

  return { cols, rows, cells, schedule };
};

export type CellState = { value: string; tone: Tone; flash: boolean };

/** What a cell shows at `frame`. Pure, and periodic over the cycle. */
export const cellStateAt = (cell: Cell, frame: number): CellState => {
  const f = ((frame % DURATION) + DURATION) % DURATION;
  if (cell.rerolls.length === 0) {
    return { value: cell.value, tone: cell.tone, flash: false };
  }
  // Default to the last reroll of the cycle, with its age measured across the
  // wrap — that is what makes frame 600 identical to frame 0 even for a cell
  // that rerolled on frame 599 and is still flashing.
  let chosen = cell.rerolls[cell.rerolls.length - 1];
  let age = f + DURATION - chosen.frame;
  for (const r of cell.rerolls) {
    if (r.frame > f) break;
    chosen = r;
    age = f - r.frame;
  }
  return { value: chosen.value, tone: chosen.tone, flash: age < FLASH_FRAMES };
};

/**
 * Cells whose appearance differs between `frame - 1` and `frame`: the ones
 * rerolling now, plus the ones whose flash has just expired. Everything else
 * can stay in the cached offscreen tile.
 */
export const dirtyCellsAt = (grid: GridModel, frame: number): number[] => {
  const now = grid.schedule[frame % DURATION];
  const expiring = grid.schedule[(frame - FLASH_FRAMES + DURATION) % DURATION];
  return now.concat(expiring);
};
