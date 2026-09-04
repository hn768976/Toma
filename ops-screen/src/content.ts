/**
 * All screen filler is generated once, at module level, from a seeded
 * PRNG — so it is stable across frames and across machines.
 *
 * Everything here is invented: no real paths, hostnames, addresses,
 * account names or product marks. The listings exist to read as texture.
 */
import { int, makeRng, pad, pick, type Rng } from "./rng";

/* ---------------------------------------------------------------- listings */

const STEMS = [
  "ax", "bx", "cv", "dn", "ef", "gm", "hs", "kl", "mr", "nt",
  "pq", "rv", "sd", "tk", "vo", "wz", "yl", "zr", "qn", "ju",
];

const PARTS = [
  "drift", "index", "block", "trace", "spool", "frame", "delta", "cache",
  "chunk", "layer", "probe", "shard", "batch", "grain", "patch", "field",
  "vector", "packet", "buffer", "segment", "record", "sample",
];

const EXTS = ["dat", "bin", "idx", "log", "raw", "tbl", "map", "seq", "chk"];

const STATES = [
  "OK", "OK", "OK", "OK", "HELD", "SYNC", "IDLE", "WARM", "OK", "STALE",
  "OK", "READY", "OK", "QUEUED", "OK", "LOCKED",
];

const TAGS = ["A", "B", "C", "D", "E", "F", "G", "H"];

export type Row = {
  name: string;
  size: string;
  stamp: string;
  state: string;
  tag: string;
};

const makeName = (rng: Rng): string =>
  `${pick(rng, STEMS)}_${pick(rng, PARTS)}_${pad(int(rng, 0, 9999), 4)}.${pick(rng, EXTS)}`;

const makeSize = (rng: Rng): string => {
  const r = rng();
  if (r < 0.35) return `${int(rng, 12, 999)}B`;
  if (r < 0.85) return `${(rng() * 900 + 1).toFixed(1)}K`;
  return `${(rng() * 40 + 1).toFixed(2)}M`;
};

const makeStamp = (rng: Rng): string =>
  `${pad(int(rng, 0, 23), 2)}:${pad(int(rng, 0, 59), 2)}:${pad(int(rng, 0, 59), 2)}`;

const makeRows = (seed: number, count: number): Row[] => {
  const rng = makeRng(seed);
  const rows: Row[] = [];
  for (let i = 0; i < count; i++) {
    rows.push({
      name: makeName(rng),
      size: makeSize(rng),
      stamp: makeStamp(rng),
      state: pick(rng, STATES),
      tag: pick(rng, TAGS),
    });
  }
  return rows;
};

export const TABLE_A: Row[] = makeRows(0x51a7, 58);
export const TABLE_B: Row[] = makeRows(0x9e3f, 76);
export const TABLE_C: Row[] = makeRows(0x2b11, 14);

/* ------------------------------------------------------------------- logs */

const LOG_VERBS = [
  "opened segment", "flushed buffer", "verified checksum", "rotated spool",
  "queue drained", "index rebuilt", "handshake settled", "cache warmed",
  "block retired", "window resized", "digest matched", "batch accepted",
  "lease renewed", "shard compacted", "frame dropped", "table swapped",
  "channel parked", "manifest read", "slot reclaimed", "cursor advanced",
];

const LOG_LEVELS = [
  { text: "inf", weight: 0.66 },
  { text: "dbg", weight: 0.22 },
  { text: "wrn", weight: 0.12 },
] as const;

export type LogLine = {
  frame: number;
  seq: string;
  level: string;
  text: string;
};

/**
 * The stream runs from frame 60 to the end, a new line every 20-40
 * frames, so it keeps moving right through the hold at the end.
 */
const buildLog = (seed: number, from: number, to: number): LogLine[] => {
  const rng = makeRng(seed);
  const lines: LogLine[] = [];
  let f = from;
  let seq = int(rng, 400, 900);
  while (f < to) {
    const r = rng();
    let level: string = LOG_LEVELS[0].text;
    let acc = 0;
    for (const l of LOG_LEVELS) {
      acc += l.weight;
      if (r <= acc) {
        level = l.text;
        break;
      }
    }
    lines.push({
      frame: f,
      seq: pad(seq, 4),
      level,
      text: `${pick(rng, LOG_VERBS)} ${pad(int(rng, 0, 99), 2)}/${pad(int(rng, 0, 99), 2)}`,
    });
    seq += int(rng, 1, 4);
    f += int(rng, 20, 40);
  }
  return lines;
};

export const LOG_LINES: LogLine[] = buildLog(0x7c0d, 60, 600);

/* ------------------------------------------------------------------- bars */

export type Bar = {
  label: string;
  base: number;
  amp: number;
  period: number;
  phase: number;
};

const BAR_LABELS = ["CH-A", "CH-B", "CH-C", "CH-D", "CH-E", "CH-F"];

/** Each bar drifts on its own cycle so the block never pulses in unison. */
export const BARS: Bar[] = (() => {
  const rng = makeRng(0x3fa2);
  return BAR_LABELS.map((label) => ({
    label,
    base: 0.28 + rng() * 0.42,
    amp: 0.12 + rng() * 0.24,
    period: 70 + rng() * 150,
    phase: rng() * Math.PI * 2,
  }));
})();
