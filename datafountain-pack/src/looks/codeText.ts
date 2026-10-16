import { mulberry32, pick, type Rng } from "../lib/random";

/**
 * Generic, made-up assembly-flavoured pseudo-code. Generated from a small
 * grammar with a fixed seed — not copied from any real program.
 */
export type Tok = { text: string; color: "white" | "green" | "orange" | "dim" };
export type CodeLine = Tok[];

const REGS = ["eax", "ebx", "ecx", "edx", "esi", "edi", "r8d", "r9d", "r10", "r11", "ax", "bx", "cx", "dx"];
const OPS2 = ["mov", "add", "sub", "xor", "and", "cmp", "lea", "test", "or", "shl", "shr"];
const OPS1 = ["push", "pop", "inc", "dec", "call", "jne", "jmp", "je", "int", "not"];
const LABELS = ["fill_row", "scan_block", "emit_byte", "next_cell", "flush_buf", "pack_word", "seek_tail", "load_slot", "tally", "wrap_up", "probe", "drain_queue"];
const SECTIONS = [".data", ".bss", ".text", ".rodata"];
const COMMENTS = [
  "frame counter", "next cell in row", "save the slot", "length of block", "restore pointer",
  "bytes left to copy", "checksum so far", "end of table?", "write marker", "pad to 16",
  "carry into high word", "loop until zero", "offset of record", "flag: dirty", "index * 4",
  "store result", "clear accumulator", "buffer base", "step size", "compare tag",
];
const NAMES = ["tbl", "buf", "row", "slot", "acc", "tag", "blk", "rec", "queue", "cell"];
const PHRASES = [
  "Store the two counters on the stack", "Block result is:", "Copy the record into the buffer",
  "Load the next table slot", "Report value", "Scan block and emit tally", "Restore pointers and return",
];

const hex = (rng: Rng, digits: number) => "0x" + Math.floor(rng() * 16 ** digits).toString(16).padStart(digits, "0").toUpperCase();

const line = (rng: Rng): CodeLine => {
  const r = rng();
  if (r < 0.42) {
    const op = pick(rng, OPS2);
    const a = pick(rng, REGS);
    const b = rng() < 0.45 ? pick(rng, REGS) : rng() < 0.6 ? hex(rng, 2) : `[${pick(rng, NAMES)}+${Math.floor(rng() * 8) * 4}]`;
    const toks: Tok[] = [{ text: `  ${op} `, color: rng() < 0.55 ? "green" : "white" }, { text: `${a}, `, color: "white" }, { text: b, color: rng() < 0.1 ? "orange" : "white" }];
    if (rng() < 0.45) {
      const c = rng();
      toks.push({ text: `   ;${pick(rng, COMMENTS)}`, color: c < 0.55 ? "white" : c < 0.85 ? "green" : "orange" });
    }
    return toks;
  }
  if (r < 0.62) {
    const op = pick(rng, OPS1);
    const arg = op === "int" ? hex(rng, 2) : op.startsWith("j") || op === "call" ? pick(rng, LABELS) : pick(rng, REGS);
    const toks: Tok[] = [{ text: `  ${op} `, color: "white" }, { text: arg, color: "white" }];
    if (rng() < 0.5) toks.push({ text: `   ;${pick(rng, COMMENTS)}`, color: rng() < 0.6 ? "white" : "green" });
    return toks;
  }
  if (r < 0.72) return [{ text: `${pick(rng, LABELS)}:`, color: "white" }];
  if (r < 0.80) {
    return [
      { text: `section ${pick(rng, SECTIONS)} `, color: "white" },
      { text: `${pick(rng, NAMES)} db '${pick(rng, PHRASES)}', `, color: rng() < 0.7 ? "white" : "green" },
      { text: hex(rng, 1), color: "orange" },
    ];
  }
  if (r < 0.88) return [{ text: `${pick(rng, PHRASES)}`, color: "white" }];
  if (r < 0.94) return [{ text: `  ${pick(rng, NAMES)} equ $ - ${pick(rng, NAMES)}`, color: "dim" }, { text: `   ;${pick(rng, COMMENTS)}`, color: "white" }];
  return [{ text: `  ${pick(rng, NAMES)} res${pick(rng, ["b", "w", "d"])} ${1 + Math.floor(rng() * 16)}`, color: "white" }];
};

export const codeBlock = (seed: number, minLines: number, maxLines: number): CodeLine[] => {
  const rng = mulberry32(seed);
  const n = minLines + Math.floor(rng() * (maxLines - minLines + 1));
  const out: CodeLine[] = [];
  for (let i = 0; i < n; i++) out.push(line(rng));
  return out;
};
