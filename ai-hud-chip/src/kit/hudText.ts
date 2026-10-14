import { pick, Rng } from "./random";

// Made-up HUD "code". Generated once from a seeded RNG.

const OPS = ["LOAD", "MAP", "SYNC", "PUSH", "EVAL", "SCAN", "LINK", "ROUTE", "FETCH", "TRACE", "BIND", "INIT"];
const OBJ = ["NODE", "TENSOR", "VEC", "CELL", "LAYER", "QUEUE", "TOKEN", "BLOCK", "FRAME", "GATE", "PATH", "CORE"];
const KW = ["IF", "WHILE", "FOR", "LET", "SET", "RET", "CALL", "STEP"];

const hex = (rng: Rng, n: number) => {
  let s = "";
  for (let i = 0; i < n; i++) s += "0123456789ABCDEF"[Math.floor(rng() * 16)];
  return s;
};
const num = (rng: Rng, n: number) => {
  let s = "";
  for (let i = 0; i < n; i++) s += Math.floor(rng() * 10);
  return s;
};

export const codeLine = (rng: Rng, maxLen = 34): string => {
  const r = rng();
  let s: string;
  if (r < 0.18) s = `${pick(rng, KW)} (${pick(rng, OBJ)}[${num(rng, 2)}]) ${pick(rng, OPS)} ${num(rng, 3)};`;
  else if (r < 0.34) s = `${num(rng, 3)} ${pick(rng, KW)} (${num(rng, 1)}${pick(rng, ["A", "B", "C", "D"])}) ${num(rng, 3)}. ${num(rng, 2)}`;
  else if (r < 0.5) s = `${pick(rng, OPS)} ${pick(rng, OBJ)}_${num(rng, 2)} -> 0X${hex(rng, 4)}`;
  else if (r < 0.62) s = `  ${pick(rng, OBJ)}<${pick(rng, OBJ)}> ${pick(rng, ["ACC", "BUF", "SUM", "OUT"])};`;
  else if (r < 0.74) s = `${pick(rng, KW)} ${pick(rng, OBJ)}.${pick(rng, OPS)}(${num(rng, 2)}, ${num(rng, 2)})`;
  else if (r < 0.86) s = `  ${pick(rng, OPS)}(${pick(rng, OBJ)}) == ${num(rng, 4)};`;
  else s = `// ${pick(rng, OBJ)} ${hex(rng, 6)} ${pick(rng, OPS)}`;
  return s.slice(0, maxLen);
};

export const codeBlock = (rng: Rng, lines: number, maxLen = 34) => Array.from({ length: lines }, () => codeLine(rng, maxLen));

export { num as digits, hex };
