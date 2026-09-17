// What the blue rows actually say, and how they decay.
//
// Each row is an endless cyclic strip of hex-ish groups that creeps
// sideways a whole dot at a time — a real LED sign cannot scroll by half
// a pixel, and copying that constraint is a large part of why the panel
// reads as hardware. On top of the crawl, individual characters re-roll
// now and then (departure-board flicker), and during a glitch burst they
// are replaced wholesale.

import { hash01 } from "../lib/random";
import { DATA_CHARS, SCRAMBLE_CHARS } from "./font5x7";

// Prime-ish strip length: long enough that no row visibly repeats inside
// the 7s, and coprime with the cell pitch so the groups never line up
// into columns between rows.
const STRIP_LENGTH = 97;

const stripCache = new Map<number, string>();

const buildStrip = (row: number) => {
  let out = "";
  let group = 0;
  while (out.length < STRIP_LENGTH) {
    const len = 2 + Math.floor(hash01(row, group, 31) * 3); // 2..4 chars
    for (let i = 0; i < len; i++) {
      const pick = hash01(row, group * 8 + i, 47);
      out += DATA_CHARS[Math.floor(pick * DATA_CHARS.length)];
    }
    out += " ";
    group++;
  }
  return out.slice(0, STRIP_LENGTH);
};

const strip = (row: number) => {
  let cached = stripCache.get(row);
  if (cached === undefined) {
    cached = buildStrip(row);
    stripCache.set(row, cached);
  }
  return cached;
};

// Whole-dot horizontal crawl for a row. Rows drift at different rates and
// in both directions so the wall never moves as one slab.
export const rowScrollDots = (row: number, frame: number) => {
  const speed = (hash01(row, 5, 21) - 0.45) * 0.3;
  return Math.floor(speed * frame);
};

const mod = (value: number, n: number) => ((value % n) + n) % n;

export const dataCharAt = (
  row: number,
  cell: number,
  frame: number,
  scramble: number,
) => {
  const index = mod(cell, STRIP_LENGTH);
  let char = strip(row)[index];

  // Ambient flicker, independent of the glitch schedule: the feed behind
  // the alert is live, so a few characters tick over every third of a
  // second even when nothing is wrong.
  const tick = Math.floor(frame / 9);
  if (hash01(row * 131 + index, tick, 77) < 0.04) {
    const pick = hash01(row + index * 17, tick, 91);
    char = DATA_CHARS[Math.floor(pick * DATA_CHARS.length)];
  }

  if (scramble > 0) {
    const burstTick = Math.floor(frame / 2);
    if (hash01(row * 977 + index, burstTick, 5) < scramble) {
      const pick = hash01(index * 41, burstTick, 13);
      char = SCRAMBLE_CHARS[Math.floor(pick * SCRAMBLE_CHARS.length)];
    }
  }
  return char;
};

// The headline corrupts too, but more gently — the words have to stay
// legible through the burst or the whole shot loses its subject.
export const headlineCharAt = (
  line: number,
  index: number,
  char: string,
  frame: number,
  scramble: number,
) => {
  if (scramble <= 0) return char;
  const burstTick = Math.floor(frame / 2);
  if (hash01(line * 613 + index, burstTick, 23) < scramble * 0.55) {
    const pick = hash01(index * 29 + line, burstTick, 37);
    return SCRAMBLE_CHARS[Math.floor(pick * SCRAMBLE_CHARS.length)];
  }
  return char;
};
