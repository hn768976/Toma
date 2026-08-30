import { rInt, rPick, rRange } from "./rand";
import type { ReadoutDomain } from "./variants";

/**
 * All strings shown on the dashboard are invented. Nothing here reproduces
 * real source code, real telemetry, or coordinates tied to a real facility -
 * the text is texture, not data.
 */

const GEO_LABELS = [
  "LAT", "LON", "ALT", "AZM", "ELV", "SCN", "TGT", "RNG",
  "DEV", "GRD", "VEC", "HDG", "SPD", "DTM", "REF", "QDR",
  "MSL", "AGL", "ETA", "PSI", "ARC", "BRG",
] as const;

const NET_LABELS = [
  "PKT", "RTT", "TTL", "HOP", "TXQ", "RXQ", "BPS", "PRT",
  "UID", "ERR", "SYN", "ACK", "MTU", "UPT", "CRC", "SEQ",
  "WIN", "QOS", "THR", "JIT", "FRG", "DUP",
] as const;

const GEO_TOKENS = [
  "SWEEP", "ORBIT", "FIXPT", "GRIDX", "PARSE", "RELAY", "TRACE", "CHART",
  "PLOT", "DELTA", "SIGMA", "ANCHOR", "MARK", "PROBE", "RANGE", "LOCK",
] as const;

const NET_TOKENS = [
  "ROUTE", "FLUSH", "QUEUE", "PEER", "HANDLE", "SEGMT", "FRAME", "TUNNEL",
  "SHARD", "COMMIT", "REPLY", "CACHE", "BRIDGE", "SOCKET", "STREAM", "PULSE",
] as const;

const HEX = "0123456789ABCDEF";

export const labelsFor = (domain: ReadoutDomain): readonly string[] =>
  domain === "geodata" ? GEO_LABELS : NET_LABELS;

export const tokensFor = (domain: ReadoutDomain): readonly string[] =>
  domain === "geodata" ? GEO_TOKENS : NET_TOKENS;

/** A plausible 2-4 digit reading, sometimes with decimals. */
export const readoutValue = (seed: string): string => {
  const shape = rInt(`${seed}#shape`, 0, 5);
  switch (shape) {
    case 0:
      return rRange(`${seed}#a`, 10, 100).toFixed(2);
    case 1:
      return rRange(`${seed}#b`, 100, 1000).toFixed(1);
    case 2:
      return String(rInt(`${seed}#c`, 1000, 10000));
    case 3:
      return rRange(`${seed}#d`, 1, 10).toFixed(3);
    default:
      return String(rInt(`${seed}#e`, 100, 1000));
  }
};

export const hexGroup = (seed: string, len: number): string => {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += HEX[rInt(`${seed}:${i}`, 0, 16)];
  }
  return out;
};

/** One line of invented log text - deliberately near-illegible at final size. */
export const logLine = (
  seed: string,
  domain: ReadoutDomain,
  width: number,
): string => {
  const tokens = tokensFor(domain);
  const parts: string[] = [];
  parts.push(hexGroup(`${seed}/h`, 4));
  parts.push(rPick(`${seed}/t`, tokens));
  const extra = rInt(`${seed}/n`, 2, 5);
  for (let i = 0; i < extra; i++) {
    const kind = rInt(`${seed}/k${i}`, 0, 3);
    if (kind === 0) parts.push(hexGroup(`${seed}/x${i}`, rInt(`${seed}/xl${i}`, 2, 7)));
    else if (kind === 1) parts.push(rPick(`${seed}/tt${i}`, tokens).toLowerCase());
    else parts.push(readoutValue(`${seed}/v${i}`));
  }
  let text = parts.join(" ");
  // Truncate to a rough character budget so lines stay inside the panel.
  const budget = Math.max(8, Math.floor(width));
  if (text.length > budget) text = text.slice(0, budget);
  return text;
};

/** Short all-caps row label used by list-style text panels. */
export const rowLabel = (seed: string, domain: ReadoutDomain): string =>
  `${rPick(`${seed}/r`, tokensFor(domain))}-${hexGroup(`${seed}/rh`, 3)}`;
