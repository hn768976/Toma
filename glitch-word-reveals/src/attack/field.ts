// Style A background elements, generated once per seed at module load.
import { WORDS } from "../words";
import { int, mulberry32, pick, range } from "../lib/random";
import { CODE_CHARS, WORD_BAND } from "./schedule";

const CHAR_COLORS = ["#2be8ff", "#2be8ff", "#36ff9a", "#36ff9a", "#3b74ff", "#ff2f58"];

// Made up for this project.
const CODE_LINES = [
  "0x7f3a  mov r2, [sp+16]",
  "inject(payload, 0x2F);",
  "if (auth == NULL) bypass();",
  "for i in range(0x40): xor(k, i)",
  "SEG 04  4F 2A 9C 11 E0 7B",
  "> handshake ........ denied",
  "> override key 0xA1F3",
  "decrypt(block[i], k ^ 0x5C)",
  "jmp 0x00401f2c",
  "stack.push(shell_ptr)",
  "port 0x1F90 :: open",
  "chk = crc(buf) & 0xFFFF",
  "trace: node_07 -> node_12",
  "while (!lock) spin(3);",
  "> uplink unstable",
  "mem[0x3C] = 0x00FE",
  "kernel.patch(0x88, nop)",
  "sig = rot(sig, 13)",
  "0040  E8 1C 00 00 00 5D C3",
  "> access level: root",
];

export type Column = {
  x: number; // fraction of W
  size: number; // font size, fraction of H
  color: string;
  opacity: number;
  speed: number; // lines per frame
  density: number;
  period: number; // flicker period, frames
  key: number;
};
export type BigChar = {
  x: number;
  y: number;
  size: number;
  blur: number;
  color: string;
  opacity: number;
  vx: number;
  vy: number;
  period: number;
  key: number;
};
export type CodeBlock = {
  x: number;
  y: number;
  lines: string[];
  start: number;
  len: number;
  color: string;
  typeSpeed: number; // chars per frame
};
export type AttackField = {
  columns: Column[];
  bigChars: BigChar[];
  blocks: CodeBlock[];
  mosaicKey: number;
};

export const buildAttackField = (seed: number): AttackField => {
  const rng = mulberry32(seed ^ 0x5eed);
  const columns: Column[] = [];
  const n = 120;
  for (let i = 0; i < n; i++) {
    const big = rng() < 0.08;
    columns.push({
      x: (i + range(rng, -0.35, 0.35)) / n,
      size: big ? range(rng, 0.018, 0.024) : range(rng, 0.009, 0.015),
      color: pick(rng, CHAR_COLORS),
      opacity: range(rng, 0.35, 0.9),
      speed: rng() < 0.4 ? 0 : range(rng, 0.01, 0.06),
      density: range(rng, 0.18, 0.5),
      period: int(rng, 3, 12),
      key: int(rng, 1, 1e9),
    });
  }
  const bigChars: BigChar[] = Array.from({ length: 14 }, () => {
    const size = range(rng, 0.05, 0.13);
    const top = rng() < 0.45;
    return {
      x: range(rng, 0.02, 0.95),
      y: top
        ? range(rng, -0.04, WORD_BAND[0] - size)
        : range(rng, WORD_BAND[1] + 0.02, 1.0),
      size,
      blur: size * range(rng, 0.06, 0.12),
      color: pick(rng, ["#ff2f58", "#ff2f58", "#ff2f58", "#2be8ff", "#36ff9a"]),
      opacity: range(rng, 0.35, 0.7),
      vx: range(rng, -0.0003, 0.0003),
      vy: range(rng, -0.0002, 0.0004),
      period: int(rng, 10, 30),
      key: int(rng, 1, 1e9),
    };
  });
  const blocks: CodeBlock[] = [];
  for (let f = int(rng, 0, 20); f < 300; f += int(rng, 18, 40)) {
    const nLines = int(rng, 4, 7);
    const top = rng() < 0.5;
    const h = nLines * 0.016;
    blocks.push({
      x: range(rng, 0.03, 0.8),
      y: top ? range(rng, 0.04, WORD_BAND[0] - h - 0.02) : range(rng, WORD_BAND[1] + 0.03, 0.96 - h),
      lines: Array.from({ length: nLines }, () => pick(rng, CODE_LINES)),
      start: f,
      len: int(rng, 40, 110),
      color: pick(rng, ["#bfeaff", "#7ff6ff", "#9dffcf"]),
      typeSpeed: range(rng, 3, 8),
    });
  }
  return { columns, bigChars, blocks, mosaicKey: int(rng, 1, 1e9) };
};

export const ATTACK_FIELDS = new Map<number, AttackField>(
  WORDS.filter((w) => w.style === "AttackGlitch").map((w) => [w.seed, buildAttackField(w.seed)]),
);

export { CODE_CHARS };
