/** Frame geometry. Flat, frontal, locked off — nothing here depends on the frame. */

export const W = 3840;
export const H = 2160;

/** The fingerprint: the only large element, centre-right, ~72% of frame height. */
export const PRINT_HEIGHT = Math.round(H * 0.72); // 1555
export const PRINT_ASPECT = 1268 / 1796; // from public/fingerprint.png
export const PRINT_WIDTH = Math.round(PRINT_HEIGHT * PRINT_ASPECT);
export const PRINT_CX = 2168;
export const PRINT_CY = 1080;
export const PRINT_X = Math.round(PRINT_CX - PRINT_WIDTH / 2);
export const PRINT_Y = Math.round(PRINT_CY - PRINT_HEIGHT / 2);

export type Rect = { x: number; y: number; w: number; h: number };

/** Upper-left: the percent dial / confidence readout. */
export const DIAL: Rect = { x: 300, y: 168, w: 420, h: 420 };

/** Left column: two code panels of dense illegible monospace. */
export const CODE_A: Rect = { x: 252, y: 664, w: 792, h: 556 };
export const CODE_B: Rect = { x: 252, y: 1258, w: 792, h: 316 };

/** Lower-left: the dot globe inside a ticked ring. */
export const GLOBE: Rect = { x: 300, y: 1636, w: 440, h: 440 };

/** Right edge: vertical measurement rule. */
export const RULE_V = { x: 3236, y: 452, h: 1256 };

/** Right edge: two small pattern panels. Texture only, never photographic. */
export const PAT_A: Rect = { x: 3376, y: 452, w: 372, h: 328 };
export const PAT_B: Rect = { x: 3376, y: 1380, w: 372, h: 328 };

/** Top and bottom rule bars, running the full width. */
export const RULE_TOP_Y = 156;
export const RULE_BOTTOM_Y = 2004;

/** Small marginal marks. */
export const CROSSHAIRS: { x: number; y: number }[] = [
  { x: 168, y: 96 },
  { x: 3672, y: 96 },
  { x: 168, y: 2064 },
  { x: 3672, y: 2064 },
  { x: 1180, y: 2064 },
  { x: 3128, y: 1900 },
  { x: 1104, y: 96 },
];

export const DASHED_RULES: { x: number; y: number; w: number; seed: string }[] = [
  { x: 252, y: 1636, w: 340, seed: "dash-a" },
  { x: 3376, y: 848, w: 372, seed: "dash-b" },
  { x: 3376, y: 928, w: 300, seed: "dash-c" },
  { x: 3376, y: 1208, w: 372, seed: "dash-d" },
  { x: 252, y: 612, w: 792, seed: "dash-e" },
  { x: 3376, y: 1300, w: 232, seed: "dash-f" },
];

/** Ambient drift: ±8px on a closed Lissajous path, so frame 0 and 420 agree on it. */
export const DRIFT_AMPLITUDE = 8;
export const drift = (frame: number, duration: number) => {
  const a = (Math.PI * 2 * frame) / duration;
  return {
    x: Math.sin(a) * DRIFT_AMPLITUDE,
    y: Math.sin(a * 2) * DRIFT_AMPLITUDE * 0.75,
  };
};
