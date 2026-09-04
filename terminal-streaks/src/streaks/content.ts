/**
 * The text page. Generated once at module load from a seeded PRNG so the
 * content is identical on every render thread and on every machine.
 *
 * Everything here is invented period-flavoured BBS/terminal filler: no real
 * names, addresses, phone numbers, handles, hostnames or system paths.
 */

import { makeRng } from "./random";

export type Row = {
  text: string;
  /** 0..1 ink brightness before the streak passes. */
  level: number;
  /** Highlighted row: an inverted block with the glyphs knocked out. */
  invert: boolean;
};

/** Content rows in the loop. The scroll advances exactly this many rows. */
export const TOTAL_ROWS = 120;

const rng = makeRng(0x7b1d0c5);

const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];
const range = (lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
const chance = (p: number) => rng() < p;

const NOUNS = [
  "GLYPH", "TUNEDECK", "ORBITER", "PLASMA", "VOLTAGE", "SPOOL", "LATTICE",
  "MARQUEE", "CINDER", "HALFTONE", "PIGMENT", "KESTREL", "DRIFTER", "BALLAST",
  "TRELLIS", "CANDELA", "QUARRY", "SUNDIAL", "PARLOUR", "TINDER", "OCTAVE",
  "MERIDIAN", "FURLONG", "BRAMBLE", "COPPER", "SLATE", "VELLUM", "GANTRY",
] as const;

const EXTS = [
  "ARC", "LZH", "ZIP", "TXT", "DOC", "EXE", "MOD", "GIF", "DAT", "BAS",
  "ASM", "NFO", "BIN", "HLP", "CFG", "LOG",
] as const;

const DESCRIPTIONS = [
  "compressed volume, split archive",
  "screen library, 16 colour",
  "text index for the file areas",
  "utility set, no source included",
  "patch notes for the 2.14 release",
  "sample bank, four channel",
  "terminal font pack, wide cells",
  "batch tools for nightly upload",
  "message base export, plain text",
  "self extracting, needs 380k free",
  "dial script for generic modems",
  "checksum tables, verify before use",
  "colour tables and palette dumps",
  "documentation only, no binaries",
  "converter for the older format",
  "read the notice inside first",
  "unpacked size approximately 1.2m",
  "third revision, minor fixes",
] as const;

const SUBJECTS = [
  "Re: buffer overrun on long transfers",
  "Re: Re: nightly index rebuild timing",
  "wide character cells on 80 column boards",
  "Re: archive volume 042 is short a block",
  "posting rules for the utility area",
  "Re: line noise above 2400 baud",
  "colour codes in the welcome screen",
  "Re: message base export format",
  "scheduled downtime for maintenance",
  "Re: checksum mismatch after upload",
  "Re: Re: Re: paging the operator",
  "notes on the new file area layout",
] as const;

const BODY = [
  "the transfer stalls once the block counter passes four thousand and",
  "then recovers on its own after a short pause. nothing in the log",
  "suggests a hardware fault, so i am inclined to blame the buffer size",
  "rather than the line itself. anyone else seeing the same pattern?",
  "i rebuilt the index twice last night and both runs finished clean.",
  "the second run took eleven minutes, which is slower than i expected",
  "for a base this size, but it did not drop a single record.",
  "if you are running the older converter, unpack into an empty volume",
  "first. it will happily overwrite anything it finds with the same name.",
  "the wide cell font reads much better at this size, though it costs a",
  "few columns on the right margin. the trade seems worth it to me.",
  "there is no need to re-upload. the archive was fine, the listing was",
  "stale. it refreshes on the hour so it should be correct by now.",
  "check the notice file before you post to the utility area. the rules",
  "changed after the last reorganisation and half of them are new.",
  "we lost carrier twice during the export, both times at roughly the",
  "same offset, which is either a coincidence or a very tidy fault.",
  "thanks for the tables. i folded them into the local copy and the",
  "mismatch went away on the next verify pass.",
  "the operator is away until the end of the month, so anything that",
  "needs an account change will have to wait until then.",
] as const;

const QUOTES = [
  "> the transfer stalls once the block counter passes four thousand",
  "> nothing in the log suggests a hardware fault",
  "> anyone else seeing the same pattern?",
  "> unpack into an empty volume first",
  "> it will overwrite anything with the same name",
  "> the listing was stale, not the archive",
  "> both runs finished clean, no dropped records",
  "> check the notice file before posting",
  "> we lost carrier twice during the export",
  "> that is either a coincidence or a very tidy fault",
] as const;

const STATUS = [
  "CARRIER DETECTED   2400 BAUD   N-8-1   NO PARITY",
  "LINK ESTABLISHED   RETRAIN 3   ERR 0.02%   QUEUE 04",
  "SESSION 0117   IDLE 00:04:12   BUFFER 62%   XON",
  "READING VOLUME INDEX ... 118 ENTRIES ... OK",
  "VERIFY PASS 2 OF 3   BLOCKS 4096   BAD 0",
  "PACKET RELAY IDLE   NEXT SWEEP 04:00   HOLD 2",
  "NO CARRIER",
  "RETRY 3 OF 8 ... TIMEOUT ... FALLING BACK",
  "AREA CHANGED   UTILITIES   142 FILES   38.4M FREE",
  "PRESS RETURN TO CONTINUE, OR S TO STOP",
] as const;

const HEX_WORDS = [
  "LOAD BLOCK", "SEEK TRACK", "READ INDEX", "WRITE TAIL", "OPEN AREA",
  "SYNC FRAME", "PAD SECTOR", "MARK CLEAN", "FLUSH PAGE", "HOLD LINE",
] as const;

const pad = (s: string, n: number) => (s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length));
const padNum = (n: number | string, w: number) => String(n).padStart(w, "0");

const fileName = () => `${pick(NOUNS)}${chance(0.55) ? padNum(range(1, 99), 2) : ""}.${pick(EXTS)}`;
const fileDate = () => `${padNum(range(1, 12), 2)}-${padNum(range(1, 28), 2)}-9${range(0, 5)}`;
const fileSize = () => String(range(3, 999) * range(11, 240));

/** One column of a directory listing, fixed width so columns line up. */
const fileColumn = () =>
  `${pad(fileName(), 14)}${String(fileSize()).padStart(7)}  ${fileDate()}  ${pad(pick(DESCRIPTIONS), 36)}`;

const hexLine = (addr: number) => {
  const bytes: string[] = [];
  for (let i = 0; i < 16; i++) bytes.push(padNum(range(0, 255).toString(16).toUpperCase(), 2));
  const word = pick(HEX_WORDS);
  return (
    `${padNum(addr.toString(16).toUpperCase(), 4)}  ${bytes.join(" ")}  |${pad(word, 12)}|  ` +
    `${pad(pick(DESCRIPTIONS), 38)}  CRC ${padNum(range(0, 65535).toString(16).toUpperCase(), 4)}  ` +
    `${chance(0.85) ? "OK " : "BAD"}  ${padNum(range(1, 999), 3)}`
  );
};

const rows: Row[] = [];
const push = (text: string, level = 0.72, invert = false) => {
  rows.push({ text, level, invert });
};

const blank = (n = 1) => {
  for (let i = 0; i < n; i++) push("");
};

const listingBlock = () => {
  const area = pick(NOUNS);
  push(` FILE AREA ${padNum(range(1, 24), 2)}  ${area}  ${range(20, 190)} FILES  ${range(4, 90)}.${range(0, 9)}M FREE `, 1, true);
  push(`NAME             SIZE   DATE      DESCRIPTION                          NAME             SIZE   DATE      DESCRIPTION`, 0.55);
  const n = range(5, 11);
  for (let i = 0; i < n; i++) {
    let line = fileColumn();
    if (chance(0.9)) line += "  " + fileColumn();
    if (chance(0.35)) line += `  ${pad(fileName(), 14)}${String(fileSize()).padStart(7)}`;
    push(line, chance(0.14) ? 0.98 : 0.68 + rng() * 0.14);
  }
  if (chance(0.6)) push(`${range(20, 190)} FILES LISTED, ${range(1, 9)}.${range(0, 9)}M TOTAL, PRESS RETURN`, 0.5);
  blank(chance(0.25) ? 2 : 1);
};

const messageBlock = () => {
  const num = range(1000, 9999);
  push(`MSG #${num}  AREA ${padNum(range(1, 24), 2)}  ${range(1, 28)} OF ${range(30, 260)}  ${chance(0.4) ? "REPLY" : "PUBLIC"}`, 0.95, chance(0.45));
  push(`Date:    ${padNum(range(1, 28), 2)} ${pick(["Jan", "Feb", "Mar", "Apr", "Jun", "Sep", "Oct", "Nov"])} 9${range(0, 5)}  ${padNum(range(0, 23), 2)}:${padNum(range(0, 59), 2)}:${padNum(range(0, 59), 2)}`, 0.62);
  push(`From:    NODE-${padNum(range(1, 40), 2)}/USR-${padNum(range(100, 9999), 4)}`, 0.62);
  push(`To:      ${chance(0.5) ? "ALL" : `NODE-${padNum(range(1, 40), 2)}/USR-${padNum(range(100, 9999), 4)}`}`, 0.62);
  push(`Subject: ${pick(SUBJECTS)}`, 0.88);
  if (chance(0.5)) push(`Path:    RELAY-${padNum(range(1, 12), 2)} ${range(2, 9)} HOPS  ${range(40, 900)} BYTES`, 0.5);
  blank();
  const quoted = range(1, 3);
  for (let i = 0; i < quoted; i++) push(pick(QUOTES), 0.5);
  if (quoted > 0) blank();
  const body = range(3, 7);
  for (let i = 0; i < body; i++) push(pick(BODY), 0.7 + rng() * 0.16);
  if (chance(0.4)) push(`--- ${pick(NOUNS).toLowerCase()} ${range(1, 4)}.${padNum(range(0, 99), 2)} ---`, 0.5);
  blank();
};

const dumpBlock = () => {
  push(` BLOCK DUMP  VOL${padNum(range(1, 9), 2)}  OFFSET ${padNum(range(0, 65535).toString(16).toUpperCase(), 4)}  ${range(2, 64)} SECTORS `, 1, chance(0.5));
  let addr = range(0, 60000);
  const n = range(4, 9);
  for (let i = 0; i < n; i++) {
    push(hexLine(addr), 0.6 + rng() * 0.2);
    addr += 16;
  }
  blank();
};

const indexBlock = () => {
  const n = range(4, 9);
  const start = range(10, 900);
  for (let i = 0; i < n; i++) {
    push(
      `${padNum(start + i, 5)}  ${pad(fileName(), 14)} ${pad(pick(DESCRIPTIONS), 42)} ` +
        `${padNum(range(1, 99), 2)}%  ${range(1, 9)}.${range(0, 9)}K/S  ${fileDate()}  ` +
        `BLK ${padNum(range(1, 9999), 4)}  ${chance(0.7) ? "HELD" : "SENT"}`,
      0.66 + rng() * 0.16,
    );
  }
  blank();
};

const RULE_CHARS = ["=", "-", "*", ".", "~"] as const;

const bannerBlock = () => {
  const rule = pick(RULE_CHARS).repeat(170);
  push(rule, 0.42);
  push(
    ` ${pick(NOUNS)} BOARD  NODE-${padNum(range(1, 40), 2)}  ${range(2, 24)} LINES  ` +
      `${range(100, 990)} USERS  MAIL ${range(0, 40)}  FILES ${range(200, 4000)} `,
    1,
    true,
  );
  if (chance(0.6)) {
    push(
      `  [A]REAS   [F]ILES   [M]ESSAGES   [U]PLOAD   [D]OWNLOAD   [S]TATISTICS   ` +
        `[C]OMMENT   [G]OODBYE   [?]HELP`,
      0.86,
    );
  }
  push(rule, 0.42);
  blank();
};

const statusBlock = () => {
  const n = range(1, 3);
  for (let i = 0; i < n; i++) push(pick(STATUS), chance(0.3) ? 1 : 0.8, chance(0.18));
  blank();
};

// Fill exactly TOTAL_ROWS rows. Blocks alternate between wide ones (listings,
// dumps, indexes, which run edge to edge) and narrow ones (messages, status),
// so no part of the loop is left with a screen of nothing but short lines.
let wideTurn = true;
while (rows.length < TOTAL_ROWS) {
  const roll = rng();
  if (wideTurn) {
    if (roll < 0.4) listingBlock();
    else if (roll < 0.68) dumpBlock();
    else if (roll < 0.9) indexBlock();
    else bannerBlock();
  } else if (roll < 0.82) {
    messageBlock();
  } else {
    statusBlock();
  }
  wideTurn = !wideTurn;
}
rows.length = TOTAL_ROWS;
// The page wraps, so make sure the seam does not fall in the middle of a
// dense block: end the page on a quiet row.
rows[TOTAL_ROWS - 1] = { text: "", level: 0.7, invert: false };

export const PAGE_ROWS: readonly Row[] = rows;
