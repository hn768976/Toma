/**
 * ONE DATA ROW PER VERSION.
 * To add a version, append a row to the relevant array below — Root.tsx
 * turns every row into a <Composition>. `id` is the composition id
 * (letters, digits and hyphens only) and `file` the preview file name.
 */

// ── Look 1 — Binary Word ────────────────────────────────────────────────
export type BinaryVersion = {
  id: string;
  file: string;
  word: string; // rendered only as a mask, in Montserrat ExtraBold
  wordColor: string; // bright in-word digits
  glowColor: string; // blurred copy behind bright digits
  bgDim: string; // background digits, darkest
  bgBright: string; // background digits, lightest
  circuitColor: string; // faint circuit traces along the top edge
  background: string;
  seed: number;
};

export const BINARY_VERSIONS: BinaryVersion[] = [
  {
    id: "BinaryWord-BinaryCode",
    file: "BinaryWord_BinaryCode",
    word: "BINARY CODE",
    wordColor: "#F2F6FA",
    glowColor: "#C9D6E6",
    bgDim: "#3A4048",
    bgBright: "#6A737D",
    circuitColor: "#1E242B",
    background: "#000000",
    seed: 11,
  },
  {
    id: "BinaryWord-DataStream",
    file: "BinaryWord_DataStream",
    word: "DATA STREAM",
    wordColor: "#5FE3F0",
    glowColor: "#2FB8C8",
    bgDim: "#0F3A40",
    bgBright: "#1F5F66",
    circuitColor: "#0B2427",
    background: "#000000",
    seed: 23,
  },
];

// ── Look 2 — Soft Spinner ───────────────────────────────────────────────
export type SpinnerVersion = {
  id: string;
  file: string;
  petal: string; // saturated petal edge colour
  center: string; // pale petal centre
  halo: string; // stacked-blur halo
  background: string;
};

export const SPINNER_VERSIONS: SpinnerVersion[] = [
  {
    id: "SoftSpinner-Amber",
    file: "SoftSpinner_Amber",
    petal: "#FFB070",
    center: "#FFE6D2",
    halo: "#E0401A",
    background: "#0E0E0E",
  },
  {
    id: "SoftSpinner-IceBlue",
    file: "SoftSpinner_IceBlue",
    petal: "#8FD0FF",
    center: "#F2FAFF",
    halo: "#1446C8",
    background: "#0E0E0E",
  },
];

// ── Look 3 — Security Dashboard ─────────────────────────────────────────
export type DashboardVersion = {
  id: string;
  file: string;
  accent: string;
  secondary: string;
  background: string;
  panel: string; // panel fill
  cameraPhase: number; // start point on the closed camera ellipse (0..1)
};

export const DASHBOARD_VERSIONS: DashboardVersion[] = [
  {
    id: "SecurityDashboard-Teal",
    file: "SecurityDashboard_Teal",
    accent: "#3FE0D0",
    secondary: "#3FD27A",
    background: "#0A1622",
    panel: "#0D1C2A",
    cameraPhase: 0,
  },
  {
    id: "SecurityDashboard-IceViolet",
    file: "SecurityDashboard_IceViolet",
    accent: "#7FB8FF",
    secondary: "#A98BFF",
    background: "#0A1622",
    panel: "#0D1A2C",
    cameraPhase: 0.5,
  },
];

// ── Look 4 — Model Training UI ──────────────────────────────────────────
export type TrainingVersion = {
  id: string;
  file: string;
  title: string;
  orb: [string, string, string];
  accent: string;
  /** keys into src/looks/training/code.ts */
  centerCode: "llm_block" | "finetune";
  rightCode: "health_check" | "eval_report";
  modelName: string; // fictional
  logs: "llm" | "finetune";
};

export const TRAINING_VERSIONS: TrainingVersion[] = [
  {
    id: "ModelTraining-LLM",
    file: "ModelTraining_LLM",
    title: "LLM model training",
    orb: ["#8A4DFF", "#FF4FB8", "#2EC8C8"],
    accent: "#4A8CFF",
    centerCode: "llm_block",
    rightCode: "health_check",
    modelName: "LM Model 1A",
    logs: "llm",
  },
  {
    id: "ModelTraining-FineTuning",
    file: "ModelTraining_FineTuning",
    title: "Model fine-tuning",
    orb: ["#22C7B8", "#3FD08A", "#FFB547"],
    accent: "#3FD08A",
    centerCode: "finetune",
    rightCode: "eval_report",
    modelName: "LM Model 1A-FT",
    logs: "finetune",
  },
];

// ── Look 5 — AI Core Tunnel ─────────────────────────────────────────────
export type TunnelVersion = {
  id: string;
  file: string;
  accent: string;
  highlight: string; // secondary highlight (white-ish / magenta)
  background: string;
  seed: number;
};

export const TUNNEL_VERSIONS: TunnelVersion[] = [
  {
    id: "AICoreTunnel-Cyan",
    file: "AICoreTunnel_Cyan",
    accent: "#5FF2E8",
    highlight: "#DFFFFC",
    background: "#020A0B",
    seed: 5,
  },
  {
    id: "AICoreTunnel-Violet",
    file: "AICoreTunnel_Violet",
    accent: "#B07CFF",
    highlight: "#FF5FD0",
    background: "#07030C",
    seed: 5,
  },
];
