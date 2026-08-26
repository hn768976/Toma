import {chance, pick, rint} from './rand';

/**
 * Fictional JavaScript.
 *
 * Nothing here is copied from a real library: the identifiers, comments and
 * declarations are invented and assembled from the vocabularies below. What
 * matters visually is the *shape* -- indentation, nested braces, aligned
 * continuations and the occasional blank line -- because that is what makes a
 * blur of text read as source code rather than as random words.
 */

const VERBS = [
  'resolve', 'bind', 'flush', 'latch', 'probe', 'spawn', 'hydrate', 'prune',
  'seal', 'drain', 'warp', 'stitch', 'anchor', 'thaw', 'mask', 'defer',
  'weave', 'clamp', 'splice', 'orbit', 'cache', 'sift', 'align', 'unfold',
] as const;

const NOUNS = [
  'Shard', 'Vector', 'Frame', 'Token', 'Buffer', 'Lattice', 'Node', 'Packet',
  'Signal', 'Cursor', 'Beacon', 'Chunk', 'Socket', 'Glyph', 'Trace', 'Slice',
  'Payload', 'Kernel', 'Bloom', 'Grid', 'Pulse', 'Strand',
] as const;

const VARS = [
  'shard', 'vector', 'frame', 'token', 'buffer', 'lattice', 'node', 'packet',
  'signal', 'cursor', 'beacon', 'chunk', 'depth', 'scope', 'index', 'offset',
  'limit', 'seed', 'ratio', 'stride', 'span', 'gate', 'edge', 'lane',
] as const;

const FIELDS = [
  'depth', 'stride', 'seed', 'limit', 'phase', 'gain', 'edge', 'span', 'lane',
  'mode', 'ttl', 'rank',
] as const;

const COMMENTS = [
  'keep the lattice warm between flushes',
  'shards arrive out of order here',
  'never widen the span past the gate',
  'second pass reuses the cold buffer',
  'phase drifts if the seed is reused',
  'trace is dropped once the node seals',
  'clamp before the packet leaves scope',
  'the cursor owns this slice, not us',
  'rebuilt on every hydrate, cheap enough',
  'edges are half-open on purpose',
  'do not touch: the grid depends on it',
  'fallback path when the socket stalls',
] as const;

const MAX_COLS = 30;

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

const fnName = (s: string) =>
  `${pick(s + 'v', VERBS)}${pick(s + 'n', NOUNS)}`;

const varName = (s: string) =>
  chance(s + 'c', 0.35)
    ? `${pick(s + 'v1', VARS)}${cap(pick(s + 'v2', VARS))}`
    : pick(s + 'v3', VARS);

const num = (s: string) =>
  pick(s, ['0', '1', '2', '8', '12', '16', '0.5', '0.25', '64', '128', '3', '-1']);

const expr = (s: string): string => {
  const kind = rint(s + 'k', 0, 6);
  switch (kind) {
    case 0:
      return `${fnName(s + 'a')}(${varName(s + 'b')})`;
    case 1:
      return `${varName(s + 'c')}.${pick(s + 'd', FIELDS)}`;
    case 2:
      return `${varName(s + 'e')} + ${num(s + 'f')}`;
    case 3:
      return `[${varName(s + 'g')}, ${num(s + 'h')}]`;
    case 4:
      return `${varName(s + 'i')} ?? ${num(s + 'j')}`;
    case 5:
      return `await ${fnName(s + 'k')}()`;
    default:
      return `${varName(s + 'l')}.${pick(s + 'm', FIELDS)} * ${num(s + 'n')}`;
  }
};

const cond = (s: string): string => {
  const kind = rint(s + 'k', 0, 4);
  switch (kind) {
    case 0:
      return `${varName(s + 'a')} !== null`;
    case 1:
      return `${varName(s + 'b')} > ${num(s + 'c')}`;
    case 2:
      return `!${varName(s + 'd')}.${pick(s + 'e', FIELDS)}`;
    case 3:
      return `${varName(s + 'f')} === ${num(s + 'g')}`;
    default:
      return `${fnName(s + 'h')}(${varName(s + 'i')})`;
  }
};

const pad = (depth: number) => '  '.repeat(depth);

const simpleStatement = (s: string, d: number): string[] => {
  const kind = rint(s + 'k', 0, 5);
  switch (kind) {
    case 0:
      return [`${pad(d)}const ${varName(s + 'a')} = ${expr(s + 'b')};`];
    case 1:
      return [`${pad(d)}let ${varName(s + 'c')} = ${num(s + 'd')};`];
    case 2:
      return [`${pad(d)}${fnName(s + 'e')}(${varName(s + 'f')});`];
    case 3:
      return [`${pad(d)}${varName(s + 'g')}.${pick(s + 'h', FIELDS)} = ${num(s + 'i')};`];
    case 4:
      // Aligned continuation -- the visual signature of hand-wrapped source.
      return [
        `${pad(d)}const ${varName(s + 'j')} = ${fnName(s + 'k')}(`,
        `${pad(d + 2)}${varName(s + 'l')},`,
        `${pad(d + 2)}${num(s + 'm')},`,
        `${pad(d)});`,
      ];
    default:
      return [`${pad(d)}return ${expr(s + 'n')};`];
  }
};

const statement = (s: string, d: number, allowNest: boolean): string[] => {
  if (allowNest && d < 3) {
    const nest = rint(s + 'nest', 0, 9);
    if (nest < 2) {
      return [
        `${pad(d)}if (${cond(s + 'if')}) {`,
        ...simpleStatement(s + 'ifb', d + 1),
        `${pad(d)}}`,
      ];
    }
    if (nest === 2) {
      return [
        `${pad(d)}for (const ${varName(s + 'fv')} of ${varName(s + 'fc')}) {`,
        ...simpleStatement(s + 'fb', d + 1),
        `${pad(d)}}`,
      ];
    }
    if (nest === 3) {
      return [
        `${pad(d)}const ${varName(s + 'ov')} = {`,
        `${pad(d + 1)}${pick(s + 'o1', FIELDS)}: ${num(s + 'o2')},`,
        `${pad(d + 1)}${pick(s + 'o3', FIELDS)}: ${varName(s + 'o4')},`,
        `${pad(d)}};`,
      ];
    }
  }
  return simpleStatement(s, d);
};

const header = (s: string): {open: string[]; close: string} => {
  const kind = rint(s + 'h', 0, 3);
  const name = fnName(s + 'hn');
  const a = varName(s + 'ha');
  const b = varName(s + 'hb');
  switch (kind) {
    case 0:
      return {open: [`function ${name}(${a}, ${b}) {`], close: '}'};
    case 1:
      return {open: [`export const ${name} = (${a}) => {`], close: '};'};
    case 2:
      return {open: [`async function ${name}(${a}) {`], close: '}'};
    default:
      return {open: [`${name}(${a}, () => {`], close: '});'};
  }
};

/** A single block of fictional source: 3-10 lines, already indented. */
export const makeCodeBlock = (seed: string): string[] => {
  const target = rint(seed + 'len', 3, 10);
  const lines: string[] = [];

  if (chance(seed + 'lead', 0.45)) {
    lines.push(`// ${pick(seed + 'cmt', COMMENTS)}`);
  }

  const {open, close} = header(seed);
  lines.push(...open);

  let i = 0;
  while (lines.length < target - 1 && i < 12) {
    const s = `${seed}s${i}`;
    if (i > 0 && chance(s + 'blank', 0.14)) {
      lines.push('');
    } else if (chance(s + 'inner', 0.12)) {
      lines.push(`  // ${pick(s + 'ic', COMMENTS)}`);
    } else {
      lines.push(...statement(s, 1, true));
    }
    i++;
  }

  lines.push(close);

  // Trim anything that would blow the offscreen canvas out to silly widths.
  return lines
    .slice(0, 10)
    .map((l) => (l.length > MAX_COLS ? l.slice(0, MAX_COLS - 1) + '…' : l));
};
