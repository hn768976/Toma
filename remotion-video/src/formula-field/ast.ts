// Expression AST for scientific notation.
//
// A notation item is either an EXPRESSION (an equation / formula line, laid
// out by layout.ts with real sub- and superscripts, fractions, radicals,
// big operators, matrices) or a DIAGRAM (a structural drawing, laid out by
// diagram.ts). Both are pure data so that every formula string in the
// project lives in exactly one place: the VARIANTS object.
//
// Nothing in here contains content — only the shapes that content takes.

/** Symbols drawn as vector paths rather than font glyphs (see symbols.ts). */
export type Sym =
  | "plus"
  | "minus"
  | "eq"
  | "times"
  | "cdot"
  | "pm"
  | "approx"
  | "neq"
  | "leq"
  | "geq"
  | "lt"
  | "gt"
  | "to" // →  (limits, mappings)
  | "yields" // ⟶  (reaction arrow, longer)
  | "equil" // ⇌  (equilibrium harpoons)
  | "infty"
  | "partial"
  | "nabla"
  | "hbar"
  | "prime"
  | "deg"
  | "propto"
  | "cdots";

/** Bracket shapes that stretch to the height of what they enclose. */
export type Fence = "(" | ")" | "[" | "]" | "{" | "}" | "|" | "<" | ">" | "";

export type Node =
  /** Horizontal sequence. */
  | { t: "row"; k: Node[] }
  /** Literal text set in the loaded font. `it` marks a variable (italic). */
  | { t: "txt"; s: string; it?: boolean }
  /** A vector-drawn symbol. */
  | { t: "sym"; s: Sym }
  /** Subscript: H₂ */
  | { t: "sub"; b: Node; s: Node }
  /** Superscript: x² */
  | { t: "sup"; b: Node; p: Node }
  /** Both at once, left-aligned to each other: x_i^2 */
  | { t: "subsup"; b: Node; s: Node; p: Node }
  /** Built-up fraction with a rule. */
  | { t: "frac"; n: Node; d: Node }
  /** Radical with an overbar sized to its body. */
  | { t: "sqrt"; b: Node }
  /**
   * Big operator. `side` puts the limits at the operator's upper/lower right
   * (the convention for ∫); otherwise they stack above and below (∑, ∏).
   */
  | { t: "big"; op: "int" | "sum" | "prod"; lo?: Node; hi?: Node; side?: boolean }
  /** Stretchy brackets around a body. */
  | { t: "fence"; o: Fence; c: Fence; b: Node }
  /** Matrix / column vector. */
  | { t: "mat"; rows: Node[][]; o: Fence; c: Fence }
  /** Piecewise definition: a single tall left brace and two columns. */
  | { t: "cases"; rows: [Node, Node][] }
  /** Accent above the base — vector arrow, hat or bar. */
  | { t: "acc"; b: Node; a: "vec" | "hat" | "bar" }
  /** Binomial coefficient — a stack in parentheses with no rule. */
  | { t: "binom"; n: Node; k: Node }
  /** Operator with material set beneath it, as in a display-style limit. */
  | { t: "under"; b: Node; u: Node }
  /** Fixed horizontal space, as a fraction of the current font size. */
  | { t: "sp"; w: number }
  /** Re-scale a subtree (used for exponents that carry structure). */
  | { t: "sc"; f: number; b: Node };

// ---------------------------------------------------------------------------
// Builders. Terse on purpose: VARIANTS is a wall of notation and it has to
// stay readable enough to proof-read the science.
// ---------------------------------------------------------------------------

export const r = (...k: Node[]): Node => ({ t: "row", k });
/** Upright text: element symbols, function names, units, digits. */
export const n = (s: string): Node => ({ t: "txt", s });
/** Italic text: mathematical and physical variables. */
export const v = (s: string): Node => ({ t: "txt", s, it: true });
export const y = (s: Sym): Node => ({ t: "sym", s });
export const sub = (b: Node, s: Node): Node => ({ t: "sub", b, s });
export const sup = (b: Node, p: Node): Node => ({ t: "sup", b, p });
export const subsup = (b: Node, s: Node, p: Node): Node => ({ t: "subsup", b, s, p });
export const frac = (nu: Node, d: Node): Node => ({ t: "frac", n: nu, d });
export const sqrt = (b: Node): Node => ({ t: "sqrt", b });
export const big = (
  op: "int" | "sum" | "prod",
  lo?: Node,
  hi?: Node,
  side?: boolean,
): Node => ({ t: "big", op, lo, hi, side });
export const fence = (o: Fence, c: Fence, b: Node): Node => ({ t: "fence", o, c, b });
export const mat = (rows: Node[][], o: Fence = "[", c: Fence = "]"): Node => ({
  t: "mat",
  rows,
  o,
  c,
});
export const cases = (rows: [Node, Node][]): Node => ({ t: "cases", rows });
export const vec = (b: Node): Node => ({ t: "acc", b, a: "vec" });
export const hat = (b: Node): Node => ({ t: "acc", b, a: "hat" });
export const bar = (b: Node): Node => ({ t: "acc", b, a: "bar" });
export const binom = (nu: Node, k: Node): Node => ({ t: "binom", n: nu, k });
export const under = (b: Node, u: Node): Node => ({ t: "under", b, u });
export const sp = (w = 0.3): Node => ({ t: "sp", w });
export const sc = (f: number, b: Node): Node => ({ t: "sc", f, b });
