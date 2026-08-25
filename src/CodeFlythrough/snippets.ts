import {random} from 'remotion';

/**
 * Fictional code fragments.
 *
 * Every identifier, comment and call below is invented for this animation.
 * Nothing here is copied from a real library and no copyright header is
 * reproduced; the goal is only the *shape* of plausible JavaScript.
 */

const TOPICS = [
  'resolve the inbound intent stream',
  'hydrate the reply surface',
  'bind the widget to a live socket',
  'normalize tokens before dispatch',
  'fallback when the model is cold',
  'throttle the outbound queue',
  'stitch partial deltas together',
  'guard against replayed sessions',
  'warm the embedding shelf',
  'flush the transcript buffer',
  'mount the assistant shell',
  'score candidate completions',
  'prune stale conversation nodes',
  'rewrite the prompt envelope',
  'mirror state into local cache',
  'batch the pending toolcalls',
  'settle the typing indicator',
  'reconcile the turn ledger',
  'seal the draft before send',
  'lift persona from the header',
  'retry once, then degrade',
  'clamp the context window',
  'fan the reply out to listeners',
  'drop frames the user never saw',
] as const;

const FNS = [
  'renderReply',
  'flushIntent',
  'bindSurface',
  'warmShelf',
  'scoreDraft',
  'parseDelta',
  'mountAgent',
  'queueToolcall',
  'traceTurn',
  'dropStaleNode',
  'hydrateWidget',
  'sealTranscript',
  'pickPersona',
  'emitToken',
  'settleTyping',
  'clampWindow',
  'rewriteEnvelope',
  'mirrorState',
] as const;

const IDS = [
  'chat-root',
  'reply-slot',
  'intent-log',
  'agent-frame',
  'turn-buffer',
  'bot-panel',
  'stream-out',
  'draft-line',
  'shelf-meter',
  'toolcall-bay',
  'persona-tag',
  'typing-dot',
] as const;

const LABELS = [
  'intent',
  'turn',
  'latency',
  'tokens',
  'persona',
  'route',
  'confidence',
  'depth',
  'shelf',
  'draft',
  'cursor',
  'budget',
] as const;

const EXPRS = [
  'state.turn',
  'ctx.depth',
  'queue.length',
  'draft.score',
  'session.id',
  'frame.tick',
  'shelf.hits',
  'reply.len',
  'turn.cost',
  'route.weight',
  'buf.head',
  'persona.tone',
] as const;

const OPEN_TAGS = ['<script>', '<div id="{id}">', '<template>'] as const;
const CLOSE_TAGS = ['</script>', '</div>', '</template>'] as const;

const pick = <T,>(seed: string, arr: readonly T[]): T =>
  arr[Math.floor(random(seed) * arr.length) % arr.length] as T;

const rint = (seed: string, lo: number, hi: number) =>
  lo + Math.floor(random(seed) * (hi - lo + 1));

const declLine = (s: string): string => {
  const fn = pick(s + ':fn', FNS);
  const label = pick(s + ':lb', LABELS);
  const r = random(s + ':d');
  if (r < 0.45) return `function ${fn}(txt) {`;
  if (r < 0.72) return `const ${fn} = (txt) => {`;
  if (r < 0.88) return `let ${label} = ${pick(s + ':ex', EXPRS)};`;
  return `export function ${fn}(txt) {`;
};

const bodyLine = (s: string): string => {
  const id = pick(s + ':id', IDS);
  const label = pick(s + ':lb', LABELS);
  const label2 = pick(s + ':lb2', LABELS);
  const expr = pick(s + ':ex', EXPRS);
  const fn = pick(s + ':fn', FNS);
  const n = rint(s + ':n', 2, 96);
  const r = random(s + ':b');
  if (r < 0.24) return `  document.getElementById("${id}").innerHTML = txt;`;
  if (r < 0.44) return `  typeof "${label}: " + ${expr} + "<br>"`;
  if (r < 0.58) return `  if (${expr} > ${n}) { ${fn}(txt); }`;
  if (r < 0.7) return `  return ${expr} + "${label}";`;
  if (r < 0.8) return `  ${label}.push({ ${label2}: ${expr} });`;
  if (r < 0.88) return `  await ${fn}(${expr}, ${n});`;
  if (r < 0.94) return `  ${label} = ${expr} ?? "${label2}";`;
  return `  for (const ${label} of ${expr}) ${fn}(${label});`;
};

/**
 * Builds one snippet. Line one is always the comment: it is the brightest part
 * of the fragment and the thing the eye catches as it streams past.
 */
export const makeSnippet = (seed: string): string[] => {
  const n = rint(seed + ':len', 2, 7);
  const lines: string[] = [`// ${pick(seed + ':topic', TOPICS)}`];

  if (n === 2) {
    lines.push(random(seed + ':two') < 0.5 ? declLine(seed) : bodyLine(seed).trim());
    return lines;
  }

  const tagIdx = Math.floor(random(seed + ':tag') * OPEN_TAGS.length) % OPEN_TAGS.length;
  const useTag = n >= 4 && random(seed + ':useTag') < 0.62;
  if (useTag) {
    lines.push((OPEN_TAGS[tagIdx] as string).replace('{id}', pick(seed + ':tid', IDS)));
  }

  lines.push(declLine(seed));

  const bodyCount = Math.max(1, n - lines.length - 1);
  for (let i = 0; i < bodyCount; i++) {
    lines.push(bodyLine(`${seed}:body${i}`));
  }

  lines.push(useTag && random(seed + ':cl') < 0.5 ? (CLOSE_TAGS[tagIdx] as string) : '}');
  return lines.slice(0, n);
};

/** A run of 1s and 0s, 8 to 20 digits long. */
export const makeBinary = (seed: string): string => {
  const len = rint(seed + ':blen', 8, 20);
  let out = '';
  for (let i = 0; i < len; i++) {
    out += random(`${seed}:bit${i}`) < 0.5 ? '0' : '1';
  }
  return out;
};

/** True for comment lines, which get the brightest treatment. */
export const isComment = (line: string) => line.trimStart().startsWith('//');
