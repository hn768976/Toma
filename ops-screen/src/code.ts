/**
 * The source shown in the centre panel, plus a tiny highlighter.
 *
 * The whole listing is tokenised once here, at module level. The panel
 * then reveals it by line and character count — it never re-highlights
 * per frame, which is what keeps a 600-frame 4K render cheap.
 *
 * The code is invented and generic on purpose: no real paths, hosts or
 * accounts anywhere on this screen.
 */
import { makeRng } from "./rng";

export const SOURCE = `// ------------------------------------------------------
//  segment reducer
//  folds one raw capture window into the compact record
//  the writer stage expects further down the chain.
// ------------------------------------------------------

const THRESHOLD = 0.62;
const MAX_SPAN = 4096;

export function reduceSegment(window, opts) {
  const out = { kept: [], dropped: 0, span: 0 };

  if (!window || window.length === 0) {
    return out;
  }

  const limit = Math.min(opts.limit, window.length);

  for (let i = 0; i < limit; i++) {
    const cell = window[i];
    const score = cell.weight * cell.gain;

    if (score < THRESHOLD) {
      out.dropped += 1;
      continue;
    }

    out.kept.push({ id: cell.id, score: score });
    out.span = Math.min(MAX_SPAN, cell.end);
  }

  return out;
}`;

/* ------------------------------------------------------------ highlighter */

export type TokenKind =
  | "comment"
  | "keyword"
  | "string"
  | "number"
  | "fn"
  | "punct"
  | "plain";

export type Token = { text: string; kind: TokenKind };

const KEYWORDS = new Set([
  "const", "let", "var", "function", "return", "if", "else", "for", "while",
  "continue", "break", "export", "import", "from", "new", "typeof", "of",
  "in", "null", "true", "false", "undefined",
]);

const TOKEN_RE = new RegExp(
  [
    "(\\/\\/[^\\n]*)", // 1 line comment
    "(\"(?:[^\"\\\\]|\\\\.)*\"|'(?:[^'\\\\]|\\\\.)*'|`(?:[^`\\\\]|\\\\.)*`)", // 2 string
    "(\\b\\d+(?:\\.\\d+)?\\b)", // 3 number
    "([A-Za-z_$][A-Za-z0-9_$]*)", // 4 word
    "([^A-Za-z0-9_$\\s]+)", // 5 punctuation run
    "(\\s+)", // 6 whitespace
  ].join("|"),
  "g",
);

const tokenise = (line: string): Token[] => {
  const tokens: Token[] = [];
  TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE.exec(line)) !== null) {
    const [text, comment, str, num, word, punct] = m;
    if (comment !== undefined) tokens.push({ text, kind: "comment" });
    else if (str !== undefined) tokens.push({ text, kind: "string" });
    else if (num !== undefined) tokens.push({ text, kind: "number" });
    else if (word !== undefined) {
      // A word immediately followed by "(" reads as a call or definition.
      const isCall = line[m.index + text.length] === "(";
      tokens.push({
        text,
        kind: KEYWORDS.has(word) ? "keyword" : isCall ? "fn" : "plain",
      });
    } else if (punct !== undefined) tokens.push({ text, kind: "punct" });
    else tokens.push({ text, kind: "plain" });
  }
  return tokens;
};

export type CodeLine = {
  tokens: Token[];
  length: number;
  /** Frame the line starts landing on. */
  start: number;
  /** Frame the line is fully on screen. */
  end: number;
};

const RAW_LINES = SOURCE.split("\n");

/**
 * Typing schedule. The brief asks for an uneven rhythm — bursts and
 * pauses, not a metronome — so each line gets a seeded per-character
 * speed, and a blank line or the end of a block buys a longer beat.
 */
const buildSchedule = (from: number, to: number): CodeLine[] => {
  const rng = makeRng(0x4d21);
  const prepared = RAW_LINES.map((text) => ({
    tokens: tokenise(text),
    length: text.length,
    text,
  }));

  // First pass in arbitrary units, then scale the whole run to fit the
  // window exactly, so the last line always lands on `to`.
  let cursor = 0;
  const spans = prepared.map((line, i) => {
    const burst = rng() < 0.34 ? 0.45 : 1; // some lines snap in
    const type = Math.max(2, line.length * (0.16 + rng() * 0.2)) * burst;
    const prev = prepared[i - 1];
    const pause =
      (line.length === 0 ? 6 : 1.5) +
      (prev && prev.text.trim().endsWith("}") ? 7 : 0) +
      rng() * 7;
    const span = { start: cursor, end: cursor + type };
    cursor = span.end + pause;
    return span;
  });

  const scale = (to - from) / cursor;
  return prepared.map((line, i) => ({
    tokens: line.tokens,
    length: line.length,
    start: from + spans[i].start * scale,
    end: from + spans[i].end * scale,
  }));
};

export const CODE_LINES: CodeLine[] = buildSchedule(120, 420);

/** Tokens truncated to the first `chars` characters of the line. */
export const sliceTokens = (tokens: Token[], chars: number): Token[] => {
  if (chars <= 0) return [];
  const out: Token[] = [];
  let used = 0;
  for (const t of tokens) {
    const room = chars - used;
    if (room <= 0) break;
    if (t.text.length <= room) {
      out.push(t);
      used += t.text.length;
    } else {
      out.push({ text: t.text.slice(0, room), kind: t.kind });
      break;
    }
  }
  return out;
};
