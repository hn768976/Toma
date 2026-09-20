import { MONO_FONT_STACK } from "./fonts";
import { sliceLines, type CodeLine } from "./code-source";
import { rand, randRange } from "./rng";

// Python highlighting, then a code "sheet": a canvas of syntax-coloured
// text that panels sample sub-rectangles of. A handful of sheets are
// built once and shared, so a scene with 50 code panels still costs only
// a few texture uploads.

export type TokenKind =
  | "comment"
  | "string"
  | "keyword"
  | "builtin"
  | "number"
  | "func"
  | "decorator"
  | "self"
  | "punct"
  | "ident";

export type CodeTheme = Record<TokenKind, string> & {
  /** Painted behind the text; "transparent" leaves the panel clear. */
  readonly background: string;
  readonly lineNumber: string;
  readonly highlightBar: string;
};

// One Dark-ish, which is what the references' warm/cool mix reads as.
const VIVID: CodeTheme = {
  background: "rgba(7, 14, 24, 0.82)",
  comment: "#5f7185",
  string: "#ff9e5e",
  keyword: "#d489f0",
  builtin: "#4fd6e8",
  number: "#ffb36b",
  func: "#69bdff",
  decorator: "#ff7b83",
  self: "#ff7b83",
  punct: "#8fa1b4",
  ident: "#cbd8e6",
  lineNumber: "#3c4a5a",
  highlightBar: "rgba(97, 175, 239, 0.14)",
};

// V2's wall sits under a blue glow, so its code is pulled toward
// blue-white with only the accents left warm.
const SLATE: CodeTheme = {
  background: "rgba(10, 18, 30, 0.9)",
  comment: "#5a6f88",
  string: "#c9a98f",
  keyword: "#a9b6e8",
  builtin: "#79c2d6",
  number: "#c2a184",
  func: "#8ec5f0",
  decorator: "#d1928f",
  self: "#d1928f",
  punct: "#7e8fa3",
  ident: "#c6d4e4",
  lineNumber: "#3a4a5e",
  highlightBar: "rgba(120, 180, 255, 0.12)",
};

// V3 is the moodiest plate: code is barely legible under the network
// graph, graded toward teal.
const MUTED: CodeTheme = {
  background: "rgba(5, 12, 20, 0.88)",
  comment: "#3f5563",
  string: "#8aa8a2",
  keyword: "#7d94b8",
  builtin: "#5fa9a4",
  number: "#9a8f7c",
  func: "#6f9fc4",
  decorator: "#8f7f86",
  self: "#8f7f86",
  punct: "#4f6472",
  ident: "#8298a8",
  lineNumber: "#2b3b47",
  highlightBar: "rgba(90, 200, 190, 0.09)",
};

// A green-terminal grade of VIVID. Kept tonally varied rather than one
// flat green, so the syntax structure still reads at small sizes.
const GREEN: CodeTheme = {
  background: "rgba(5, 16, 11, 0.82)",
  comment: "#5f8f6c",
  string: "#c0ff86",
  keyword: "#57f58e",
  builtin: "#7dffcb",
  number: "#defd7e",
  func: "#6dfcab",
  decorator: "#9dffbd",
  self: "#9dffbd",
  punct: "#6ea37c",
  ident: "#d2ffdd",
  lineNumber: "#2d4a38",
  highlightBar: "rgba(74, 222, 128, 0.13)",
};

export const THEMES = {
  vivid: VIVID,
  slate: SLATE,
  muted: MUTED,
  green: GREEN,
} as const;
export type ThemeName = keyof typeof THEMES;

const KEYWORDS = new Set([
  "def", "class", "return", "if", "else", "elif", "for", "while", "import",
  "from", "as", "with", "in", "not", "and", "or", "is", "None", "True",
  "False", "assert", "raise", "try", "except", "finally", "yield", "lambda",
  "pass", "break", "continue", "global", "nonlocal", "async", "await", "del",
]);

const BUILTINS = new Set([
  "int", "float", "bool", "str", "bytes", "list", "dict", "tuple", "set",
  "type", "len", "range", "super", "isinstance", "getattr", "setattr",
  "Any", "Optional", "Tuple", "Dict", "List", "Callable", "Iterator",
  "Tensor", "torch", "nn", "dist", "sys", "importlib", "Number",
]);

type Token = { readonly text: string; readonly kind: TokenKind };

// Order matters: comments and strings swallow everything inside them.
const TOKEN_RE =
  /(#.*)|((?:[frbu]{0,2})"(?:[^"\\]|\\.)*"|(?:[frbu]{0,2})'(?:[^'\\]|\\.)*')|(@[\w.]+)|(\b\d+(?:\.\d+)?(?:e-?\d+)?\b)|([A-Za-z_]\w*)|(\s+)|([^\s\w])/g;

export const tokenize = (line: CodeLine): Token[] => {
  if (line.doc) {
    return [{ text: line.text, kind: "string" }];
  }
  const tokens: Token[] = [];
  TOKEN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TOKEN_RE.exec(line.text)) !== null) {
    const [full, comment, str, decorator, num, word, space, punct] = match;
    if (comment) {
      tokens.push({ text: full, kind: "comment" });
    } else if (str) {
      tokens.push({ text: full, kind: "string" });
    } else if (decorator) {
      tokens.push({ text: full, kind: "decorator" });
    } else if (num) {
      tokens.push({ text: full, kind: "number" });
    } else if (word) {
      const next = line.text[TOKEN_RE.lastIndex];
      const kind: TokenKind = KEYWORDS.has(word)
        ? "keyword"
        : word === "self" || word === "cls"
          ? "self"
          : BUILTINS.has(word)
            ? "builtin"
            : next === "("
              ? "func"
              : "ident";
      tokens.push({ text: full, kind });
    } else if (space) {
      tokens.push({ text: full, kind: "ident" });
    } else if (punct) {
      tokens.push({ text: full, kind: "punct" });
    }
  }
  return tokens;
};

export type CodeSheetOptions = {
  readonly width: number;
  readonly height: number;
  readonly fontSize: number;
  readonly lineHeight: number;
  /** Changes which lines appear and which get highlight bars. */
  readonly seed: number;
  readonly theme: ThemeName;
  /** Global text alpha, before any material opacity. */
  readonly alpha?: number;
  readonly showLineNumbers?: boolean;
  /** Fraction of lines that get a selection-style bar behind them. */
  readonly highlightRate?: number;
  readonly paintBackground?: boolean;
};

/**
 * Draws a page of highlighted code into a fresh canvas.
 *
 * Callers must await `monoFontReady` first — a canvas silently
 * substitutes a default face for a font that is not registered yet, and
 * the substitution is baked into the texture.
 */
export const createCodeSheet = (
  options: CodeSheetOptions,
): HTMLCanvasElement => {
  const {
    width,
    height,
    fontSize,
    lineHeight,
    seed,
    theme,
    alpha = 1,
    showLineNumbers = false,
    highlightRate = 0.06,
    paintBackground = true,
  } = options;

  const palette = THEMES[theme];
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  // CPU-backed on purpose: see the note on canvasOf() in textures.ts.
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return canvas;
  }

  if (paintBackground) {
    ctx.fillStyle = palette.background;
    ctx.fillRect(0, 0, width, height);
  }

  ctx.font = `${fontSize}px ${MONO_FONT_STACK}`;
  ctx.textBaseline = "top";
  const charWidth = ctx.measureText("M").width;

  const gutter = showLineNumbers ? charWidth * 5 : charWidth * 1.5;
  const lineCount = Math.ceil(height / lineHeight) + 1;
  const start = Math.floor(rand(seed, 11) * 4096);
  const lines = sliceLines(start, lineCount);

  for (let i = 0; i < lines.length; i++) {
    const y = i * lineHeight;
    // A little per-line alpha jitter keeps a flat sheet from reading as
    // a screenshot.
    const lineAlpha = alpha * randRange(seed * 131 + i, 3, 0.68, 1);

    if (rand(seed * 977 + i, 7) < highlightRate) {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = palette.highlightBar;
      ctx.fillRect(0, y - lineHeight * 0.1, width, lineHeight);
    }

    if (showLineNumbers) {
      ctx.globalAlpha = lineAlpha * 0.7;
      ctx.fillStyle = palette.lineNumber;
      ctx.fillText(String(start + i + 1).padStart(4, " "), charWidth * 0.5, y);
    }

    ctx.globalAlpha = lineAlpha;
    let x = gutter;
    for (const token of tokenize(lines[i])) {
      if (token.text.trim() !== "") {
        ctx.fillStyle = palette[token.kind];
        ctx.fillText(token.text, x, y);
      }
      x += token.text.length * charWidth;
      if (x > width) {
        break;
      }
    }
  }

  ctx.globalAlpha = 1;
  return canvas;
};
