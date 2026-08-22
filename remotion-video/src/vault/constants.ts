// Kurzgesagt-style explainer: "the vault".
//
// Two independent coordinate/timing systems live in this folder:
//   * the SCENE   — one oversized 3840x2160 container that every element is
//                   positioned inside, in absolute scene pixels;
//   * the CAMERA  — a 1920x1080 viewport onto that container (see camera.ts).
// Element animation never reads camera state and vice versa.

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;
export const DURATION_IN_FRAMES = 870; // 29s

// The oversized scene container the camera looks at.
export const SCENE_WIDTH = 3840;
export const SCENE_HEIGHT = 2160;
export const SCENE_CX = SCENE_WIDTH / 2;
export const SCENE_CY = SCENE_HEIGHT / 2;

export const PALETTE = {
  navy: "#0B1A2F",
  navyCool: "#08172F", // cue 8 shifts the background 8% cooler and stays there
  yellow: "#FFC93C", // fat / the vault's contents ONLY
  coral: "#FF6B6B", // alarm, the guard's interventions
  teal: "#4ECDC4", // the hormone / the gauge
  cream: "#F7F3E9", // structures, the vault itself
} as const;

// Frame each cue's voice-over starts on.
export const CUE = {
  c1: 0, // "This is a vault."
  c2: 30, // "Your body built it."
  c3: 60, // "It is packed with fat,"
  c4: 90, // "...guarded around the clock by a security guard"
  c5: 165, // "who has never once clocked off."
  c6: 210, // "And he takes the job seriously."
  c7: 255, // "Try to take anything out,"
  c8: 300, // "...drop your body temperature without telling you."
  c9: 375, // "...a cheese sandwich look like a religious event,"
  c10: 450, // "...for years after you have stopped noticing."
  c11: 540, // "So why does your body guard fat like the crown jewels?"
  c12: 630, // "And how does it even know how much is in there?"
  c13: 705, // "...look at the gauge bolted to the side of the vault."
  c14: 780, // "It's real."
  c15: 795, // "It's a hormone."
  c16: 810, // "...since before you could walk."
  end: DURATION_IN_FRAMES,
} as const;

// Rule: land each visual 6 frames BEFORE the words explain it.
export const LEAD = 6;
export const lead = (cueFrame: number) => cueFrame - LEAD;

// Element enter/exit timings, in frames (0.4s in, 0.3s out).
export const ENTER_FRAMES = 12;
export const EXIT_FRAMES = 9;

// Where the recurring props live in scene space.
export const POS = {
  vault: { x: 1800, y: 1050 },
  vaultLate: { x: 1620, y: 1060 }, // cue 13 puts it centre-left
  guard: { x: 2400, y: 1180 },
  clock: { x: 2400, y: 880 },
  punchCards: { x: 2400, y: 1460 },
  thermometer: { x: 2560, y: 1010 },
  sandwich: { x: 1900, y: 1040 },
  calendars: { x: 1880, y: 1260 },
  cushion: { x: 1800, y: 1160 },
  question: { x: 2620, y: 660 },
  gauge: { x: 1930, y: 1080 },
  infant: { x: 1900, y: 1530 },
  label: { x: 1900, y: 1460 },
} as const;

export const FONT_FAMILY = "Nunito Vault";
export const FONT_STACK = `"${FONT_FAMILY}", Nunito, Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
