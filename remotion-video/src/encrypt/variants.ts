/**
 * The single source of truth for both versions of the encryption screen.
 *
 * `VARIANTS` is keyed by variant name and each entry bundles EVERYTHING that
 * distinguishes one version from the other: the palette, the outcome mode, the
 * progress curve, the dialog labels and the icon types. Nothing else in the
 * project may contain a hex literal or a user-visible label string — switching
 * `variant` switches the whole piece as one coherent mode, not four separate
 * knobs.
 */

export type VariantName = "success" | "failure";

/** The outcome mode. Drives curve shape, icon swap, labels and palette. */
export type OutcomeMode = "completes" | "stalls";

export type IconKind = "padlockClosed" | "padlockOpen" | "checkCircle";

/** One leg of the progress curve. `ease` shapes the pace inside the leg. */
export type CurveSegment = {
  readonly from: number;
  readonly to: number;
  readonly a: number;
  readonly b: number;
  readonly ease: "linear" | "out" | "in" | "jerky";
};

export type Palette = {
  readonly backgroundDeep: string;
  readonly backdropText: string;
  readonly gridLine: string;
  readonly panelBorder: string;
  readonly dialogFill: string;
  readonly dialogFillAlpha: number;
  readonly dialogBorder: string;
  readonly titleBar: string;
  /** The title bar brightens when the outcome lands. */
  readonly titleBarBright: string;
  readonly titleText: string;
  /** Outcome icon colour. */
  readonly icon: string;
  readonly iconGlow: string;
  /** Icon colour while the progress phase is still nominal. */
  readonly iconPre: string;
  readonly iconGlowPre: string;
  readonly barFill: string;
  /** Bar fill colour while progress is still nominal. */
  readonly barFillPre: string;
  /** Mid point of the fill colour shift. */
  readonly barFillMid: string;
  readonly barTrack: string;
  readonly textPale: string;
  readonly textBright: string;
  readonly flash: string;
  /** Generic window-control dots. Deliberately not any real platform's. */
  readonly dotRed: string;
  readonly dotGreen: string;
  /** The two channels the dialog splits into during the glitch. */
  readonly channelA: string;
  readonly channelB: string;
};

export type Labels = {
  readonly title: string;
  readonly status: string;
  /** Shown briefly while the system retries. Only used by "stalls". */
  readonly statusAlt: string;
  readonly outcomeTitle: string;
  readonly outcomeBanner: string;
};

export type Variant = {
  readonly mode: OutcomeMode;
  readonly palette: Palette;
  readonly labels: Labels;
  readonly icon: { readonly progress: IconKind; readonly outcome: IconKind };
  readonly curve: {
    readonly segments: readonly CurveSegment[];
    /** Percentages the curve must land on exactly (plateaus, endpoints). */
    readonly anchors: readonly number[];
    /** Frame the fill colour starts shifting away from `barFillPre`. */
    readonly colorShiftAt: number | null;
    readonly colorShiftFrames: number;
    /** Window over which the hatching scroll decelerates to a standstill. */
    readonly hatchStallAt: number | null;
    readonly hatchStallFrames: number;
    /** Frames where the status line flips to `labels.statusAlt`. */
    readonly statusAltWindows: readonly (readonly [number, number])[];
  };
  readonly transitionSpec: {
    /** Frames held at full flash opacity. */
    readonly flashHold: number;
    readonly flashDecay: number;
    readonly glitch: boolean;
    /** Frames after the flash starts that the glitch runs, and for how long.
     *  Offset so the slices are still on screen once the flash has washed
     *  down far enough to see them. */
    readonly glitchAt: number;
    readonly glitchFrames: number;
    /** Draws a hard cross over the outcome icon. */
    readonly cross: boolean;
  };
  readonly outcome: {
    readonly pulse: boolean;
    readonly flicker: boolean;
    /** Side-panel indices that go dark permanently. */
    readonly deadPanels: readonly number[];
    /** Backdrop column index that garbles, or null. */
    readonly garbleColumn: number | null;
  };
};

/** Generic window controls, shared by both variants. */
const DOT_RED = "#C8323C";
const DOT_GREEN = "#32C84B";

/** v1's green. v2 reuses it so the two are indistinguishable until frame 300. */
const NOMINAL_GREEN = "#3FE84F";
const NOMINAL_GREEN_GLOW = "#7FFF8F";

export const VARIANTS: Readonly<Record<VariantName, Variant>> = {
  success: {
    mode: "completes",
    palette: {
      backgroundDeep: "#020A14",
      backdropText: "#1A4A6B",
      gridLine: "#0F2E42",
      panelBorder: "#2E7FA8",
      dialogFill: "#06182A",
      dialogFillAlpha: 0.88,
      dialogBorder: "#4FC4E8",
      titleBar: "#0A3A5C",
      titleBarBright: "#1C6E9E",
      titleText: "#E8F8FF",
      icon: NOMINAL_GREEN,
      iconGlow: NOMINAL_GREEN_GLOW,
      iconPre: NOMINAL_GREEN,
      iconGlowPre: NOMINAL_GREEN_GLOW,
      barFill: NOMINAL_GREEN,
      barFillPre: NOMINAL_GREEN,
      barFillMid: NOMINAL_GREEN,
      barTrack: "#0A2A3A",
      textPale: "#A8D8F0",
      textBright: "#FFFFFF",
      flash: "#E8FCFF",
      dotRed: DOT_RED,
      dotGreen: DOT_GREEN,
      channelA: "#FF2A3C",
      channelB: "#28E4FF",
    },
    labels: {
      title: "DATA ENCRYPTION",
      status: "Encrypting...",
      statusAlt: "Verifying...",
      outcomeTitle: "SUCCESSFUL",
      outcomeBanner: "DATA PROTECTED",
    },
    icon: { progress: "padlockClosed", outcome: "checkCircle" },
    curve: {
      // Fast to 40, a pause around 47, steady to 80, a longer pause at 88,
      // then a quick run to 100.
      segments: [
        { from: 100, to: 168, a: 0, b: 40, ease: "out" },
        { from: 168, to: 186, a: 40, b: 47, ease: "linear" },
        { from: 186, to: 214, a: 47, b: 47, ease: "linear" },
        { from: 214, to: 296, a: 47, b: 80, ease: "linear" },
        { from: 296, to: 330, a: 80, b: 88, ease: "in" },
        { from: 330, to: 362, a: 88, b: 88, ease: "linear" },
        { from: 362, to: 380, a: 88, b: 100, ease: "out" },
      ],
      anchors: [0, 40, 47, 80, 88, 100],
      colorShiftAt: null,
      colorShiftFrames: 25,
      hatchStallAt: null,
      hatchStallFrames: 40,
      statusAltWindows: [],
    },
    transitionSpec: {
      flashHold: 4,
      flashDecay: 20,
      glitch: false,
      glitchAt: 0,
      glitchFrames: 0,
      cross: false,
    },
    outcome: { pulse: true, flicker: false, deadPanels: [], garbleColumn: null },
  },

  failure: {
    mode: "stalls",
    palette: {
      backgroundDeep: "#0A0204",
      backdropText: "#6B1A24",
      gridLine: "#3A0F14",
      panelBorder: "#A82E3A",
      dialogFill: "#1A0608",
      dialogFillAlpha: 0.88,
      dialogBorder: "#F5486B",
      titleBar: "#5C0A16",
      titleBarBright: "#96142A",
      titleText: "#FFE8EC",
      icon: "#FF3A4F",
      iconGlow: "#FF8F9F",
      // Starts as v1's green padlock; only turns red from the failure moment.
      iconPre: NOMINAL_GREEN,
      iconGlowPre: NOMINAL_GREEN_GLOW,
      barFill: "#FF3A4F",
      barFillPre: NOMINAL_GREEN,
      barFillMid: "#FFA23A",
      barTrack: "#2A0A0E",
      textPale: "#F0A8B4",
      textBright: "#FFFFFF",
      flash: "#FF6070",
      dotRed: DOT_RED,
      dotGreen: DOT_GREEN,
      channelA: "#FF2A3C",
      channelB: "#28E4FF",
    },
    labels: {
      title: "DATA ENCRYPTION",
      status: "Encrypting...",
      statusAlt: "Verifying...",
      outcomeTitle: "FAILED",
      outcomeBanner: "DATA EXPOSED",
    },
    icon: { progress: "padlockClosed", outcome: "padlockOpen" },
    curve: {
      // Identical rhythm to v1 up to 73%, reached exactly at frame 300, then
      // the stall and the drain back to 41%.
      segments: [
        { from: 100, to: 168, a: 0, b: 40, ease: "out" },
        { from: 168, to: 186, a: 40, b: 47, ease: "linear" },
        { from: 186, to: 214, a: 47, b: 47, ease: "linear" },
        { from: 214, to: 300, a: 47, b: 73, ease: "linear" },
        { from: 300, to: 340, a: 73, b: 73, ease: "linear" },
        { from: 340, to: 380, a: 73, b: 41, ease: "jerky" },
      ],
      anchors: [0, 40, 47, 73, 41],
      colorShiftAt: 300,
      colorShiftFrames: 25,
      hatchStallAt: 300,
      hatchStallFrames: 40,
      statusAltWindows: [
        [308, 324],
        [332, 340],
      ],
    },
    transitionSpec: {
      flashHold: 3,
      flashDecay: 12,
      glitch: true,
      glitchAt: 6,
      glitchFrames: 3,
      cross: true,
    },
    outcome: {
      pulse: false,
      flicker: true,
      deadPanels: [2, 5],
      garbleColumn: 3,
    },
  },
};
