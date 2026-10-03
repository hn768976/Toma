/**
 * One data row per version. Root.tsx turns every row into a <Composition>.
 * To add a version, copy a row, give it a new `id`, and change its props
 * (colours, camera mode, word). Nothing else needs to change.
 */

export type DataCenterProps = {
  /** "sideStreaks": side dolly along one row; "aisleFibres": forward down the aisle. */
  mode: "sideStreaks" | "aisleFibres";
  background: string;
  /** Light streams / fibres. */
  stream: string;
  streamHot: string;
  ledGreen: string;
  ledBlue: string;
  ceiling: string;
  fog: string;
  loopCheck?: boolean;
};

export type RisingArrowsProps = {
  bgTop: string;
  bgBottom: string;
  band: string;
  arrow: string;
  arrowHot: string;
  loopCheck?: boolean;
};

export type PadlockGridProps = {
  background: string;
  padlock: string;
  ring: string;
  floor: string;
  line: string;
  loopCheck?: boolean;
};

export type CloudHudProps = {
  background: string;
  cyan: string;
  amber: string;
};

export type AiCubeProps = {
  word: string;
  glass: string;
  trace: string;
  background: string;
  glowAccents: string[];
};

type Row<L extends string, P> = {
  id: string;
  look: L;
  durationInFrames: number;
  /** Loops get a 601-frame variant via `loopCheck: true` for the seam test. */
  loop: boolean;
  props: P;
};

export type VersionRow =
  | Row<"datacenter", DataCenterProps>
  | Row<"arrows", RisingArrowsProps>
  | Row<"padlock", PadlockGridProps>
  | Row<"cloudhud", CloudHudProps>
  | Row<"aicube", AiCubeProps>;

export const VERSIONS: VersionRow[] = [
  {
    id: "DataCenter-SideStreaks",
    look: "datacenter",
    durationInFrames: 600,
    loop: true,
    props: {
      mode: "sideStreaks",
      background: "#02060f",
      stream: "#0a9cff",
      streamHot: "#9fe6ff",
      ledGreen: "#3dff8a",
      ledBlue: "#3aa0ff",
      ceiling: "#e8f3ff",
      fog: "#0d3a78",
    },
  },
  {
    id: "DataCenter-AisleFibres",
    look: "datacenter",
    durationInFrames: 600,
    loop: true,
    props: {
      mode: "aisleFibres",
      background: "#01040b",
      stream: "#18b4ff",
      streamHot: "#a8f6ff",
      ledGreen: "#45f5d8",
      ledBlue: "#5fd0ff",
      ceiling: "#9fc4ff",
      fog: "#0c4470",
    },
  },
  {
    id: "RisingArrows-Blue",
    look: "arrows",
    durationInFrames: 600,
    loop: true,
    props: {
      bgTop: "#0A1A5A",
      bgBottom: "#05103A",
      band: "#0a6cff",
      arrow: "#4FB8FF",
      arrowHot: "#FFFFFF",
    },
  },
  {
    id: "RisingArrows-Green",
    look: "arrows",
    durationInFrames: 600,
    loop: true,
    props: {
      bgTop: "#04281C",
      bgBottom: "#021810",
      band: "#16b866",
      arrow: "#3FE88A",
      arrowHot: "#DFFFEC",
    },
  },
  {
    id: "PadlockGrid",
    look: "padlock",
    durationInFrames: 600,
    loop: true,
    props: {
      background: "#0c2c58",
      padlock: "#9FD0F0",
      ring: "#00b8ff",
      floor: "#0a1e48",
      line: "#3bb4ff",
    },
  },
  {
    id: "CloudHUD",
    look: "cloudhud",
    durationInFrames: 450,
    loop: false,
    props: {
      background: "#06205A",
      cyan: "#5FE8FF",
      amber: "#FFB347",
    },
  },
  {
    id: "AICube-Blue",
    look: "aicube",
    durationInFrames: 360,
    loop: false,
    props: {
      word: "AI",
      glass: "#7FD0FF",
      trace: "#4FE8FF",
      background: "#06204A",
      glowAccents: ["#ffffff", "#ffc061", "#4fe8ff"],
    },
  },
  {
    id: "AICube-Violet",
    look: "aicube",
    durationInFrames: 360,
    loop: false,
    props: {
      word: "AI",
      glass: "#B89CFF",
      trace: "#FF6FD8",
      background: "#16083A",
      glowAccents: ["#ffffff", "#ffc061", "#ff6fd8"],
    },
  },
];
