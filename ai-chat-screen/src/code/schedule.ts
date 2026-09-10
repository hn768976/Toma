import { CODE_LINES } from "./highlight";
import { CODE_TYPE_END, CODE_TYPE_START } from "../constants";
import { seededRandom } from "../random";

// Frame at which each line lands, computed once. The rhythm is uneven on
// purpose: blank lines cost almost nothing, a new `def`/`class` gets a
// beat of hesitation before it, and roughly a quarter of the remaining
// lines arrive in a fast burst. A metronome reads as a fake.
const rawGaps = (): number[] => {
  const gaps: number[] = [];
  CODE_LINES.forEach((line, i) => {
    const text = line.spans.map((s) => s.text).join("");
    const trimmed = text.trim();
    const r = seededRandom(i, 7);
    const burst = seededRandom(i, 13) < 0.28;

    let gap: number;
    if (trimmed.length === 0) {
      gap = 1 + r;
    } else if (/^(def |class |async def )/.test(trimmed)) {
      gap = 13 + r * 14; // hesitate before starting a new block
    } else if (/^(#|"""|')/.test(trimmed)) {
      gap = 6 + r * 9;
    } else if (burst) {
      gap = 2 + r * 2;
    } else {
      gap = 3.5 + r * 7 + Math.min(trimmed.length, 60) * 0.06;
    }
    gaps.push(gap);
  });
  return gaps;
};

const buildArrivals = (): number[] => {
  const gaps = rawGaps();
  const cumulative: number[] = [];
  let total = 0;
  for (const gap of gaps) {
    total += gap;
    cumulative.push(total);
  }
  // Rescale the whole rhythm onto the [start, end] beat so the last line
  // always lands on CODE_TYPE_END regardless of how the gaps came out.
  const span = CODE_TYPE_END - CODE_TYPE_START;
  return cumulative.map((c) =>
    CODE_TYPE_START + (c / total) * span,
  );
};

export const LINE_ARRIVAL: number[] = buildArrivals();

export const revealedLineCount = (frame: number): number => {
  let count = 0;
  for (const arrival of LINE_ARRIVAL) {
    if (frame >= arrival) count++;
    else break;
  }
  return count;
};

const smoothstep = (t: number) => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};

// Per-line fade so a line does not pop in on a single frame.
export const lineOpacity = (index: number, frame: number): number =>
  smoothstep((frame - LINE_ARRIVAL[index]) / 3.5);

// The editor follows the caret: nothing scrolls until the code outgrows
// the viewport, then every further line eases the view up by exactly one
// line. Summing eased unit steps keeps the scroll continuous and a pure
// function of the frame.
export const scrollInLines = (frame: number, visibleLines: number): number => {
  let scroll = 0;
  for (let i = visibleLines; i < LINE_ARRIVAL.length; i++) {
    scroll += smoothstep((frame - LINE_ARRIVAL[i]) / 9);
  }
  return scroll;
};

// The caret stops blinking while lines are actively landing, exactly as a
// real editor does, and resumes on the hold.
export const caretOpacity = (frame: number): number => {
  const index = revealedLineCount(frame) - 1;
  const sinceLastLine = index >= 0 ? frame - LINE_ARRIVAL[index] : Infinity;
  if (sinceLastLine < 7) return 1;
  return frame % 30 < 17 ? 1 : 0;
};
