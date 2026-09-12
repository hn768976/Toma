// The script the UI plays out: the prompt that gets typed, the workflow it
// compiles into, and the telemetry that scrolls alongside it.

export const PROMPT =
  "Build an agent that reads incoming documents, extracts important " +
  "information, checks a database, and sends the result for approval.";

export type WorkflowNode = {
  index: string;
  title: string;
  subtitle: string;
  badge: string;
  kind: "input" | "agent" | "tool" | "gate" | "output";
};

export const NODES: WorkflowNode[] = [
  {
    index: "01",
    title: "Document Input",
    subtitle: "PDF · DOCX · EMAIL",
    badge: "INPUT",
    kind: "input",
  },
  {
    index: "02",
    title: "AI Agent",
    subtitle: "REASONING CORE",
    badge: "CONFIGURED",
    kind: "agent",
  },
  {
    index: "03",
    title: "Extract Information",
    subtitle: "ENTITIES · FIELDS · TABLES",
    badge: "TOOL",
    kind: "tool",
  },
  {
    index: "04",
    title: "Database Check",
    subtitle: "RECORD LOOKUP",
    badge: "TOOL",
    kind: "tool",
  },
  {
    index: "05",
    title: "Human Approval",
    subtitle: "REVIEWER REQUIRED",
    badge: "GATE",
    kind: "gate",
  },
  {
    index: "06",
    title: "Final Output",
    subtitle: "STRUCTURED RESULT",
    badge: "OUTPUT",
    kind: "output",
  },
];

// Intent chips light up as the phrase that implies them finishes typing.
// `atChar` is an index into PROMPT.
export const INTENTS = [
  { label: "read documents", atChar: 44 },
  { label: "extract data", atChar: 76 },
  { label: "query database", atChar: 94 },
  { label: "human approval", atChar: 131 },
];

export const PROPERTIES = [
  { label: "Purpose", value: "Document Processing" },
  { label: "Tools", value: "3" },
  { label: "Workflow Steps", value: "6" },
  { label: "Approval Required", value: "Yes" },
];

// Scrolling model-activity log. Rendered three lines at a time, advancing
// roughly every 10 frames, so the panel always looks busy without ever
// repeating a visible triplet.
export const LOG_LINES: [string, string][] = [
  ["parser.tokenize", "ok"],
  ["intent.classify", "0.98"],
  ["graph.plan", "node +1"],
  ["tool.bind", "extract"],
  ["db.schema", "resolved"],
  ["policy.check", "approval"],
  ["runtime.compile", "ok"],
  ["trace.emit", "step"],
  ["vector.index", "1.2k"],
  ["guard.rails", "pass"],
  ["memory.write", "ctx"],
  ["router.pick", "gpt-core"],
  ["schema.infer", "7 fields"],
  ["retry.budget", "3"],
  ["latency.p95", "210ms"],
  ["queue.drain", "empty"],
];

export const EXECUTION_LABELS = NODES.map((n) => n.title);
