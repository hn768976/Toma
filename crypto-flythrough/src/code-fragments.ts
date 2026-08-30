import { random } from "remotion";

/**
 * Entirely fictional JavaScript with a crypto-flavoured vocabulary.
 * Nothing here is copied from a real library, exchange API or SDK — the
 * identifiers, endpoints and comments are invented for this animation.
 */

export type LineKind = "comment" | "code" | "accent";

export type CodeLine = {
  readonly text: string;
  readonly kind: LineKind;
  /** Leading indent, in character widths. */
  readonly indent: number;
};

const NOUNS = [
  "vault",
  "ledger",
  "shard",
  "wallet",
  "epoch",
  "nonce",
  "digest",
  "token",
  "balance",
  "receipt",
  "escrow",
  "mint",
  "pool",
  "relay",
  "beacon",
  "attest",
];

const VERBS = [
  "settle",
  "reconcile",
  "seal",
  "unwind",
  "commit",
  "resolve",
  "verify",
  "rotate",
  "flush",
  "anchor",
  "drain",
  "prime",
];

const COMMENTS = [
  "// reconcile pending ledger deltas",
  "// nonce drifts if the relay clock skews",
  "// never trust an unattested balance",
  "// shard 0 holds the canonical digest",
  "// TODO: fold the escrow sweep in here",
  "// walk the mint queue newest first",
  "// a receipt without a seal is a promise",
  "// keep the hash window to one frame",
  "// beacon rotation is idempotent",
  "// drop the token if the vault refuses",
  "// widen the escrow when the pool thins",
  "// digest collisions cannot happen",
  "// the ledger is append only",
  "// unwind partial fills first",
  "// FIXME: the drain path double counts",
  "// cache the shard map, it moves rarely",
];

const DECLARATIONS = [
  "function {verb}{Noun}Epoch({noun}Id, epoch) {",
  "async function {verb}{Noun}Queue(session) {",
  "const {verb}{Noun} = async ({noun}) => {",
  "class {Noun}Reconciler extends LedgerNode {",
  "function assert{Noun}Seal(digest) {",
  "async function open{Noun}Channel(peer) {",
  "const {noun}Guard = defineGuard(() => {",
  "const {verb}{Noun}Batch = withRetry(async () => {",
];

const BODY = [
  "const {noun} = openShard(session.{noun}Id);",
  "if (!{noun}.sealed) throw new StaleDigest();",
  "const digest = foldDigest({noun}.leaves);",
  "await relay.publish('{noun}/seal', digest);",
  "document.querySelector('#{noun}').hidden = false;",
  "const balance = {noun}.entries.reduce(sum, 0n);",
  "queueMicrotask(() => beacon.notify(balance));",
  "for (const leaf of {noun}.pending) leaf.attest();",
  "const [head, ...tail] = {noun}.window;",
  "ledger.applyDelta(epoch.hash, epoch.nonce);",
  "state.set('{noun}.cursor', epoch.height);",
  "document.body.dataset.phase = phase.toString();",
  "const proof = await witness.prove({noun}.root);",
  "if (drift > MAX_SKEW) return retryLater({noun});",
  "emit('{noun}:settled', { height, digest });",
  "const escrow = pool.reserve({noun}.id, balance);",
  "cache.write('{noun}', digest, TTL);",
  "await Promise.all(shards.map(flush));",
];

const TAILS = [
  "  return { digest, balance, height };",
  "  return ledger.seal();",
  "  return proof.compact();",
  "  return { ok: true, drift };",
];

const CLOSERS = ["}", "});", "}", "});"];

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

const pick = <T,>(arr: readonly T[], seed: string): T =>
  arr[Math.floor(random(seed) * arr.length) % arr.length];

const fill = (template: string, seed: string): string => {
  const noun = pick(NOUNS, `${seed}-noun`);
  const verb = pick(VERBS, `${seed}-verb`);
  return template
    .replace(/\{Noun\}/g, cap(noun))
    .replace(/\{noun\}/g, noun)
    .replace(/\{verb\}/g, verb);
};

/**
 * Builds one fictional code block: a comment, a declaration, an indented
 * body and a closing brace. Fully deterministic for a given `blockIndex`.
 */
export const buildCodeBlock = (blockIndex: number): CodeLine[] => {
  const seed = `block-${blockIndex}`;
  const lines: CodeLine[] = [];

  lines.push({
    text: pick(COMMENTS, `${seed}-c0`),
    kind: "comment",
    indent: 0,
  });
  lines.push({
    text: fill(pick(DECLARATIONS, `${seed}-d`), `${seed}-d`),
    kind: "code",
    indent: 0,
  });

  const bodyCount = 2 + Math.floor(random(`${seed}-n`) * 2);
  for (let i = 0; i < bodyCount; i++) {
    // One inner comment, roughly halfway down, on most blocks.
    if (i === 1 && random(`${seed}-ic-${i}`) > 0.5) {
      lines.push({
        text: pick(COMMENTS, `${seed}-c1-${i}`),
        kind: "comment",
        indent: 1,
      });
      continue;
    }
    lines.push({
      text: fill(pick(BODY, `${seed}-b-${i}`), `${seed}-b-${i}`),
      kind: "code",
      indent: 1,
    });
  }

  lines.push({
    text: pick(TAILS, `${seed}-t`),
    kind: "code",
    indent: 0,
  });
  lines.push({
    text: pick(CLOSERS, `${seed}-x`),
    kind: "code",
    indent: 0,
  });

  return lines;
};
