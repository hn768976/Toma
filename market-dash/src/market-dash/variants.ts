// The single source of truth for every colour and every year in the piece.
// No hex literal and no year string exists anywhere else in the codebase —
// a new variant is a new entry here and nothing more.

export type VariantName = "blue" | "green" | "night";

/** How the continents are drawn behind the charts. */
export type MapMode = "filled" | "dotted" | "outline";

/** How the row of bars along the bottom behaves. */
export type BarMode = "dense" | "sparse" | "descending";

/** Which way the line series travel over the timeline. */
export type Direction = "up" | "down";

export type Palette = {
  backgroundDeep: string;
  backgroundWash: string;
  /** Land ink: the fill, the dots or the outline stroke depending on mapMode. */
  mapInk: string;
  gridLine: string;
  /** Ordered top band first: index 0 is the topmost, brightest, most volatile. */
  series: readonly string[];
  barBase: string;
  barBright: string;
  rail: string;
  textPale: string;
  textBright: string;
};

export type Timeline = {
  startYear: number;
  /** 1-4. */
  startQuarter: number;
  endYear: number;
  endQuarter: number;
};

export type Variant = {
  palette: Palette;
  mapMode: MapMode;
  seriesCount: number;
  /** Stroke width in 4K pixels. */
  seriesWidth: number;
  /** Bloom radius in 4K pixels for the line pass. */
  seriesGlow: number;
  direction: Direction;
  timeline: Timeline;
  bars: {
    mode: BarMode;
    /** How many bars stand in the row once the timeline has fully advanced. */
    count: number;
    /** Fraction of each slot left empty between neighbouring bars. */
    gap: number;
  };
  /**
   * A mood wash that grows behind the composition as the series fall.
   * Absent (null) unless the variant declines.
   */
  moodWash: string | null;
};

export const VARIANTS: Record<VariantName, Variant> = {
  blue: {
    palette: {
      backgroundDeep: "#061428",
      backgroundWash: "#0F3050",
      mapInk: "#1A4A6B",
      gridLine: "#14385C",
      series: ["#F5A03F", "#4FD4F5", "#F58FB4"],
      barBase: "#3F8FD4",
      barBright: "#7FC4F0",
      rail: "#E85FC4",
      textPale: "#A8C8E8",
      textBright: "#E8F4FF",
    },
    mapMode: "filled",
    seriesCount: 3,
    seriesWidth: 5,
    seriesGlow: 26,
    direction: "up",
    timeline: { startYear: 2026, startQuarter: 1, endYear: 2030, endQuarter: 4 },
    bars: { mode: "dense", count: 22, gap: 0.28 },
    moodWash: null,
  },

  green: {
    palette: {
      backgroundDeep: "#02140C",
      backgroundWash: "#06381E",
      mapInk: "#1A5C33",
      gridLine: "#0F4022",
      series: ["#C4F52E", "#4FE8A8", "#2E9F8F", "#7FC49F", "#A8E8C4"],
      barBase: "#3FB86A",
      barBright: "#8FF5B0",
      rail: "#F5C43F",
      textPale: "#A8E8C4",
      textBright: "#E8FFF0",
    },
    mapMode: "dotted",
    seriesCount: 5,
    // Five lines clog the frame at v1's weight, so both the stroke and the
    // bloom come down a step.
    seriesWidth: 4,
    seriesGlow: 18,
    direction: "up",
    timeline: { startYear: 2015, startQuarter: 1, endYear: 2025, endQuarter: 4 },
    bars: { mode: "sparse", count: 12, gap: 0.52 },
    moodWash: null,
  },

  night: {
    palette: {
      backgroundDeep: "#0A0612",
      backgroundWash: "#241848",
      mapInk: "#3A2A6B",
      gridLine: "#1E1440",
      series: ["#FF5C6B", "#9B7FE8"],
      barBase: "#6F4FC4",
      barBright: "#B89FF5",
      rail: "#FF7A8F",
      textPale: "#B8A8E8",
      textBright: "#F0E8FF",
    },
    mapMode: "outline",
    seriesCount: 2,
    // Only two lines here, so the frame can carry — and needs — the weight.
    seriesWidth: 7,
    seriesGlow: 30,
    direction: "down",
    timeline: { startYear: 2020, startQuarter: 1, endYear: 2024, endQuarter: 4 },
    bars: { mode: "descending", count: 16, gap: 0.34 },
    moodWash: "#FF3040",
  },
};

export const quarterCount = (t: Timeline) =>
  (t.endYear - t.startYear) * 4 + (t.endQuarter - t.startQuarter) + 1;
