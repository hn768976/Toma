import { ACCENT } from "../shared/theme";

/** Pipeline layout, in the shared 1920x1080 design space. */
export const PIPE_LAYOUT = {
  titleFrame: { x: 122, y: 70, w: 1676, h: 62 },
  throughput: { x: 122, y: 230, w: 1676, h: 166 },
  cardY: 525,
  cardW: 168,
  cardH: 115,
  labelY: 648,
  metricY: 674,
  stageLoadY: 753,
  barY: 786,
  barPctY: 806,
  timelineLabelY: 896,
  timelineY: 930,
  tickY: 952,
  margin: 122,
} as const;

export type Stage = {
  id: string;
  label: string;
  metric: string;
  cx: number;
  color: string;
  load: number;
  /** Simple glyph drawn inside the card. */
  icon: "feed" | "check" | "hex" | "branch" | "chevrons" | "target" | "exit";
};

/** Card centres across the 1920 canvas; the gap after DECISION holds the fork. */
export const STAGES: Stage[] = [
  { id: "input", label: "INPUT", metric: "req/s", cx: 194, color: ACCENT.cyan, load: 44, icon: "feed" },
  { id: "validation", label: "VALIDATION", metric: "% pass", cx: 418, color: ACCENT.violet, load: 61, icon: "check" },
  { id: "ai", label: "AI PROCESSING", metric: "ms avg", cx: 642, color: ACCENT.amber, load: 76, icon: "hex" },
  { id: "decision", label: "DECISION", metric: "conf", cx: 864, color: ACCENT.pink, load: 38, icon: "branch" },
  { id: "execution", label: "EXECUTION", metric: "tasks", cx: 1274, color: ACCENT.emerald, load: 72, icon: "chevrons" },
  { id: "review", label: "REVIEW", metric: "% ok", cx: 1502, color: ACCENT.blue, load: 29, icon: "target" },
  { id: "output", label: "OUTPUT", metric: "done", cx: 1724, color: ACCENT.white, load: 58, icon: "exit" },
];

/** The fork sits between DECISION and EXECUTION. */
export const FORK = {
  cx: 1071,
  approveY: 478,
  escalateY: 686,
  width: 112,
  height: 38,
} as const;

export const JOB_IDS = [
  "JOB-4471",
  "JOB-4472",
  "JOB-4473",
  "JOB-4474",
  "JOB-4475",
  "JOB-4476",
  "JOB-4477",
  "JOB-4478",
];
