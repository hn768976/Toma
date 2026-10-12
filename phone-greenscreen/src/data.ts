/**
 * One data row per version (motion + background). Root.tsx turns every row
 * into a <Composition>. To add a background, add an entry to BACKGROUNDS;
 * to add a version, add a row to VERSIONS.
 */

export type BackgroundType = "green" | "diagonal" | "studio" | "flat";

export type BackgroundSpec = {
  type: BackgroundType;
  /** sRGB hex colours; meaning depends on type (see post.ts) */
  colors?: string[];
  /** soft floor glow (diagonal backgrounds) */
  glow?: number;
  glowPos?: [number, number];
  /** diagonal: deepen the first colour into the bottom-left corner / soft light streak */
  deepen?: number;
  streak?: number;
  /** studio: uv.y of the wall / floor horizon (0 = bottom) */
  horizon?: number;
  vignette?: number;
  /** draw the soft contact / drop shadow (never on green) */
  shadow: boolean;
  /** shadow strength */
  shadowOpacity?: number;
};

export const BACKGROUNDS = {
  GreenScreen: { type: "green", shadow: false },
  PastelGradient: {
    type: "diagonal",
    colors: ["#C8D4F0", "#F0F2F8", "#F0D8E0"],
    glow: 0.35,
    glowPos: [0.69, 0.13],
    deepen: 1.0,
    streak: 0.45,
    vignette: 0.06,
    shadow: true,
    shadowOpacity: 0.24,
  },
  PastelPink: {
    type: "diagonal",
    colors: ["#D8C8F0", "#F0C0D0", "#F4ECC0"],
    glow: 0,
    vignette: 0.04,
    shadow: false,
  },
  WhiteStudio: {
    type: "studio",
    colors: ["#F2F4F6"],
    horizon: 0.22,
    vignette: 0.1,
    shadow: true,
    shadowOpacity: 0.3,
  },
  White: { type: "flat", colors: ["#FAFAFA"], shadow: true, shadowOpacity: 0.3 },
  /** neutral grey, used only for the model check stills */
  Grey: { type: "flat", colors: ["#8A8D92"], shadow: false },
} satisfies Record<string, BackgroundSpec>;

export type BackgroundId = keyof typeof BACKGROUNDS;

export type MotionId = "DropIn" | "Sway" | "TumbleLand" | "Grid" | "ModelCheck";

export type VersionRow = {
  /** composition id (Remotion ids allow no underscores); the output file is id with "-" -> "_" */
  id: string;
  motion: MotionId;
  background: BackgroundId;
  durationInFrames: number;
  /** loops must end where they started: frame N === frame 0 */
  loop: boolean;
  frameColor?: string;
};

export const FPS = 30;
export const WIDTH = 3840;
export const HEIGHT = 2160;

export const VERSIONS: VersionRow[] = [
  { id: "PhoneDropIn-GreenScreen", motion: "DropIn", background: "GreenScreen", durationInFrames: 300, loop: false },
  { id: "PhoneDropIn-PastelGradient", motion: "DropIn", background: "PastelGradient", durationInFrames: 300, loop: false },
  { id: "PhoneSway-GreenScreen", motion: "Sway", background: "GreenScreen", durationInFrames: 600, loop: true },
  { id: "PhoneSway-PastelPink", motion: "Sway", background: "PastelPink", durationInFrames: 600, loop: true },
  { id: "PhoneTumbleLand-GreenScreen", motion: "TumbleLand", background: "GreenScreen", durationInFrames: 300, loop: false },
  { id: "PhoneTumbleLand-WhiteStudio", motion: "TumbleLand", background: "WhiteStudio", durationInFrames: 300, loop: false },
  { id: "PhoneGrid-White", motion: "Grid", background: "White", durationInFrames: 600, loop: true },
];

/** Utility composition: frame 0 front, 1 back, 2 three-quarter, 3 three-quarter back. */
export const MODEL_CHECK: VersionRow = {
  id: "PhoneModelCheck",
  motion: "ModelCheck",
  background: "Grey",
  durationInFrames: 4,
  loop: false,
};
