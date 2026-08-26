import {seededInt, seededPick} from '../lib/rng';
import {CONFIG} from '../config';

/**
 * Fictional JavaScript, generated from seeded templates.
 *
 * Nothing here is real library source and there are no copyright headers — the
 * names, comments and DOM calls are invented. It only has to *read* like code
 * at 40% opacity behind a blur: indentation, braces, aligned continuations.
 */

const VERBS = ['compose', 'resolve', 'flatten', 'hydrate', 'reconcile', 'dispatch', 'normalize', 'settle'] as const;
const NOUNS = ['Intent', 'Lane', 'Envelope', 'Fragment', 'Transcript', 'Signal', 'Draft', 'Turn'] as const;
const FIELDS = ['payload', 'cursor', 'locale', 'channel', 'tokens', 'stride', 'anchor', 'mode'] as const;
const SELECTORS = ['[data-lane]', '.turn-shell', '#composer-root', '[data-role="bubble"]', '.stream-slot'] as const;
const STATES = ['idle', 'streaming', 'settled', 'queued', 'draining'] as const;
const COMMENTS = [
  'resolve the intent envelope before dispatch',
  'lanes are re-keyed whenever the transcript rewinds',
  'keep the cursor stable across partial flushes',
  'bail early: nothing to reconcile on this turn',
  'width is measured once, then cached per lane',
  'the shell owns focus; fragments never steal it',
  'coalesce adjacent fragments to one repaint',
  'guard against a transcript that settled mid-stream',
] as const;

export interface CodeLine {
  indent: number;
  text: string;
  isComment: boolean;
}

const capitalize = (s: string) => s[0].toUpperCase() + s.slice(1);

/** One plausible function-shaped block. */
export const generateCodeBlock = (seed: string): CodeLine[] => {
  const verb = seededPick(`${seed}-verb`, VERBS);
  const noun = seededPick(`${seed}-noun`, NOUNS);
  const helper = `${seededPick(`${seed}-verb2`, VERBS)}${seededPick(`${seed}-noun2`, NOUNS)}`;
  const fnName = `${verb}${noun}`;
  const argA = seededPick(`${seed}-fa`, FIELDS);
  const argB = seededPick(`${seed}-fb`, FIELDS);
  const selector = seededPick(`${seed}-sel`, SELECTORS);
  const state = seededPick(`${seed}-state`, STATES);
  const comment = seededPick(`${seed}-c1`, COMMENTS);
  const comment2 = seededPick(`${seed}-c2`, COMMENTS);

  const lines: CodeLine[] = [
    {indent: 0, text: `// ${comment}`, isComment: true},
    {indent: 0, text: `export function ${fnName}(${argA}, ctx) {`, isComment: false},
    {indent: 1, text: `const shell = document.querySelector("${selector}");`, isComment: false},
    {indent: 1, text: `const draft = ${helper}(${argA}.${argB}, {`, isComment: false},
    {indent: 3, text: `strict: true,`, isComment: false},
    {indent: 3, text: `locale: ctx.${seededPick(`${seed}-fc`, FIELDS)},`, isComment: false},
    {indent: 2, text: `});`, isComment: false},
    {indent: 1, text: `if (!shell || draft.length === 0) {`, isComment: false},
    {indent: 2, text: `return ctx.flush("${state}");`, isComment: false},
    {indent: 1, text: `}`, isComment: false},
    {indent: 1, text: `// ${comment2}`, isComment: true},
    {indent: 1, text: `shell.setAttribute("data-state", draft.mode);`, isComment: false},
    {indent: 1, text: `return draft.map((t) => decorate(t, ctx.theme));`, isComment: false},
    {indent: 0, text: `}`, isComment: false},
    {indent: 0, text: `const ${verb}${capitalize(argA)} = (n) => n * ctx.stride;`, isComment: false},
  ];

  const take = seededInt(`${seed}-len`, CONFIG.code.minLines, CONFIG.code.maxLines);
  const start = seededInt(`${seed}-start`, 0, Math.max(0, lines.length - take));
  return lines.slice(start, start + take);
};

const KEYWORDS = /\b(export|function|const|let|return|if|import|from|await|async|new|true|false|null)\b/g;
const STRINGS = /"[^"]*"/g;

export interface CodeToken {
  text: string;
  accent: boolean;
}

/**
 * Split a line into accented (cyan) and plain (white) runs. Comments are handled
 * by the caller — every one of their tokens is accented.
 */
export const tokenizeCodeLine = (text: string): CodeToken[] => {
  const marks = new Array<boolean>(text.length).fill(false);
  for (const re of [KEYWORDS, STRINGS]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      for (let i = m.index; i < m.index + m[0].length; i++) marks[i] = true;
      if (m[0].length === 0) re.lastIndex++;
    }
  }
  const tokens: CodeToken[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const accent = marks[cursor];
    let end = cursor;
    while (end < text.length && marks[end] === accent) end++;
    tokens.push({text: text.slice(cursor, end), accent});
    cursor = end;
  }
  return tokens;
};
