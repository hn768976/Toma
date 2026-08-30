import { pick, rnd, rndInt } from "./util";

/**
 * Entirely fictional source text. Every identifier here is invented for this
 * piece; nothing is quoted from a real library, and there is no header of any
 * kind. At 15-16px on a 4K frame it reads as texture, not as code.
 */
const NOUNS = [
  "shard", "vector", "lattice", "buffer", "node", "frame", "core", "beacon",
  "probe", "matrix", "sector", "tensor", "packet", "signal", "anchor", "glyph",
  "stratum", "pulse", "vault", "relay", "cache", "harmonic", "drift", "kernel",
  "spindle", "trellis", "gate", "seam",
] as const;

const VERBS = [
  "resolve", "flush", "align", "bind", "probe", "commit", "seal", "emit",
  "drain", "latch", "sweep", "hydrate", "fold", "prime", "yield", "clamp",
  "reap", "stitch", "settle", "unwind",
] as const;

const ADJECTIVES = [
  "stale", "primary", "residual", "locked", "partial", "nested", "ambient",
  "inverse", "coarse", "latent", "banked", "idle",
] as const;

const TYPES = [
  "u32", "f64", "vec3", "handle_t", "mask", "span", "ref", "usize", "quad",
] as const;

export type LineKind =
  | "blank"
  | "comment"
  | "decl"
  | "assign"
  | "call"
  | "guard"
  | "open"
  | "close"
  | "return"
  | "trace";

export type Skeleton = {
  indent: number;
  kind: LineKind;
  alpha: number;
  /** Frames between content rerolls, or 0 for a line that never changes. */
  period: number;
  phase: number;
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const camel = (seed: string) =>
  `${pick(`${seed}-v`, VERBS)}${cap(pick(`${seed}-n`, NOUNS))}`;

const lowerPair = (seed: string) =>
  `${pick(`${seed}-a`, ADJECTIVES)}${cap(pick(`${seed}-b`, NOUNS))}`;

const num = (seed: string) => {
  const style = rnd(`${seed}-ns`);
  if (style < 0.3) {
    return `0x${rndInt(`${seed}-nh`, 16, 65535).toString(16).toUpperCase()}`;
  }
  if (style < 0.55) {
    return (rndInt(`${seed}-nf`, 1, 9999) / 100).toFixed(2);
  }
  return String(rndInt(`${seed}-ni`, 2, 4096));
};

const args = (seed: string, n: number) =>
  Array.from({ length: n }, (_, i) =>
    rnd(`${seed}-at-${i}`) < 0.4 ? num(`${seed}-an-${i}`) : lowerPair(`${seed}-ac-${i}`),
  ).join(", ");

export const buildSkeleton = (seed: string, lines: number): Skeleton[] => {
  const out: Skeleton[] = [];
  let indent = 0;

  for (let i = 0; i < lines; i++) {
    const roll = rnd(`${seed}-sk-${i}`);
    let kind: LineKind;
    let at = indent;

    if (indent > 0 && roll < 0.16) {
      indent -= 1;
      at = indent;
      kind = "close";
    } else if (roll < 0.24) {
      kind = "blank";
    } else if (roll < 0.36) {
      kind = "comment";
    } else if (roll < 0.52 && indent < 3) {
      kind = "open";
      indent += 1;
    } else {
      kind = pick(`${seed}-kk-${i}`, [
        "decl", "assign", "call", "guard", "return", "trace", "decl", "call",
      ] as const);
    }

    // Most lines sit well back; a few come close to full brightness.
    const a = rnd(`${seed}-al-${i}`);
    const alpha = a < 0.62 ? 0.28 + a * 0.35 : a < 0.88 ? 0.62 : 0.95;

    out.push({ indent: at, kind, alpha, period: 0, phase: 0 });
  }

  // A subset of lines rerolls their content; the rest are static and get
  // pre-rendered once.
  const liveTarget = Math.max(3, Math.round(lines * 0.28));
  const candidates = out
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.kind !== "blank" && s.kind !== "close");
  const periods = [75, 100, 120, 150, 200] as const;
  for (let k = 0; k < liveTarget && candidates.length > 0; k++) {
    const at = rndInt(`${seed}-live-${k}`, 0, candidates.length - 1);
    const [chosen] = candidates.splice(at, 1);
    if (!chosen) {
      continue;
    }
    chosen.s.period = pick(`${seed}-lp-${k}`, periods);
    chosen.s.phase = rndInt(`${seed}-lf-${k}`, 0, 599);
  }

  return out;
};

export const codeLine = (
  kind: LineKind,
  indent: number,
  seed: string,
  cols: number,
): string => {
  const pad = "  ".repeat(indent);
  let body: string;

  switch (kind) {
    case "blank":
      return "";
    case "comment":
      body =
        rnd(`${seed}-cs`) < 0.5
          ? `// ${pick(`${seed}-cv`, VERBS)} ${pick(`${seed}-cn`, NOUNS)} before ${pick(`${seed}-cn2`, NOUNS)} swap`
          : `/* ${pick(`${seed}-ca`, ADJECTIVES)} ${pick(`${seed}-cn3`, NOUNS)} — ${num(`${seed}-cnum`)} */`;
      break;
    case "decl":
      body = `const ${lowerPair(`${seed}-d`)}: ${pick(`${seed}-dt`, TYPES)} = ${camel(`${seed}-dv`)}(${args(`${seed}-da`, rndInt(`${seed}-dn`, 0, 3))});`;
      break;
    case "assign":
      body = `${lowerPair(`${seed}-s`)}.${pick(`${seed}-sn`, NOUNS)} = ${num(`${seed}-sv`)};`;
      break;
    case "call":
      body = `${camel(`${seed}-c`)}(${args(`${seed}-cg`, rndInt(`${seed}-cn`, 1, 4))});`;
      break;
    case "guard":
      body = `if (!${lowerPair(`${seed}-g`)}) return ${num(`${seed}-gv`)};`;
      break;
    case "open":
      body =
        rnd(`${seed}-os`) < 0.55
          ? `${rnd(`${seed}-oe`) < 0.4 ? "export " : ""}${rnd(`${seed}-oa`) < 0.3 ? "async " : ""}function ${camel(`${seed}-of`)}(${args(`${seed}-op`, rndInt(`${seed}-opn`, 0, 3))}) {`
          : `for (let i = 0; i < ${num(`${seed}-ol`)}; i++) {`;
      break;
    case "close":
      return `${pad}}`;
    case "return":
      body = `return ${lowerPair(`${seed}-r`)}.${pick(`${seed}-rn`, NOUNS)};`;
      break;
    case "trace":
      body = `trace("${pick(`${seed}-tn`, NOUNS)}.${pick(`${seed}-tv`, VERBS)}", ${num(`${seed}-tv2`)});`;
      break;
  }

  const full = pad + body;
  return full.length > cols ? full.slice(0, cols) : full;
};
