/**
 * One data row per version. Add a colourway by copying a row, giving it a
 * new `id`, and changing its colours/parameters. Root.tsx registers one
 * composition per row.
 */

export type BaseRow = {
  id: string;
  durationInFrames: number;
  /** Loops wrap every time-based value at durationInFrames. */
  loop: boolean;
};

export type CloudRow = BaseRow & {
  kind: "clouds";
  story: "flight" | "sea";
  /** Primary raymarch steps. 96 = full quality. See README. */
  steps: number;
  sunElevationDeg: number;
  sunAzimuthDeg: number; // relative to the flight direction, + = right
  sunColor: string;
  sunIntensity: number;
  skyZenith: string;
  /** Sky colour at ~15 deg elevation. */
  skyMid: string;
  skyHorizon: string;
  ambientTop: string;
  ambientBottom: string;
  shadowTint: string;
  groundHaze: string;
  groundDark: string;
  groundLight: string;
  exposure: number;
};

export type RainbowRingsRow = BaseRow & {
  kind: "rainbowRings";
  spacing: number;
  ringsPerLoop: number;
  hold: number;
  /** Dark band colour per key hue (+ optional explicit light band). */
  keys: [string, string?][];
};

export type SunLeavesRow = BaseRow & {
  kind: "sunLeaves";
  leaves: string[];
  sun: string;
  shadow: string;
  backdrop: string;
  seed: number;
};

export type DataGridRow = BaseRow & {
  kind: "dataGrid";
  bgTop: string;
  bgBottom: string;
  line: string;
  tag: string;
  seed: number;
};

export type RippleRingsRow = BaseRow & {
  kind: "rippleRings";
  source: [number, number]; // fraction across, fraction down
  wavelength: number; // fraction of frame width
  wavesPerLoop: number;
  dimple: [number, number]; // cell size, fraction of frame width
  base: string;
  highlight: string;
  trough: string;
};

export type Row =
  | CloudRow
  | RainbowRingsRow
  | SunLeavesRow
  | DataGridRow
  | RippleRingsRow;

const DAY_CLOUDS: Omit<CloudRow, "id" | "story" | "durationInFrames" | "loop"> = {
  kind: "clouds",
  steps: 96,
  sunElevationDeg: 55,
  sunAzimuthDeg: -128,
  sunColor: "#FFF6EA",
  sunIntensity: 12.0,
  skyZenith: "#0A3E9C",
  skyMid: "#5596D6",
  skyHorizon: "#B2D0EC",
  ambientTop: "#8AA9D6",
  ambientBottom: "#5A6880",
  shadowTint: "#6F7F9C",
  groundHaze: "#5A6E88",
  groundDark: "#1A2638",
  groundLight: "#465866",
  exposure: 0.78,
};

export const ROWS: Row[] = [
  {
    ...DAY_CLOUDS,
    id: "CloudFlight_Day",
    story: "flight",
    durationInFrames: 450,
    loop: false,
  },
  {
    ...DAY_CLOUDS,
    id: "CloudFlight_Sunset",
    story: "flight",
    durationInFrames: 450,
    loop: false,
    sunElevationDeg: 6,
    sunAzimuthDeg: 30,
    sunColor: "#FF9440",
    sunIntensity: 14.0,
    skyZenith: "#173E8A",
    skyMid: "#5B78BC",
    skyHorizon: "#F4A45A",
    ambientTop: "#4E5A9C",
    ambientBottom: "#5A3E6C",
    shadowTint: "#6E5A9A",
    groundHaze: "#5A6088",
    groundDark: "#1C2240",
    groundLight: "#363C60",
    exposure: 0.9,
  },
  {
    ...DAY_CLOUDS,
    id: "CloudSea_Loop",
    story: "sea",
    durationInFrames: 600,
    loop: true,
  },
  {
    kind: "rainbowRings",
    id: "RainbowRings_Spectrum",
    durationInFrames: 600,
    loop: true,
    spacing: 0.088,
    ringsPerLoop: 12,
    hold: 0.45,
    keys: [
      ["#8410D6", "#9C30EA"], // purple
      ["#2C1EDE", "#4038F2"], // indigo
      ["#0F4EAA", "#1D62C0"], // blue
      ["#12800E", "#22961A"], // green
      ["#6EB410", "#86C826"], // lime
      ["#D6B600", "#E9CC12"], // yellow
      ["#E68C08", "#F4A21E"], // orange
      ["#D4001C", "#FF1C40"], // red
      ["#C8005A", "#EC1A78"], // magenta
    ],
  },
  {
    kind: "sunLeaves",
    id: "SunLeaves_Summer",
    durationInFrames: 600,
    loop: true,
    leaves: ["#3A7A2A", "#62962E", "#8AB83A", "#B0C848", "#D8E05A"],
    sun: "#FFFCE8",
    shadow: "#0C260A",
    backdrop: "#2E6A1C",
    seed: 1054726244,
  },
  {
    kind: "sunLeaves",
    id: "SunLeaves_Autumn",
    durationInFrames: 600,
    loop: true,
    // Order matters: the last entries are the backlit/highlight colours; the
    // late green sits first so it only appears among shaded leaves.
    leaves: ["#7A9A30", "#A83A1A", "#E8781A", "#E8781A", "#F0A830"],
    sun: "#FFE8B0",
    shadow: "#3A160A",
    backdrop: "#8A4A18",
    seed: 1054726245,
  },
  {
    kind: "dataGrid",
    id: "DataGrid_Teal",
    durationInFrames: 600,
    loop: true,
    bgTop: "#000000",
    bgBottom: "#02080A",
    line: "#3AD8C8",
    tag: "#C8FFF4",
    seed: 1006851679,
  },
  {
    kind: "rippleRings",
    id: "RippleRings_Blue",
    durationInFrames: 600,
    loop: true,
    source: [0.9, 0.76],
    wavelength: 0.088,
    wavesPerLoop: 10,
    dimple: [0.041, 0.031],
    base: "#0018E8",
    highlight: "#6AA8FF",
    trough: "#00000A",
  },
];
