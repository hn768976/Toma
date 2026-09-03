// Vendored from @studio/remotion-lib (src/KeywordHighlight.ts). Do not edit here —
// edit the library and re-run `node scripts/sync-lib.mjs`.
/**
 * <KeywordHighlight> — per-word emphasis within a run of text.
 *
 * One word in the run is held at full contrast and full sharpness; every other
 * word is drawn at reduced contrast and progressively blurred, the blur rising
 * with distance from the keyword so the transition is graded rather than
 * abrupt. It reads as an eye that has settled on a single word.
 *
 * Layout and painting are separate on purpose: `measureKeywordRun` produces a
 * plan (and reports where the keyword landed, which the caller needs in order
 * to position the whole card), and `KeywordHighlight` paints one part of that
 * plan. The keyword is painted onto its own layer so it can be given less
 * motion blur than its surroundings later on.
 *
 * Subject-agnostic: nothing here knows about headlines, articles or palettes —
 * it is given a string, a word to hold, a font and two colours.
 */
import type { Ctx } from "./canvas2d";
import { clamp, setBlur } from "./canvas2d";

export interface KeywordRunOptions {
  text: string;
  /** Matched case-insensitively against each word, ignoring punctuation. */
  keyword: string;
  x: number;
  /** Baseline of the first line. */
  y: number;
  maxWidth: number;
  /** CSS font shorthand — the caller owns typeface choice. */
  font: string;
  fontSize: number;
  lineHeight: number;
  /** Blur applied to a word immediately beside the keyword. */
  minBlur: number;
  /** Blur applied to a word at or beyond `falloff`. */
  maxBlur: number;
  /** Distance in pixels at which `maxBlur` is reached. */
  falloff: number;
  /** Opacity of a word beside the keyword, and of one far from it. */
  nearAlpha: number;
  farAlpha: number;
}

export interface PlacedWord {
  text: string;
  /** Left edge. */
  x: number;
  /** Baseline. */
  y: number;
  width: number;
  blur: number;
  alpha: number;
  isKeyword: boolean;
}

export interface KeywordRunPlan {
  words: PlacedWord[];
  lineCount: number;
  /** Total height of the run, first baseline to last descender. */
  height: number;
  font: string;
  /** Bounding box of the keyword, or null if the run did not contain it. */
  keyword: { x: number; y: number; width: number; height: number; cx: number; cy: number } | null;
}

const normalise = (word: string): string => word.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();

/** Greedy wrap of `words` at `width`, returning one array of words per line. */
const wrapAt = (widths: number[], spaceWidth: number, width: number): number[][] => {
  const lines: number[][] = [];
  let line: number[] = [];
  let used = 0;
  for (let i = 0; i < widths.length; i += 1) {
    const add = line.length === 0 ? widths[i] : spaceWidth + widths[i];
    if (line.length > 0 && used + add > width) {
      lines.push(line);
      line = [i];
      used = widths[i];
    } else {
      line.push(i);
      used += add;
    }
  }
  if (line.length) lines.push(line);
  return lines;
};

/**
 * Wraps at the narrowest width that still yields the same number of lines,
 * which evens the lines out instead of leaving a long line above a stub.
 */
const balancedWrap = (widths: number[], spaceWidth: number, maxWidth: number): number[][] => {
  const target = wrapAt(widths, spaceWidth, maxWidth).length;
  let lo = maxWidth * 0.4;
  let hi = maxWidth;
  for (let i = 0; i < 18; i += 1) {
    const mid = (lo + hi) / 2;
    if (wrapAt(widths, spaceWidth, mid).length <= target) hi = mid;
    else lo = mid;
  }
  return wrapAt(widths, spaceWidth, hi);
};

export const measureKeywordRun = (ctx: Ctx, o: KeywordRunOptions): KeywordRunPlan => {
  ctx.save();
  ctx.filter = "none";
  ctx.font = o.font;
  const tokens = o.text.split(/\s+/).filter(Boolean);
  const widths = tokens.map((t) => ctx.measureText(t).width);
  const spaceWidth = ctx.measureText(" ").width;
  const lines = balancedWrap(widths, spaceWidth, o.maxWidth);

  // First pass: position every word.
  const placed: PlacedWord[] = [];
  const keywordIndex = tokens.findIndex((t) => normalise(t) === o.keyword.toLowerCase());
  lines.forEach((line, lineIndex) => {
    let cursor = o.x;
    line.forEach((tokenIndex) => {
      placed.push({
        text: tokens[tokenIndex],
        x: cursor,
        y: o.y + lineIndex * o.lineHeight,
        width: widths[tokenIndex],
        blur: 0,
        alpha: 1,
        isKeyword: tokenIndex === keywordIndex,
      });
      cursor += widths[tokenIndex] + spaceWidth;
    });
  });

  const focus = placed.find((w) => w.isKeyword) ?? null;
  const focusCx = focus ? focus.x + focus.width / 2 : o.x + o.maxWidth / 2;
  const focusCy = focus ? focus.y : o.y;

  // Second pass: grade blur and contrast by distance from the keyword. The
  // vertical term is weighted up, so a word one line away is already well
  // outside the sharp zone.
  for (const word of placed) {
    if (word.isKeyword) {
      word.blur = 0;
      word.alpha = 1;
      continue;
    }
    const dx = word.x + word.width / 2 - focusCx;
    const dy = (word.y - focusCy) * 3.0;
    const distance = Math.hypot(dx, dy);
    const t = clamp(distance / o.falloff, 0, 1) ** 0.8;
    word.blur = o.minBlur + (o.maxBlur - o.minBlur) * t;
    word.alpha = o.nearAlpha + (o.farAlpha - o.nearAlpha) * t;
  }

  ctx.restore();
  return {
    words: placed,
    lineCount: lines.length,
    height: (lines.length - 1) * o.lineHeight + o.fontSize * 1.02,
    font: o.font,
    keyword: focus
      ? {
          x: focus.x,
          y: focus.y - o.fontSize * 0.76,
          width: focus.width,
          height: o.fontSize * 1.0,
          cx: focus.x + focus.width / 2,
          cy: focus.y - o.fontSize * 0.32,
        }
      : null,
  };
};

export type RunPart = "rest" | "keyword";

export const KeywordHighlight = (
  ctx: Ctx,
  plan: KeywordRunPlan,
  part: RunPart,
  colors: { keyword: string; rest: string },
): void => {
  ctx.save();
  ctx.font = plan.font;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  for (const word of plan.words) {
    if ((part === "keyword") !== word.isKeyword) continue;
    setBlur(ctx, word.blur);
    ctx.globalAlpha = word.alpha;
    ctx.fillStyle = word.isKeyword ? colors.keyword : colors.rest;
    ctx.fillText(word.text, word.x, word.y);
  }
  ctx.restore();
};
