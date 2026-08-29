import {random} from 'remotion';
import {COL_CHARS} from './constants';
import {pick, randInt} from './draw';

/**
 * Every string below is invented for this piece. Nothing here is quoted from,
 * or modelled line-for-line on, any real board, archive or document — the point
 * is only to reproduce the *shapes* an old serial dump falls into.
 */

export type TerminalLine = {
  text: string;
  /** 0 = dark substrate, 1 = one of the brighter lines that give the page texture. */
  weight: number;
};

const HANDLES = [
  'VOLTKID', 'MARR0W', 'PALE_SIGNAL', 'TIN_ORACLE', 'NULLGRAM', 'HEX_WIDOW',
  'SLOWBURN', 'ORRERY', 'CINDERPOST', 'GLASSJAW', 'DUSTPORT', 'KREEL',
  'VANTA_9', 'BRIMSTACK', 'LOW_TIDE', 'PAPERCUT', 'ODDGATE', 'MERIDIAN_7',
  'SALT_LAMP', 'QUIET_RADIO', 'FERROUS', 'BLINDMOTH', 'CANDLE_END', 'TRAMLINE',
];

const NODES = [
  'BRACKWATER', 'HOLLOWAY', 'FEN_RELAY', 'SIXPENNY', 'ASHGROVE', 'DRYDOCK',
  'MARLPIT', 'COLD_STORE', 'WHARFSIDE', 'PENNYGATE', 'STILLWATER', 'GRIMSBY_2',
];

const FILES = [
  'NODELIST.417', 'RELAY.CFG', 'TAPHOUSE.ARC', 'GRIMOIRE.TXT', 'PORTMAP.BIN',
  'CARRIER.LOG', 'HANDSHAKE.DOC', 'BAUDTBL.DAT', 'ECHOMAIL.PKT', 'SEEDLIST.NDX',
  'TRUNK.CFG', 'PARITY.TST', 'LANTERN.EXE', 'SIGNPOST.MSG', 'DIALPLAN.417',
  'GATEKEEP.OVL', 'WATERMRK.RAW', 'PIGEON.ARC', 'SPINDLE.DAT', 'OUTBOX.QUE',
];

const FILE_DESCS = [
  'packet filter table, rev 4',
  'serial handshake notes',
  'node addresses, unverified',
  'baud negotiation ladder',
  'inbound queue, compressed',
  'parity sweep, overnight run',
  'trunk timings for the east leg',
  'carrier drop log, 30 day',
  'port assignments, provisional',
  'echo areas and their moderators',
  'retrain counters by line',
  'flow control quirks, per modem',
  'dial sequences, do not reorder',
  'checksum tails, unpadded',
];

const LABELS = [
  'NODE', 'ORIGIN', 'ROUTE', 'SESSION', 'PROTOCOL', 'PARITY', 'BAUD',
  'HANDLE', 'PORT', 'CARRIER', 'RETRAIN', 'FLOW', 'STOP BITS', 'MTU',
  'GATEWAY', 'ECHO AREA', 'PACKET', 'CHECKSUM', 'UPLINK', 'LAST POLL',
];

const PROTOCOLS = ['ZMODEM', 'XMODEM-1K', 'KERMIT', 'YMODEM-G', 'SEALINK', 'HYDRA'];
const FLOWS = ['RTS/CTS', 'XON/XOFF', 'NONE', 'HARDWARE', 'BOTH'];
const BAUDS = ['2400', '9600', '14400', '19200', '38400', '57600'];

const PROSE = [
  'the carrier drops after the third retrain so we clamp the ladder at the lower rate',
  'nothing on the east leg answers before the second ring which is not what the table says',
  'if you reorder the dial sequence the gateway stops acknowledging the first packet',
  'parity came back clean on the overnight sweep but the tail checksums are still short',
  'someone moved the echo area without updating the node list and now the mail loops',
  'flow control is negotiated twice on this port and the second attempt always wins',
  'the trunk timing is fine until the line warms up and then it slips about four counts',
  'we are holding the outbound queue until the uplink confirms the previous batch',
  'the packet header is padded on one side only which the older reader will not accept',
  'do not raise the window size on this route the far end simply stops replying',
  'stop bits were set to two on the replacement unit and nobody wrote that down',
  'the log shows a clean session but the file arrives with the last block missing',
  'this port has been reassigned three times this month and the map is out of date',
  'the handshake completes and then sits idle for eleven seconds before any data moves',
  'compression is doing more harm than good on text that is already this dense',
  'a retrain in the middle of a transfer is survivable but two in a row is not',
];

const SUBJECTS = [
  're: trunk timings on the east leg',
  'node list correction, please read',
  'that port reassignment again',
  're: re: parity sweep results',
  'outbound queue is backing up',
  'handshake stalls, anyone else',
  'seedlist for the quarter',
  're: do not reorder the dialplan',
];

const pad = (s: string, n: number): string =>
  s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length);

const padLeft = (s: string, n: number): string =>
  s.length >= n ? s.slice(0, n) : ' '.repeat(n - s.length) + s;

const num = (seed: string, digits: number): string => {
  let out = '';
  for (let i = 0; i < digits; i++) out += String(Math.floor(random(`${seed}-${i}`) * 10));
  return out;
};

const wrap = (text: string, width: number): string[] => {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if (cur.length + w.length + 1 > width) {
      lines.push(cur);
      cur = w;
    } else {
      cur = cur ? `${cur} ${w}` : w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
};

const line = (text: string, weight: number): TerminalLine => ({text, weight});

const separator = (seed: string): TerminalLine =>
  line('-'.repeat(COL_CHARS - randInt(0, 6, seed)), 0.35);

const headerBlock = (seed: string): TerminalLine[] => {
  const out: TerminalLine[] = [separator(`${seed}-sep`)];
  const rows = randInt(4, 7, `${seed}-rows`);
  for (let i = 0; i < rows; i++) {
    const label = pick(LABELS, `${seed}-l-${i}`);
    const roll = random(`${seed}-v-${i}`);
    let value: string;
    if (roll < 0.2) value = pick(PROTOCOLS, `${seed}-p-${i}`);
    else if (roll < 0.38) value = pick(FLOWS, `${seed}-f-${i}`);
    else if (roll < 0.56) value = `${pick(BAUDS, `${seed}-b-${i}`)} BPS`;
    else if (roll < 0.74) value = `${pick(NODES, `${seed}-n-${i}`)}/${num(`${seed}-nn-${i}`, 3)}`;
    else value = `0x${num(`${seed}-h-${i}`, 4)} : ${num(`${seed}-h2-${i}`, 2)}.${num(`${seed}-h3-${i}`, 3)}`;
    out.push(line(`  ${pad(`${label}`, 14)}${pad(':', 3)}${value}`, 0.55));
  }
  out.push(separator(`${seed}-sep2`));
  return out;
};

const messageBlock = (seed: string): TerminalLine[] => {
  const from = pick(HANDLES, `${seed}-from`);
  const to = pick(HANDLES, `${seed}-to`);
  const out: TerminalLine[] = [
    line(`  FROM   : ${pad(from, 18)}NODE ${pick(NODES, `${seed}-nd`)}/${num(`${seed}-a`, 3)}`, 0.75),
    line(`  TO     : ${pad(to, 18)}MSG  ${num(`${seed}-b`, 5)}`, 0.5),
    line(`  SUBJ   : ${pick(SUBJECTS, `${seed}-s`)}`, 0.8),
    line('', 0.2),
  ];
  const count = randInt(4, 8, `${seed}-c`);
  for (let i = 0; i < count; i++) {
    const body = pick(PROSE, `${seed}-pr-${i}`);
    for (const l of wrap(body, COL_CHARS - 4)) out.push(line(`  ${l}`, 0.4));
  }
  out.push(line('', 0.2));
  out.push(line(`  [${from}]`, 0.85));
  out.push(line('', 0.2));
  return out;
};

const listingBlock = (seed: string): TerminalLine[] => {
  const out: TerminalLine[] = [
    line(pad('  FILE', 22) + padLeft('SIZE', 9) + '   DESCRIPTION', 0.8),
    separator(`${seed}-sep`),
  ];
  const rows = randInt(6, 12, `${seed}-rows`);
  for (let i = 0; i < rows; i++) {
    const f = pick(FILES, `${seed}-f-${i}`);
    const size = `${num(`${seed}-z-${i}`, randInt(3, 6, `${seed}-zd-${i}`))}K`;
    const desc = pick(FILE_DESCS, `${seed}-d-${i}`);
    out.push(line(pad(`  ${f}`, 22) + padLeft(size, 9) + `   ${desc}`, 0.45));
  }
  out.push(separator(`${seed}-sep2`));
  return out;
};

const handleLine = (seed: string): TerminalLine[] => [
  line(`  [${pick(HANDLES, seed)}]`, 0.9),
];

/** Deterministic stream of content lines, one column wide. */
export const generateTerminalLines = (count: number, seedPrefix: string): TerminalLine[] => {
  const out: TerminalLine[] = [];
  let i = 0;
  while (out.length < count) {
    const seed = `${seedPrefix}-blk-${i}`;
    const roll = random(seed);
    if (roll < 0.28) out.push(...headerBlock(seed));
    else if (roll < 0.62) out.push(...messageBlock(seed));
    else if (roll < 0.9) out.push(...listingBlock(seed));
    else out.push(...handleLine(seed));
    i++;
  }
  return out.slice(0, count);
};

const GARBLE_SYMBOLS = '#@%&$*!?~^=+<>/\\|[]{}';
const GARBLE_ALNUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/** Repeated symbol runs and nonsense sequences — what a corrupted block looks like. */
export const garbleLine = (width: number, seed: string): string => {
  let out = '';
  let i = 0;
  while (out.length < width) {
    const roll = random(`${seed}-r-${i}`);
    const runLen = randInt(2, 14, `${seed}-n-${i}`);
    if (roll < 0.45) {
      const ch = GARBLE_SYMBOLS[Math.floor(random(`${seed}-s-${i}`) * GARBLE_SYMBOLS.length)];
      out += ch.repeat(runLen);
    } else if (roll < 0.8) {
      for (let k = 0; k < runLen; k++) {
        out += GARBLE_ALNUM[Math.floor(random(`${seed}-a-${i}-${k}`) * GARBLE_ALNUM.length)];
      }
    } else {
      out += ' '.repeat(randInt(1, 4, `${seed}-w-${i}`));
    }
    i++;
  }
  return out.slice(0, width);
};
