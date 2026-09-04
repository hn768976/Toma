/**
 * The flip schedule for the split-flap board.
 *
 * Only two things move: a row's remark flips, or its whole destination
 * riffles over to another city. Flight codes and times never change, which is
 * what keeps most of the board still. Every change is paired with a change
 * back before frame 420, so the board's content at the loop point is exactly
 * its content at frame 0.
 */
import { DURATION_IN_FRAMES } from "./constants";
import { ROWS, SPARE_DESTINATIONS, Status, toFlapStatus } from "./data";
import { hashInt, hashPick } from "./random";

export const FLAP_COLUMNS = 2;
export const FLAP_ROWS_PER_COLUMN = 16;

export const FLAP_FIELDS = [
  { key: "flight", width: 5 },
  { key: "time", width: 5 },
  { key: "destination", width: 13 },
  { key: "status", width: 9 },
] as const;

export type FlapField = (typeof FLAP_FIELDS)[number]["key"];

/** Frames a single flap spends riffling before it lands. */
export const FLIP_FRAMES = 6;
/** Frames each cell lags behind the one to its left, so words ripple. */
export const CHAR_STAGGER = 2;

/** The drum's alphabet — what a riffling flap can show on the way past. */
export const FLAP_ALPHABET = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:";

/** The four remarks this board carries. */
const FLAP_CYCLE: Status[] = ["ON TIME", "BOARDING", "DELAYED", "CANCELLED"];

/** Rows whose remark flips, and rows whose destination is re-assigned. */
const STATUS_ROWS = [1, 3, 6, 9, 12, 14, 17, 19, 22, 25, 28, 30];
const DESTINATION_ROWS = [4, 11, 16, 23, 29];

export type FlapChange = { frame: number; from: string; to: string };

const pad = (text: string, width: number) => text.toUpperCase().padEnd(width, " ").slice(0, width);

const fieldWidth = (field: FlapField) =>
  FLAP_FIELDS.find((f) => f.key === field)!.width;

export const flapInitial = (rowIndex: number, field: FlapField): string => {
  const row = ROWS[rowIndex];
  const raw = field === "status" ? toFlapStatus(row.status) : row[field];
  return pad(raw, fieldWidth(field));
};

const buildChanges = (): Map<string, FlapChange[]> => {
  const changes = new Map<string, FlapChange[]>();
  const add = (rowIndex: number, field: FlapField, list: FlapChange[]) => {
    changes.set(`${rowIndex}:${field}`, list);
  };

  STATUS_ROWS.forEach((rowIndex, k) => {
    const base = toFlapStatus(ROWS[rowIndex].status);
    const step = 1 + hashInt(0, 2, rowIndex, "flap-status");
    const alt = FLAP_CYCLE[(FLAP_CYCLE.indexOf(base) + step) % FLAP_CYCLE.length];
    const first = 18 + k * 29 + hashInt(0, 10, rowIndex, "flap-status-jitter");
    const width = fieldWidth("status");
    add(rowIndex, "status", [
      { frame: first, from: pad(base, width), to: pad(alt, width) },
      { frame: first + 44, from: pad(alt, width), to: pad(base, width) },
    ]);
  });

  DESTINATION_ROWS.forEach((rowIndex, k) => {
    const base = ROWS[rowIndex].destination;
    const alt = hashPick(SPARE_DESTINATIONS, rowIndex, "flap-destination");
    const first = 26 + k * 54 + hashInt(0, 14, rowIndex, "flap-destination-jitter");
    const width = fieldWidth("destination");
    add(rowIndex, "destination", [
      { frame: first, from: pad(base, width), to: pad(alt, width) },
      { frame: first + 110, from: pad(alt, width), to: pad(base, width) },
    ]);
  });

  return changes;
};

export const FLAP_CHANGES = buildChanges();

/** Sanity guard: nothing may still be riffling when the loop cuts back. */
const longestFlip = fieldWidth("destination") * CHAR_STAGGER + FLIP_FRAMES;
FLAP_CHANGES.forEach((list, key) => {
  const last = list[list.length - 1];
  if (last.frame + longestFlip > DURATION_IN_FRAMES) {
    throw new Error(`Flip on ${key} does not settle before the loop point`);
  }
});

export type FlapCellState = {
  /** What the flap is showing right now — a riffle character while moving. */
  char: string;
  /** The field value this flap has landed on, used to colour the remark. */
  text: string;
  flipping: boolean;
};

/** The drum without the blank, so a spinning flap always shows a glyph. */
const RIFFLE = FLAP_ALPHABET.slice(1);

/**
 * What one flap is showing. A flap only moves when its character actually
 * changes; the rest of the word stays put, exactly as on a real board.
 */
export const flapCharAt = (
  rowIndex: number,
  field: FlapField,
  charIndex: number,
  frame: number,
): FlapCellState => {
  let text = flapInitial(rowIndex, field);
  let flipping = false;

  const list = FLAP_CHANGES.get(`${rowIndex}:${field}`);
  if (list) {
    for (const change of list) {
      const start = change.frame + charIndex * CHAR_STAGGER;
      const moves = change.from[charIndex] !== change.to[charIndex];
      if (frame >= start + (moves ? FLIP_FRAMES : 0)) {
        text = change.to;
      } else if (moves && frame >= start) {
        flipping = true;
      }
    }
  }

  const char = flipping
    ? RIFFLE[hashInt(0, RIFFLE.length - 1, rowIndex, field, charIndex, frame)]
    : text[charIndex];

  return { char, text, flipping };
};
