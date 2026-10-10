// One data row per version. To add a colourway, copy a row, give it a new
// id and change the colours; Root.tsx registers every row automatically.

export const FPS = 30;
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const STORY_FRAMES = 450; // 15 s
export const LOOP_FRAMES = 600; // 20 s

// ---------------------------------------------------------------- Look 1
export type GenerateRow = {
  id: string;
  reveal: "circuit" | "waveform";
  label: string; // the button word
  buttonFrom: string; // gradient start (left)
  buttonTo: string; // gradient end (right)
  outline: string;
  glow: string;
  traceFrom: string; // traces / bars near the button
  traceTo: string; // traces / bars at the tips
  head: string; // white-hot heads and pulses
  squares: string[];
  seed: number;
};

export const GENERATE_ROWS: GenerateRow[] = [
  {
    id: "GenerateButton-Circuit",
    reveal: "circuit",
    label: "Generate",
    buttonFrom: "#2AD8D0",
    buttonTo: "#7A4AE8",
    outline: "#8AF4FF",
    glow: "#2AD8FF",
    traceFrom: "#2AD8FF",
    traceTo: "#2A7AFF",
    head: "#F2FDFF",
    squares: ["#2AD8FF", "#2A7AFF", "#7A4AE8", "#7A4AE8", "#8A3AF0", "#5AC8C8", "#5A6AC8", "#3AE08A"],
    seed: 11,
  },
  {
    id: "GenerateButton-Waveform",
    reveal: "waveform",
    label: "Generate",
    buttonFrom: "#2AD8D0",
    buttonTo: "#7A4AE8",
    outline: "#8AF4FF",
    glow: "#2AD8FF",
    traceFrom: "#2A8AFF",
    traceTo: "#5AE0FF",
    head: "#E8FBFF",
    squares: ["#2AD8FF", "#2A7AFF", "#7A4AE8", "#7A4AE8", "#5A6AC8", "#2AD8FF", "#3AE08A"],
    seed: 23,
  },
  {
    id: "GenerateButton-CircuitWarm",
    reveal: "circuit",
    label: "Generate",
    buttonFrom: "#FF8A3A",
    buttonTo: "#C82A9A",
    outline: "#FFC89A",
    glow: "#FF6A3A",
    traceFrom: "#FF2AA8",
    traceTo: "#FF8A2A",
    head: "#FFF4D8",
    squares: ["#FF2AA8", "#FF8A2A", "#FFC84A", "#FF2AA8", "#FF8A2A", "#FFC84A", "#8A4AE8"],
    seed: 11,
  },
];

// ---------------------------------------------------------------- Look 2
export type FibreRow = {
  id: string;
  fibreFrom: string;
  fibreTo: string;
  pulse: string;
  background: string;
  board: string;
  seed: number;
};

export const FIBRE_ROWS: FibreRow[] = [
  {
    id: "FibreRibbon-Blue",
    fibreFrom: "#2A6AFF",
    fibreTo: "#4AD8FF",
    pulse: "#DFFAFF",
    background: "#02060F",
    board: "#0A2A5A",
    seed: 7,
  },
  {
    id: "FibreRibbon-Violet",
    fibreFrom: "#7A3AFF",
    fibreTo: "#FF4AD8",
    pulse: "#FFE0F8",
    background: "#06020C",
    board: "#2A0A4A",
    seed: 7,
  },
];

// ---------------------------------------------------------------- Look 3
export type CubeRow = {
  id: string;
  body: string;
  edge: string;
  line: string;
  bgEdge: string;
  bgMid: string;
  seed: number;
};

export const CUBE_ROWS: CubeRow[] = [
  {
    id: "CubeNetwork-Blue",
    body: "#0A3A7A",
    edge: "#7ADFFF",
    line: "#6ADFFF",
    bgEdge: "#06183A",
    bgMid: "#0A2350",
    seed: 5,
  },
];

// ---------------------------------------------------------------- Look 4
export type PadlockRow = {
  id: string;
  shot: "topdown" | "flyover";
  padlock: string;
  rim: string;
  ring: string;
  ringGlow: string;
  floor: string;
  grid: string;
  circuit: string;
  line: string;
  fogTop: string;
  fogBottom: string;
  seed: number;
};

export const PADLOCK_ROWS: PadlockRow[] = [
  {
    id: "PadlockField-TopDownOrange",
    shot: "topdown",
    padlock: "#F4D8E4",
    rim: "#6AA8FF",
    ring: "#FF8A2A",
    ringGlow: "#FF6A1A",
    floor: "#0A1A3A",
    grid: "#2A5AA8",
    circuit: "#3AC8E8",
    line: "#C8E0FF",
    fogTop: "#0A1A3A",
    fogBottom: "#0A1A3A",
    seed: 3,
  },
  {
    id: "PadlockField-FlyOverCyan",
    shot: "flyover",
    padlock: "#7AD0F0",
    rim: "#BDEBFF",
    ring: "#5AC8FF",
    ringGlow: "#2A9AFF",
    floor: "#04182A",
    grid: "#2A8AB8",
    circuit: "#3AC8E8",
    line: "#8ADCFF",
    fogTop: "#0A3048",
    fogBottom: "#1A6A8A",
    seed: 9,
  },
];
