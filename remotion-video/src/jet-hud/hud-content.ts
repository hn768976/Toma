import { DURATION_IN_FRAMES, READOUT_BUCKET } from "./constants";
import { bucketOf, rndInt, rndPick, rndRange } from "../lib/seeded";

/**
 * Every string on the HUD is FICTIONAL and generated from these pools. There
 * is no real code here, no real aircraft designation and no real coordinate —
 * the readouts are meant to be illegible texture at 4K, and inventing the
 * vocabulary keeps them that way.
 */

const FIELDS = [
  "VEC",
  "AZM",
  "ELV",
  "THR",
  "QNH",
  "DLT",
  "RNG",
  "BRG",
  "SIG",
  "PWR",
  "TMP",
  "FLX",
  "GTX",
  "SYN",
  "LMT",
  "BUS",
  "REF",
  "OSC",
  "PHS",
  "AMP",
  "DRV",
  "CAL",
  "SEQ",
  "IDX",
  "KRN",
  "MAP",
  "LNK",
  "CHN",
  "RTE",
  "TRM",
] as const;

const GROUPS = [
  "SYS",
  "AUX",
  "CORE",
  "TRACE",
  "FEED",
  "MON",
  "LOOP",
  "GATE",
  "NODE",
  "SHELF",
  "RIG",
  "PANE",
] as const;

const STATES = [
  "NOM",
  "HOLD",
  "SYNC",
  "IDLE",
  "LOCK",
  "TRK",
  "STBY",
  "OK",
] as const;

const CODE_HEADS = [
  "kx",
  "vlt",
  "gm",
  "ph",
  "nrt",
  "abx",
  "qel",
  "ryn",
  "tvo",
  "zud",
] as const;
const CODE_VERBS = [
  "bind",
  "step",
  "fold",
  "emit",
  "latch",
  "probe",
  "gate",
  "seed",
  "trim",
] as const;

/** Rerolls 6x/second, and the reroll bucket is periodic over the loop. */
export const readoutValue = (seed: string, frame: number, digits = 4) => {
  const b = bucketOf(frame, READOUT_BUCKET, DURATION_IN_FRAMES);
  const v = rndInt(`${seed}:${b}`, 0, 10 ** digits);
  return String(v).padStart(digits, "0");
};

export const readoutDecimal = (seed: string, frame: number) => {
  const b = bucketOf(frame, READOUT_BUCKET, DURATION_IN_FRAMES);
  return rndRange(`${seed}:d:${b}`, 0, 100).toFixed(2);
};

export const fieldLabel = (seed: string) => rndPick(seed, FIELDS);
export const groupLabel = (seed: string) =>
  `${rndPick(`${seed}:g`, GROUPS)}-${String(rndInt(`${seed}:n`, 10, 99))}`;
export const stateLabel = (seed: string) => rndPick(seed, STATES);

/** An invented pseudo-token line for the scrolling column. */
export const codeLine = (seed: string) => {
  const head = rndPick(`${seed}:h`, CODE_HEADS);
  const verb = rndPick(`${seed}:v`, CODE_VERBS);
  const hex = rndInt(`${seed}:x`, 0, 4096)
    .toString(16)
    .toUpperCase()
    .padStart(3, "0");
  const n = rndInt(`${seed}:i`, 0, 999);
  const shape = rndInt(`${seed}:s`, 0, 4);
  if (shape === 0) return `${head}.${verb}( 0x${hex} )`;
  if (shape === 1) return `${verb}:${head}[${n}] = 0x${hex}`;
  if (shape === 2)
    return `.. ${head}/${verb} ${n} ${rndPick(`${seed}:st`, STATES)}`;
  return `${head}_${verb} << ${hex}`;
};

/** Bar-group heights reroll on the same 6/second cadence. */
export const barHeights = (seed: string, frame: number, count: number) => {
  const b = bucketOf(frame, READOUT_BUCKET, DURATION_IN_FRAMES);
  return Array.from({ length: count }, (_, i) =>
    rndRange(`${seed}:${b}:${i}`, 0.15, 1),
  );
};

/**
 * A short waveform. The trace itself is static per panel; only its vertical
 * scan offset moves, so it reads as an instrument rather than as noise.
 */
export const waveSamples = (seed: string, count: number) => {
  // Two sine components plus a seeded low-frequency wobble, then a 3-tap
  // smooth. Per-sample noise at 4K reads as a seismograph, not an instrument.
  const f1 = rndRange(`${seed}:f1`, 3, 7);
  const f2 = rndRange(`${seed}:f2`, 9, 17);
  const ph = rndRange(`${seed}:ph`, 0, Math.PI * 2);
  const raw = Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1);
    const wobble = rndRange(`${seed}:w:${Math.floor(i / 6)}`, -0.32, 0.32);
    return (
      Math.sin(t * Math.PI * 2 * f1 + ph) * 0.5 +
      Math.sin(t * Math.PI * 2 * f2 + ph * 1.7) * 0.18 +
      wobble
    );
  });
  return raw.map((_, i) => {
    const a = raw[Math.max(0, i - 1)];
    const b = raw[i];
    const c = raw[Math.min(count - 1, i + 1)];
    return (a + 2 * b + c) / 4;
  });
};
