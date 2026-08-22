// The sheet: an ordered list of marks with the frame each one starts on.
//
// Marks are appended through a moving cursor, so only one thing is ever being
// drawn at a time and the order on the page is the order in the source. That
// is what produces the lecture-notes rhythm — something new every couple of
// seconds, in sequence.

import { INK, STROKE_WIDTH, TYPE_SIZE } from "./constants";
import { bounds, type Pt } from "./geometry";

export type Mark =
  | {
      kind: "stroke";
      pts: Pt[];
      start: number;
      dur: number;
      color: string;
      width: number;
      /** Frame this mark disappears. Only ever set by the single erase. */
      until?: number;
      /** Jitters every 4 frames — the scene-6 bell, which never stops. */
      shake?: boolean;
    }
  | {
      kind: "fill";
      pts: Pt[];
      start: number;
      dur: number;
      color: string;
      until?: number;
      shake?: boolean;
    }
  | {
      kind: "text";
      text: string;
      x: number;
      y: number;
      size: number;
      start: number;
      dur: number;
      color: string;
      anchor: "start" | "middle" | "end";
      until?: number;
      shake?: boolean;
    };

// Caveat is narrow and loose. This estimate drives both the write-on clip and
// the SVG textLength, so glyphs get spaced to match rather than distorted.
const NARROW = new Set("ijlt.,'!:;()rf".split(""));
const WIDE = new Set("mwMW".split(""));

export const textWidth = (text: string, size: number): number => {
  let units = 0;
  for (const ch of text) {
    if (ch === " ") units += 0.24;
    else if (NARROW.has(ch)) units += 0.26;
    else if (WIDE.has(ch)) units += 0.62;
    else if (ch === ch.toUpperCase() && ch !== ch.toLowerCase()) units += 0.46;
    else units += 0.4;
  }
  return units * size;
};

export const textLeft = (mark: Extract<Mark, { kind: "text" }>): number => {
  const w = textWidth(mark.text, mark.size);
  if (mark.anchor === "middle") return mark.x - w / 2;
  if (mark.anchor === "end") return mark.x - w;
  return mark.x;
};

type StrokeOpts = { color?: string; width?: number; shake?: boolean };
type TextOpts = { color?: string; anchor?: "start" | "middle" | "end"; size?: number };

/** The gap between consecutive marks — the beat where the pen would reposition. */
const BEAT = 2;

export class Sheet {
  readonly marks: Mark[] = [];
  private cursor = 0;
  private dx = 0;
  private dy = 0;

  /** Nudges everything added from here on along the sheet. */
  shift(dx: number, dy: number): this {
    this.dx = dx;
    this.dy = dy;
    return this;
  }

  at(frame: number): this {
    this.cursor = frame;
    return this;
  }

  get now(): number {
    return this.cursor;
  }

  pause(frames: number): this {
    this.cursor += frames;
    return this;
  }

  stroke(pts: Pt[], dur = 10, opts: StrokeOpts = {}): this {
    this.marks.push({
      kind: "stroke",
      pts: this.lower(pts),
      start: this.cursor,
      dur,
      color: opts.color ?? INK,
      width: opts.width ?? STROKE_WIDTH,
      shake: opts.shake,
    });
    this.cursor += dur + BEAT;
    return this;
  }

  /** Several marks that belong to one object, drawn back to back. */
  strokes(list: Pt[][], dur = 8, opts: StrokeOpts = {}): this {
    for (const pts of list) this.stroke(pts, dur, opts);
    return this;
  }

  /** A flat colour laid inside the lines. Wipes on; nothing ever fades. */
  fill(pts: Pt[], color: string, dur = 7): this {
    this.marks.push({
      kind: "fill",
      pts: this.lower(pts),
      start: this.cursor,
      dur,
      color,
    });
    this.cursor += dur + BEAT;
    return this;
  }

  text(text: string, x: number, y: number, dur = 12, opts: TextOpts = {}): this {
    this.marks.push({
      kind: "text",
      text,
      x: x + this.dx,
      y: y + this.dy,
      size: opts.size ?? TYPE_SIZE,
      start: this.cursor,
      dur,
      color: opts.color ?? INK,
      anchor: opts.anchor ?? "middle",
    });
    this.cursor += dur + BEAT;
    return this;
  }

  private lower(pts: Pt[]): Pt[] {
    if (this.dx === 0 && this.dy === 0) return pts;
    return pts.map((p) => ({ x: p.x + this.dx, y: p.y + this.dy }));
  }

  /** The single erase, at scene 6. Everything already on the sheet goes. */
  eraseEverything(frame: number): this {
    for (const mark of this.marks) mark.until = frame;
    return this;
  }
}

/** How much of a mark is drawn at `frame`, 0 → 1. */
export const progressOf = (mark: Mark, frame: number): number => {
  if (frame < mark.start) return 0;
  if (frame >= mark.start + mark.dur) return 1;
  return (frame - mark.start) / mark.dur;
};

export const isVisible = (mark: Mark, frame: number): boolean =>
  frame >= mark.start && (mark.until === undefined || frame < mark.until);

export const fillBounds = (pts: Pt[]) => bounds(pts);
