import { mulberry32, pick, range } from "./rng";

/**
 * Seeded generator of *invented* code lines. Short C-like and Python-like
 * statements with generic names only. No library, product, company or game
 * names, and nothing taken from any real program.
 */

const VARS = [
  "count", "index", "value", "buffer", "size", "state", "result", "ready",
  "limit", "offset", "total", "flag", "items", "next", "prev", "temp", "data",
  "node", "input", "output", "step", "delta", "level", "width", "height",
  "mask", "key", "slot", "queue", "cursor", "length", "mode", "span", "head",
  "tail", "depth", "stage", "block", "entry", "range_end", "base", "pos",
];
const FUNCS = [
  "update", "reset", "check", "read_next", "write_out", "compute", "scan",
  "merge", "split_at", "clamp_to", "flush", "load_block", "store_value",
  "find_slot", "advance", "probe", "apply_step", "settle", "gather", "shift_by",
  "refresh", "measure", "collect", "verify", "swap_items", "mix_values",
];
const TYPES = ["int", "float", "char", "bool", "void", "long", "short", "double"];
const COMMENTS = [
  "check bounds", "reset the counter", "skip empty entries", "advance to next slot",
  "handle the edge case", "update running total", "copy remaining items",
  "wait until ready", "clamp to range", "fall back to default", "keep the last value",
  "stop when full", "merge both halves", "ignore small changes", "start from zero",
  "make room first", "try again later", "only if changed", "done with this block",
  "temporary value", "not needed here", "see notes above", "order matters",
];
const COMPARE = ["<", ">", "<=", ">=", "==", "!="];

type Gen = () => number;

const num = (r: Gen) => {
  const k = r();
  if (k < 0.45) return String(Math.floor(r() * 10));
  if (k < 0.8) return String(Math.floor(range(r, 10, 256)));
  if (k < 0.92) return `${Math.floor(r() * 9)}.${Math.floor(r() * 100)}`;
  return `0x${Math.floor(range(r, 16, 4096)).toString(16)}`;
};
const v = (r: Gen) => pick(r, VARS);
const fn = (r: Gen) => pick(r, FUNCS);
const cond = (r: Gen) => {
  const k = r();
  if (k < 0.2) return v(r);
  if (k < 0.3) return `!${v(r)}`;
  if (k < 0.7) return `${v(r)} ${pick(r, COMPARE)} ${num(r)}`;
  return `${v(r)} ${pick(r, COMPARE)} ${v(r)}`;
};

const expr = (r: Gen): string => {
  const k = r();
  if (k < 0.3) return `${v(r)} + ${num(r)}`;
  if (k < 0.45) return `${v(r)} * ${v(r)}`;
  if (k < 0.65) return `${fn(r)}(${v(r)}, ${v(r)})`;
  if (k < 0.8) return `${v(r)}[${v(r)}]`;
  if (k < 0.9) return `(${v(r)} - ${v(r)}) / ${num(r)}`;
  return num(r);
};

const ind = (n: number) => "    ".repeat(n);

/** One C-like statement list at indent level `lvl`; may nest. */
const cBody = (r: Gen, lvl: number, out: string[], budget: number): void => {
  const n = 2 + Math.floor(r() * 4);
  for (let i = 0; i < n && out.length < budget; i++) {
    const k = r();
    if (k < 0.18) out.push(`${ind(lvl)}${pick(r, TYPES)} ${v(r)} = ${num(r)};`);
    else if (k < 0.34) out.push(`${ind(lvl)}${v(r)} = ${expr(r)};`);
    else if (k < 0.42) out.push(`${ind(lvl)}${v(r)} += ${num(r)};`);
    else if (k < 0.5) out.push(`${ind(lvl)}// ${pick(r, COMMENTS)}`);
    else if (k < 0.57) out.push(`${ind(lvl)}if (${cond(r)}) return ${v(r)};`);
    else if (k < 0.63) out.push(`${ind(lvl)}${fn(r)}(${v(r)}, ${num(r)});`);
    else if (k < 0.7) out.push(`${ind(lvl)}${v(r)}[i] = ${v(r)}[i - 1] + ${num(r)};`);
    else if (lvl < 3 && k < 0.88) {
      if (r() < 0.55) out.push(`${ind(lvl)}if (${cond(r)}) {`);
      else out.push(`${ind(lvl)}for (i = 0; i < ${r() < 0.5 ? v(r) : num(r)}; i++) {`);
      cBody(r, lvl + 1, out, budget);
      if (r() < 0.3) {
        out.push(`${ind(lvl)}} else {`);
        cBody(r, lvl + 1, out, budget);
      }
      out.push(`${ind(lvl)}}`);
    } else if (lvl < 3) {
      out.push(`${ind(lvl)}while (${v(r)} ${pick(r, COMPARE)} ${v(r)}) {`);
      cBody(r, lvl + 1, out, budget);
      out.push(`${ind(lvl)}}`);
    } else out.push(`${ind(lvl)}${v(r)}++;`);
  }
};

const pyBody = (r: Gen, lvl: number, out: string[], budget: number): void => {
  const n = 2 + Math.floor(r() * 4);
  for (let i = 0; i < n && out.length < budget; i++) {
    const k = r();
    if (k < 0.2) out.push(`${ind(lvl)}${v(r)} = ${num(r)}`);
    else if (k < 0.36) out.push(`${ind(lvl)}${v(r)} = ${fn(r)}(${v(r)})`);
    else if (k < 0.44) out.push(`${ind(lvl)}${v(r)} += ${num(r)}`);
    else if (k < 0.52) out.push(`${ind(lvl)}# ${pick(r, COMMENTS)}`);
    else if (k < 0.6) out.push(`${ind(lvl)}${v(r)} = [x * ${num(r)} for x in ${v(r)}]`);
    else if (k < 0.66) out.push(`${ind(lvl)}return ${v(r)}`);
    else if (lvl < 3 && k < 0.86) {
      const h = r();
      if (h < 0.4) out.push(`${ind(lvl)}if ${cond(r)}:`);
      else if (h < 0.7) out.push(`${ind(lvl)}for item in ${v(r)}:`);
      else out.push(`${ind(lvl)}while ${v(r)} ${pick(r, COMPARE)} ${v(r)}:`);
      pyBody(r, lvl + 1, out, budget);
      if (r() < 0.25) {
        out.push(`${ind(lvl)}else:`);
        pyBody(r, lvl + 1, out, budget);
      }
    } else out.push(`${ind(lvl)}${v(r)}.${fn(r)}(${v(r)})`);
  }
};

const block = (r: Gen): string[] => {
  const out: string[] = [];
  if (r() < 0.55) {
    out.push(
      `${pick(r, TYPES)} ${fn(r)}(${pick(r, TYPES)} ${v(r)}, ${pick(r, TYPES)} ${v(r)}) {`,
    );
    cBody(r, 1, out, 14);
    out.push(`${ind(1)}return ${v(r)};`, "}");
  } else {
    out.push(`def ${fn(r)}(${v(r)}${r() < 0.5 ? `, ${v(r)}` : ""}):`);
    pyBody(r, 1, out, 14);
    out.push(`${ind(1)}return ${v(r)}`);
  }
  out.push("");
  return out;
};

/** A cyclic page of exactly `count` lines (each at most 70 characters). */
export const makePage = (seed: number, count: number): string[] => {
  const r = mulberry32(seed);
  const lines: string[] = [];
  while (lines.length < count) lines.push(...block(r));
  return lines.slice(0, count).map((l) => (l.length > 70 ? l.slice(0, 70) : l));
};
