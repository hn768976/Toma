/**
 * The ONE place where a colour, a piece of display copy, a signal character,
 * a readout behaviour or an event schedule is defined.
 *
 * Nothing else in this project contains a hex literal or a label string:
 * every component receives a `VariantConfig` and reads what it needs from it.
 * Adding a third variant means adding a third key here and nothing more.
 */

export type VariantName = "steady" | "alert";

/** Exactly the eleven roles the brief specifies, named without a hue. */
export type Palette = {
  background: string;
  panelFill: string;
  panelBorder: string;
  gridLine: string;
  trace: string;
  tracePale: string;
  text: string;
  readoutValue: string;
  readoutUnit: string;
  cell: string;
  cellDim: string;
};

export type Labels = {
  headerSections: readonly string[];
  panelStrip: string;
  waveformIds: readonly string[];
  waveformCodes: readonly string[];
  readoutUnits: readonly string[];
  readoutAnnotation: string;
  thumbPanelTitle: string;
  tableTitles: readonly string[];
  tableColumns: readonly string[];
  progressLabel: string;
  matrixTitle: string;
  matrixTag: string;
  spectrumTitle: string;
  spectrumTag: string;
  indicatorTitles: readonly string[];
  namePool: readonly string[];
  codePool: readonly string[];
  monthPool: readonly string[];
  tokenPool: readonly string[];
};

/** How the three centre signals behave over the 600 frames. */
export type WaveformCharacter = {
  kind: "steady" | "destabilising";
  /**
   * The single INSTABILITY value every degradation is driven from.
   * Linear from `[0]` at frame 0 to `[1]` at frame 600.
   * "steady" holds it at zero, so nothing in the signal path moves.
   */
  instabilityRamp: readonly [number, number];
};

export type ReadoutBehaviour = {
  mode: "normal" | "climbing";
  /** Normal operating band for each of the three readouts. */
  bands: readonly (readonly [number, number])[];
  /** Where "climbing" drags each readout to by frame 600. */
  climbTo: readonly number[];
  /** Frames between updates at frame 0 and at frame 600. */
  updateGapStart: readonly [number, number];
  updateGapEnd: readonly [number, number];
  /** Above this a readout flashes continuously instead of only on change. */
  alarmAbove: readonly number[];
};

export type EventSchedule = {
  kind: "none" | "escalating";
  /** First frame an alert flash can fire; Infinity disables the event. */
  alertFrom: number;
  /** Frames between alerts, at `alertFrom` and at frame 600. */
  alertGapStart: number;
  alertGapEnd: number;
  glitchFrom: number;
  /** Frame the two data tables stop updating, permanently. */
  tableFreezeFrom: number;
  /** Frame the cell matrix starts going dark. */
  matrixDarkFrom: number;
};

export type VariantConfig = {
  palette: Palette;
  labels: Labels;
  waveform: WaveformCharacter;
  readout: ReadoutBehaviour;
  events: EventSchedule;
  /** Whether frame 600 is pixel-identical to frame 0. */
  loops: boolean;
};

/** Copy is shared between the variants; only the tone of the piece changes. */
const LABELS: Labels = {
  headerSections: ["PROFILE", "DATA", "FORMULA", "LAB"],
  panelStrip: "PROFILE / DATA / FORMULA / LAB",
  waveformIds: ["QI", "HL", "ER"],
  waveformCodes: ["SEQ_QI_04 / CH_1", "SEQ_HL_11 / CH_2", "SEQ_ER_07 / CH_3"],
  readoutUnits: ["PPU", "TI 2", "IL"],
  readoutAnnotation: "mc/p",
  thumbPanelTitle: "PROFILE / DATA / FORMULA / LAB",
  tableTitles: ["LAB_09_R(h)", "LAB_03_L(r)"],
  tableColumns: ["NAME", "NP", "FILE_1", "DATA", "PRO_9992"],
  progressLabel: "SEQ",
  matrixTitle: "MED_04 LAB#2 PL_2",
  matrixTag: "NT",
  spectrumTitle: "MED_2b4 LAB#0 1 PL_1 / PROGRAM3_EERO HPEM(2) / PL_GAM",
  spectrumTag: "YE",
  indicatorTitles: ["CTL_A", "CTL_B", "CTL_C", "CTL_D"],
  namePool: [
    "Marcus Diani", "Liliana Bendel", "Josephine Desjarlais", "Addison McIntyre",
    "Audrey Michel", "Dominic Massot", "Jonathan Mccullough", "Joshua Ionita",
    "Kaolan Cabina", "Federico Fialdini", "Brian R. Maynard", "Brianna Ossa",
    "Jasmine Aude", "Christine Berry", "Brigitte Bay", "Tuan Soor",
  ],
  codePool: [
    "APL-707-LNP-071-1", "GRI-1EL-No", "GPH-9LE-BIP-HUM", "LS1-582-4990-N",
    "979-069-NCL-SEV-4", "S94-925-050-FNA", "540-Y52-7b", "REF-575-B5E",
    "RE9-3T4-P", "F97-5RG-E", "X7T-mPB", "B4P-RF2-J9", "PLM-0LR-22",
  ],
  monthPool: ["Jan", "Feb", "Mar", "Apr", "Jun", "Jul", "Sep", "Oct", "Nov"],
  tokenPool: [
    "PL_1", "PL_2", "AL_B", "SA_1_P", "C_F", "NP", "HAT-5.1", "LOP",
    "GC", "VQ", "LMN", "KP_2", "TR_9", "MX", "EE", "N_4",
  ],
};

export const VARIANTS: Record<VariantName, VariantConfig> = {
  /* ─────────── v1 "steady" — green, normal operation ─────────── */
  steady: {
    palette: {
      background: "#010604",
      panelFill: "#030F08",
      panelBorder: "#1A9F6B",
      gridLine: "#0C3D28",
      trace: "#3FE8A8",
      tracePale: "#A8FFD8",
      text: "#4FD48F",
      readoutValue: "#FF3A3A",
      readoutUnit: "#3FE87A",
      cell: "#3FD4E8",
      cellDim: "#0F4A5C",
    },
    labels: LABELS,
    waveform: {
      kind: "steady",
      // Held at zero: all three signals stay within normal bounds all loop.
      instabilityRamp: [0, 0],
    },
    readout: {
      mode: "normal",
      bands: [
        [84, 90],
        [117, 133],
        [73, 79],
      ],
      climbTo: [87, 125, 76],
      updateGapStart: [40, 70],
      updateGapEnd: [40, 70],
      alarmAbove: [Infinity, Infinity, Infinity],
    },
    events: {
      kind: "none",
      alertFrom: Infinity,
      alertGapStart: Infinity,
      alertGapEnd: Infinity,
      glitchFrom: Infinity,
      tableFreezeFrom: Infinity,
      matrixDarkFrom: Infinity,
    },
    loops: true,
  },

  /* ─────────── v2 "alert" — amber, the system destabilising ─────────── */
  alert: {
    palette: {
      background: "#0A0301",
      panelFill: "#180703",
      panelBorder: "#C4622A",
      gridLine: "#3D1A0C",
      trace: "#FFA83F",
      tracePale: "#FFE0B8",
      text: "#E8A65F",
      readoutValue: "#FF2D2D",
      readoutUnit: "#FFC44F",
      cell: "#FF7A3F",
      cellDim: "#5C2A0F",
    },
    labels: LABELS,
    waveform: {
      kind: "destabilising",
      instabilityRamp: [0, 1],
    },
    readout: {
      mode: "climbing",
      bands: [
        [84, 90],
        [117, 133],
        [73, 79],
      ],
      climbTo: [167, 288, 154],
      updateGapStart: [40, 70],
      updateGapEnd: [8, 15],
      alarmAbove: [104, 152, 92],
    },
    events: {
      kind: "escalating",
      alertFrom: 200,
      alertGapStart: 62,
      alertGapEnd: 22,
      glitchFrom: 380,
      tableFreezeFrom: 450,
      matrixDarkFrom: 520,
    },
    loops: false,
  },
};
