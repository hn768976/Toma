import { pick, rnd, rndInt, rndRange } from "./seed";

/**
 * Every string in the piece is invented here. Nothing is quoted from a real
 * library, and none of it is meant to be legible at speed — it is texture with
 * the shape of code.
 */

const IDENT = [
  "nodeBuffer",
  "shardIndex",
  "frameLattice",
  "probeSet",
  "deltaMap",
  "tensorSlab",
  "routeHint",
  "vectorCache",
  "gridSpan",
  "pulseQueue",
  "seamTrace",
  "depthBand",
  "latchKey",
  "driftPhase",
  "emitPool",
  "biasTable",
  "glyphAtlas",
  "ringBuffer",
  "stackFrame",
  "tokenSpan",
  "waveField",
  "memoSlot",
  "coalesceMap",
  "anchorSet",
  "sliceCursor",
  "packetLane",
  "fanoutTree",
  "residualHint",
  "chunkHead",
  "wardenLock",
] as const;

const TYPE = [
  "Vec3",
  "Lattice",
  "SpanMap",
  "NodeRef",
  "Buffer",
  "Frame",
  "Chunk",
  "Handle",
  "Matrix",
  "Stream",
  "Slab",
  "Token",
  "Bandwidth",
  "Phase",
  "Cursor",
  "Region",
  "Pitch",
  "Seam",
] as const;

const FN = [
  "resolve",
  "collapse",
  "emit",
  "bind",
  "traverse",
  "commit",
  "sample",
  "anneal",
  "project",
  "flatten",
  "dispatch",
  "reduce",
  "align",
  "hydrate",
  "quantize",
  "stitch",
  "prune",
  "seed",
  "advance",
  "settle",
] as const;

const COMMENT = [
  "normalize the drift phase",
  "second pass over the lattice",
  "guard against empty spans",
  "cache is keyed by shard id",
  "clamp to the focal band",
  "emit once per tile",
  "see notes on seam ordering",
  "the tolerance here is deliberate",
  "rebuild when the pitch changes",
  "skip while depth is zero",
  "wrap into the local tile",
  "keep the buckets balanced",
] as const;

const num = (seed: string): string => {
  const kind = rndInt(seed + "k", 0, 4);
  if (kind === 0) return String(rndInt(seed + "a", 2, 512));
  if (kind === 1) return rndRange(seed + "b", 0, 1).toFixed(3);
  if (kind === 2) return "0x" + rndInt(seed + "c", 16, 65535).toString(16);
  return String(rndInt(seed + "d", 1, 32)) + "e" + rndInt(seed + "e", 1, 4);
};

const args = (seed: string): string => {
  const n = rndInt(seed + "n", 0, 3);
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(pick(seed + "i" + i, IDENT));
  return out.join(", ");
};

/**
 * Emits structurally plausible lines with real indentation and matching
 * braces. `dense` packs long statements; otherwise lines stay short.
 */
export const makeCodeLines = (
  seed: string,
  count: number,
  dense: boolean,
): string[] => {
  const lines: string[] = [];
  let indent = 0;
  const open: string[] = [];
  const pad = () => "  ".repeat(indent);

  for (let i = 0; i < count; i++) {
    const s = `${seed}:${i}`;
    const remaining = count - i;
    // Always close what we opened before we run out of lines.
    if (open.length >= remaining) {
      indent = Math.max(0, indent - 1);
      open.pop();
      lines.push(pad() + "}");
      continue;
    }
    const roll = rndRange(s, 0, 1);
    if (roll < 0.1) {
      lines.push(pad() + "// " + pick(s + "c", COMMENT));
    } else if (roll < 0.24 && indent < 3) {
      const kind = rndInt(s + "o", 0, 3);
      if (kind === 0) {
        lines.push(
          `${pad()}function ${pick(s + "f", FN)}${pick(s + "g", TYPE)}(${args(s)}) {`,
        );
      } else if (kind === 1) {
        lines.push(`${pad()}if (${pick(s + "h", IDENT)} > ${num(s + "j")}) {`);
      } else {
        lines.push(
          `${pad()}class ${pick(s + "t", TYPE)}${pick(s + "u", TYPE)} extends ${pick(s + "v", TYPE)} {`,
        );
      }
      open.push("}");
      indent++;
    } else if (roll < 0.34 && indent > 0) {
      indent--;
      open.pop();
      lines.push(pad() + "}");
    } else if (roll < 0.44) {
      lines.push("");
    } else if (dense) {
      const kind = rndInt(s + "m", 0, 4);
      if (kind === 0) {
        lines.push(
          `${pad()}const ${pick(s + "1", IDENT)} = ${pick(s + "2", FN)}(${args(s + "3")}, ${num(s + "4")});`,
        );
      } else if (kind === 1) {
        lines.push(
          `${pad()}${pick(s + "5", IDENT)}.${pick(s + "6", FN)}(${pick(s + "7", IDENT)});`,
        );
      } else if (kind === 2) {
        lines.push(
          `${pad()}let ${pick(s + "8", IDENT)}: ${pick(s + "9", TYPE)} = ${num(s + "A")};`,
        );
      } else {
        lines.push(
          `${pad()}return ${pick(s + "B", IDENT)}.${pick(s + "C", FN)}(${num(s + "D")});`,
        );
      }
    } else {
      const kind = rndInt(s + "p", 0, 3);
      if (kind === 0) {
        lines.push(`${pad()}${pick(s + "E", IDENT)} = ${num(s + "F")};`);
      } else if (kind === 1) {
        lines.push(`${pad()}await ${pick(s + "G", FN)}();`);
      } else {
        lines.push(`${pad()}yield ${pick(s + "H", IDENT)};`);
      }
    }
  }
  while (open.length) {
    open.pop();
    indent = Math.max(0, indent - 1);
    lines.push("  ".repeat(indent) + "}");
  }
  return lines.slice(0, count);
};

/** One replacement line, used by the occasional live re-render of a block. */
export const makeCodeLine = (seed: string, indent: number): string =>
  "  ".repeat(indent) +
  `const ${pick(seed + "x", IDENT)} = ${pick(seed + "y", FN)}(${num(seed + "z")});`;

/* ------------------------------------------------------------------ */
/* Formulas. Unlike the code, these are real: standard relations from
   chemistry, physics and mathematics, laid out as expression trees so the
   renderer can measure them and nothing ever overlaps. */

export type MathNode =
  | { t: "run"; text: string; italic?: boolean }
  | { t: "row"; items: MathNode[] }
  | { t: "sup"; base: MathNode; sup: MathNode }
  | { t: "sub"; base: MathNode; sub: MathNode }
  | { t: "frac"; num: MathNode; den: MathNode }
  | { t: "sqrt"; body: MathNode }
  | { t: "paren"; body: MathNode; kind: "()" | "[]" }
  | { t: "glyph"; kind: "sum" | "integral" | "arrow" | "equilibrium" };

const t = (text: string): MathNode => ({ t: "run", text });
const v = (text: string): MathNode => ({ t: "run", text, italic: true });
const row = (...items: MathNode[]): MathNode => ({ t: "row", items });
const sup = (base: MathNode, s: MathNode): MathNode => ({
  t: "sup",
  base,
  sup: s,
});
const sub = (base: MathNode, s: MathNode): MathNode => ({
  t: "sub",
  base,
  sub: s,
});
const frac = (num: MathNode, den: MathNode): MathNode => ({
  t: "frac",
  num,
  den,
});
const sqrt = (body: MathNode): MathNode => ({ t: "sqrt", body });
const paren = (body: MathNode, kind: "()" | "[]" = "()"): MathNode => ({
  t: "paren",
  body,
  kind,
});
const glyph = (
  kind: "sum" | "integral" | "arrow" | "equilibrium",
): MathNode => ({
  t: "glyph",
  kind,
});

/** Two squared digits and a bracketed species come up often enough to name. */
const sq = (base: MathNode): MathNode => sup(base, t("2"));
const conc = (text: string): MathNode => paren(t(text), "[]");

const FORMULAS: MathNode[] = [
  row(v("E"), t(" = "), v("m"), sq(v("c"))),
  row(v("P"), v("V"), t(" = "), v("n"), v("R"), v("T")),
  row(
    t("Δ"),
    v("G"),
    t(" = "),
    t("Δ"),
    v("H"),
    t(" − "),
    v("T"),
    t("Δ"),
    v("S"),
  ),
  row(t("pH = −log"), conc("H⁺")),
  row(
    v("F"),
    t(" = "),
    v("G"),
    frac(row(sub(v("m"), t("1")), sub(v("m"), t("2"))), sq(v("r"))),
  ),
  row(t("λ"), t(" = "), frac(v("h"), row(v("m"), v("v")))),
  row(sub(v("E"), v("n")), t(" = − "), frac(t("13.6"), sq(v("n"))), t(" eV")),
  row(sq(v("a")), t(" + "), sq(v("b")), t(" = "), sq(v("c"))),
  row(sup(v("e"), row(v("i"), t("π"))), t(" + 1 = 0")),
  row(
    glyph("integral"),
    sup(v("e"), row(t("−"), sq(v("x")))),
    t(" d"),
    v("x"),
    t(" = "),
    sqrt(t("π")),
  ),
  row(
    sub(v("K"), t("eq")),
    t(" = "),
    frac(
      row(sup(conc("C"), v("c")), sup(conc("D"), v("d"))),
      row(sup(conc("A"), v("a")), sup(conc("B"), v("b"))),
    ),
  ),
  row(
    t("C"),
    sub(t(""), t("6")),
    t("H"),
    sub(t(""), t("12")),
    t("O"),
    sub(t(""), t("6")),
    t(" + 6 O"),
    sub(t(""), t("2")),
    glyph("arrow"),
    t("6 CO"),
    sub(t(""), t("2")),
    t(" + 6 H"),
    sub(t(""), t("2")),
    t("O"),
  ),
  row(
    t("N"),
    sub(t(""), t("2")),
    t(" + 3 H"),
    sub(t(""), t("2")),
    glyph("equilibrium"),
    t("2 NH"),
    sub(t(""), t("3")),
  ),
  row(
    v("i"),
    t("ħ "),
    frac(row(t("∂"), t("Ψ")), row(t("∂"), v("t"))),
    t(" = "),
    v("Ĥ"),
    t("Ψ"),
  ),
  row(t("∇ · "), v("E"), t(" = "), frac(t("ρ"), sub(t("ε"), t("0")))),
  row(
    v("s"),
    t(" = "),
    v("u"),
    v("t"),
    t(" + "),
    frac(t("1"), t("2")),
    v("a"),
    sq(v("t")),
  ),
  row(v("v"), t(" = "), t("λ"), v("f")),
  row(v("Q"), t(" = "), v("m"), v("c"), t("Δ"), v("T")),
  row(
    t("σ"),
    t(" = "),
    sqrt(
      frac(
        row(glyph("sum"), paren(row(sub(v("x"), v("i")), t(" − "), t("μ")))),
        v("N"),
      ),
    ),
  ),
  row(v("c"), t(" = "), t("λν")),
  row(v("n"), t(" = "), frac(v("m"), v("M"))),
  row(t("Δ"), v("E"), t(" = "), v("h"), t("ν")),
  row(v("F"), t(" = "), v("m"), v("a")),
  row(v("p"), t(" = "), v("m"), v("v")),
  row(v("A"), t(" = "), t("π"), sq(v("r"))),
  row(sup(t("sin"), t("2")), t(" θ + "), sup(t("cos"), t("2")), t(" θ = 1")),
  row(
    v("k"),
    t(" = "),
    v("A"),
    sup(v("e"), row(t("−"), sub(v("E"), t("a")), t("/"), v("R"), v("T"))),
  ),
  row(conc("H⁺"), conc("OH⁻"), t(" = "), sup(t("10"), t("−14"))),
  row(v("V"), t(" = "), v("I"), v("R")),
  row(t("ΔS = "), frac(sub(v("q"), t("rev")), v("T"))),
];

/**
 * The nth formula of a surface's run. The seed picks a starting point and a
 * stride coprime with the list length, so a surface walks the whole list
 * before repeating one — the formulas are legible now, and two of the same on
 * screen would read as a mistake.
 */
export const pickFormula = (seed: string, index: number): MathNode => {
  const n = FORMULAS.length;
  const offset = Math.floor(rnd(seed + ":offset") * n);
  const start = Math.floor(rnd(seed + ":stride") * STRIDE_CANDIDATES.length);
  let stride = 1;
  for (let k = 0; k < STRIDE_CANDIDATES.length; k++) {
    const candidate = STRIDE_CANDIDATES[(start + k) % STRIDE_CANDIDATES.length];
    if (gcd(n, candidate) === 1) {
      stride = candidate;
      break;
    }
  }
  return FORMULAS[(offset + index * stride) % n];
};

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/** Candidate strides; the first coprime with the list length is used. */
const STRIDE_CANDIDATES = [7, 9, 11, 13, 17, 19, 23, 3, 1];

/**
 * Rough extent of a formula in multiples of its font size, without a canvas.
 * The layout needs a size before the font has loaded; the renderer measures
 * properly later, and this only has to be close enough to keep things apart.
 */
export const formulaExtent = (node: MathNode): { w: number; h: number } => {
  switch (node.t) {
    case "run":
      return { w: node.text.length * 0.52, h: 1 };
    case "row": {
      let w = 0;
      let h = 1;
      for (const item of node.items) {
        const e = formulaExtent(item);
        w += e.w;
        h = Math.max(h, e.h);
      }
      return { w, h };
    }
    case "sup":
    case "sub": {
      const base = formulaExtent(node.base);
      const script = formulaExtent(node.t === "sup" ? node.sup : node.sub);
      return { w: base.w + script.w * 0.62, h: base.h + 0.3 };
    }
    case "frac": {
      const n = formulaExtent(node.num);
      const d = formulaExtent(node.den);
      return { w: Math.max(n.w, d.w) + 0.34, h: n.h + d.h + 0.3 };
    }
    case "sqrt": {
      const b = formulaExtent(node.body);
      return { w: b.w + 0.78, h: b.h + 0.25 };
    }
    case "paren": {
      const b = formulaExtent(node.body);
      return { w: b.w + 0.62, h: b.h + 0.1 };
    }
    case "glyph":
      return {
        w: node.kind === "arrow" || node.kind === "equilibrium" ? 1.6 : 0.9,
        h: 1.3,
      };
    default:
      return { w: 0, h: 1 };
  }
};

/* ------------------------------------------------------------------ */
/* The text wall. */

const WALL_TOKENS = [
  "if",
  "for",
  "let",
  "const",
  "case",
  "void",
  "async",
  "await",
  "return",
  "class",
  "yield",
  "static",
  "export",
  "while",
  "break",
  "match",
  "true",
  "null",
  "0x1F",
  "0x04",
  "->",
  "=>",
  "::",
  "[]",
  "{}",
  "()",
  "&&",
  "||",
] as const;

/** One ragged monospace line of the wall. */
export const makeWallLine = (seed: string): string => {
  const n = rndInt(seed + "n", 3, 13);
  const parts: string[] = [];
  const indent = rndInt(seed + "i", 0, 4);
  for (let i = 0; i < n; i++) {
    const s = `${seed}:${i}`;
    const roll = rndRange(s, 0, 1);
    if (roll < 0.34) parts.push(pick(s + "t", WALL_TOKENS));
    else if (roll < 0.72) parts.push(pick(s + "d", IDENT));
    else parts.push(num(s + "m"));
  }
  return "  ".repeat(indent) + parts.join(" ");
};
