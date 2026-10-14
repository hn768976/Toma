// One data row per version. To add a colourway, copy a row, give it a new
// `id` (the composition name) and change the colours — nothing else.

export type HudPlaneRow = {
  look: "hudPlane";
  id: string;
  /** blurred background: [main, highlight, deep] */
  bg: [string, string, string];
  /** HUD lines + text */
  hud: string;
  /** block-cell fill */
  fill: string;
  /** centre text */
  centre: string;
};

export type ParticleChipRow = {
  look: "particleChip";
  id: string;
  points: string;
  space: string;
  bokeh: string;
  rain: string;
  centre: string;
};

export type ChipRevealRow = {
  look: "chipReveal";
  id: string;
  /** HUD lines, labels and the centre letters */
  hud: string;
  /** fine tick marks on the chip face */
  ticks: string;
  die: string;
  /** bokeh palette, weighted by repetition */
  bokeh: string[];
  /** blurred board base colour */
  board: string;
  centre: string;
  labels: { chatbot: string; prompt: string; data: string; model: string };
};

export type Row = HudPlaneRow | ParticleChipRow | ChipRevealRow;

export const ROWS: Row[] = [
  { look: "hudPlane", id: "AIHudPlane_Violet", bg: ["#6A3AC8", "#C86AC8", "#1A1A6A"], hud: "#C8F0FF", fill: "#A8E4FF", centre: "AI" },
  { look: "hudPlane", id: "AIHudPlane_Teal", bg: ["#1A8A8A", "#3AC8C8", "#0A1A3A"], hud: "#D0FFF8", fill: "#B0FFF0", centre: "AI" },
  { look: "particleChip", id: "ParticleAIChip_Blue", points: "#C8E8FF", space: "#0A1A3A", bokeh: "#3A8AFF", rain: "#9CCBFF", centre: "AI" },
  {
    look: "chipReveal",
    id: "AIChipReveal_Blue",
    hud: "#D8F4FF",
    ticks: "#FF8A3A",
    die: "#0A1A3A",
    bokeh: ["#3A8AFF", "#3A8AFF", "#3A8AFF", "#40D0FF", "#40D0FF", "#FF8A3A"],
    board: "#08283C",
    centre: "AI",
    labels: { chatbot: "CHATBOT", prompt: "COMMAND PROMPT:", data: "DATA", model: "MODEL" },
  },
  {
    look: "chipReveal",
    id: "AIChipReveal_Amber",
    hud: "#FFE6B8",
    ticks: "#FFC060",
    die: "#1E1208",
    bokeh: ["#FF8A3A", "#FF8A3A", "#FFC060", "#FFC060", "#FFA040", "#2AB8B0"],
    board: "#2A1606",
    centre: "AI",
    labels: { chatbot: "CHATBOT", prompt: "COMMAND PROMPT:", data: "DATA", model: "MODEL" },
  },
];
