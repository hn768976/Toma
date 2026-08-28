import { random } from "remotion";
import { DURATION_IN_FRAMES } from "./constants";
import type { PanelBehaviour, PanelDensity } from "./variants";

export type CellState = {
  text: string;
  highlighted: boolean;
  /** A cell that has gone dark — it draws nothing at all. */
  dark: boolean;
  dim: boolean;
};

export type ReadoutModel = {
  cell: (column: number, row: number, frame: number) => CellState;
  /** 0 while a whole column has flickered out. */
  columnAlpha: (column: number, frame: number) => number;
  meter: (column: number, frame: number) => number;
};

type Window = { start: number; end: number };

/**
 * Reroll periods, in frames. Every period divides 330, and the epoch is
 * derived from `frame % 330`, so all values return to their frame-0 state
 * when the loop wraps.
 *
 * Cell count x 30 / period is the reroll rate: the medium panel's 27 cells
 * average ~5 rerolls a second, the high panel's 56 cells ~10.
 */
const PERIOD_POOL: Record<PanelBehaviour, number[]> = {
  steady: [110, 165, 165, 330, 165, 110],
  active: [165, 165, 330, 110, 165, 165],
  failing: [110, 165, 55, 110, 330, 66],
};

const CORRUPT_FILLS = ["8888", "----", "####", "0000", "::::", "FFFF"];

/** Non-overlapping windows inside the loop, all closing before frame 330. */
const buildWindows = (
  seed: string,
  count: number,
  minLen: number,
  maxLen: number,
  guard: number,
): Window[] => {
  const windows: Window[] = [];
  const slot = (DURATION_IN_FRAMES - guard * 2) / count;
  for (let i = 0; i < count; i++) {
    const len = minLen + Math.floor(random(`${seed}-len-${i}`) * (maxLen - minLen + 1));
    const room = Math.max(slot - len, 1);
    const start = Math.floor(guard + i * slot + random(`${seed}-at-${i}`) * room);
    windows.push({ start, end: Math.min(start + len, DURATION_IN_FRAMES - 1) });
  }
  return windows;
};

const inWindow = (windows: Window[], frame: number) =>
  windows.find((w) => frame >= w.start && frame < w.end);

const digits = (seed: string) => {
  const length = 2 + Math.floor(random(`${seed}-len`) * 3);
  let out = "";
  for (let i = 0; i < length; i++) out += Math.floor(random(`${seed}-d${i}`) * 10);
  return out;
};

export const buildReadoutModel = (
  density: PanelDensity,
  behaviour: PanelBehaviour,
  seed: string,
): ReadoutModel => {
  const columns = density.columns.length;
  const rows = density.rows;
  const pool = PERIOD_POOL[behaviour];

  const period: number[][] = [];
  const offset: number[][] = [];
  for (let c = 0; c < columns; c++) {
    period[c] = [];
    offset[c] = [];
    for (let r = 0; r < rows; r++) {
      const p = pool[Math.floor(random(`${seed}-p-${c}-${r}`) * pool.length)];
      period[c][r] = p;
      offset[c][r] = Math.floor(random(`${seed}-o-${c}-${r}`) * p);
    }
  }

  // Columns that stop updating for 20-40 frames at a time, columns that blink
  // out entirely for 4-6, and a handful of cells that go dark mid-loop and
  // come back before it wraps. Only the failing panel uses any of them.
  const failing = behaviour === "failing";
  const freezeWindows: Window[][] = [];
  const blinkWindows: Window[][] = [];
  for (let c = 0; c < columns; c++) {
    freezeWindows[c] = failing ? buildWindows(`${seed}-freeze-${c}`, 3, 20, 40, 12) : [];
    blinkWindows[c] = failing && c % 2 === 0 ? buildWindows(`${seed}-blink-${c}`, 2, 4, 6, 30) : [];
  }
  const darkCells = failing
    ? [0, 1, 2].map((i) => ({
        column: Math.floor(random(`${seed}-dark-c-${i}`) * columns),
        row: Math.floor(random(`${seed}-dark-r-${i}`) * rows),
        window: buildWindows(`${seed}-dark-w-${i}`, 1, 70, 130, 40)[0],
      }))
    : [];

  const epochOf = (c: number, r: number, frame: number) => {
    const loopFrame = ((frame % DURATION_IN_FRAMES) + DURATION_IN_FRAMES) % DURATION_IN_FRAMES;
    const frozen = inWindow(freezeWindows[c], loopFrame);
    const effective = frozen ? frozen.start : loopFrame;
    return Math.floor(((effective + offset[c][r]) % DURATION_IN_FRAMES) / period[c][r]);
  };

  return {
    cell: (c, r, frame) => {
      const loopFrame = ((frame % DURATION_IN_FRAMES) + DURATION_IN_FRAMES) % DURATION_IN_FRAMES;
      const epoch = epochOf(c, r, frame);

      // Highlighted cells shift every 66 frames — five positions per loop.
      const hlEpoch = Math.floor(loopFrame / 66);
      const highlightRow = Math.floor(random(`${seed}-hl-${c}-${hlEpoch}`) * rows);
      const secondRow = Math.floor(random(`${seed}-hl2-${c}-${hlEpoch}`) * rows);

      const dark = darkCells.some(
        (d) =>
          d.column === c &&
          d.row === r &&
          loopFrame >= d.window.start &&
          loopFrame < d.window.end,
      );

      const corrupt =
        failing && random(`${seed}-corrupt-${c}-${r}-${epoch}`) < 0.16
          ? CORRUPT_FILLS[Math.floor(random(`${seed}-cf-${c}-${r}-${epoch}`) * CORRUPT_FILLS.length)]
          : null;

      return {
        text: corrupt ?? digits(`${seed}-v-${c}-${r}-${epoch}`),
        highlighted: r === highlightRow || (density.name === "high" && r === secondRow),
        dark,
        dim: random(`${seed}-dim-${c}-${r}`) < 0.3,
      };
    },

    columnAlpha: (c, frame) => {
      const loopFrame = ((frame % DURATION_IN_FRAMES) + DURATION_IN_FRAMES) % DURATION_IN_FRAMES;
      return inWindow(blinkWindows[c], loopFrame) ? 0 : 1;
    },

    // Seeded sines whose periods divide the loop, so the meters fill and
    // drain back to exactly where they started.
    meter: (c, frame) => {
      const t = (frame % DURATION_IN_FRAMES) / DURATION_IN_FRAMES;
      const cycles = 2 + Math.floor(random(`${seed}-meter-c-${c}`) * 4);
      const phase = random(`${seed}-meter-p-${c}`) * Math.PI * 2;
      return 0.5 + 0.5 * Math.sin(2 * Math.PI * cycles * t + phase);
    },
  };
};
