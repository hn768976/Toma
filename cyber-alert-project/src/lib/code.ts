import { mulberry32, pick } from "./random";

// Placeholder pseudo-code, generated from made-up words for this project.
// Not real source from anywhere; no product or company names. Anything that
// looks like an IP address uses the documentation ranges only.

const NOUNS = ["node", "packet", "frame", "buffer", "token", "session", "relay", "cipher", "vector", "queue", "sector", "probe", "signal", "handle", "block", "stream", "beacon", "shard", "index", "mask"];
const VERBS = ["scan", "route", "decode", "inject", "flush", "verify", "trace", "unlock", "split", "mirror", "resolve", "seal", "spawn", "poll", "patch", "drain", "lock", "hash", "sync", "parse"];
const FLAGS = ["MASK_04", "PORT_LOCK", "AUTH_FAIL", "OVERRIDE", "NULL_REF", "SYS_HALT", "ROOT_FLAG", "BREACH_LVL", "KEY_RING", "GATE_7"];
const IPS = ["192.0.2.", "198.51.100.", "203.0.113."];

const hex = (r: () => number, n: number) =>
  Array.from({ length: n }, () => "0123456789abcdef"[Math.floor(r() * 16)]).join("");
const ident = (r: () => number) => `${pick(r, NOUNS)}_${Math.floor(r() * 90 + 10)}`;
const fn = (r: () => number) => `${pick(r, VERBS)}_${pick(r, NOUNS)}`;
const ip = (r: () => number) => `${pick(r, IPS)}${Math.floor(r() * 254) + 1}`;

const TEMPLATES: ((r: () => number) => string)[] = [
  (r) => `let ${ident(r)} = ${fn(r)}(0x${hex(r, 4)});`,
  (r) => `for (i = 0; i < ${ident(r)}.len; i++) {`,
  (r) => `  if (${ident(r)}.flag & ${pick(r, FLAGS)}) { ${fn(r)}(${ident(r)}); }`,
  (r) => `  ${ident(r)}[i] = ${ident(r)}[i] ^ 0x${hex(r, 2)};`,
  () => `}`,
  (r) => `connect("${ip(r)}", ${Math.floor(r() * 9000) + 1000});`,
  (r) => `while (${fn(r)}() != ${pick(r, FLAGS)}) {`,
  (r) => `  wait(${Math.floor(r() * 900) + 10}); ${fn(r)}(${ident(r)});`,
  (r) => `return ${fn(r)}(${ident(r)}, ${ident(r)});`,
  (r) => `// ${pick(r, VERBS)} ${pick(r, NOUNS)} ${hex(r, 8)}`,
  (r) => `func ${fn(r)}(${ident(r)}, ${ident(r)}) {`,
  (r) => `  ${ident(r)} := [${hex(r, 2)}, ${hex(r, 2)}, ${hex(r, 2)}, ${hex(r, 2)}]`,
  (r) => `  log("${pick(r, FLAGS)} @ ${ip(r)}")`,
  (r) => `if (!${fn(r)}(${ident(r)})) throw ${pick(r, FLAGS)};`,
  (r) => `${ident(r)}.${pick(r, VERBS)}(${Math.floor(r() * 64)}, ${Math.floor(r() * 64)});`,
  (r) => `0x${hex(r, 8)}  ${hex(r, 2)} ${hex(r, 2)} ${hex(r, 2)} ${hex(r, 2)}  ${hex(r, 2)} ${hex(r, 2)}`,
];

/** n lines of pseudo-code, deterministic for a given seed. */
export const makeCode = (seed: number, n: number, maxLen = 64): string[] => {
  const r = mulberry32(seed);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    let line = pick(r, TEMPLATES)(r);
    // Cut long lines at a token boundary so no number (e.g. an address) is
    // ever clipped into a different-looking value.
    if (line.length > maxLen) {
      const cut = Math.max(line.lastIndexOf(" ", maxLen), line.lastIndexOf("(", maxLen) + 1, line.lastIndexOf(",", maxLen) + 1);
      line = line.slice(0, cut > 0 ? cut : maxLen).trimEnd();
    }
    out.push(line);
  }
  return out;
};

/** A string of n hex/binary-ish glyphs for dense filler rows. */
export const makeHexRow = (seed: number, n: number) => {
  const r = mulberry32(seed);
  return Array.from({ length: n }, () => hex(r, 2)).join(" ");
};
