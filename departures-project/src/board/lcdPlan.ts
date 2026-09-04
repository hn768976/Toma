/**
 * The typing schedule for the LCD board.
 *
 * The loop is: a full board that updates a few remarks, a clearing wave from
 * the top, a retyping wave, then a run of individual remark updates that put
 * every cell back to the value it had at frame 0. Frames 398-420 and 0-10 are
 * both quiet, so the cut is invisible.
 */
import { DURATION_IN_FRAMES } from "./constants";
import { nextStatus, ROWS, Status } from "./data";

export const LCD_ROW_COUNT = 12;

export const LCD_FIELDS = ["flight", "time", "destination", "gate", "remarks"] as const;
export type LcdField = (typeof LCD_FIELDS)[number];

/** Frames spent on one character while typing / while erasing. */
const TYPE_CHAR_FRAMES = 1;
const ERASE_CHAR_FRAMES = 0.45;
/** Beat between two columns of the same row. */
const FIELD_GAP = 2;

const CLEAR_START = 78;
const CLEAR_ROW_STAGGER = 5;
/** Columns blank right to left, so the wave also reads across the row. */
const CLEAR_FIELD_STAGGER = 2;

const RETYPE_START = 162;
const RETYPE_ROW_STAGGER = 7;

/** A single remark cell swapping value: erase, beat, retype. */
const UPDATE_PAUSE = 3;

type Keyframe = { frame: number; chars: number };
type TextChange = { frame: number; text: string };

export type LcdCellPlan = {
  keys: Keyframe[];
  texts: TextChange[];
};

type Op = { at: number; kind: "erase" | "type"; length: number };

const eraseFrames = (length: number) => Math.max(2, length * ERASE_CHAR_FRAMES);
const typeFrames = (length: number) => Math.max(2, length * TYPE_CHAR_FRAMES);

const buildCell = (initial: string, ops: Op[], texts: TextChange[]): LcdCellPlan => {
  const sorted = [...ops].sort((a, b) => a.at - b.at);
  const keys: Keyframe[] = [{ frame: 0, chars: initial.length }];
  for (const op of sorted) {
    if (op.kind === "erase") {
      keys.push({ frame: op.at, chars: op.length });
      keys.push({ frame: op.at + eraseFrames(op.length), chars: 0 });
    } else {
      keys.push({ frame: op.at, chars: 0 });
      keys.push({ frame: op.at + typeFrames(op.length), chars: op.length });
    }
  }
  const last = keys[keys.length - 1];
  keys.push({ frame: DURATION_IN_FRAMES, chars: last.chars });
  return {
    keys,
    texts: [{ frame: 0, text: initial }, ...texts].sort((a, b) => a.frame - b.frame),
  };
};

/** Number of characters revealed at `frame`, interpolated between keyframes. */
export const charsAt = (plan: LcdCellPlan, frame: number): number => {
  const { keys } = plan;
  if (frame <= keys[0].frame) return keys[0].chars;
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1];
    const b = keys[i];
    if (frame <= b.frame) {
      if (b.frame <= a.frame) return b.chars;
      const t = (frame - a.frame) / (b.frame - a.frame);
      return Math.round(a.chars + (b.chars - a.chars) * t);
    }
  }
  return keys[keys.length - 1].chars;
};

/** The value the cell is currently holding, whether or not it is fully typed. */
export const textAt = (plan: LcdCellPlan, frame: number): string => {
  let text = plan.texts[0].text;
  for (const change of plan.texts) {
    if (change.frame <= frame) text = change.text;
  }
  return text;
};

/**
 * Every row's remarks return to their frame-0 value before the loop point.
 * Rows are split into three groups so the updates are spread over the whole
 * fourteen seconds instead of arriving together.
 */
const statusPlan = (rowIndex: number, base: Status, blankFrame: number) => {
  const alt = nextStatus(base);
  const group = rowIndex % 3;
  const k = Math.floor(rowIndex / 3);
  if (group === 0) {
    // Flips early on the full board, and quietly reverts inside the wave.
    return [
      { frame: 10 + k * 15, status: alt, animated: true },
      { frame: blankFrame, status: base, animated: false },
    ];
  }
  if (group === 1) {
    // Comes back from the wave with a new remark, reverts in the last phase.
    return [
      { frame: blankFrame, status: alt, animated: false },
      { frame: 306 + k * 11, status: base, animated: true },
    ];
  }
  // Updates twice during the final phase.
  return [
    { frame: 300 + k * 9, status: alt, animated: true },
    { frame: 352 + k * 9, status: base, animated: true },
  ];
};

const buildRow = (rowIndex: number): Record<LcdField, LcdCellPlan> => {
  const row = ROWS[rowIndex];
  const clearAt = (fieldIndex: number) =>
    CLEAR_START + rowIndex * CLEAR_ROW_STAGGER + (LCD_FIELDS.length - 1 - fieldIndex) * CLEAR_FIELD_STAGGER;
  const blankFrame = clearAt(LCD_FIELDS.length - 1) + 12;

  const plan = statusPlan(rowIndex, row.status, blankFrame);
  const statusAt = (frame: number): Status => {
    let status = row.status;
    for (const change of plan) {
      if (change.frame <= frame) status = change.status;
    }
    return status;
  };

  const values: Record<LcdField, string> = {
    flight: row.flight,
    time: row.time,
    destination: row.destination,
    gate: row.gate,
    remarks: row.status,
  };

  // The retype wave runs left to right through the row, each column starting
  // where the previous one finished.
  const retypeStart: number[] = [];
  let cursor = RETYPE_START + rowIndex * RETYPE_ROW_STAGGER;
  for (const field of LCD_FIELDS) {
    retypeStart.push(cursor);
    const length = field === "remarks" ? statusAt(cursor).length : values[field].length;
    cursor += typeFrames(length) + FIELD_GAP;
  }

  const cells = {} as Record<LcdField, LcdCellPlan>;
  LCD_FIELDS.forEach((field, fieldIndex) => {
    if (field !== "remarks") {
      cells[field] = buildCell(
        values[field],
        [
          { at: clearAt(fieldIndex), kind: "erase", length: values[field].length },
          { at: retypeStart[fieldIndex], kind: "type", length: values[field].length },
        ],
        [],
      );
      return;
    }

    const ops: Op[] = [
      { at: clearAt(fieldIndex), kind: "erase", length: row.status.length },
    ];
    const texts: TextChange[] = [];

    for (const change of plan) {
      if (!change.animated) {
        // Falls inside the blank left by the clearing wave — nothing to erase.
        texts.push({ frame: change.frame, text: change.status });
        continue;
      }
      const before = statusAt(change.frame - 1);
      ops.push({ at: change.frame, kind: "erase", length: before.length });
      const typeAt = change.frame + eraseFrames(before.length) + UPDATE_PAUSE;
      texts.push({ frame: change.frame + eraseFrames(before.length), text: change.status });
      ops.push({ at: typeAt, kind: "type", length: change.status.length });
    }

    ops.push({
      at: retypeStart[fieldIndex],
      kind: "type",
      length: statusAt(retypeStart[fieldIndex]).length,
    });

    cells[field] = buildCell(row.status, ops, texts);
  });

  return cells;
};

export const LCD_PLAN: Record<LcdField, LcdCellPlan>[] = Array.from(
  { length: LCD_ROW_COUNT },
  (_, rowIndex) => buildRow(rowIndex),
);
