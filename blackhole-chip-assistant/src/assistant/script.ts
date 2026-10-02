import { mulberry32 } from "../common/random";
import { CHAT_TEXT } from "../palettes";

/**
 * The chat timeline, in frames (30 fps). Look 3 is a one-way exchange of
 * 300 frames and does NOT loop.
 *
 *   0-20    empty interface, cursor blinking in the input field
 *   20-90   the question types in, with uneven, human timing
 *   90-110  pause; the send button pulses once
 *   110-230 the reply types in, faster and more evenly
 *   230-299 hold, cursor blinking at the end of the reply
 */
export const TIMELINE = {
  questionStart: 20,
  questionEnd: 86,
  sendPulseStart: 93,
  sendPulseEnd: 109,
  replyStart: 112,
  replyEnd: 228,
};

/** Frame at which each character appears, spread over [start, end]. */
const typingTimes = (text: string, start: number, end: number, seed: number, unevenness: number) => {
  const rand = mulberry32(seed);
  const gaps: number[] = [];
  for (let i = 0; i < text.length; i++) {
    let g = 1 + (rand() * 2 - 1) * unevenness;
    // a person hesitates a little after a space or punctuation
    if (i > 0 && /[ ,?]/.test(text[i - 1])) g *= 1 + unevenness;
    gaps.push(Math.max(0.15, g));
  }
  const total = gaps.reduce((a, b) => a + b, 0) - gaps[0];
  const times: number[] = [];
  let acc = 0;
  for (let i = 0; i < text.length; i++) {
    if (i > 0) acc += gaps[i];
    times.push(Math.round(start + (acc / total) * (end - start)));
  }
  return times;
};

export const QUESTION_TIMES = typingTimes(
  CHAT_TEXT.question,
  TIMELINE.questionStart,
  TIMELINE.questionEnd,
  0x9e57,
  0.75,
);
export const REPLY_TIMES = typingTimes(CHAT_TEXT.reply, TIMELINE.replyStart, TIMELINE.replyEnd, 0x4e91, 0.18);

export const charsVisible = (times: number[], frame: number) => {
  let n = 0;
  while (n < times.length && times[n] <= frame) n++;
  return n;
};

/** Word-wrap to at most `maxChars` per line (monospace). */
export const wrap = (text: string, maxChars: number) => {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > maxChars && cur) {
      lines.push(cur + " ");
      cur = w;
    } else cur = next;
  }
  lines.push(cur);
  return lines;
};

/** Cursor blink: on for 15 frames, off for 15. Pure function of frame. */
export const cursorOn = (frame: number) => Math.floor(frame / 15) % 2 === 0;
