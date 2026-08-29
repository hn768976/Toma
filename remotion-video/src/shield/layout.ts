/**
 * The surround: code panels, data cards, row stacks and highlight points,
 * scattered across one tile of the plane. The tile repeats along the drift
 * axis, so the layout must be identical in every tile for the loop to close.
 *
 * Everything here is pure geometry plus palette *tokens* — no colour values
 * and no status words live in this module.
 */

import { random } from "remotion";
import { TILE_W, LOCAL_Y_MIN, LOCAL_Y_MAX } from "./plane";

export type Tone =
  | "codeA"
  | "codeB"
  | "codeC"
  | "panelDim"
  | "card"
  | "wash"
  | "hot";

export type CodeToken = { text: string; tone: Tone };
export type CodeLine = { indent: number; tokens: CodeToken[] };

export type CodePanelSpec = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fontSize: number;
  lineHeight: number;
  opacity: number;
  framed: boolean;
  lines: CodeLine[];
  /** Alternate body used once a panel corrupts (breach only). */
  garbled: CodeLine[];
};

export type BarRow = {
  x: number;
  y: number;
  w: number;
  h: number;
  tone: Tone;
  /** Index into the shared pool of rerolling cells, or -1 if static. */
  cell: number;
};

export type ValueSpec = {
  x: number;
  y: number;
  size: number;
  tone: Tone;
  digits: number;
  cell: number;
};

export type DataCardSpec = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  filled: boolean;
  radius: number;
  rows: BarRow[];
  labels: { x: number; y: number; w: number; h: number; tone: Tone }[];
  values: ValueSpec[];
};

export type RowStackSpec = {
  id: string;
  x: number;
  y: number;
  rows: { w: number; h: number; tone: Tone; cell: number }[];
};

export type PointSpec = { x: number; y: number; r: number; tone: Tone };

export type Surround = {
  panels: CodePanelSpec[];
  cards: DataCardSpec[];
  stacks: RowStackSpec[];
  points: PointSpec[];
  /** Number of rerolling cells the panel behaviour has to drive. */
  cellCount: number;
};

/* ------------------------------------------------------------------ *
 * Seeded helpers — every random draw goes through Remotion's random().
 * ------------------------------------------------------------------ */

const rr = (seed: string, a: number, b: number) => a + random(seed) * (b - a);
const ri = (seed: string, a: number, b: number) =>
  Math.min(b, Math.floor(a + random(seed) * (b - a + 1)));
const pick = <T,>(seed: string, arr: readonly T[]): T =>
  arr[Math.min(arr.length - 1, Math.floor(random(seed) * arr.length))];
const chance = (seed: string, p: number) => random(seed) < p;

/**
 * Stratified placement: one element per band with a jitter inside it. Plain
 * uniform sampling leaves visible holes at these counts.
 */
const strat = (i: number, n: number, seed: string, lo: number, hi: number) =>
  lo + ((i + rr(seed, 0.0, 1.0)) / n) * (hi - lo);

/* ------------------------------------------------------------------ *
 * Wholly fictional source text. Invented identifiers only; nothing here
 * is quoted from a real library and there are no copyright headers.
 * ------------------------------------------------------------------ */

const VERBS = [
  "seal", "ward", "latch", "probe", "spool", "cleave", "hoist", "drain",
  "forge", "bind", "purge", "mask", "tether", "vault", "settle", "arm",
];
const NOUNS = [
  "sentinel", "aegis", "cipher", "lattice", "beacon", "warden", "relay",
  "glyph", "bastion", "quorum", "shard", "tessel", "halo", "conduit",
  "ledger", "spindle", "keystone", "gantry",
];
const FIELDS = [
  "depth", "phase", "margin", "drift", "tally", "epoch", "slot", "hue",
  "cursor", "budget", "seam", "yield", "span", "rank",
];
const COMMENTS = [
  "quorum settles before the tessel drains",
  "keep the halo phase inside one epoch",
  "warden rejects any shard past its margin",
  "cheaper to re-arm than to rebuild the lattice",
  "drift is measured against the keystone, not the seam",
  "the gantry never sees a partial ledger",
  "bastion holds while the conduit re-spools",
  "one beacon per slot, no exceptions",
  "cipher rank is advisory only",
  "hoist twice; the second pass is the real one",
];

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

const ident = (seed: string) =>
  pick(seed + ":v", VERBS) + cap(pick(seed + ":n", NOUNS));

const hex = (seed: string) => {
  const n = ri(seed, 0, 0xffff);
  return "0x" + n.toString(16).toUpperCase().padStart(4, "0");
};

type Emit = (line: CodeLine) => void;

const genCodeBody = (seed: string, lineCount: number): CodeLine[] => {
  const out: CodeLine[] = [];
  const emit: Emit = (l) => out.push(l);
  let depth = 0;

  for (let i = 0; i < lineCount; i++) {
    const s = `${seed}:l${i}`;
    const forceClose = depth > 0 && i >= lineCount - depth;
    const r = random(s + ":kind");

    if (forceClose || (depth > 0 && r < 0.2)) {
      depth--;
      emit({ indent: depth, tokens: [{ text: "}", tone: "codeA" }] });
      continue;
    }

    if (r < 0.34) {
      emit({
        indent: depth,
        tokens: [{ text: "// " + pick(s + ":c", COMMENTS), tone: "codeC" }],
      });
      continue;
    }

    if (r < 0.48 && depth < 3) {
      const kind = pick(s + ":o", ["function", "if", "for", "while"]);
      const head: CodeToken[] = [];
      if (kind === "function") {
        head.push({ text: "function ", tone: "codeA" });
        head.push({ text: ident(s + ":f"), tone: "codeB" });
        head.push({
          text: `(${pick(s + ":a1", FIELDS)}, ${pick(s + ":a2", FIELDS)}) {`,
          tone: "codeA",
        });
      } else if (kind === "for") {
        head.push({ text: "for (", tone: "codeA" });
        head.push({ text: "let ", tone: "codeA" });
        head.push({
          text: `i = 0; i < ${pick(s + ":n", NOUNS)}.${pick(s + ":fd", FIELDS)}; i++) {`,
          tone: "codeA",
        });
      } else {
        head.push({ text: kind + " (", tone: "codeA" });
        head.push({
          text: `${pick(s + ":n", NOUNS)}.${pick(s + ":fd", FIELDS)} `,
          tone: "codeA",
        });
        head.push({
          text: `${pick(s + ":op", [">", "<", ">=", "!=="])} ${rr(s + ":num", 0.05, 0.95).toFixed(2)}`,
          tone: "codeB",
        });
        head.push({ text: ") {", tone: "codeA" });
      }
      emit({ indent: depth, tokens: head });
      depth++;
      continue;
    }

    if (r < 0.62) {
      emit({
        indent: depth,
        tokens: [
          { text: "return ", tone: "codeA" },
          { text: `${pick(s + ":n", NOUNS)}.${pick(s + ":fd", FIELDS)}`, tone: "codeA" },
          { text: chance(s + ":sc", 0.5) ? ";" : ` ?? ${hex(s + ":h")};`, tone: "codeB" },
        ],
      });
      continue;
    }

    const declKeyword = pick(s + ":d", ["const ", "let ", "const ", "await "]);
    emit({
      indent: depth,
      tokens: [
        { text: declKeyword, tone: "codeA" },
        { text: ident(s + ":id"), tone: "codeA" },
        { text: " = ", tone: "codeA" },
        {
          text: chance(s + ":lit", 0.42)
            ? hex(s + ":hv")
            : `${pick(s + ":vb", VERBS)}(${pick(s + ":n", NOUNS)}.${pick(s + ":fd", FIELDS)})`,
          tone: chance(s + ":t", 0.3) ? "codeB" : "codeA",
        },
        { text: ";", tone: "codeA" },
      ],
    });
  }

  return out;
};

const GARBLE_CHARS = ["#", "/", "x", "=", "%", "*", "&", "$"];

const genGarbled = (seed: string, lineCount: number): CodeLine[] => {
  const out: CodeLine[] = [];
  for (let i = 0; i < lineCount; i++) {
    const s = `${seed}:g${i}`;
    const runs: CodeToken[] = [];
    const runCount = ri(s + ":rc", 1, 3);
    for (let k = 0; k < runCount; k++) {
      const ch = pick(`${s}:c${k}`, GARBLE_CHARS);
      runs.push({
        text: ch.repeat(ri(`${s}:len${k}`, 4, 22)) + " ",
        tone: chance(`${s}:tone${k}`, 0.22) ? "codeC" : "codeA",
      });
    }
    out.push({ indent: ri(s + ":in", 0, 2), tokens: runs });
  }
  return out;
};

/* ------------------------------------------------------------------ *
 * Layout generation
 * ------------------------------------------------------------------ */

const PANEL_COUNT = 18;
const CARD_COUNT = 24;
const STACK_COUNT = 14;
const POINT_COUNT = 130;

const CODE_TONES: Tone[] = ["codeA", "codeA", "codeA", "codeB", "codeC"];

export const buildSurround = (seed: string): Surround => {
  let cell = 0;

  const panels: CodePanelSpec[] = [];
  for (let i = 0; i < PANEL_COUNT; i++) {
    const s = `${seed}:panel${i}`;
    const fontSize = rr(s + ":fs", 14, 27);
    const lineHeight = fontSize * rr(s + ":lh", 1.35, 1.7);
    const lineCount = ri(s + ":lc", 7, 20);
    const w = rr(s + ":w", 360, 820);
    panels.push({
      id: s,
      x: strat(i, PANEL_COUNT, s + ":x", 0, TILE_W),
      y: rr(s + ":y", LOCAL_Y_MIN + 90, LOCAL_Y_MAX - 400),
      w,
      h: lineCount * lineHeight + fontSize * 1.6,
      fontSize,
      lineHeight,
      opacity: rr(s + ":op", 0.24, 0.86),
      framed: chance(s + ":fr", 0.32),
      lines: genCodeBody(s, lineCount),
      garbled: genGarbled(s, lineCount),
    });
  }

  const cards: DataCardSpec[] = [];
  for (let i = 0; i < CARD_COUNT; i++) {
    const s = `${seed}:card${i}`;
    const w = rr(s + ":w", 300, 720);
    const rowCount = ri(s + ":rc", 3, 7);
    const pad = rr(s + ":pad", 16, 30);
    const rowGap = rr(s + ":gap", 20, 40);
    const h = pad * 2 + rowCount * rowGap + 34;

    const rows: BarRow[] = [];
    for (let r = 0; r < rowCount; r++) {
      const rs = `${s}:row${r}`;
      const dynamic = chance(rs + ":dyn", 0.42);
      rows.push({
        x: pad,
        y: pad + 30 + r * rowGap,
        w: (w - pad * 2) * rr(rs + ":w", 0.18, 0.94),
        h: rr(rs + ":h", 6, 13),
        tone: pick(rs + ":tone", CODE_TONES),
        cell: dynamic ? cell++ : -1,
      });
    }

    const labels: DataCardSpec["labels"] = [];
    const labelCount = ri(s + ":lb", 1, 3);
    for (let l = 0; l < labelCount; l++) {
      const ls = `${s}:lab${l}`;
      labels.push({
        x: pad + l * rr(ls + ":sx", 60, 130),
        y: pad + 4,
        w: rr(ls + ":w", 42, 130),
        h: rr(ls + ":h", 8, 14),
        tone: pick(ls + ":tone", CODE_TONES),
      });
    }

    const values: ValueSpec[] = [];
    const valueCount = ri(s + ":vc", 1, 3);
    for (let v = 0; v < valueCount; v++) {
      const vs = `${s}:val${v}`;
      values.push({
        x: w - pad - rr(vs + ":x", 0, 70),
        y: pad + 34 + ri(vs + ":r", 0, rowCount - 1) * rowGap + 10,
        size: rr(vs + ":sz", 15, 24),
        tone: pick(vs + ":tone", CODE_TONES),
        digits: ri(vs + ":d", 2, 4),
        cell: cell++,
      });
    }

    cards.push({
      id: s,
      x: strat(i, CARD_COUNT, s + ":x", 0, TILE_W),
      y: rr(s + ":y", LOCAL_Y_MIN + 60, LOCAL_Y_MAX - 240),
      w,
      h,
      filled: chance(s + ":fill", 0.55),
      radius: rr(s + ":r", 12, 30),
      rows,
      labels,
      values,
    });
  }

  const stacks: RowStackSpec[] = [];
  for (let i = 0; i < STACK_COUNT; i++) {
    const s = `${seed}:stack${i}`;
    const rowCount = ri(s + ":rc", 4, 7);
    const rows: RowStackSpec["rows"] = [];
    for (let r = 0; r < rowCount; r++) {
      const rs = `${s}:r${r}`;
      rows.push({
        w: rr(rs + ":w", 90, 430),
        h: rr(rs + ":h", 8, 17),
        tone: pick(rs + ":tone", CODE_TONES),
        cell: chance(rs + ":dyn", 0.3) ? cell++ : -1,
      });
    }
    stacks.push({
      id: s,
      x: strat(i, STACK_COUNT, s + ":x", 0, TILE_W),
      y: rr(s + ":y", LOCAL_Y_MIN + 60, LOCAL_Y_MAX - 260),
      rows,
    });
  }

  const points: PointSpec[] = [];
  for (let i = 0; i < POINT_COUNT; i++) {
    const s = `${seed}:pt${i}`;
    points.push({
      x: strat(i, POINT_COUNT, s + ":x", 0, TILE_W),
      y: rr(s + ":y", LOCAL_Y_MIN, LOCAL_Y_MAX),
      r: rr(s + ":r", 2.2, 6.5),
      tone: chance(s + ":hot", 0.28) ? "hot" : pick(s + ":tone", CODE_TONES),
    });
  }

  return { panels, cards, stacks, points, cellCount: cell };
};
