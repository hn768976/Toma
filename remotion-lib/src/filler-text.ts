/**
 * Deterministic illegible filler.
 *
 * Nonsense words assembled from syllable fragments, laid into lines with
 * varied lengths and a short last line, so a block of them carries the *shape*
 * of a paragraph at small sizes without being prose. Use wherever body copy is
 * meant to read as texture — and specifically so that rendered "text" is never
 * mistakable for, or derived from, real writing.
 */
import { randInt, randRange, rand } from "./seeded-random";

const SYLLABLES = [
  "ta", "re", "in", "con", "ver", "si", "na", "lor", "mus", "de",
  "pel", "an", "tor", "ce", "ri", "ba", "ment", "tis", "que", "dol",
  "um", "era", "fic", "gan", "hus", "lem", "por", "sed", "ate", "min",
  "ol", "rus", "tel", "vas", "nel", "cor", "dis", "ent", "ral", "sto",
];

export const fillerWord = (seed: string): string => {
  const count = randInt(`${seed}-syl`, 1, 3);
  let word = "";
  for (let i = 0; i < count; i += 1) {
    word += SYLLABLES[randInt(`${seed}-s${i}`, 0, SYLLABLES.length - 1)];
  }
  return word;
};

/**
 * Lays filler words into lines of a given pixel width. The last line of each
 * paragraph is deliberately short, which is what makes a block of text read as
 * a paragraph rather than a rectangle.
 */
export const fillerLines = (
  measure: (text: string) => number,
  seed: string,
  width: number,
  lineCount: number,
  lastLineShort: boolean,
): string[] => {
  const lines: string[] = [];
  for (let i = 0; i < lineCount; i += 1) {
    const isLast = lastLineShort && i === lineCount - 1;
    // A little jitter on every line keeps the right edge ragged.
    const target = isLast
      ? width * randRange(`${seed}-last`, 0.26, 0.62)
      : width * randRange(`${seed}-w${i}`, 0.955, 1.0);
    let line = "";
    let guard = 0;
    for (;;) {
      guard += 1;
      const next = fillerWord(`${seed}-l${i}-w${guard}`);
      const candidate = line ? `${line} ${next}` : next;
      if (measure(candidate) > target || guard > 60) {
        if (!line) line = next;
        break;
      }
      line = candidate;
    }
    // Occasional punctuation, so the texture is not uniformly word-shaped.
    if (!isLast && rand(`${seed}-p${i}`) < 0.35) line += ",";
    if (isLast) line += ".";
    lines.push(i === 0 ? line.charAt(0).toUpperCase() + line.slice(1) : line);
  }
  return lines;
};
