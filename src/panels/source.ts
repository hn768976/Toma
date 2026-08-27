/**
 * Fictional source text and log lines for the terminal variant.
 *
 * Everything below is invented for this piece: the language, the APIs, the
 * subsystem names and the messages. None of it is copied from real library
 * source or from any real product's diagnostics.
 */

export const FAKE_SOURCE: string[] = [
	'// lattice/resolve.kl  -- anchor folding pass',
	'',
	'kernel resolve(graph: Lattice, budget: Span) -> Bundle {',
	'  let anchors = graph.seed(0x4F1A, depth: 3)',
	'  let folded  = Bundle.empty(capacity: anchors.count)',
	'',
	'  for node in anchors.walk(.reverse) {',
	'    guard node.weight > 0.184 else continue',
	'    when node.kind {',
	'      .pivot  -> folded.push(node.fold(mode: .adaptive))',
	'      .branch -> folded.splice(node.children, at: 2)',
	'      _       -> trace("skipped", node.id)',
	'    }',
	'  }',
	'  return folded.compact(budget)',
	'}',
	'',
	'shape Anchor {',
	'  id:     Handle',
	'  weight: Real = 1.0',
	'  span:   Span<Frame>',
	'}',
	'',
	'bind Lattice.seed(mask: Word, depth: Int) {',
	'  defer halt.unless(depth < 9)',
	'  let cursor = self.head.offset(mask & 0xFF)',
	'  yield cursor.expand(depth, stride: 4)',
	'}',
	'',
	'// -- drift correction ------------------------------',
	'',
	'kernel settle(b: Bundle) -> Real {',
	'  let drift = b.map { $0.span.width }.mean()',
	'  emit sync.pulse(drift, into: .telemetry)',
	'  return clamp(drift, 0.0, 12.0)',
	'}',
	'',
	'lift Bundle.compact(budget: Span) {',
	'  while self.size > budget.width {',
	'    self.drop(self.weakest())',
	'  }',
	'}',
	'',
];

export const LOG_SUBSYSTEMS = [
	'lattice.sync',
	'anchor.fold',
	'bundle.gc',
	'telemetry',
	'span.alloc',
	'drift.trim',
	'kernel.sched',
	'handle.pool',
];

export const LOG_INFO = [
	'anchor 0x4F1A committed',
	'bundle compacted, 312 -> 188',
	'seed depth 3 resolved in 4.1ms',
	'pulse accepted by telemetry',
	'span window advanced',
	'pool refilled, 64 handles',
	'drift within tolerance',
	'checkpoint written',
	'walk completed, 41 nodes',
	'schedule slot reclaimed',
];

export const LOG_WARN = [
	'drift 11.8 approaching ceiling',
	'pool below watermark, 6 handles',
	'fold retried after contention',
	'budget exceeded, trimming tail',
	'stale cursor discarded',
];

export const LOG_ERROR = [
	'seed rejected: depth limit 9',
	'handle 0x00 released twice',
	'bundle compact failed, no slack',
	'sync pulse dropped',
];

export const PROCESS_NAMES = [
	'latt-resolver',
	'anchor-fold',
	'bundle-gc',
	'span-alloc',
	'drift-trim',
	'telemetry-tx',
	'handle-pool',
	'kernel-sched',
	'pulse-relay',
	'compact-io',
];
