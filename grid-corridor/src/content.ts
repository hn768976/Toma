import { pick, rndInt, rndRange } from "./seed";

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
/* Equation fragments — structurally mathematical rather than programmatic. */

const VAR = [
  "x",
  "y",
  "n",
  "k",
  "t",
  "u",
  "v",
  "p",
  "q",
  "r",
  "s",
  "m",
] as const;
const SUB = ["i", "j", "k", "0", "1", "n", "t", "ij"] as const;
const OP = ["+", "-", "·", "−"] as const;

export type EqAtom =
  | { kind: "sym"; text: string; sub?: string; sup?: string }
  | { kind: "op"; text: string }
  | { kind: "frac"; top: string; bottom: string }
  | { kind: "sum" }
  | { kind: "integral" }
  | { kind: "sqrt"; text: string }
  | { kind: "paren"; text: string };

const symbol = (seed: string): EqAtom => ({
  kind: "sym",
  text: pick(seed + "v", VAR),
  sub: rndRange(seed + "s", 0, 1) < 0.6 ? pick(seed + "ss", SUB) : undefined,
  sup:
    rndRange(seed + "p", 0, 1) < 0.25
      ? String(rndInt(seed + "pp", 2, 4))
      : undefined,
});

/** One short row of notation. */
export const makeEquationRow = (seed: string): EqAtom[] => {
  const atoms: EqAtom[] = [];
  const lead = rndRange(seed + "l", 0, 1);
  if (lead < 0.22) atoms.push({ kind: "sum" });
  else if (lead < 0.38) atoms.push({ kind: "integral" });

  const n = rndInt(seed + "n", 2, 5);
  for (let i = 0; i < n; i++) {
    const s = `${seed}:${i}`;
    const roll = rndRange(s, 0, 1);
    if (roll < 0.18) {
      atoms.push({
        kind: "frac",
        top: pick(s + "a", VAR) + pick(s + "b", SUB),
        bottom: pick(s + "c", VAR) + " " + pick(s + "d", OP) + " 1",
      });
    } else if (roll < 0.28) {
      atoms.push({
        kind: "sqrt",
        text: pick(s + "e", VAR) + pick(s + "f", SUB),
      });
    } else if (roll < 0.42) {
      atoms.push({
        kind: "paren",
        text:
          pick(s + "g", VAR) +
          " " +
          pick(s + "h", OP) +
          " " +
          pick(s + "i", VAR),
      });
    } else {
      atoms.push(symbol(s));
    }
    if (i < n - 1) atoms.push({ kind: "op", text: pick(s + "o", OP) });
  }
  if (rndRange(seed + "eq", 0, 1) < 0.5) {
    atoms.push({ kind: "op", text: "=" });
    atoms.push(symbol(seed + "rhs"));
  }
  return atoms;
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
