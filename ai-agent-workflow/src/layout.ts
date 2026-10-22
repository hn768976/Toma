// World layout of the infographic, in floor units. `u` runs along the data
// flow (screen up-right), `v` runs down a column (screen down-right). The
// AI Agent card is 10×10 and sits at the origin.

export type V2 = [number, number];

export const FPS = 30;
export const DURATION = 600; // 20 s, same as the reference

// ---------------------------------------------------------------------------
// Timeline (frames)
// ---------------------------------------------------------------------------
export const T = {
  sceneFadeIn: [0, 15] as const,
  inputsIn: 0,
  guideLines: 8,
  inputStubs: 8,
  inputLines: 40,
  cardGhost: 28,
  cardGrow: 32,
  rings: 34,
  brain: 35,
  agentLabel: 40,
  agentOut: 80,
  workflowBranches: 104,
  workflowLabel: 110,
  workflowTiles: [129, 117, 143] as const, // flowchart, shield, gear
  shieldOut: 172,
  outputLabel: 196,
  outputBus: 200,
  outputCards: 206,
  nextLines: 282,
  nextLabel: 300,
  nextIcons: 304,
};

// ---------------------------------------------------------------------------
// Nodes
// ---------------------------------------------------------------------------
export const CARD = { u: 0, v: 0, size: 10, z: 0.9 };

export type IconName =
  | "database"
  | "document"
  | "chat"
  | "cloud"
  | "broadcast"
  | "flowchart"
  | "shield"
  | "gear"
  | "bulb"
  | "robot"
  | "bell"
  | "puzzle";

export const INPUT_ICONS: IconName[] = [
  "database",
  "document",
  "chat",
  "cloud",
  "broadcast",
];

export const INPUT = {
  u: -12.3,
  vs: [-3.7, -1.1, 1.5, 4.1, 6.7],
  size: 1.75,
  label: [-13.7, -6.6] as V2,
};

export const WORKFLOW = {
  label: [8.0, -7.7] as V2,
  tiles: [
    { icon: "flowchart" as IconName, u: 8.0, v: -5.0, w: 2.7, h: 2.5, accent: "secondary" as const },
    { icon: "shield" as IconName, u: 8.8, v: -1.2, w: 5.0, h: 2.5, accent: "primary" as const },
    { icon: "gear" as IconName, u: 9.6, v: 2.6, w: 2.7, h: 2.5, accent: "secondary" as const },
  ],
};

export type OutputKind = "bars" | "gauge" | "dots" | "lines" | "list";
export const OUTPUT = {
  label: [16.2, -10.8] as V2,
  u: 16.2,
  w: 7.2,
  h: 2.0,
  rows: [
    { v: -8.4, icon: "document" as IconName, kind: "bars" as OutputKind },
    { v: -6.0, icon: "bulb" as IconName, kind: "gauge" as OutputKind },
    { v: -3.6, icon: "robot" as IconName, kind: "dots" as OutputKind },
    { v: -1.2, icon: "bell" as IconName, kind: "lines" as OutputKind },
    { v: 1.2, icon: "puzzle" as IconName, kind: "list" as OutputKind },
  ],
};

export const NEXT_INPUT = {
  u: 27.6,
  label: [26.2, -12.4] as V2,
  size: 1.7,
  icons: ["database", "document", "chat", "cloud", "broadcast"] as IconName[],
  vs: OUTPUT.rows.map((r) => r.v - 1.2),
};

// ---------------------------------------------------------------------------
// Data-flow paths
// ---------------------------------------------------------------------------
export type FlowPath = {
  pts: V2[];
  start: number; // frame the reveal begins
  dur: number; // frames to fully reveal
  arrow?: boolean;
  /** Frame range over which the path fades out (for temporary stubs). */
  fadeOut?: [number, number];
};

const inR = INPUT.u + INPUT.size / 2 + 0.25;
const cardL = CARD.u - CARD.size / 2 - 0.15;
const cardR = CARD.u + CARD.size / 2 + 0.15;
const trunkV = INPUT.vs[2];
const BUS_A = -9.2;
const BUS_B = -7.6;

// Short straight arrows that shoot out of each input first, then give way
// to the routed bus (as in the reference).
export const INPUT_STUBS: FlowPath[] = INPUT.vs.map((v, i) => ({
  pts: [[inR, v], [inR + 3.2 + (i % 2) * 0.8, v]],
  start: T.inputStubs + [6, 2, 0, 4, 8][i],
  dur: 22,
  arrow: true,
  fadeOut: [T.inputLines + 6, T.inputLines + 20],
}));

export const INPUT_PATHS: FlowPath[] = [
  { pts: [[inR, trunkV], [cardL, trunkV]], start: T.inputLines, dur: 40, arrow: true },
  { pts: [[inR, INPUT.vs[0]], [BUS_A, INPUT.vs[0]], [BUS_A, trunkV]], start: T.inputLines + 10, dur: 40 },
  { pts: [[inR, INPUT.vs[1]], [BUS_B, INPUT.vs[1]], [BUS_B, trunkV]], start: T.inputLines + 4, dur: 38 },
  { pts: [[inR, INPUT.vs[3]], [BUS_B, INPUT.vs[3]], [BUS_B, trunkV]], start: T.inputLines + 7, dur: 38 },
  { pts: [[inR, INPUT.vs[4]], [BUS_A, INPUT.vs[4]], [BUS_A, trunkV]], start: T.inputLines + 13, dur: 42 },
];

const j1: V2 = [6.8, -1.2];
const wf = WORKFLOW.tiles;
export const WORKFLOW_PATHS: FlowPath[] = [
  { pts: [[cardR, j1[1]], j1], start: T.agentOut, dur: 20 },
  { pts: [j1, [wf[1].u - 0.15, wf[1].v]], start: T.workflowBranches, dur: 14, arrow: true },
  { pts: [j1, [j1[0], wf[0].v], [wf[0].u - 0.15, wf[0].v]], start: T.workflowBranches + 4, dur: 22, arrow: true },
  { pts: [j1, [j1[0], wf[2].v], [wf[2].u - 0.15, wf[2].v]], start: T.workflowBranches + 8, dur: 24, arrow: true },
];

const j2: V2 = [14.9, -1.2];
const outL = OUTPUT.u - 0.15;
const outR = OUTPUT.u + OUTPUT.w + 0.15;
export const OUTPUT_PATHS: FlowPath[] = [
  { pts: [[wf[1].u + wf[1].w + 0.15, j2[1]], j2], start: T.shieldOut, dur: 18 },
  { pts: [j2, [outL, j2[1]]], start: T.outputBus, dur: 10, arrow: true },
  ...OUTPUT.rows
    .filter((r) => r.v !== j2[1])
    .map<FlowPath>((r) => ({
      pts: [j2, [j2[0], r.v], [outL, r.v]],
      start: T.outputBus + Math.abs(r.v - j2[1]) * 2,
      dur: 16 + Math.abs(r.v - j2[1]) * 2,
      arrow: true,
    })),
  // Secondary feedback loop from the flowchart tile up to the first output.
  {
    pts: [[wf[0].u + wf[0].w + 0.15, wf[0].v], [13.9, wf[0].v], [13.9, OUTPUT.rows[0].v - 1.5], [19.5, OUTPUT.rows[0].v - 1.5]],
    start: T.outputBus + 20,
    dur: 50,
  },
];

export const NEXT_PATHS: FlowPath[] = OUTPUT.rows.map((r, k) => {
  const bx = 24.2 + 0.45 * k;
  const tv = NEXT_INPUT.vs[k];
  return {
    pts: [[outR, r.v], [bx, r.v], [bx, tv], [NEXT_INPUT.u - NEXT_INPUT.size / 2 - 0.25, tv]],
    start: T.nextLines + k * 8,
    dur: 44,
    arrow: true,
  };
});

export const JUNCTIONS: { p: V2; at: number }[] = [
  { p: [BUS_A, trunkV], at: T.inputLines + 45 },
  { p: [BUS_B, trunkV], at: T.inputLines + 42 },
  { p: j1, at: T.agentOut + 20 },
  { p: [cardR + 0.05, j1[1]], at: T.agentOut },
  { p: j2, at: T.shieldOut + 18 },
];

// Faint, solid "circuit board" lines etched into the floor.
export const GUIDE_LINES: { pts: V2[]; a: number }[] = [
  { pts: [[-40, -9.6], [60, -9.6]], a: 0.03 },
  { pts: [[-40, 11.5], [60, 11.5]], a: 0.025 },
  { pts: [[-16.5, -40], [-16.5, 40]], a: 0.02 },
  { pts: [[5.6, -40], [5.6, 30]], a: 0.025 },
  { pts: [[14.1, -40], [14.1, 30]], a: 0.02 },
  { pts: [[-30, 18], [45, 18]], a: 0.02 },
  { pts: [[24.9, -40], [24.9, 30]], a: 0.02 },
  { pts: [[-3, -20], [26, -20]], a: 0.02 },
  { pts: [[-6.2, 6.2], [-6.2, 9.0], [4.0, 9.0]], a: 0.03 },
];

export const COUNTERS: { u: number; v: number; seed: number; dot?: "primary" | "secondary" }[] = [
  { u: -4.2, v: 9.8, seed: 11, dot: "primary" },
  { u: 3.4, v: 7.0, seed: 23, dot: "secondary" },
  { u: 11.4, v: 7.6, seed: 37 },
  { u: 20.5, v: 4.6, seed: 41 },
  { u: -1.0, v: 14.6, seed: 53 },
  { u: 29.0, v: 3.6, seed: 61 },
];
