import { ACCENT } from "../shared/theme";

/** Panel frame, in the shared 1920x1080 design space. */
export const LAYOUT = {
  header: { x: 28, y: 18, w: 1864, h: 52 },
  activeOps: { x: 28, y: 96, w: 336, h: 566 },
  graph: { x: 382, y: 96, w: 1188, h: 566 },
  loadMap: { x: 1588, y: 96, w: 304, h: 238 },
  vitals: { x: 1588, y: 348, w: 304, h: 314 },
  telemetry: { x: 28, y: 680, w: 336, h: 372 },
  eventStream: { x: 382, y: 680, w: 862, h: 372 },
  envelope: { x: 1262, y: 680, w: 630, h: 372 },
} as const;

export type Operation = {
  label: string;
  color: string;
  base: number;
  swing: number;
};

export const OPERATIONS: Operation[] = [
  { label: "Inference cluster", color: ACCENT.teal, base: 86, swing: 9 },
  { label: "Embedding pipeline", color: ACCENT.green, base: 70, swing: 12 },
  { label: "Policy validation", color: ACCENT.violet, base: 88, swing: 7 },
  { label: "Memory compaction", color: ACCENT.indigo, base: 61, swing: 14 },
  { label: "Tool execution", color: ACCENT.teal, base: 83, swing: 10 },
  { label: "Response synthesis", color: ACCENT.green, base: 85, swing: 8 },
  { label: "Audit replication", color: ACCENT.purple, base: 66, swing: 11 },
];

export type GraphNode = {
  id: string;
  label: string;
  sub: string;
  x: number;
  y: number;
  color: string;
};

/** Node centres, absolute in design space. */
export const NODES: GraphNode[] = [
  { id: "ingest", label: "EVENT INGEST", sub: "12.8k / m", x: 509, y: 387, color: ACCENT.teal },
  { id: "normalize", label: "NORMALIZE", sub: "schema v4.2", x: 695, y: 282, color: ACCENT.violet },
  { id: "vectorize", label: "VECTORIZE", sub: "768 dims", x: 695, y: 491, color: ACCENT.blue },
  { id: "router", label: "ROUTER", sub: "mixed mesh", x: 902, y: 231, color: ACCENT.teal },
  { id: "retrieval", label: "RETRIEVAL", sub: "14 sources", x: 904, y: 389, color: ACCENT.purple },
  { id: "memory", label: "MEMORY", sub: "vector sync", x: 908, y: 545, color: ACCENT.green },
  { id: "planner", label: "PLANNER", sub: "graph solver", x: 1126, y: 233, color: ACCENT.teal },
  { id: "core", label: "MODEL CORE", sub: "reasoning", x: 1126, y: 387, color: ACCENT.teal },
  { id: "validator", label: "VALIDATOR", sub: "policy pass", x: 1126, y: 545, color: ACCENT.violet },
  { id: "tools", label: "TOOLS", sub: "12 active", x: 1349, y: 280, color: ACCENT.blue },
  { id: "synthesis", label: "SYNTHESIS", sub: "streaming", x: 1349, y: 489, color: ACCENT.green },
  { id: "delivery", label: "DELIVERY", sub: "99.99% SLA", x: 1470, y: 387, color: ACCENT.teal },
];

export const NODE_W = 150;
export const NODE_H = 52;

export const EDGES: [string, string][] = [
  ["ingest", "normalize"],
  ["ingest", "vectorize"],
  ["normalize", "router"],
  ["normalize", "retrieval"],
  ["vectorize", "retrieval"],
  ["vectorize", "memory"],
  ["router", "planner"],
  ["retrieval", "core"],
  ["memory", "core"],
  ["memory", "validator"],
  ["router", "core"],
  ["planner", "tools"],
  ["core", "tools"],
  ["memory", "synthesis"],
  ["core", "synthesis"],
  ["validator", "synthesis"],
  ["tools", "delivery"],
  ["synthesis", "delivery"],
];

/** Event-stream copy. Each entry carries its own severity tint. */
export const EVENT_MESSAGES: { text: string; color: string }[] = [
  { text: "agent-07 acquired lease on shard eu-central-2", color: ACCENT.teal },
  { text: "retrieval index rebuilt · 1.4M vectors committed", color: ACCENT.green },
  { text: "planner reduced task graph to 6 nodes", color: ACCENT.teal },
  { text: "policy gate cleared batch b-88213", color: ACCENT.violet },
  { text: "autoscaler added 4 inference replicas", color: ACCENT.green },
  { text: "memory compaction finished in 812ms", color: ACCENT.teal },
  { text: "tool call search.web resolved · confidence 0.94", color: ACCENT.blue },
  { text: "checkpoint written to durable store", color: ACCENT.teal },
  { text: "model core switched to speculative decode", color: ACCENT.purple },
  { text: "delivery receipt acknowledged by edge gateway", color: ACCENT.green },
  { text: "drift monitor nominal · score below threshold", color: ACCENT.teal },
  { text: "validator rejected 2 unsafe completions", color: ACCENT.amber },
  { text: "context cache hit ratio climbed to 0.78", color: ACCENT.green },
  { text: "region us-west-1 rebalanced 18 sessions", color: ACCENT.blue },
  { text: "embedding queue drained · backlog 0", color: ACCENT.teal },
  { text: "audit trail replicated to cold storage", color: ACCENT.violet },
  { text: "synthesis stream opened for 41 clients", color: ACCENT.green },
  { text: "router pinned traffic to healthy pool", color: ACCENT.teal },
];

export const TELEMETRY = [
  { label: "THROUGHPUT", color: ACCENT.teal, min: 13.4, max: 15.1, unit: "K", decimals: 1 },
  { label: "ACCURACY", color: ACCENT.green, min: 98.1, max: 99.2, unit: "", decimals: 1 },
  { label: "DRIFT", color: ACCENT.purple, min: 0.02, max: 0.05, unit: "", decimals: 2 },
  { label: "COST / 1K", color: ACCENT.amber, min: 0.16, max: 0.21, unit: "", decimals: 2, prefix: "$" },
] as const;

/** Colour pool for the regional load map cells. */
export const LOAD_COLORS = [
  ACCENT.teal,
  ACCENT.green,
  ACCENT.blue,
  ACCENT.indigo,
  ACCENT.violet,
  ACCENT.purple,
  ACCENT.magenta,
  ACCENT.cyan,
];
